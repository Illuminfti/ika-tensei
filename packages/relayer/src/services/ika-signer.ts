/**
 * IKA dWallet signing orchestration
 * 
 * Implements the 2PC-MPC signing flow:
 * 1. requestGlobalPresign (TX1) → poll for MPC completion
 * 2. verifyPresignCap + approveMessage + requestSign (TX2) → poll for signature
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import {
  IkaClient,
  IkaTransaction,
  Curve,
  Hash,
  SignatureAlgorithm,
  UserShareEncryptionKeys,
  getNetworkConfig,
} from '@ika.xyz/sdk';
import { type Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

export interface SigningResult {
  signature: Uint8Array;
  signatureHex: string;
  txDigest: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000; // 2 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilState<T>(
  fetcher: () => Promise<T | null>,
  label: string,
  timeoutMs: number,
  logger: Logger,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const result = await fetcher();
      if (result) return result;
    } catch {
      // Not ready yet
    }
    logger.debug(`Polling ${label}: waiting...`);
    await sleep(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs / 1000}s`);
}

export interface IKASigner {
  initialize(): Promise<void>;
  signMessage(messageHash: Uint8Array): Promise<SigningResult>;
  isInitialized(): boolean;
}

export function createIKASigner(
  config: RelayerConfig,
  logger: Logger,
): IKASigner {
  const { 
    suiRpcUrl, 
    ikaNetwork, 
    suiKeypair, 
    dwalletCapId, 
    dwalletId, 
    encryptedShareId,
  } = config;

  let ikaClient: IkaClient;
  let userShareKeys: UserShareEncryptionKeys;
  let initialized = false;

  async function initialize(): Promise<void> {
    if (initialized) return;

    logger.info('Initializing IKA signer...');

    const ikaConfig = getNetworkConfig(ikaNetwork as any);
    const suiClient = new SuiClient({ url: suiRpcUrl });

    ikaClient = new IkaClient({ suiClient, config: ikaConfig });
    await ikaClient.initialize();

    // Create user share encryption keys from Sui secret key
    const secretKey = suiKeypair.getSecretKey();
    const seed = secretKey.slice(0, 32);
    userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(
      Uint8Array.from(seed),
      Curve.ED25519,
    );

    initialized = true;
    logger.info(`IKA signer initialized: address=${suiKeypair.getPublicKey().toSuiAddress()}`);
  }

  async function signMessage(messageHash: Uint8Array): Promise<SigningResult> {
    if (!initialized) {
      throw new Error('IKA signer not initialized');
    }

    const suiClient = new SuiClient({ url: suiRpcUrl });
    const senderAddress = suiKeypair.getPublicKey().toSuiAddress();

    logger.info(`Starting IKA 2PC-MPC sign: dwalletId=${dwalletId}, messageHash=${Buffer.from(messageHash).toString('hex').slice(0,16)}...`);

    // Step 1: Get encryption key and coins
    const encKey = await ikaClient.getLatestNetworkEncryptionKey();
    const coins = await suiClient.getCoins({ 
      owner: senderAddress,
    });

    // Get IKA coin type
    const ikaConfig = getNetworkConfig(config.ikaNetwork as any);
    const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
    const ikaCoins = coins.data.filter(c => c.coinType === ikaType);
    
    if (ikaCoins.length === 0) {
      throw new Error('No IKA coins found for signing');
    }

    // === TX1: Request Global Presign ===
    logger.debug('TX1: Requesting global presign...');
    
    const tx1 = new Transaction();
    tx1.setSender(senderAddress);
    tx1.setGasBudget(500_000_000);

    const ikaTx1 = new IkaTransaction({
      ikaClient,
      transaction: tx1,
      userShareEncryptionKeys: userShareKeys,
    });

    const presignCap = ikaTx1.requestGlobalPresign({
      dwalletNetworkEncryptionKeyId: encKey.id,
      curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      ikaCoin: tx1.object(ikaCoins[0].coinObjectId),
      suiCoin: tx1.gas,
    });

    tx1.transferObjects([presignCap], senderAddress);

    const tx1Result = await suiClient.signAndExecuteTransaction({
      transaction: tx1,
      signer: suiKeypair,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
    });

    if (tx1Result.effects?.status?.status !== 'success') {
      throw new Error(`Presign TX failed: ${tx1Result.effects?.status?.error}`);
    }

    const tx1Digest = tx1Result.digest;
    logger.info(`Presign TX submitted: ${tx1Digest}`);

    // Extract presign session ID from events or object changes
    let presignSessionId: string | null = null;
    let presignCapId: string | null = null;

    for (const change of (tx1Result.objectChanges || [])) {
      if (change.type === 'created') {
        const type = change.objectType?.split('::').pop() || '';
        if (type.includes('UnverifiedPresignCap')) {
          presignCapId = change.objectId;
        }
        if (type.includes('PresignSession')) {
          presignSessionId = change.objectId;
        }
      }
    }

    for (const event of (tx1Result.events || [])) {
      if ((event.parsedJson as any)?.presign_session_id) {
        presignSessionId = (event.parsedJson as any).presign_session_id;
      }
    }

    if (!presignSessionId) {
      // Try to get from owned objects
      const owned = await suiClient.getOwnedObjects({
        owner: senderAddress,
        options: { showType: true },
        filter: { StructType: `${ikaConfig.packages.ikaPackage}::presign::PresignSession` },
      });
      
      if (owned.data.length > 0) {
        presignSessionId = owned.data[0].data?.objectId || null;
      }
    }

    if (!presignSessionId) {
      throw new Error('Could not find presign session ID');
    }

    logger.debug(`Presign Session: ${presignSessionId}`);

    // Wait for presign completion
    logger.info('Waiting for presign MPC completion...');
    
    const presign = await pollUntilState(
      () => ikaClient.getPresignInParticularState(presignSessionId, 'Completed'),
      'presign completion',
      POLL_TIMEOUT_MS,
      logger,
    );
    
    logger.info('Presign completed!');

    // === TX2: Sign ===
    logger.debug('TX2: Signing message...');

    const dwallet = await ikaClient.getDWallet(dwalletId);
    const encShare = await ikaClient.getEncryptedUserSecretKeyShare(encryptedShareId);
    const coins2 = await suiClient.getCoins({ owner: senderAddress });

    const tx2 = new Transaction();
    tx2.setSender(senderAddress);
    tx2.setGasBudget(500_000_000);

    const ikaTx2 = new IkaTransaction({
      ikaClient,
      transaction: tx2,
      userShareEncryptionKeys: userShareKeys,
    });

    // Verify presign capability
    const verifiedPresignCap = ikaTx2.verifyPresignCap({ presign });

    // Approve message
    const messageApproval = ikaTx2.approveMessage({
      dWalletCap: dwalletCapId,
      curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      hashScheme: Hash.SHA512,
      message: Array.from(messageHash) as any,
    });

    // Request sign
    await ikaTx2.requestSign({
      dWallet: dwallet as any,
      messageApproval,
      hashScheme: Hash.SHA512,
      verifiedPresignCap,
      presign,
      encryptedUserSecretKeyShare: encShare,
      message: Array.from(messageHash) as any,
      signatureScheme: SignatureAlgorithm.EdDSA,
      ikaCoin: tx2.object(coins2.data[0].coinObjectId),
      suiCoin: tx2.gas,
    });

    const tx2Result = await suiClient.signAndExecuteTransaction({
      transaction: tx2,
      signer: suiKeypair,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
    });

    if (tx2Result.effects?.status?.status !== 'success') {
      throw new Error(`Sign TX failed: ${tx2Result.effects?.status?.error}`);
    }

    const tx2Digest = tx2Result.digest;
    logger.info(`Sign TX submitted: ${tx2Digest}`);

    // Extract sign session ID
    let signSessionId: string | null = null;

    for (const change of (tx2Result.objectChanges || [])) {
      if (change.type === 'created') {
        const type = change.objectType?.split('::').pop() || '';
        if (type.includes('SignSession')) {
          signSessionId = change.objectId;
        }
      }
    }

    for (const event of (tx2Result.events || [])) {
      if ((event.parsedJson as any)?.sign_session_id) {
        signSessionId = (event.parsedJson as any).sign_session_id;
      }
    }

    if (!signSessionId) {
      // Try to find SignOutput directly
      const owned = await suiClient.getOwnedObjects({
        owner: senderAddress,
        options: { showContent: true, showType: true },
      });

      for (const obj of (owned.data || [])) {
        const type = obj.data?.type?.split('::').pop() || '';
        if (type.includes('SignOutput') || type.includes('SignSession')) {
          const fields = (obj.data?.content as any)?.fields;
          if (fields?.signature && Array.isArray(fields.signature) && fields.signature.length >= 64) {
            // Found the signature!
            const sigBytes = Buffer.from(fields.signature);
            logger.info(`Signature obtained: ${sigBytes.toString('hex').slice(0, 32)}...`);
            
            return {
              signature: new Uint8Array(sigBytes),
              signatureHex: sigBytes.toString('hex'),
              txDigest: tx2Digest,
            };
          }
        }
      }
      throw new Error('Could not find sign session ID or signature');
    }

    // Wait for signature
    logger.info('Waiting for signature MPC completion...');
    
    const signOutput = await pollUntilState(
      () => ikaClient.getSignInParticularState(signSessionId, Curve.ED25519, SignatureAlgorithm.EdDSA, 'Completed'),
      'signature completion',
      POLL_TIMEOUT_MS,
      logger,
    );

    // Extract signature from sign output
    const completedState = (signOutput as any).state?.Completed;
    const sigArray = completedState?.signature || (signOutput as any).signature;
    
    if (!sigArray || !Array.isArray(sigArray) || sigArray.length < 64) {
      throw new Error('Signature not found in sign output');
    }

    const sigBytes = Buffer.from(sigArray);
    logger.info(`Signature obtained: ${sigBytes.toString('hex').slice(0, 32)}...`);

    return {
      signature: new Uint8Array(sigBytes),
      signatureHex: sigBytes.toString('hex'),
      txDigest: tx2Digest,
    };
  }

  return {
    initialize,
    signMessage,
    isInitialized: () => initialized,
  };
}
