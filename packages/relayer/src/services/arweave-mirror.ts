/**
 * Arweave Mirror Service
 *
 * Uploads NFT image + metadata to Arweave via Irys.
 * Replaces the previous Walrus-based mirroring flow.
 *
 * Now accepts raw buffers directly — no Walrus dependency.
 * Uses gateway.irys.xyz for returned URIs (faster CDN).
 */

import Irys from '@irys/sdk';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import type { Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

const IRYS_GATEWAY = 'https://gateway.irys.xyz';

// ─── Result types ──────────────────────────────────────────────────────────────

export interface ArweaveMirrorResult {
  imageArweaveUrl: string;
  metadataArweaveUrl: string;
  imageArweaveId: string;
  metadataArweaveId: string;
}

export interface UploadNFTResult {
  imageArweaveUri: string;
  metadataArweaveUri: string;
  imageArweaveId: string;
  metadataArweaveId: string;
}

// ─── Service interface ─────────────────────────────────────────────────────────

export interface ArweaveMirrorService {
  initialize(): Promise<void>;
  /**
   * Upload an NFT image buffer + metadata JSON object to Arweave.
   * Image URI is injected into the metadata before upload.
   */
  mirrorNFT(
    imageBuffer: Buffer,
    imageContentType: string,
    metadataJson: Record<string, unknown>,
  ): Promise<ArweaveMirrorResult>;
  /**
   * Upload arbitrary buffer to Arweave with custom tags.
   * Returns the permanent gateway URI.
   */
  uploadBuffer(
    buffer: Buffer,
    contentType: string,
    tags?: Array<{ name: string; value: string }>,
  ): Promise<string>;
  /**
   * Upload a JSON object to Arweave.
   * Returns the permanent gateway URI.
   */
  uploadJSON(
    json: Record<string, unknown>,
    tags?: Array<{ name: string; value: string }>,
  ): Promise<string>;
  /**
   * Download an image from any URI (ipfs://, ar://, https://, data:) and upload to Arweave.
   * Returns the Arweave URI and detected content type.
   */
  mirrorImageUrl(imageUrl: string): Promise<{ uri: string; contentType: string }>;
  /**
   * Full NFT upload: image buffer + metadata JSON → both on Arweave.
   */
  uploadNFT(
    imageBuffer: Buffer,
    imageContentType: string,
    metadataJson: Record<string, unknown>,
    tags?: Array<{ name: string; value: string }>,
  ): Promise<UploadNFTResult>;
  getBalance(): Promise<number>;
  isInitialized(): boolean;
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createArweaveMirror(
  config: RelayerConfig,
  logger: Logger,
): ArweaveMirrorService {
  let irys: Irys;
  let initialized = false;

  // ── Initialization ────────────────────────────────────────────────────────

  async function initialize(): Promise<void> {
    if (initialized) return;

    const secretKey = Buffer.from(config.solanaKeypairBytes);

    irys = new Irys({
      url: 'https://devnet.irys.xyz',
      token: 'solana',
      key: secretKey,
      config: { providerUrl: config.solanaRpcUrl },
    });

    await irys.ready();

    const rawBal = await irys.getLoadedBalance();
    const balSol = irys.utils.fromAtomic(rawBal).toNumber();
    logger.info(`Arweave mirror initialized: balance=${balSol} SOL`);

    if (balSol < 0.005) {
      logger.info('Funding Irys with 0.01 SOL...');
      try {
        await irys.fund(irys.utils.toAtomic(0.01));
        logger.info('Irys funded successfully');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn(`Irys funding failed: ${msg}. Uploads may fail.`);
      }
    }

    initialized = true;
  }

  // ── Core upload helpers ───────────────────────────────────────────────────

  async function uploadBuffer(
    buffer: Buffer,
    contentType: string,
    tags: Array<{ name: string; value: string }> = [],
  ): Promise<string> {
    if (!initialized) throw new Error('Arweave mirror not initialized');

    const allTags = [
      { name: 'Content-Type', value: contentType },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '4.0.0' },
      ...tags,
    ];

    const receipt = await irys.upload(buffer, { tags: allTags });
    const uri = `${IRYS_GATEWAY}/${receipt.id}`;
    logger.debug(`Uploaded buffer (${buffer.length}B, ${contentType}) → ${uri}`);
    return uri;
  }

  async function uploadJSON(
    json: Record<string, unknown>,
    tags: Array<{ name: string; value: string }> = [],
  ): Promise<string> {
    if (!initialized) throw new Error('Arweave mirror not initialized');

    const buffer = Buffer.from(JSON.stringify(json, null, 2), 'utf8');
    const allTags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '4.0.0' },
      ...tags,
    ];

    const receipt = await irys.upload(buffer, { tags: allTags });
    const uri = `${IRYS_GATEWAY}/${receipt.id}`;
    logger.debug(`Uploaded JSON (${buffer.length}B) → ${uri}`);
    return uri;
  }

  // ── Image mirroring ───────────────────────────────────────────────────────

  const IPFS_GATEWAYS = [
    'https://nftstorage.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://w3s.link/ipfs/',
  ] as const;

  async function mirrorImageUrl(
    imageUrl: string,
  ): Promise<{ uri: string; contentType: string }> {
    if (!initialized) throw new Error('Arweave mirror not initialized');

    logger.info(`Downloading image from: ${imageUrl}`);

    if (imageUrl.startsWith('ar://')) {
      // Already on Arweave — return permanent URL without re-uploading
      const txId = imageUrl.slice(5);
      logger.info(`Image already on Arweave: https://arweave.net/${txId}`);
      return { uri: `https://arweave.net/${txId}`, contentType: 'image/png' };
    }

    if (imageUrl.startsWith('data:')) {
      const commaIdx = imageUrl.indexOf(',');
      const header = imageUrl.slice(0, commaIdx);
      const b64 = imageUrl.slice(commaIdx + 1);
      const contentType = header.split(';')[0]?.replace('data:', '') ?? 'image/png';
      const buf = Buffer.from(b64, 'base64');
      const uri = await uploadBuffer(buf, contentType, [{ name: 'Type', value: 'nft-image' }]);
      return { uri, contentType };
    }

    let imageBuffer: Buffer | undefined;
    let contentType = 'image/png';

    if (imageUrl.startsWith('ipfs://')) {
      const cid = imageUrl.slice(7);
      let fetched = false;
      for (const gw of IPFS_GATEWAYS) {
        try {
          const resp = await fetch(gw + cid, { signal: AbortSignal.timeout(10_000) });
          if (resp.ok) {
            imageBuffer = Buffer.from(await resp.arrayBuffer());
            contentType = (resp.headers.get('content-type') ?? 'image/png').split(';')[0]?.trim() ?? 'image/png';
            logger.info(`IPFS resolved via ${gw} (${imageBuffer.length}B)`);
            fetched = true;
            break;
          }
        } catch { /* try next */ }
      }
      if (!fetched) throw new Error(`IPFS resolution failed for ${imageUrl}`);
    } else {
      const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) throw new Error(`Failed to download image: HTTP ${resp.status}`);
      imageBuffer = Buffer.from(await resp.arrayBuffer());
      contentType = (resp.headers.get('content-type') ?? 'image/png').split(';')[0]?.trim() ?? 'image/png';
    }

    const uri = await uploadBuffer(imageBuffer!, contentType, [{ name: 'Type', value: 'nft-image' }]);
    logger.info(`Image mirrored to Arweave: ${uri}`);
    return { uri, contentType };
  }

  // ── NFT upload ────────────────────────────────────────────────────────────

  async function uploadNFT(
    imageBuffer: Buffer,
    imageContentType: string,
    metadataJson: Record<string, unknown>,
    tags: Array<{ name: string; value: string }> = [],
  ): Promise<UploadNFTResult> {
    if (!initialized) throw new Error('Arweave mirror not initialized');

    logger.info(`Uploading NFT image to Arweave (${imageBuffer.length}B)...`);
    const imageArweaveUri = await uploadBuffer(imageBuffer, imageContentType, [
      { name: 'Type', value: 'nft-image' },
      ...tags,
    ]);

    const metaWithImage = { ...metadataJson, image: imageArweaveUri };
    logger.info('Uploading NFT metadata to Arweave...');
    const metadataArweaveUri = await uploadJSON(metaWithImage, [
      { name: 'Type', value: 'nft-metadata' },
      ...tags,
    ]);

    return {
      imageArweaveUri,
      metadataArweaveUri,
      imageArweaveId: imageArweaveUri.split('/').pop() ?? '',
      metadataArweaveId: metadataArweaveUri.split('/').pop() ?? '',
    };
  }

  // ── mirrorNFT (legacy-compat wrapper) ────────────────────────────────────

  async function mirrorNFT(
    imageBuffer: Buffer,
    imageContentType: string,
    metadataJson: Record<string, unknown>,
  ): Promise<ArweaveMirrorResult> {
    const result = await uploadNFT(imageBuffer, imageContentType, metadataJson);
    return {
      imageArweaveUrl: result.imageArweaveUri,
      metadataArweaveUrl: result.metadataArweaveUri,
      imageArweaveId: result.imageArweaveId,
      metadataArweaveId: result.metadataArweaveId,
    };
  }

  // ── Balance ───────────────────────────────────────────────────────────────

  async function getBalance(): Promise<number> {
    if (!initialized) return 0;
    const raw = await irys.getLoadedBalance();
    return irys.utils.fromAtomic(raw).toNumber();
  }

  return {
    initialize,
    mirrorNFT,
    uploadBuffer,
    uploadJSON,
    mirrorImageUrl,
    uploadNFT,
    getBalance,
    isInitialized: () => initialized,
  };
}

/**
 * Load a Solana keypair from file (utility for standalone use).
 */
export function loadSolanaKeypair(path?: string): Buffer {
  const keypairPath = path ?? `${homedir()}/.config/solana/id.json`;
  const raw = JSON.parse(readFileSync(keypairPath, 'utf8')) as number[];
  return Buffer.from(raw);
}
