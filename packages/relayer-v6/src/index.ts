/**
 * Ika Tensei v8 Relayer - Main Entry Point
 *
 * Five roles:
 * 1. VAA ingester — polls Wormholescan for signed VAAs, submits process_vaa() to Sui
 * 2. API server — accepts seal requests, creates deposit dWallets via IKA SDK
 * 3. SealPending listener — watches SealPending events, triggers IKA signing
 * 4. SealSigned listener — watches SealSigned events, bridges to Solana
 * 5. Background maintenance — treasury balances, presign pool replenishment
 *
 * v8 changes from v7:
 * - VAA ingester: automatic Wormholescan polling for EVM/NEAR VAAs
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
import { rateLimitSuiClient } from './rate-limited-sui-client.js';
import { TreasuryManager } from './treasury-manager.js';
import { PresignPool } from './presign-pool.js';
import { SealSigner } from './seal-signer.js';
import { VAAIngester } from './vaa-ingester.js';
import { HealthServer } from './health.js';
import { logger } from './logger.js';
import { initDb, createSession, getSession, updateSession, updateSessionByDeposit } from './db.js';
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
 * - VAA ingestion from Wormholescan → Sui process_vaa
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
  private vaaIngester?: VAAIngester;

  constructor() {
    const config = getConfig();
    initDb(config.dbPath);

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
        createSession(session);

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

        const session = getSession(sessionId);
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

        updateSession(sessionId, {
          status: 'payment_confirmed',
          payment_tx_sig: paymentTxSignature,
          payment_verified: Date.now(),
        });

        logger.info(
          { sessionId, paymentTxSignature, lamports: verification.actualLamports },
          'Payment verified — creating dWallet',
        );

        updateSession(sessionId, { status: 'creating_dwallet' });
        const dwallet = await this.dwalletCreator.create(session.sourceChain);

        updateSession(sessionId, {
          status: 'waiting_deposit',
          dwallet_id: dwallet.id,
          deposit_address: dwallet.depositAddress,
          dwallet_pubkey: Buffer.from(dwallet.pubkey),
        });

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
      const session = getSession(req.params.id);
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

    // Subscribe to event listeners BEFORE starting VAA ingester
    // (otherwise process_vaa fires SealPending before the listener is ready)
    await this.sealPendingListener.start(async (event, eventId) => {
      await this.handleSealPending(event, eventId);
    });

    await this.sealSignedListener.start(async (event, eventId) => {
      await this.processSealEvent(event, eventId);
    });

    // Initialize and start VAA ingester AFTER event listeners are subscribed
    await this.initializeVAAIngester();

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

    const sui = rateLimitSuiClient(new SuiClient({ url: config.suiRpcUrl }));
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

  /**
   * Initialize the VAA ingester (polls Wormholescan for source chain VAAs).
   * Requires wormholeStateObjectId and at least one source chain emitter.
   */
  private async initializeVAAIngester(): Promise<void> {
    const config = getConfig();

    if (!config.wormholeStateObjectId) {
      logger.warn('VAA ingester disabled — WORMHOLE_STATE_OBJECT_ID not set');
      return;
    }

    if (config.sourceChainEmitters.length === 0) {
      logger.warn('VAA ingester disabled — no SOURCE_CHAIN_EMITTERS configured');
      return;
    }

    const sui = new SuiClient({ url: config.suiRpcUrl });
    const suiKeypair = this.loadSuiKeypair(config.suiKeypairPath);

    this.vaaIngester = new VAAIngester(sui, suiKeypair);
    await this.vaaIngester.start();
    logger.info('VAA ingester started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping relayer…');
    this.vaaIngester?.stop();
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
    const vaaHashDisplay = Array.isArray(event.vaa_hash)
      ? Buffer.from(event.vaa_hash).toString('hex')
      : event.vaa_hash;
    logger.info({ eventId, vaaHash: vaaHashDisplay }, 'Processing SealPending event');

    if (!this.sealSigner) {
      logger.error({ eventId }, 'Seal signer not initialized — cannot sign');
      return;
    }

    try {
      await this.sealSigner.signAndComplete(event);
      logger.info({ eventId, vaaHash: vaaHashDisplay }, 'Signing flow completed');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // MoveAbort errors are non-retriable (e.g., seal already completed, invalid state).
      // Don't rethrow — let the cursor advance past this event.
      if (errMsg.includes('MoveAbort') || errMsg.includes('already')) {
        logger.warn(
          { err, eventId, vaaHash: vaaHashDisplay },
          'Signing flow failed with non-retriable error — skipping event',
        );
        return;
      }

      // For transient errors (network, timeout), rethrow so the cursor
      // stays put and we retry on the next poll cycle.
      logger.error({ err, eventId, vaaHash: vaaHashDisplay }, 'Signing flow failed — will retry');
      throw err;
    }
  }

  /**
   * Handle SealSigned event — bridge to Solana.
   */
  private async processSealEvent(event: SealSignedEvent, eventId: string): Promise<void> {
    logger.info({ eventId, tokenId: event.token_id }, 'Processing SealSigned event');

    try {
      const processedSeal = this.parseSealEvent(event);

      const depositAddressHex = Buffer.from(toBytes(event.deposit_address)).toString('hex');
      this.updateSessionStatus(depositAddressHex, 'minting');

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
        this.updateSessionStatus(depositAddressHex, 'complete');
      } else {
        logger.error(
          { eventId, error: result.error, retries: result.retries },
          'Failed to process SealSigned event',
        );
        this.healthServer.incrementFailed();
        this.updateSessionStatusError(depositAddressHex, result.error ?? 'Unknown error');
      }
    } catch (err) {
      logger.error({ err, eventId }, 'Exception processing SealSigned event');
      this.healthServer.incrementFailed();
    }
  }

  private parseSealEvent(event: SealSignedEvent): ProcessedSeal {
    const signature = toBytes(event.signature);
    const dwalletPubkey = toBytes(event.dwallet_pubkey);
    const messageHash = toBytes(event.message_hash);
    const receiver = toBytes(event.receiver);
    const nftContract = toBytes(event.nft_contract);
    const tokenId = toBytes(event.token_id);
    const tokenUri = Buffer.from(toBytes(event.token_uri)).toString('utf-8');
    const nftContractHex = Buffer.from(nftContract).toString('hex');
    const collectionName = this.deriveCollectionName(event.source_chain, nftContractHex);

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
    updateSessionByDeposit(depositAddress, status);
  }

  private updateSessionStatusError(depositAddress: string, error: string): void {
    updateSessionByDeposit(depositAddress, 'error', error);
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

  private deriveCollectionName(sourceChain: number, nftContractHex: string): string {
    const shortId = nftContractHex.slice(-8);
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

/**
 * Convert Sui event vector<u8> fields to Uint8Array.
 * Sui SDK may return these as number[], base64 string, or hex string.
 */
function toBytes(value: number[] | string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      const clean = value.slice(2);
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
    // Try base64 first (Sui SDK sometimes returns base64 for vector<u8>)
    try {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      // Fall back to hex
      const bytes = new Uint8Array(value.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
  }
  throw new Error(`Cannot convert to bytes: ${typeof value}`);
}

/**
 * Convert hex string to Uint8Array (for env var parsing).
 */
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
