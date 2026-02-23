/**
 * Ika Tensei v6 Relayer - Main Entry Point
 * 
 * Permissionless relayer that:
 * 1. Subscribes to SealSigned events on Sui
 * 2. Parses event data
 * 3. Builds and submits transactions to Solana
 * 4. Handles retries with exponential backoff
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
 * Main Relayer class
 */
export class Relayer {
  private suiListener: SuiListener;
  private solanaSubmitter: SolanaSubmitter;
  private healthServer: HealthServer;
  private relayerKeypair: Keypair;
  private isRunning: boolean = false;

  constructor() {
    this.suiListener = new SuiListener();
    this.solanaSubmitter = new SolanaSubmitter();
    this.healthServer = new HealthServer();
    this.relayerKeypair = this.loadRelayerKeypair();
  }

  /**
   * Load relayer keypair from file
   */
  private loadRelayerKeypair(): Keypair {
    const config = getConfig();
    
    try {
      const keypairData = readFileSync(config.relayerKeypairPath, 'utf-8');
      const keypairArray = JSON.parse(keypairData);
      return Keypair.fromSecretKey(new Uint8Array(keypairArray));
    } catch (error) {
      logger.error({ 
        path: config.relayerKeypairPath, 
        error 
      }, 'Failed to load relayer keypair');
      throw new Error('Could not load relayer keypair');
    }
  }

  /**
   * Initialize and start the relayer
   */
  async start(): Promise<void> {
    logger.info('Starting Ika Tensei v6 Relayer...');

    // Check connections
    const suiConnected = await this.suiListener.checkConnection();
    const solanaConnected = await this.solanaSubmitter.checkConnection();

    this.healthServer.setSuiConnected(suiConnected);
    this.healthServer.setSolanaConnected(solanaConnected);

    if (!suiConnected) {
      throw new Error('Sui connection failed');
    }

    if (!solanaConnected) {
      throw new Error('Solana connection failed');
    }

    logger.info('Connections verified');

    // Start health server
    this.healthServer.start();

    // Subscribe to Sui events
    await this.suiListener.subscribe(async (event, eventId) => {
      await this.processSealEvent(event, eventId);
    });

    this.isRunning = true;
    logger.info('Relayer is running');

    // Setup periodic connection checks
    setInterval(async () => {
      await this.checkConnections();
    }, 30000);
  }

  /**
   * Process a SealSigned event from Sui
   */
  private async processSealEvent(event: SealSignedEvent, eventId: string): Promise<void> {
    logger.info({ eventId, tokenId: event.token_id }, 'Processing SealSigned event');

    try {
      // Parse and validate the event data
      const processedSeal = this.parseSealEvent(event);
      
      logger.info({
        eventId,
        receiver: processedSeal.receiver,
        collectionName: processedSeal.collectionName,
      }, 'Submitting mint_reborn to Solana');

      // Submit to Solana
      const result = await this.solanaSubmitter.submitMintReborn(
        processedSeal,
        this.relayerKeypair
      );

      if (result.success) {
        logger.info({
          eventId,
          txHash: result.txHash,
          retries: result.retries,
        }, 'Successfully processed seal');
        
        this.healthServer.incrementProcessed();
        this.healthServer.setLastProcessedEvent(eventId);
      } else {
        logger.error({
          eventId,
          error: result.error,
          retries: result.retries,
        }, 'Failed to process seal');
        
        this.healthServer.incrementFailed();
      }
    } catch (error) {
      logger.error({ error, eventId }, 'Error processing seal event');
      this.healthServer.incrementFailed();
    }
  }

  /**
   * Parse SealSigned event into ProcessedSeal
   */
  private parseSealEvent(event: SealSignedEvent): ProcessedSeal {
    // Convert hex strings to Uint8Array
    const signature = this.hexToUint8Array(event.signature);
    const dwalletPubkey = this.hexToUint8Array(event.deposit_address);
    
    // Extract collection name from token URI or contract
    // In production, this would come from the event or be looked up
    const collectionName = this.deriveCollectionName(event.nft_contract, event.token_uri);

    return {
      signature,
      dwalletPubkey,
      sourceChain: event.source_chain,
      nftContract: event.nft_contract,
      tokenId: event.token_id,
      tokenUri: event.token_uri,
      receiver: event.receiver,
      collectionName,
      messageHash: event.message_hash,
      originalEvent: event,
    };
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    // Handle 0x prefix
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Derive collection name from contract and URI
   * This is a simplified version - in production you'd look up from a registry
   */
  private deriveCollectionName(nftContract: string, _tokenUri: string): string {
    // Try to extract collection name from contract address
    // In production, this would query a collection registry
    // Note: _tokenUri is reserved for future use
    const shortContract = nftContract.slice(-8);
    return `Reborn Collection (${shortContract})`;
  }

  /**
   * Check and update connection status
   */
  private async checkConnections(): Promise<void> {
    const suiConnected = await this.suiListener.checkConnection();
    const solanaConnected = await this.solanaSubmitter.checkConnection();

    this.healthServer.setSuiConnected(suiConnected);
    this.healthServer.setSolanaConnected(solanaConnected);

    if (!suiConnected && this.isRunning) {
      logger.warn('Sui connection lost, attempting reconnect');
      await this.suiListener.reconnect();
    }
  }

  /**
   * Stop the relayer
   */
  async stop(): Promise<void> {
    logger.info('Stopping relayer...');
    
    await this.suiListener.unsubscribeFromEvents();
    this.healthServer.stop();
    
    this.isRunning = false;
    logger.info('Relayer stopped');
  }
}

/**
 * Main entry point
 */
async function main() {
  const relayer = new Relayer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await relayer.stop();
    process.exit(0);
  });

  // Start the relayer
  try {
    await relayer.start();
  } catch (error) {
    logger.error({ error }, 'Failed to start relayer');
    process.exit(1);
  }
}

// Run if this is the main module
main().catch((error) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});
