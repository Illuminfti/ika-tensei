/**
 * Ika Tensei Relayer - Main Entry Point
 *
 * Orchestrates the cross-chain NFT reincarnation flow (PRD v4):
 * 1. Receive deposit detection event
 * 2. Sign seal hash with IKA dWallet (2PC-MPC)
 * 3. Verify seal on Solana (Ed25519 precompile + our program)
 * 4. Fetch + download original NFT image
 * 5. Upload image to Arweave (via Irys)
 * 6. Build reborn metadata JSON
 * 7. Upload metadata to Arweave
 * 8. Lock DWalletCap on Sui (SealVault)
 * 9. Mint reborn NFT on Solana (Metaplex Core)
 * 10. Mark seal complete in DB
 */

import { loadConfig, type RelayerConfig } from './config.js';
import { createLogger, type Logger, sanitize } from './logger.js';
import { createDB, type DB, type SealStatus } from './db.js';
import { ProcessingQueue, type NFTSealedEvent } from './queue.js';
import { createSuiListener } from './services/sui-listener.js';
import { createIKASigner, type IKASigner } from './services/ika-signer.js';
import { createSolanaMinter, type SolanaMinter } from './services/solana-minter.js';
import { createSuiCloser, type SuiCloser } from './services/sui-closer.js';
import { createArweaveMirror, type ArweaveMirrorService } from './services/arweave-mirror.js';
import { createRealmsCreator, type RealmsCreator } from './services/realms-creator.js';
import { createHealthServer, type HealthServer } from './health.js';
import type { UniversalNFTMetadata } from '@ika-tensei/shared/metadata';
import { buildRebornMetadata } from '@ika-tensei/shared/metadata';
import { createDWalletPool, poolConfigFromRelayer, type DWalletPool } from './services/dwallet-pool.js';
import { createDepositDetector, detectorConfigFromRelayer, type DepositDetector } from './services/deposit-detector.js';
import { createAPIServer, type APIServer } from './api/deposit-routes.js';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';

export interface Relayer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export async function createRelayer(): Promise<Relayer> {
  // Load configuration
  const config = await loadConfig();
  
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
  let arweaveMirror: ArweaveMirrorService;
  let realmsCreator: RealmsCreator;
  let healthServer: HealthServer;
  let dwalletPool: DWalletPool;
  let depositDetector: DepositDetector;
  let apiServer: APIServer;

  let running = false;

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Map Wormhole chain ID to human-readable chain name */
  function chainName(chainId: number): string {
    const names: Record<number, string> = {
      1: 'ethereum',
      2: 'sui',
      3: 'solana',
      4: 'near',
      5: 'bitcoin',
      6: 'polygon',
      7: 'arbitrum',
      8: 'optimism',
      9: 'base',
      10: 'bsc',
      11: 'avalanche',
      12: 'fantom',
      23: 'aptos',
    };
    return names[chainId] ?? `chain-${chainId}`;
  }

  /** Get relayer keypair public key from config (base58) */
  function keypairPublicKey(cfg: RelayerConfig): string {
    const seed = Buffer.from(cfg.solanaKeypairBytes.slice(0, 32));
    const kp = Keypair.fromSeed(seed);
    return kp.publicKey.toBase58();
  }

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

      // === Steps 4–7: Arweave upload pipeline (v4 flow) ===

      // Determine where to get the image from
      // Prefer explicit image_url from event; fall back to fetching metadata_uri
      let imageUrl = event.image_url;

      const nowIso = new Date().toISOString();

      // Base provenance (used in all branches)
      const baseProvenance: UniversalNFTMetadata['provenance'] = {
        source_chain: chainName(source_chain),
        source_contract,
        token_id,
        seal_hash,
        dwallet_id: event.dwallet_pubkey,
        sealed_at: Date.now(),
        fetched_at: nowIso,
        original_metadata_uri: event.metadata_uri,
      };

      let originalMetadata: UniversalNFTMetadata = {
        name: event.nft_name || 'Unknown NFT',
        description: event.nft_description || '',
        image: imageUrl || '',
        attributes: [],
        collection: { name: event.collection_name || 'Unknown Collection' },
        provenance: baseProvenance,
      };

      if (!imageUrl && event.metadata_uri) {
        logger.info('Step 4: Fetching original NFT metadata...');
        try {
          const metaResp = await fetch(event.metadata_uri, { signal: AbortSignal.timeout(15_000) });
          if (metaResp.ok) {
            const metaJson = await metaResp.json() as Record<string, unknown>;
            imageUrl = metaJson.image as string | undefined;
            // Update originalMetadata with resolved fields
            originalMetadata = {
              name: (metaJson.name as string) || event.nft_name || 'Unknown NFT',
              description: (metaJson.description as string) || event.nft_description || '',
              image: imageUrl || '',
              animation_url: (metaJson.animation_url as string) || undefined,
              attributes: (metaJson.attributes as UniversalNFTMetadata['attributes']) || [],
              collection: {
                name: event.collection_name || (metaJson.collection as Record<string, string> | undefined)?.name || 'Unknown Collection',
              },
              provenance: {
                ...baseProvenance,
                original_metadata_uri: event.metadata_uri,
              },
            };
          }
        } catch (e) {
          logger.warn(`Failed to fetch metadata from ${event.metadata_uri}: ${e}`);
        }
      }

      // Step 5: Upload image to Arweave
      logger.info('Step 5: Uploading image to Arweave...');
      let imageArweaveUri = '';
      let animationArweaveUri: string | undefined;

      if (imageUrl) {
        const { uri } = await arweaveMirror.mirrorImageUrl(imageUrl);
        imageArweaveUri = uri;
      } else {
        logger.warn('No image URL found — using placeholder');
        imageArweaveUri = 'https://gateway.irys.xyz/placeholder';
      }

      // Upload animation if present
      if (event.animation_url || originalMetadata.animation_url) {
        const animUrl = event.animation_url || originalMetadata.animation_url!;
        try {
          const { uri } = await arweaveMirror.mirrorImageUrl(animUrl);
          animationArweaveUri = uri;
        } catch (e) {
          logger.warn(`Failed to mirror animation: ${e}`);
        }
      }

      // Step 6: Build reborn metadata JSON
      logger.info('Step 6: Building reborn metadata JSON...');
      const rebornMetadata = buildRebornMetadata({
        original: originalMetadata,
        imageArweaveUri,
        animationArweaveUri,
        dwalletAddress: event.dwallet_pubkey,
        sealTx: signResult.txDigest,
      });

      // Step 7: Upload metadata to Arweave
      logger.info('Step 7: Uploading reborn metadata to Arweave...');
      const metadataArweaveUri = await arweaveMirror.uploadJSON(
        rebornMetadata as unknown as Record<string, unknown>,
        [
          { name: 'Type', value: 'reborn-metadata' },
          { name: 'Seal-Hash', value: seal_hash.slice(0, 32) },
        ],
      );
      logger.info(`Metadata uploaded: ${metadataArweaveUri}`);

      // === Step 8: Lock DWalletCap on Sui ===
      logger.info('Step 8: Locking DWalletCap on Sui (SealVault)...');
      db.updateSealStatus(seal_hash, 'closing');

      const closeResult = await suiCloser.markReborn(seal_hash, ''); // placeholder mint address
      // We'll update with real mint address after step 9

      // === Step 9: Mint reborn NFT on Solana (Metaplex Core) ===
      logger.info('Step 9: Minting reborn NFT on Solana (Metaplex Core)...');
      db.updateSealStatus(seal_hash, 'minting');

      const rebornName = rebornMetadata.name; // "{Original Name} ✦ Reborn"
      const recipient = event.recipient_solana_address || keypairPublicKey(config);
      const collectionAddr = config.rebornCollectionAddress || '';

      const mintResult = await solanaMinter.mintReborn({
        metadataUri: metadataArweaveUri,
        recipient,
        collectionAddress: collectionAddr,
        name: rebornName,
        sealId: seal_hash,
      });

      db.updateSealMinted(seal_hash, mintResult.mintAddress, mintResult.txDigest);
      logger.info(`Reborn NFT minted: ${mintResult.mintAddress}`);

      // === Step 10: Mark complete ===
      db.updateSealCompleted(seal_hash, closeResult.txDigest);

      // === Bonus: Create/join Adventurer's Guild ===
      try {
        logger.info('Step 10+: Creating/joining Adventurer\'s Guild...');
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
      } catch (guildErr) {
        logger.warn(`Guild creation failed (non-fatal): ${guildErr}`);
      }

      logger.info('='.repeat(40));
      logger.info(`✅ REINCARNATION COMPLETE!`);
      logger.info(`   Seal:     ${truncatedHash}`);
      logger.info(`   Mint:     ${mintResult.mintAddress}`);
      logger.info(`   Metadata: ${metadataArweaveUri}`);
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

    // Initialize Arweave Mirror (Irys uploader)
    logger.info('Initializing Arweave mirror (Irys)...');
    arweaveMirror = createArweaveMirror(config, logger);
    await arweaveMirror.initialize();

    // Create Reborn collection if not configured
    if (!config.rebornCollectionAddress) {
      logger.warn('REBORN_COLLECTION_ADDRESS not set — collection creation skipped (set env var after first deploy)');
    }

    // Initialize Realms Creator
    logger.info('Initializing Realms Creator...');
    realmsCreator = createRealmsCreator(config, logger);
    await realmsCreator.initialize();

    // Create Sui closer
    suiCloser = createSuiCloser(config, logger);

    // Initialize dWallet Pool
    logger.info('Initializing dWallet pool...');
    dwalletPool = createDWalletPool(poolConfigFromRelayer(config), db, queue, logger);
    await dwalletPool.initPool();

    // Initialize Deposit Detector
    logger.info('Initializing deposit detector...');
    depositDetector = createDepositDetector(detectorConfigFromRelayer(config), db, logger);
    depositDetector.onDeposit(async (deposit) => {
      logger.info(`Deposit received: ${deposit.chain} tx=${deposit.txHash}`);
      // Future: enqueue full reincarnation flow for deposit-based seals
    });

    // Restore monitoring for any currently-assigned pool dWallets
    const allPoolEntries = db.getAllPoolDwallets();
    const assignedEntries = allPoolEntries
      .filter((e) => e.status === 'assigned')
      .map((e) => ({
        address: e.deposit_address,
        chain: e.curve === 'secp256k1' ? 'ethereum' : 'solana',
        dwalletId: e.dwallet_id,
      }));
    if (assignedEntries.length > 0) {
      await depositDetector.startMonitoring(assignedEntries);
    }

    // Start API server
    logger.info('Starting deposit API server...');
    apiServer = createAPIServer(
      config.apiPort,
      db,
      dwalletPool,
      depositDetector,
      logger,
      config.alchemyWebhookSecret || undefined,
    );
    await apiServer.start();

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
    await apiServer?.stop();
    dwalletPool?.stop();
    depositDetector?.stop();
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
