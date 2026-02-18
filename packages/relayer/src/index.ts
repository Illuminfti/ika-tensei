/**
 * Ika Tensei Relayer - Main Entry Point
 * 
 * Orchestrates the cross-chain NFT reincarnation flow:
 * 1. Listen for NFTSealed events on Sui
 * 2. Sign seal hash with IKA dWallet (2PC-MPC)
 * 3. Verify seal + mint reborn NFT on Solana
 * 4. Mark reborn on Sui to close the loop
 */

import { loadConfig, type RelayerConfig } from './config.js';
import { createLogger, type Logger, sanitize } from './logger';
import { createDB, type DB, type SealStatus } from './db.js';
import { ProcessingQueue, type NFTSealedEvent } from './queue.js';
import { createSuiListener } from './services/sui-listener.js';
import { createIKASigner, type IKASigner } from './services/ika-signer.js';
import { createSolanaMinter, type SolanaMinter } from './services/solana-minter.js';
import { createSuiCloser, type SuiCloser } from './services/sui-closer.js';
import { createRealmsCreator, type RealmsCreator } from './services/realms-creator.js';
import { createHealthServer, type HealthServer } from './health.js';
import { PublicKey, Connection } from '@solana/web3.js';

export interface Relayer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export async function createRelayer(): Promise<Relayer> {
  // Load configuration
  const config = loadConfig();
  
  // Create logger
  const logger = createLogger(config.logLevel);
  
  logger.info('='.repeat(60));
  logger.info('Ika Tensei Relayer v3.0.0');
  logger.info('='.repeat(60));

  // Create database
  const db = createDB(config.dbPath, logger);

  // Create processing queue
  const queue = new ProcessingQueue(
    config.queueConcurrency,
    config.queuePollIntervalMs,
    logger,
  );

  const uptimeStart = Date.now();

  // Create services
  let suiListener: ReturnType<typeof createSuiListener>;
  let ikaSigner: IKASigner;
  let solanaMinter: SolanaMinter;
  let suiCloser: SuiCloser;
  let realmsCreator: RealmsCreator;
  let healthServer: HealthServer;

  let running = false;

  // Processing loop
  async function processSeal(event: NFTSealedEvent): Promise<void> {
    const { seal_hash, source_chain, dest_chain, source_contract, token_id, nonce } = event;
    // M4: Use truncated seal hash for logging
    const truncatedHash = seal_hash.slice(0, 16) + '...';
    const logger = createLogger(config.logLevel).child({ sealHash: truncatedHash });

    logger.info(`Processing seal: ${truncatedHash}`);
    // M4: Sanitize event data before logging
    logger.debug(`Event: ${JSON.stringify(sanitize({
      source_chain,
      dest_chain,
      source_contract,
      token_id,
      nonce
    }))}`);

    // Check if already processed
    const existing = db.getSealByHash(seal_hash);
    if (existing) {
      if (existing.status === 'completed') {
        logger.info('Seal already completed, skipping');
        return;
      }
      if (existing.status === 'failed') {
        logger.warn('Seal previously failed, will retry');
      }
    }

    try {
      // === Step 1: Create seal record ===
      if (!existing) {
        db.createSeal({
          seal_hash,
          status: 'sealed',
          source_chain,
          dest_chain,
          source_contract,
          token_id,
          nonce,
          nft_name: event.nft_name || 'Ika Tensei NFT',
          nft_description: event.nft_description || '',
          metadata_uri: event.metadata_uri || '',
          collection_name: event.collection_name || 'Ika Tensei',
          dwallet_pubkey: event.dwallet_pubkey,
          solana_mint_address: null,
          signature: null,
          error: null,
          tx_seal: event.tx_digest,
          tx_sign: null,
          tx_verify: null,
          tx_mint: null,
          tx_close: null,
        });
      }

      // === Step 2: Sign with IKA dWallet ===
      logger.info('Step 2: Signing with IKA dWallet...');
      db.updateSealStatus(seal_hash, 'signing');

      const messageHash = Buffer.from(seal_hash, 'hex');
      const signResult = await ikaSigner.signMessage(messageHash);

      // M4: Don't log full signature, just truncated
      db.updateSealSignature(seal_hash, signResult.signatureHex, signResult.txDigest);
      logger.info(`Signature obtained: ${signResult.signatureHex.slice(0, 16)}...`);

      // === Step 3: Verify seal on Solana ===
      // C7: Idempotency - check if already verified on Solana before calling verifySeal
      const messageHashHex = seal_hash;
      const [recordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reincarnation'), messageHash],
        config.solanaProgramId,
      );
      
      const connection = new Connection(config.solanaRpcUrl, 'confirmed');
      const existingRecord = await connection.getAccountInfo(recordPda);
      if (existingRecord) {
        logger.info('Seal already verified on Solana, skipping to mint');
        // Skip to Step 4 - Mint
      } else {
        logger.info('Step 3: Verifying seal on Solana...');
        db.updateSealStatus(seal_hash, 'verifying');

        const dwalletPubkey = Buffer.from(event.dwallet_pubkey.replace(/^0x/, ''), 'hex');
        const signature = Buffer.from(signResult.signatureHex, 'hex');

        const verifyResult = await solanaMinter.verifySeal(
          messageHash,
          source_chain,
          source_contract,
          token_id,
          dwalletPubkey,
          signature,
        );

        db.updateSealVerified(seal_hash, verifyResult.txDigest);
        logger.info('Seal verified on Solana');
      }

      // === Step 4: Mint reborn NFT ===
      logger.info('Step 4: Minting reborn NFT on Solana...');
      db.updateSealStatus(seal_hash, 'minting');

      const mintResult = await solanaMinter.mintReborn(
        messageHash,
        event.nft_name || 'Ika Tensei NFT',
        event.metadata_uri || '',
      );

      db.updateSealMinted(seal_hash, mintResult.mintAddress, mintResult.txDigest);
      logger.info(`Reborn NFT minted: ${mintResult.mintAddress}`);

      // === Step 5: Mark reborn on Sui ===
      logger.info('Step 5: Marking reborn on Sui...');
      db.updateSealStatus(seal_hash, 'closing');

      const closeResult = await suiCloser.markReborn(seal_hash, mintResult.mintAddress);

      db.updateSealCompleted(seal_hash, closeResult.txDigest);

      // === Step 6: Create/join Adventurer's Guild ===
      logger.info('Step 6: Creating/joining Adventurer\'s Guild...');
      const collectionMint = new PublicKey(event.collection_mint || mintResult.mintAddress);
      const guildResult = await realmsCreator.ensureGuildExists(
        event.collection_name || 'Ika Tensei',
        collectionMint,
      );
      await realmsCreator.depositNft(
        guildResult.realmAddress,
        collectionMint,
        new PublicKey(mintResult.mintAddress),
      );
      logger.info(`Guild: ${guildResult.realmAddress.toBase58()}`);
      
      logger.info('='.repeat(40));
      logger.info(`✅ REINCARNATION COMPLETE!`);
      logger.info(`   Seal: ${truncatedHash}`);
      logger.info(`   Mint: ${mintResult.mintAddress}`);
      logger.info('='.repeat(40));

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Processing failed: ${errorMsg}`);
      db.updateSealStatus(seal_hash, 'failed', errorMsg);
      throw err;
    }
  }

  // Worker loop
  async function workerLoop(): Promise<void> {
    while (running) {
      const batch = queue.getNextBatch();

      for (const item of batch) {
        queue.startProcessing(item.sealHash);
        
        try {
          await processSeal(item.eventData);
          queue.finishProcessing(item.sealHash);
        } catch (err) {
          queue.release(item.sealHash);
          
          // Re-queue with backoff
          const maxRetries = config.maxRetries;
          if (item.retries < maxRetries) {
            queue.requeue(item, maxRetries);
          }
        }
      }

      // Wait before next iteration
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  async function start(): Promise<void> {
    if (running) {
      logger.warn('Relayer already running');
      return;
    }

    logger.info('Starting Ika Tensei Relayer...');

    // Initialize IKA signer
    logger.info('Initializing IKA signer...');
    ikaSigner = createIKASigner(config, logger);
    await ikaSigner.initialize();

    // Initialize Solana minter
    logger.info('Initializing Solana minter...');
    solanaMinter = createSolanaMinter(config, logger);
    await solanaMinter.initialize();

    // Initialize Realms Creator
    logger.info('Initializing Realms Creator...');
    realmsCreator = createRealmsCreator(config, logger);
    await realmsCreator.initialize();

    // Create Sui closer
    suiCloser = createSuiCloser(config, logger);

    // Create Sui listener
    suiListener = createSuiListener(
      config,
      logger,
      (event: NFTSealedEvent) => {
        queue.enqueue(event);
      },
    );

    // Create health server
    healthServer = createHealthServer(
      config.healthPort,
      logger,
      db,
      queue,
      uptimeStart,
    );

    // Start services
    await healthServer.start();
    healthServer.setServiceStatus('sui', 'healthy');
    healthServer.setServiceStatus('solana', 'healthy');
    healthServer.setServiceStatus('ika', 'healthy');

    await suiListener.start();

    // Start worker
    running = true;
    workerLoop(); // Don't await - run in background

    logger.info('✅ Ika Tensei Relayer started successfully');
  }

  async function stop(): Promise<void> {
    if (!running) return;

    logger.info('Stopping Ika Tensei Relayer...');
    running = false;

    // M5: Wait for in-flight operations (max 30s)
    const maxWait = 30000;
    const start = Date.now();
    while (queue.activeCount() > 0 && Date.now() - start < maxWait) {
      logger.info(`Waiting for ${queue.activeCount()} in-flight operations...`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (queue.activeCount() > 0) {
      logger.warn(`Forcing shutdown with ${queue.activeCount()} in-flight operations`);
    }

    // Then stop services
    await suiListener?.stop();
    await healthServer?.stop();
    queue.stop();
    db.close();

    logger.info('✅ Ika Tensei Relayer stopped');
  }

  return {
    start,
    stop,
    isRunning: () => running,
  };
}

// CLI entry point
async function main(): Promise<void> {
  const relayer = await createRelayer();

  // Handle shutdown signals
  const shutdown = async () => {
    console.log('\nReceived shutdown signal...');
    await relayer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the relayer
  await relayer.start();

  // Keep alive
  while (relayer.isRunning()) {
    await new Promise(r => setTimeout(r, 5000));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
