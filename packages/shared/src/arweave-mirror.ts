/**
 * Arweave Mirror — Mirrors Walrus blobs to Arweave via Irys (Bundlr)
 * 
 * Ensures NFT metadata and images are accessible from both:
 * - Walrus (Sui-native decentralized storage)
 * - Arweave (permanent storage, supported by all NFT indexers)
 * 
 * Uses Irys SDK with Solana payment (devnet SOL for testing).
 */

import Irys from '@irys/sdk';
import { readFileSync } from 'fs';
import { homedir } from 'os';

// Walrus endpoints
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export interface ArweaveMirrorConfig {
  /** 'devnet' | 'mainnet' */
  network: 'devnet' | 'mainnet';
  /** Path to Solana keypair JSON */
  solanaKeypairPath?: string;
}

export interface MirrorResult {
  walrusBlobId: string;
  arweaveId: string;
  arweaveUrl: string;
  contentType: string;
  size: number;
}

/**
 * Create an Arweave mirror client.
 * Uses Irys (Bundlr) with Solana for payment.
 */
export async function createArweaveMirror(config: ArweaveMirrorConfig) {
  const keypairPath = config.solanaKeypairPath || `${homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf8'));
  const secretKey = Buffer.from(keypairData);

  // Irys node: devnet uses devnet, mainnet uses node1/node2
  const irysNode = config.network === 'devnet' 
    ? 'https://devnet.irys.xyz' 
    : 'https://node1.irys.xyz';

  const irys = new Irys({
    url: irysNode,
    token: 'solana',
    key: secretKey,
    config: {
      providerUrl: config.network === 'devnet' 
        ? 'https://api.devnet.solana.com' 
        : 'https://api.mainnet-beta.solana.com',
    },
  });

  await irys.ready();

  /**
   * Mirror a Walrus blob to Arweave.
   * Fetches from Walrus, uploads to Arweave via Irys.
   */
  async function mirrorBlob(
    walrusBlobId: string, 
    contentType: string,
    tags?: Record<string, string>,
  ): Promise<MirrorResult> {
    // Fetch from Walrus
    const walrusUrl = `${WALRUS_AGGREGATOR}/${walrusBlobId}`;
    const response = await fetch(walrusUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Walrus blob ${walrusBlobId}: ${response.status}`);
    }
    const data = Buffer.from(await response.arrayBuffer());

    // Build Irys tags
    const irysTags = [
      { name: 'Content-Type', value: contentType },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '3.0.0' },
      { name: 'Walrus-Blob-Id', value: walrusBlobId },
      { name: 'Source', value: 'walrus-mirror' },
    ];
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        irysTags.push({ name: k, value: v });
      }
    }

    // Upload to Arweave via Irys
    const receipt = await irys.upload(data, { tags: irysTags });

    return {
      walrusBlobId,
      arweaveId: receipt.id,
      arweaveUrl: `https://arweave.net/${receipt.id}`,
      contentType,
      size: data.length,
    };
  }

  /**
   * Mirror an NFT's image and metadata to Arweave.
   * Updates the metadata JSON to include the Arweave image URL.
   */
  async function mirrorNFT(
    imageBlobId: string,
    metadataBlobId: string,
    extraTags?: Record<string, string>,
  ): Promise<{ image: MirrorResult; metadata: MirrorResult }> {
    // 1. Mirror the image first
    console.log(`Mirroring image: ${imageBlobId}`);
    const image = await mirrorBlob(imageBlobId, 'image/jpeg', {
      ...extraTags,
      'Type': 'nft-image',
    });
    console.log(`  → Arweave: ${image.arweaveUrl} (${image.size} bytes)`);

    // 2. Fetch original metadata, add Arweave image URL
    const metaUrl = `${WALRUS_AGGREGATOR}/${metadataBlobId}`;
    const metaResp = await fetch(metaUrl);
    if (!metaResp.ok) throw new Error(`Failed to fetch metadata: ${metaResp.status}`);
    const metaJson = await metaResp.json();

    // Add Arweave URLs to metadata
    metaJson.image = image.arweaveUrl;
    metaJson.properties = metaJson.properties || {};
    metaJson.properties.files = metaJson.properties.files || [];
    metaJson.properties.files.push({
      uri: image.arweaveUrl,
      type: 'image/jpeg',
      cdn: true,
    });
    // Keep Walrus as backup
    metaJson.properties.walrus = {
      image_blob_id: imageBlobId,
      metadata_blob_id: metadataBlobId,
      image_url: `${WALRUS_AGGREGATOR}/${imageBlobId}`,
    };

    // 3. Upload updated metadata to Arweave
    console.log(`Mirroring metadata: ${metadataBlobId}`);
    const metaBuffer = Buffer.from(JSON.stringify(metaJson, null, 2));
    const irysTags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '3.0.0' },
      { name: 'Walrus-Blob-Id', value: metadataBlobId },
      { name: 'Source', value: 'walrus-mirror' },
      { name: 'Type', value: 'nft-metadata' },
    ];
    if (extraTags) {
      for (const [k, v] of Object.entries(extraTags)) {
        irysTags.push({ name: k, value: v });
      }
    }
    const metaReceipt = await (irys as any).upload(metaBuffer, { tags: irysTags });

    const metadata: MirrorResult = {
      walrusBlobId: metadataBlobId,
      arweaveId: metaReceipt.id,
      arweaveUrl: `https://arweave.net/${metaReceipt.id}`,
      contentType: 'application/json',
      size: metaBuffer.length,
    };
    console.log(`  → Arweave: ${metadata.arweaveUrl} (${metadata.size} bytes)`);

    return { image, metadata };
  }

  /**
   * Get Irys balance (in SOL)
   */
  async function getBalance(): Promise<number> {
    const balance = await irys.getLoadedBalance();
    return irys.utils.fromAtomic(balance).toNumber();
  }

  /**
   * Fund Irys with SOL for uploads
   */
  async function fund(amountSol: number): Promise<string> {
    const atomicAmount = irys.utils.toAtomic(amountSol);
    const response = await irys.fund(atomicAmount);
    return response.id;
  }

  return {
    mirrorBlob,
    mirrorNFT,
    getBalance,
    fund,
    irys,
  };
}
