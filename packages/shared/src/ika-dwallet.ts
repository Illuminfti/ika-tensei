/**
 * IKA dWallet integration for Ika Tensei v3
 * 
 * Frontend/relayer compatible module for dWallet creation (DKG) and signing.
 * No filesystem imports - uses passed config and storage interface.
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { PublicKey } from '@solana/web3.js';
import {
  IkaClient,
  IkaTransaction,
  Curve,
  Hash,
  SignatureAlgorithm,
  UserShareEncryptionKeys,
  getNetworkConfig,
  prepareDKGAsync,
  createRandomSessionIdentifier,
  publicKeyFromDWalletOutput,
  parseSignatureFromSignOutput,
} from '@ika.xyz/sdk';

/**
 * DKG output cache entry
 */
export interface DKGOutput {
  userPublicOutput: Uint8Array;
  userSecretKeyShare: Uint8Array;
}

/**
 * dWallet reference after creation
 */
export interface DWalletRef {
  dwalletId: string;
  dwalletCapId: string;
  curve: 'ED25519' | 'SECP256K1';
  publicKey: Uint8Array;
  solanaAddress: string;
}

/**
 * Configuration for IkaDWalletService
 */
export interface IkaDWalletConfig {
  /** Sui RPC URL */
  suiRpcUrl: string;
  /** IKA network name (e.g., 'mainnet', 'testnet', 'devnet') */
  ikaNetwork: string;
  /** Sui keypair bytes (secret key) */
  suiKeypairBytes: Uint8Array;
  /** Optional storage for DKG cache */
  dkgStorage?: IkaDWalletStorage;
  /** Optional logger */
  logger?: IkaDWalletLogger;
}

/**
 * Storage interface for DKG cache (implement to persist across sessions)
 */
export interface IkaDWalletStorage {
  /** Get cached DKG output for a dWallet cap ID */
  get(key: string): Promise<DKGOutput | null>;
  /** Store DKG output for a dWallet cap ID */
  set(key: string, value: DKGOutput): Promise<void>;
  /** Remove cached DKG output */
  delete(key: string): Promise<void>;
  /** List all cached keys */
  keys(): Promise<string[]>;
}

/**
 * Logger interface - simplified
 */
export interface IkaDWalletLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * Default no-op logger
 */
const noopLogger: IkaDWalletLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * Map our curve type to IKA SDK curve
 */
function toIkaCurve(curve: 'ED25519' | 'SECP256K1'): Curve {
  return curve === 'ED25519' ? Curve.ED25519 : Curve.SECP256K1;
}

/**
 * Map our curve type to IKA SDK signature algorithm
 */
function toSignatureAlgorithm(curve: 'ED25519' | 'SECP256K1'): SignatureAlgorithm {
  return curve === 'ED25519' ? SignatureAlgorithm.EdDSA : SignatureAlgorithm.ECDSASecp256k1;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polling helper with timeout
 */
async function pollUntilState<T>(
  fetcher: () => Promise<T>,
  label: string,
  timeoutMs: number,
  intervalMs: number,
  logger: IkaDWalletLogger,
): Promise<T> {
  const safeInterval = Math.max(intervalMs, 100);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const result = await fetcher();
      if (result) return result;
    } catch {
      // Not ready yet, continue polling
      logger.debug(`Polling ${label}: not ready`);
    }
    await sleep(safeInterval);
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs / 1000}s`);
}

/**
 * IKA dWallet Service for Ika Tensei v3
 * 
 * Provides dWallet creation via DKG and message signing for the NFT reincarnation protocol.
 * Supports both Ed25519 (Solana-compatible) and Secp256k1 (Ethereum/Bitcoin-compatible) curves.
 */
export class IkaDWalletService {
  private ikaClient: IkaClient | null = null;
  private suiClient: SuiClient | null = null;
  private suiKeypair: Ed25519Keypair | null = null;
  private userShareKeys: UserShareEncryptionKeys | null = null;
  private initialized = false;
  private createDWalletLock = false;
  private config: IkaDWalletConfig;
  private logger: IkaDWalletLogger;
  
  // In-memory DKG cache (supplemented by storage)
  private dkgCache = new Map<string, DKGOutput>();

  // Constants
  
  private readonly DEFAULT_POLL_INTERVAL_MS = 2000;
  private readonly DEFAULT_POLL_TIMEOUT_MS = 120_000;
  private readonly MIN_SECRET_KEY_LENGTH = 32;

  constructor(config: IkaDWalletConfig) {
    if (!config.suiRpcUrl) {
      throw new Error('suiRpcUrl is required');
    }
    if (!config.ikaNetwork) {
      throw new Error('ikaNetwork is required');
    }
    if (!config.suiKeypairBytes || config.suiKeypairBytes.length < this.MIN_SECRET_KEY_LENGTH) {
      throw new Error(`suiKeypairBytes must be at least ${this.MIN_SECRET_KEY_LENGTH} bytes`);
    }

    this.config = config;
    this.logger = config.logger ?? noopLogger;
  }

  /**
   * Initialize the IKA and Sui clients
   * Idempotent - safe to call multiple times
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.info('IkaDWalletService already initialized, skipping');
      return;
    }

    const { suiRpcUrl, ikaNetwork, suiKeypairBytes } = this.config;

    // Get IKA network config
    const ikaConfig = getNetworkConfig((ikaNetwork as any));
    
    // Initialize Sui client
    this.suiClient = new SuiClient({ url: suiRpcUrl });
    
    // Initialize IKA client
    this.ikaClient = new IkaClient({ suiClient: this.suiClient, config: ikaConfig });
    await this.ikaClient.initialize();

    // Load Sui keypair
    this.suiKeypair = Ed25519Keypair.fromSecretKey(suiKeypairBytes);

    // Create user share encryption keys from Sui secret key
    const secretKey = this.suiKeypair.getSecretKey();
    if (secretKey.length < this.MIN_SECRET_KEY_LENGTH) {
      throw new Error(`Sui secret key too short: ${secretKey.length} bytes, need ${this.MIN_SECRET_KEY_LENGTH}`);
    }
    const seed = secretKey.slice(0, 32);
    this.userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(
      Uint8Array.from(seed),
      Curve.ED25519,
    );

    // Load persisted DKG cache if storage provided
    if (this.config.dkgStorage) {
      try {
        const keys = await this.config.dkgStorage.keys();
        for (const key of keys) {
          const cached = await this.config.dkgStorage.get(key);
          if (cached) {
            this.dkgCache.set(key, cached);
          }
        }
        this.logger.info(`Loaded DKG cache from storage: ${this.dkgCache.size} dWallets`);
      } catch (err) {
        this.logger.warn(`Failed to load DKG cache from storage: ${err}`);
      }
    }

    this.initialized = true;
    this.logger.info(`IkaDWalletService initialized: network=${ikaNetwork}, address=${this.suiKeypair.getPublicKey().toSuiAddress()}, cached=${this.dkgCache.size}`);
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.ikaClient || !this.suiClient || !this.suiKeypair || !this.userShareKeys) {
      throw new Error('IkaDWalletService not initialized. Call initialize() first.');
    }
  }

  /**
   * Create a dWallet via IKA 2PC-MPC DKG
   * 
   * @param curve - Cryptographic curve ('ED25519' for Solana, 'SECP256K1' for Ethereum/Bitcoin)
   * @returns DWalletRef with dWallet ID, cap ID, public key, and Solana address
   */
  async createDWallet(curve: 'ED25519' | 'SECP256K1'): Promise<DWalletRef> {
    this.ensureInitialized();

    if (this.createDWalletLock) {
      throw new Error('createDWallet already in progress. Wait for it to complete.');
    }
    this.createDWalletLock = true;

    try {
      return await this._createDWalletImpl(curve);
    } finally {
      this.createDWalletLock = false;
    }
  }

  /**
   * Internal dWallet creation implementation
   */
  private async _createDWalletImpl(curve: 'ED25519' | 'SECP256K1'): Promise<DWalletRef> {
    const ikaClient = this.ikaClient!;
    const suiClient = this.suiClient!;
    const suiKeypair = this.suiKeypair!;
    const userShareKeys = this.userShareKeys!;
    const senderAddress = suiKeypair.getPublicKey().toSuiAddress();

    const ikaCurve = toIkaCurve(curve);

    this.logger.info(`Starting dWallet DKG with ${curve} curve`);

    // Step 1: Prepare DKG
    const sessionBytes = createRandomSessionIdentifier();
    const dkgInput = await prepareDKGAsync(
      ikaClient,
      ikaCurve,
      userShareKeys,
      sessionBytes,
      senderAddress,
    );
    this.logger.info('DKG input prepared');

    // Step 2: Build and execute DKG transaction
    const tx = new Transaction();
    const ikaTx = new IkaTransaction({
      ikaClient,
      transaction: tx,
      userShareEncryptionKeys: userShareKeys,
    });

    const sessionId = ikaTx.registerSessionIdentifier(sessionBytes);
    const encKey = await ikaClient.getLatestNetworkEncryptionKey();

    await ikaTx.requestDWalletDKG({
      curve: ikaCurve,
      dkgRequestInput: dkgInput,
      ikaCoin: tx.gas,
      suiCoin: tx.gas,
      sessionIdentifier: sessionId,
      dwalletNetworkEncryptionKeyId: encKey.id,
    });

    const txResult = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: suiKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });

    if (txResult.effects?.status?.status !== 'success') {
      throw new Error(`DKG transaction failed: ${txResult.effects?.status?.error}`);
    }
    this.logger.info(`DKG transaction executed: ${txResult.digest}`);

    // Step 3: Find DWalletCap
    const created = txResult.objectChanges?.filter(
      (c: any) => c.type === 'created' && c.objectType?.includes('DWalletCap')
    ) || [];
    let dwalletCapId = (created[0] as any)?.objectId;

    if (!dwalletCapId) {
      const caps = await ikaClient.getOwnedDWalletCaps(senderAddress);
      if (!caps.dWalletCaps.length) throw new Error('No DWalletCap found after DKG');
      dwalletCapId = caps.dWalletCaps[caps.dWalletCaps.length - 1].id?.id;
    }
    this.logger.info(`DWalletCap created: ${dwalletCapId}`);

    // Step 4: Wait for Active state
    const dwallet = await pollUntilState(
      () => ikaClient.getDWalletInParticularState(dwalletCapId, 'Active'),
      'dWallet DKG completion',
      this.DEFAULT_POLL_TIMEOUT_MS,
      this.DEFAULT_POLL_INTERVAL_MS,
      this.logger,
    );
    this.logger.info('dWallet reached Active state');

    const activeState = (dwallet as any).state?.Active;
    const publicOutputBytes = activeState?.public_output
      ? Uint8Array.from(activeState.public_output)
      : new Uint8Array();

    // Step 5: Accept encrypted user share
    const encShareTableId = (dwallet as any).encrypted_user_secret_key_shares?.id?.id;
    if (encShareTableId) {
      try {
        const acceptTx = new Transaction();
        const acceptIkaTx = new IkaTransaction({
          ikaClient,
          transaction: acceptTx,
          userShareEncryptionKeys: userShareKeys,
        });
        const encShare = await ikaClient.getEncryptedUserSecretKeyShare(encShareTableId);
        await acceptIkaTx.acceptEncryptedUserShare({
          dWallet: dwallet as any,
          userPublicOutput: dkgInput.userPublicOutput,
          encryptedUserSecretKeyShareId: encShare.id?.id || encShareTableId,
        });
        await suiClient.signAndExecuteTransaction({ transaction: acceptTx, signer: suiKeypair });
        this.logger.info('Encrypted user share accepted');
      } catch (err) {
        this.logger.warn(`Failed to accept encrypted user share (may already be accepted): ${err}`);
      }
    }

    // Step 6: Extract public key
    let publicKeyBytes: Uint8Array;
    let solanaAddress: string;

    if (curve === 'ED25519') {
      publicKeyBytes = await publicKeyFromDWalletOutput(Curve.ED25519, publicOutputBytes);
      solanaAddress = new PublicKey(publicKeyBytes).toBase58();
    } else {
      // For SECP256K1, the public key format is different
      // Extract uncompressed format and convert to compressed for Ethereum
      publicKeyBytes = publicOutputBytes;
      // SECP256K1 address would be derived differently (keccak256 of compressed pubkey)
      solanaAddress = ''; // Not used for SECP256K1 in current flow
    }

    // Persist DKG output
    const dkgOutput: DKGOutput = {
      userPublicOutput: dkgInput.userPublicOutput,
      userSecretKeyShare: dkgInput.userSecretKeyShare,
    };
    this.dkgCache.set(dwalletCapId, dkgOutput);

    // Save to storage if available
    if (this.config.dkgStorage) {
      try {
        await this.config.dkgStorage.set(dwalletCapId, dkgOutput);
      } catch (err) {
        this.logger.warn(`Failed to persist DKG cache to storage: ${err}`);
      }
    }

    this.logger.info(`dWallet created: dwalletId=${(dwallet as any).id?.id}, dwalletCapId=${dwalletCapId}, solanaAddress=${solanaAddress}`);

    return {
      dwalletId: (dwallet as any).id?.id || '',
      dwalletCapId,
      curve,
      publicKey: publicKeyBytes,
      solanaAddress,
    };
  }

  /**
   * Sign a message using the dWallet 2PC-MPC
   * 
   * @param dwalletRef - The dWallet reference from createDWallet
   * @param message - Message bytes to sign
   * @returns Signature bytes
   */
  async signMessage(dwalletRef: DWalletRef, message: Uint8Array): Promise<Uint8Array> {
    this.ensureInitialized();

    if (!message || message.length === 0) {
      throw new Error('message cannot be empty');
    }

    if (message.length > 1232) {
      this.logger.warn(`Message exceeds Solana tx size limit (1232 bytes): ${message.length}`);
    }

    const ikaClient = this.ikaClient!;
    const suiClient = this.suiClient!;
    const suiKeypair = this.suiKeypair!;
    const userShareKeys = this.userShareKeys!;

    const ikaCurve = toIkaCurve(dwalletRef.curve);
    const sigAlgo = toSignatureAlgorithm(dwalletRef.curve);
    const hashScheme = dwalletRef.curve === 'ED25519' ? Hash.SHA512 : Hash.KECCAK256;

    this.logger.info(`Signing via IKA 2PC-MPC: dwalletId=${dwalletRef.dwalletId}, dwalletCapId=${dwalletRef.dwalletCapId}, curve=${dwalletRef.curve}, messageLen=${message.length}`);

    // Get dWallet
    const dwallet = await ikaClient.getDWallet(dwalletRef.dwalletCapId);

    // Step 1: Request presign
    const presignTx = new Transaction();
    const presignIkaTx = new IkaTransaction({
      ikaClient,
      transaction: presignTx,
      userShareEncryptionKeys: userShareKeys,
    });

    presignIkaTx.requestPresign({
      dWallet: dwallet as any,
      signatureAlgorithm: sigAlgo,
      ikaCoin: presignTx.gas,
      suiCoin: presignTx.gas,
    });

    const presignResult = await suiClient.signAndExecuteTransaction({
      transaction: presignTx,
      signer: suiKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    this.logger.info(`Presign requested: ${presignResult.digest}`);

    const presignCreated = presignResult.objectChanges?.filter(
      (c: any) => c.type === 'created' && c.objectType?.includes('PresignSession')
    ) || [];
    const presignId = (presignCreated[0] as any)?.objectId || dwalletRef.dwalletId;

    // Step 2: Wait for presign completion
    const presign = await pollUntilState(
      () => ikaClient.getPresignInParticularState(presignId, 'Completed'),
      'presign completion',
      this.DEFAULT_POLL_TIMEOUT_MS,
      this.DEFAULT_POLL_INTERVAL_MS,
      this.logger,
    );
    this.logger.info('Presign completed');

    // Step 3: Approve message and request sign
    const signTx = new Transaction();
    const signIkaTx = new IkaTransaction({
      ikaClient,
      transaction: signTx,
      userShareEncryptionKeys: userShareKeys,
    });

    const messageApproval = signIkaTx.approveMessage({
      dWalletCap: dwalletRef.dwalletCapId,
      curve: ikaCurve,
      signatureAlgorithm: sigAlgo,
      hashScheme,
      message,
    });

    const verifiedPresignCap = signIkaTx.verifyPresignCap({ presign });
    
    // Get cached DKG output for signing
    const dkgCache = this.dkgCache.get(dwalletRef.dwalletCapId);

    await signIkaTx.requestSign({
      dWallet: dwallet as any,
      messageApproval,
      hashScheme,
      verifiedPresignCap,
      presign,
      message,
      signatureScheme: sigAlgo,
      secretShare: dkgCache ? dkgCache.userSecretKeyShare : undefined,
      publicOutput: dkgCache ? dkgCache.userPublicOutput : undefined,
      ikaCoin: signTx.gas,
      suiCoin: signTx.gas,
    });

    const signResult = await suiClient.signAndExecuteTransaction({
      transaction: signTx,
      signer: suiKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    this.logger.info(`Sign request submitted: ${signResult.digest}`);

    const signCreated = signResult.objectChanges?.filter(
      (c: any) => c.type === 'created' && c.objectType?.includes('SignSession')
    ) || [];
    const signSessionId = (signCreated[0] as any)?.objectId || dwalletRef.dwalletId;

    // Step 4: Wait for signature
    const signOutput = await pollUntilState(
      () => ikaClient.getSignInParticularState(signSessionId, ikaCurve, sigAlgo, 'Completed'),
      'signature completion',
      this.DEFAULT_POLL_TIMEOUT_MS,
      this.DEFAULT_POLL_INTERVAL_MS,
      this.logger,
    );
    this.logger.info('Sign completed');

    // Step 5: Parse signature
    const completedState = (signOutput as any).state?.Completed;
    const rawSig = completedState?.signature
      ? Uint8Array.from(completedState.signature)
      : new Uint8Array();

    const signature = await parseSignatureFromSignOutput(ikaCurve, sigAlgo, rawSig);
    this.logger.info(`Signature parsed: length=${signature.length}`);

    return signature;
  }

  /**
   * Transfer dWallet capability to another address (e.g., SealVault)
   * 
   * @param dwalletCapId - The DWalletCap object ID to transfer
   * @param recipient - The recipient Sui address
   * @returns Transaction digest
   */
  async transferDWalletCap(dwalletCapId: string, recipient: string): Promise<string> {
    this.ensureInitialized();

    if (!dwalletCapId) {
      throw new Error('dwalletCapId is required');
    }
    if (!recipient) {
      throw new Error('recipient is required');
    }

    const suiClient = this.suiClient!;
    const suiKeypair = this.suiKeypair!;

    this.logger.info(`Transferring DWalletCap: dwalletCapId=${dwalletCapId}, recipient=${recipient}`);

    const tx = new Transaction();
    const capObject = tx.object(dwalletCapId);
    tx.transferObjects([capObject], tx.pure.address(recipient));

    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: suiKeypair,
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transfer failed: ${result.effects?.status?.error}`);
    }

    this.logger.info(`DWalletCap transferred: ${result.digest}`);
    return result.digest;
  }

  /**
   * Get the Sui address of the configured keypair
   */
  getSuiAddress(): string {
    this.ensureInitialized();
    return this.suiKeypair!.getPublicKey().toSuiAddress();
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get cached dWallet by cap ID
   */
  async getCachedDkgOutput(dwalletCapId: string): Promise<DKGOutput | null> {
    // Check memory cache first
    const cached = this.dkgCache.get(dwalletCapId);
    if (cached) return cached;

    // Check storage
    if (this.config.dkgStorage) {
      const stored = await this.config.dkgStorage.get(dwalletCapId);
      if (stored) {
        this.dkgCache.set(dwalletCapId, stored);
        return stored;
      }
    }

    return null;
  }

  /**
   * Clear all cached DKG outputs
   */
  async clearCache(): Promise<void> {
    this.dkgCache.clear();
    if (this.config.dkgStorage) {
      const keys = await this.config.dkgStorage.keys();
      for (const key of keys) {
        await this.config.dkgStorage.delete(key);
      }
    }
    this.logger.info('DKG cache cleared');
  }
}

/**
 * Derive Solana address from dWallet Ed25519 public key
 */
export function dwalletToSolanaAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${publicKey.length}, expected 32`);
  }
  return new PublicKey(publicKey).toBase58();
}
