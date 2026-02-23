/**
 * Ika Tensei v6 Relayer - Main Entry Point
 *
 * Permissionless relayer that bridges SealSigned events from Sui to Solana.
 *
 * Flow:
 * 1. Subscribe to SealSigned events on Sui (real-time + replay on restart)
 * 2. Parse event data into ProcessedSeal
 * 3. Build and submit mint_reborn transaction to Solana
 * 4. Handle retries with exponential backoff
 */

import { readFileSync } from 'fs';
import { Keypair } from '@solana/web3.js';
import { getConfig } from './config.js';
import { SuiListener } from './sui-listener.js';
import { SolanaSubmitter } from './solana-submitter.js';
import { HealthServer } from './health.js';
import { logger } from './logger.js';
import type { SealSignedEvent, ProcessedSeal } from './types.js';

/**
 * Relayer orchestrates the Sui → Solana bridge.
 */
export class Relayer {
  private readonly suiListener: SuiListener;
  private readonly solanaSubmitter: SolanaSubmitter;
  private readonly healthServer: HealthServer;
  private readonly relayerKeypair: Keypair;
  private _isRunning = false;

  constructor() {
    this.suiListener = new SuiListener();
    this.solanaSubmitter = new SolanaSubmitter();
    this.healthServer = new HealthServer();
    this.relayerKeypair = this.loadRelayerKeypair();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Start the relayer: verify connections, load cursor, subscribe to events.
   */
  async start(): Promise<void> {
    logger.info('Starting Ika Tensei v6 Relayer…');

    // Verify Sui connection
    const suiOk = await this.suiListener.checkConnection();
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

    // Start health endpoint
    this.healthServer.start();

    // Subscribe to Sui events (includes replay from cursor)
    await this.suiListener.start(async (event, eventId) => {
      await this.processSealEvent(event, eventId);
    });

    this._isRunning = true;
    logger.info('Relayer is running');

    // Periodic connection health checks
    setInterval(() => {
      this.checkConnections().catch((err) => {
        logger.error({ err }, 'Connection check failed');
      });
    }, 30_000);
  }

  /**
   * Graceful shutdown.
   */
  async stop(): Promise<void> {
    logger.info('Stopping relayer…');
    await this.suiListener.unsubscribeFromEvents();
    this.healthServer.stop();
    this._isRunning = false;
    logger.info('Relayer stopped');
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  // ─── Event Processing ────────────────────────────────────────────────────────

  /**
   * Handle an incoming SealSigned event from Sui.
   */
  private async processSealEvent(event: SealSignedEvent, eventId: string): Promise<void> {
    logger.info({ eventId, tokenId: event.token_id }, 'Processing SealSigned event');

    try {
      // Parse and validate event data
      const processedSeal = this.parseSealEvent(event);

      logger.info(
        {
          eventId,
          receiver: Buffer.from(processedSeal.receiver).toString('hex'),
          collectionName: processedSeal.collectionName,
        },
        'Submitting mint_reborn to Solana',
      );

      // Submit to Solana
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
      } else {
        logger.error(
          { eventId, error: result.error, retries: result.retries },
          'Failed to process SealSigned event',
        );
        this.healthServer.incrementFailed();
      }
    } catch (err) {
      logger.error({ err, eventId }, 'Exception processing SealSigned event');
      this.healthServer.incrementFailed();
    }
  }

  /**
   * Convert raw Sui event fields into the ProcessedSeal structure used by Solana.
   *
   * CRITICAL FIX: The dWallet Ed25519 pubkey comes from `dwallet_pubkey` field,
   * NOT from `deposit_address`. The deposit_address is a different field (likely
   * the Sui address where funds were deposited, not the MPC key).
   */
  private parseSealEvent(event: SealSignedEvent): ProcessedSeal {
    // All fields from Sui are hex-encoded strings.
    // Convert them to the appropriate binary representations.

    // 64-byte Ed25519 signature
    const signature = this.hexToUint8Array(event.signature, 64, 'signature');

    // 32-byte Ed25519 public key of the IKA dWallet (NOT deposit_address!)
    const dwalletPubkey = this.hexToUint8Array(event.dwallet_pubkey, 32, 'dwallet_pubkey');

    // 32-byte message hash (SHA256)
    const messageHash = this.hexToUint8Array(event.message_hash, 32, 'message_hash');

    // Receiver is a 32-byte Solana public key (hex of raw bytes)
    const receiver = this.hexToUint8Array(event.receiver, 32, 'receiver');

    // NFT contract and token ID are variable-length bytes (convert hex → raw)
    const nftContract = this.hexToBytes(event.nft_contract);
    const tokenId = this.hexToBytes(event.token_id);

    // Token URI is hex-encoded UTF-8 bytes
    const tokenUriBytes = this.hexToBytes(event.token_uri);
    const tokenUri = Buffer.from(tokenUriBytes).toString('utf-8');

    // Derive a collection name from the contract + source chain.
    // In production this would be looked up from a registry, but for now we derive one.
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

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Load the relayer's keypair from the JSON file path in config.
   */
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

  /**
   * Convert a fixed-length hex string to Uint8Array.
   */
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

  /**
   * Convert a variable-length hex string to Uint8Array.
   */
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

  /**
   * Derive a collection name from the source chain and contract.
   * In a production system this would query a registry.
   */
  private deriveCollectionName(sourceChain: number, nftContract: string): string {
    // Use last 8 hex chars of contract as identifier
    const shortId = nftContract.slice(-8);
    return `Reborn Collection ${sourceChain}:${shortId}`;
  }

  /**
   * Periodic connection health checks + auto-reconnect.
   */
  private async checkConnections(): Promise<void> {
    const suiOk = await this.suiListener.checkConnection();
    const solanaOk = await this.solanaSubmitter.checkConnection();

    this.healthServer.setSuiConnected(suiOk);
    this.healthServer.setSolanaConnected(solanaOk);

    if (!suiOk && this._isRunning) {
      logger.warn('Sui connection lost, attempting reconnect');
      await this.suiListener.reconnect();
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const relayer = new Relayer();

  // Graceful shutdown handlers
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

  // Start the relayer
  try {
    await relayer.start();
  } catch (err) {
    logger.error({ err }, 'Failed to start relayer');
    process.exit(1);
  }
}

// Run as main module
main().catch((err) => {
  logger.error({ err }, 'Unhandled error in main');
  process.exit(1);
});
