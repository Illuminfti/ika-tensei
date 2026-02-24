/**
 * Ika Tensei v8 Relayer - Main Entry Point
 *
 * Four roles:
 * 1. API server — accepts seal requests, creates deposit dWallets via IKA SDK
 * 2. SealPending listener — watches SealPending events, triggers IKA signing
 * 3. SealSigned listener — watches SealSigned events, bridges to Solana
 * 4. Background maintenance — treasury balances, presign pool replenishment
 *
 * v8 changes from v7:
 * - Treasury-funded coordinator calls (DKG, presign, sign)
 * - Presign pool with FIFO allocation
 * - Full signing flow: SealPending → IKA 2PC-MPC → complete_seal → SealSigned
 * - Configurable SuiListener supports multiple event types
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { Keypair } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { IkaClient } from '@ika.xyz/sdk';
import { getNetworkConfig } from '@ika.xyz/sdk';
import express from 'express';
import cors from 'cors';
import { getConfig } from './config.js';
import { SuiListener } from './sui-listener.js';
import { SolanaSubmitter } from './solana-submitter.js';
import { DWalletCreator } from './dwallet-creator.js';
import { TreasuryManager } from './treasury-manager.js';
import { PresignPool } from './presign-pool.js';
import { SealSigner } from './seal-signer.js';
import { HealthServer } from './health.js';
import { logger } from './logger.js';
import type {
  SealSignedEvent,
  SealPendingEvent,
  ProcessedSeal,
  SealSession,
  StartSealRequest,
  ConfirmPaymentRequest,
} from './types.js';

/**
 * Relayer orchestrates the full seal flow:
 * - API for dWallet creation
 * - SealPending → IKA signing → complete_seal
 * - SealSigned → Solana minting
 * - Treasury + presign pool maintenance
 */
export class Relayer {
  private readonly sealSignedListener: SuiListener<SealSignedEvent>;
  private readonly sealPendingListener: SuiListener<SealPendingEvent>;
  private readonly solanaSubmitter: SolanaSubmitter;
  private readonly dwalletCreator: DWalletCreator;
  private readonly healthServer: HealthServer;
  private readonly relayerKeypair: Keypair;
  private readonly app: express.Application;
  private _isRunning = false;

  // New v8 services (initialized lazily in start())
  private treasuryManager?: TreasuryManager;
  private presignPool?: PresignPool;
  private sealSigner?: SealSigner;

  /** In-memory seal session tracker (production: use Redis or DB) */
  private readonly sessions = new Map<string, SealSession>();

  constructor() {
    this.sealSignedListener = new SuiListener<SealSignedEvent>('SealSigned');
    this.sealPendingListener = new SuiListener<SealPendingEvent>('SealPending');
    this.solanaSubmitter = new SolanaSubmitter();
    this.dwalletCreator = new DWalletCreator();
    this.healthServer = new HealthServer();
    this.relayerKeypair = this.loadRelayerKeypair();
    this.app = express();
    this.setupApi();
  }

  // ─── API Server ─────────────────────────────────────────────────────────────

  private setupApi(): void {
    this.app.use(cors());
    this.app.use(express.json());

    /**
     * POST /api/seal/start
     */
    this.app.post('/api/seal/start', (req, res) => {
      try {
        const { solanaWallet, sourceChain } = req.body as StartSealRequest;

        if (!solanaWallet || !sourceChain) {
          res.status(400).json({ error: 'Missing solanaWallet or sourceChain' });
          return;
        }

        const config = getConfig();
        const sessionId = randomUUID();

        const session: SealSession = {
          sessionId,
          solanaWallet,
          sourceChain,
          status: 'awaiting_payment',
          createdAt: Date.now(),
        };
        this.sessions.set(sessionId, session);

        logger.info({ sessionId, solanaWallet, sourceChain }, 'Seal session created — awaiting payment');

        res.json({
          sessionId,
          paymentAddress: this.relayerKeypair.publicKey.toBase58(),
          feeAmountLamports: config.sealFeeLamports,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to start seal session');
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Internal error',
        });
      }
    });

    /**
     * POST /api/seal/confirm-payment
     */
    this.app.post('/api/seal/confirm-payment', async (req, res) => {
      try {
        const { sessionId, paymentTxSignature } = req.body as ConfirmPaymentRequest;

        if (!sessionId || !paymentTxSignature) {
          res.status(400).json({ error: 'Missing sessionId or paymentTxSignature' });
          return;
        }

        const session = this.sessions.get(sessionId);
        if (!session) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }

        if (session.status !== 'awaiting_payment') {
          res.status(409).json({ error: 'Payment already confirmed or session in progress' });
          return;
        }

        const config = getConfig();

        const verification = await this.solanaSubmitter.verifyPayment(
          paymentTxSignature,
          session.solanaWallet,
          this.relayerKeypair.publicKey.toBase58(),
          config.sealFeeLamports,
        );

        if (!verification.verified) {
          res.status(402).json({ error: verification.error || 'Payment verification failed' });
          return;
        }

        session.status = 'payment_confirmed';
        session.paymentTxSignature = paymentTxSignature;
        session.paymentVerifiedAt = Date.now();

        logger.info(
          { sessionId, paymentTxSignature, lamports: verification.actualLamports },
          'Payment verified — creating dWallet',
        );

        session.status = 'creating_dwallet';
        const dwallet = await this.dwalletCreator.create(session.sourceChain);

        session.dwalletId = dwallet.id;
        session.depositAddress = dwallet.depositAddress;
        session.dwalletPubkey = dwallet.pubkey;
        session.status = 'waiting_deposit';

        logger.info(
          { sessionId, dwalletId: dwallet.id, depositAddress: dwallet.depositAddress },
          'dWallet created successfully',
        );

        res.json({
          dwalletId: dwallet.id,
          depositAddress: dwallet.depositAddress,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to confirm payment');
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Internal error',
        });
      }
    });

    /**
     * GET /api/seal/:id/status
     */
    this.app.get('/api/seal/:id/status', (req, res) => {
      const session = this.sessions.get(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Seal session not found' });
        return;
      }

      res.json({
        sessionId: session.sessionId,
        dwalletId: session.dwalletId,
        status: session.status,
        depositAddress: session.depositAddress,
        rebornNFT: session.rebornNFT,
        error: session.error,
      });
    });

    /**
     * GET /api/treasury/balances
     */
    this.app.get('/api/treasury/balances', async (_req, res) => {
      try {
        if (!this.treasuryManager) {
          res.status(503).json({ error: 'Treasury manager not initialized' });
          return;
        }
        const balances = await this.treasuryManager.getBalances();
        res.json({
          ika: balances.ika.toString(),
          sui: balances.sui.toString(),
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    });

    /**
     * GET /api/presign/stats
     */
    this.app.get('/api/presign/stats', (_req, res) => {
      if (!this.presignPool) {
        res.status(503).json({ error: 'Presign pool not initialized' });
        return;
      }
      res.json(this.presignPool.stats());
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    logger.info('Starting Ika Tensei v8 Relayer…');

    // Verify Sui connection
    const suiOk = await this.sealSignedListener.checkConnection();
    this.healthServer.setSuiConnected(suiOk);
    if (!suiOk) {
      throw new Error('Sui RPC connection failed');
    }

    // Verify Solana connection
    const solanaOk = await this.solanaSubmitter.checkConnection();
    this.healthServer.setSolanaConnected(solanaOk);
    if (!solanaOk) {
      throw new Error('Solana RPC connection failed');
    }

    logger.info('All connections verified');

    // Initialize v8 services (treasury, presign pool, seal signer)
    await this.initializeSigningServices();

    // Start health endpoint
    this.healthServer.start();

    // Start API server
    const config = getConfig();
    this.app.listen(config.apiPort, () => {
      logger.info({ port: config.apiPort }, 'API server listening');
    });

    // Subscribe to SealPending events → trigger signing flow
    await this.sealPendingListener.start(async (event, eventId) => {
      await this.handleSealPending(event, eventId);
    });

    // Subscribe to SealSigned events → submit to Solana
    await this.sealSignedListener.start(async (event, eventId) => {
      await this.processSealEvent(event, eventId);
    });

    this._isRunning = true;
    logger.info('Relayer is running');

    // Periodic maintenance
    setInterval(() => {
      this.checkConnections().catch((err) => {
        logger.error({ err }, 'Connection check failed');
      });
    }, 30_000);

    setInterval(() => {
      this.treasuryManager?.ensureMinimumBalances().catch((err) => {
        logger.error({ err }, 'Treasury maintenance failed');
      });
    }, 60_000);

    setInterval(() => {
      const config = getConfig();
      this.presignPool?.ensureMinimumAvailable(config.presignPoolMinAvailable).catch((err) => {
        logger.error({ err }, 'Presign pool maintenance failed');
      });
    }, 30_000);
  }

  /**
   * Initialize the signing services (treasury, presign pool, seal signer).
   * These require Sui + IKA clients and are only available when the
   * necessary config values (object IDs) are set.
   */
  private async initializeSigningServices(): Promise<void> {
    const config = getConfig();

    if (!config.suiOrchestratorStateId || !config.suiSigningStateId) {
      logger.warn('Signing services disabled — missing orchestrator/signing state IDs');
      return;
    }

    const sui = new SuiClient({ url: config.suiRpcUrl });
    const suiKeypair = this.loadSuiKeypair(config.suiKeypairPath);
    const ikaConfig = getNetworkConfig(config.ikaNetwork);
    const ikaClient = new IkaClient({ suiClient: sui, config: ikaConfig });
    await ikaClient.initialize();

    // Treasury manager
    this.treasuryManager = new TreasuryManager(sui, suiKeypair, ikaConfig);
    await this.treasuryManager.ensureMinimumBalances();

    // Presign pool
    this.presignPool = new PresignPool(sui, suiKeypair, ikaClient, ikaConfig);
    const initialPresigns = config.presignPoolReplenishBatch;
    logger.info({ count: initialPresigns }, 'Seeding initial presign pool');
    await this.presignPool.replenish(initialPresigns).catch((err) => {
      logger.warn({ err }, 'Initial presign seeding failed — will retry in maintenance cycle');
    });

    // Seal signer needs minting dWallet DKG outputs
    // These must be stored (e.g., in a file or env vars) after the initial minting dWallet creation
    const mintingKeyShareHex = process.env.MINTING_DWALLET_SECRET_KEY_SHARE;
    const mintingPublicOutputHex = process.env.MINTING_DWALLET_PUBLIC_OUTPUT;

    if (mintingKeyShareHex && mintingPublicOutputHex) {
      const userSecretKeyShare = hexToBytes(mintingKeyShareHex);
      const userPublicOutput = hexToBytes(mintingPublicOutputHex);

      this.sealSigner = new SealSigner(
        sui,
        ikaClient,
        ikaConfig,
        suiKeypair,
        this.presignPool,
        userSecretKeyShare,
        userPublicOutput,
      );
      logger.info('Seal signer initialized');
    } else {
      logger.warn(
        'MINTING_DWALLET_SECRET_KEY_SHARE / MINTING_DWALLET_PUBLIC_OUTPUT not set — signing disabled',
      );
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping relayer…');
    await this.sealSignedListener.unsubscribeFromEvents();
    await this.sealPendingListener.unsubscribeFromEvents();
    this.healthServer.stop();
    this._isRunning = false;
    logger.info('Relayer stopped');
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  // ─── Event Processing ───────────────────────────────────────────────────────

  /**
   * Handle SealPending event — trigger the signing flow.
   */
  private async handleSealPending(event: SealPendingEvent, eventId: string): Promise<void> {
    logger.info({ eventId, vaaHash: event.vaa_hash }, 'Processing SealPending event');

    if (!this.sealSigner) {
      logger.error({ eventId }, 'Seal signer not initialized — cannot sign');
      return;
    }

    try {
      await this.sealSigner.signAndComplete(event);
      logger.info({ eventId, vaaHash: event.vaa_hash }, 'Signing flow completed');
    } catch (err) {
      logger.error({ err, eventId, vaaHash: event.vaa_hash }, 'Signing flow failed');
    }
  }

  /**
   * Handle SealSigned event — bridge to Solana.
   */
  private async processSealEvent(event: SealSignedEvent, eventId: string): Promise<void> {
    logger.info({ eventId, tokenId: event.token_id }, 'Processing SealSigned event');

    try {
      const processedSeal = this.parseSealEvent(event);

      this.updateSessionStatus(event.deposit_address, 'minting');

      logger.info(
        {
          eventId,
          receiver: Buffer.from(processedSeal.receiver).toString('hex'),
          collectionName: processedSeal.collectionName,
        },
        'Submitting mint_reborn to Solana',
      );

      const result = await this.solanaSubmitter.submitMintReborn(
        processedSeal,
        this.relayerKeypair,
      );

      if (result.success) {
        logger.info(
          { eventId, txHash: result.txHash, retries: result.retries },
          'Successfully processed SealSigned event',
        );
        this.healthServer.incrementProcessed();
        this.healthServer.setLastProcessedEvent(eventId);
        this.updateSessionStatus(event.deposit_address, 'complete');
      } else {
        logger.error(
          { eventId, error: result.error, retries: result.retries },
          'Failed to process SealSigned event',
        );
        this.healthServer.incrementFailed();
        this.updateSessionStatusError(event.deposit_address, result.error ?? 'Unknown error');
      }
    } catch (err) {
      logger.error({ err, eventId }, 'Exception processing SealSigned event');
      this.healthServer.incrementFailed();
    }
  }

  private parseSealEvent(event: SealSignedEvent): ProcessedSeal {
    const signature = this.hexToUint8Array(event.signature, 64, 'signature');
    const dwalletPubkey = this.hexToUint8Array(event.dwallet_pubkey, 32, 'dwallet_pubkey');
    const messageHash = this.hexToUint8Array(event.message_hash, 32, 'message_hash');
    const receiver = this.hexToUint8Array(event.receiver, 32, 'receiver');
    const nftContract = this.hexToBytes(event.nft_contract);
    const tokenId = this.hexToBytes(event.token_id);
    const tokenUriBytes = this.hexToBytes(event.token_uri);
    const tokenUri = Buffer.from(tokenUriBytes).toString('utf-8');
    const collectionName = this.deriveCollectionName(event.source_chain, event.nft_contract);

    return {
      signature,
      dwalletPubkey,
      sourceChain: event.source_chain,
      nftContract,
      tokenId,
      tokenUri,
      receiver,
      collectionName,
      messageHash,
    };
  }

  // ─── Session Management ─────────────────────────────────────────────────────

  private updateSessionStatus(depositAddress: string, status: SealSession['status']): void {
    for (const session of this.sessions.values()) {
      if (session.depositAddress && session.depositAddress === depositAddress) {
        session.status = status;
        return;
      }
    }
  }

  private updateSessionStatusError(depositAddress: string, error: string): void {
    for (const session of this.sessions.values()) {
      if (session.depositAddress && session.depositAddress === depositAddress) {
        session.status = 'error';
        session.error = error;
        return;
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private loadRelayerKeypair(): Keypair {
    const config = getConfig();
    try {
      const data = readFileSync(config.relayerKeypairPath, 'utf-8');
      const secretKey = new Uint8Array(JSON.parse(data));
      return Keypair.fromSecretKey(secretKey);
    } catch (err) {
      logger.error({ path: config.relayerKeypairPath, err }, 'Failed to load relayer keypair');
      throw new Error('Could not load relayer keypair');
    }
  }

  private loadSuiKeypair(path: string): Ed25519Keypair {
    try {
      const raw = readFileSync(path, 'utf-8').trim();
      if (raw.startsWith('[')) {
        const bytes = new Uint8Array(JSON.parse(raw));
        const seed = bytes.length === 64 ? bytes.slice(0, 32) : bytes;
        return Ed25519Keypair.fromSecretKey(seed);
      }
      return Ed25519Keypair.fromSecretKey(raw);
    } catch (err) {
      logger.error({ path, err }, 'Failed to load Sui keypair');
      throw new Error(`Could not load Sui keypair from ${path}`);
    }
  }

  private hexToUint8Array(hex: string, expectedLen: number, fieldName?: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length !== expectedLen * 2) {
      throw new Error(
        `${fieldName ?? 'field'}: expected ${expectedLen} bytes (${expectedLen * 2} hex chars), got ${clean.length} chars from "${hex.slice(0, 20)}..."`,
      );
    }
    const bytes = new Uint8Array(expectedLen);
    for (let i = 0; i < expectedLen; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private deriveCollectionName(sourceChain: number, nftContract: string): string {
    const shortId = nftContract.slice(-8);
    return `Reborn Collection ${sourceChain}:${shortId}`;
  }

  private async checkConnections(): Promise<void> {
    const suiOk = await this.sealSignedListener.checkConnection();
    const solanaOk = await this.solanaSubmitter.checkConnection();

    this.healthServer.setSuiConnected(suiOk);
    this.healthServer.setSolanaConnected(solanaOk);

    if (!suiOk && this._isRunning) {
      logger.warn('Sui connection lost, attempting reconnect');
      await this.sealSignedListener.reconnect();
      await this.sealPendingListener.reconnect();
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const relayer = new Relayer();

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down…');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down…');
    await relayer.stop();
    process.exit(0);
  });

  try {
    await relayer.start();
  } catch (err) {
    logger.error({ err }, 'Failed to start relayer');
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, 'Unhandled error in main');
  process.exit(1);
});
