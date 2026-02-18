/**
 * Arweave Mirror Service
 * 
 * Mirrors NFT image + metadata from Walrus to Arweave via Irys.
 * Returns Arweave URLs for use in Solana NFT minting.
 * 
 * Flow: Walrus blob → fetch → upload to Arweave → return permanent URL
 */

import Irys from '@irys/sdk';
import type { Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

const WALRUS_AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export interface ArweaveMirrorResult {
  imageArweaveUrl: string;
  metadataArweaveUrl: string;
  imageArweaveId: string;
  metadataArweaveId: string;
}

export interface ArweaveMirrorService {
  initialize(): Promise<void>;
  mirrorNFT(imageBlobId: string, metadataBlobId: string): Promise<ArweaveMirrorResult>;
  getBalance(): Promise<number>;
  isInitialized(): boolean;
}

export function createArweaveMirror(
  config: RelayerConfig,
  logger: Logger,
): ArweaveMirrorService {
  let irys: Irys;
  let initialized = false;

  async function initialize(): Promise<void> {
    if (initialized) return;

    const secretKey = config.solanaKeypairBytes;

    irys = new Irys({
      url: 'https://devnet.irys.xyz',
      token: 'solana',
      key: secretKey,
      config: { providerUrl: config.solanaRpcUrl },
    });

    await irys.ready();
    
    const bal = await irys.getLoadedBalance();
    const balSol = irys.utils.fromAtomic(bal).toNumber();
    logger.info(`Arweave mirror initialized: balance=${balSol} SOL`);

    // Auto-fund if low
    if (balSol < 0.005) {
      logger.info('Funding Irys with 0.01 SOL...');
      try {
        await irys.fund(irys.utils.toAtomic(0.01));
        logger.info('Irys funded successfully');
      } catch (e: any) {
        logger.warn(`Irys funding failed: ${e.message}. Uploads may fail.`);
      }
    }

    initialized = true;
  }

  async function mirrorNFT(
    imageBlobId: string, 
    metadataBlobId: string,
  ): Promise<ArweaveMirrorResult> {
    if (!initialized) throw new Error('Arweave mirror not initialized');

    // 1. Mirror image
    logger.info(`Mirroring image: ${imageBlobId}`);
    const imgResp = await fetch(`${WALRUS_AGG}/${imageBlobId}`);
    if (!imgResp.ok) throw new Error(`Failed to fetch Walrus image: ${imgResp.status}`);
    const imgData = Buffer.from(await imgResp.arrayBuffer());

    const imgReceipt = await irys.upload(imgData, {
      tags: [
        { name: 'Content-Type', value: 'image/jpeg' },
        { name: 'App-Name', value: 'Ika-Tensei' },
        { name: 'Walrus-Blob-Id', value: imageBlobId },
        { name: 'Type', value: 'nft-image' },
      ],
    });
    const imageArweaveUrl = `https://arweave.net/${imgReceipt.id}`;
    logger.info(`Image mirrored: ${imageArweaveUrl} (${imgData.length}B)`);

    // 2. Fetch metadata, update image URL to Arweave, upload
    logger.info(`Mirroring metadata: ${metadataBlobId}`);
    const metaResp = await fetch(`${WALRUS_AGG}/${metadataBlobId}`);
    if (!metaResp.ok) throw new Error(`Failed to fetch Walrus metadata: ${metaResp.status}`);
    const metaJson = await metaResp.json() as any;

    // Update image to Arweave
    metaJson.image = imageArweaveUrl;
    metaJson.properties = metaJson.properties || {};
    metaJson.properties.files = [
      { uri: imageArweaveUrl, type: 'image/jpeg', cdn: true },
    ];
    metaJson.properties.walrus = {
      image_blob_id: imageBlobId,
      metadata_blob_id: metadataBlobId,
    };

    const metaBuffer = Buffer.from(JSON.stringify(metaJson, null, 2));
    const metaReceipt = await irys.upload(metaBuffer, {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'Ika-Tensei' },
        { name: 'Walrus-Blob-Id', value: metadataBlobId },
        { name: 'Type', value: 'nft-metadata' },
      ],
    });
    const metadataArweaveUrl = `https://arweave.net/${metaReceipt.id}`;
    logger.info(`Metadata mirrored: ${metadataArweaveUrl} (${metaBuffer.length}B)`);

    return {
      imageArweaveUrl,
      metadataArweaveUrl,
      imageArweaveId: imgReceipt.id,
      metadataArweaveId: metaReceipt.id,
    };
  }

  async function getBalance(): Promise<number> {
    if (!initialized) return 0;
    const bal = await irys.getLoadedBalance();
    return irys.utils.fromAtomic(bal).toNumber();
  }

  return {
    initialize,
    mirrorNFT,
    getBalance,
    isInitialized: () => initialized,
  };
}
