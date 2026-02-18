/**
 * Arweave Uploader via Irys
 *
 * Replaces Walrus storage for permanent NFT asset storage.
 * Pays using a Solana keypair. Returns gateway.irys.xyz URIs.
 *
 * Functions:
 *   uploadImage(buffer, mime, config)     — upload raw image bytes
 *   uploadMetadata(json, config)          — upload JSON metadata
 *   uploadNFT(metadata, imageBuffer, config) — full pipeline
 */

import Irys from '@irys/sdk';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import type { UniversalNFTMetadata } from './metadata/types.js';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ArweaveUploaderConfig {
  /** 'devnet' (Irys devnet, free) or 'mainnet' (Irys node2, paid) */
  network: 'devnet' | 'mainnet';
  /** Path to Solana keypair JSON file. Defaults to ~/.config/solana/id.json */
  solanaKeypairPath?: string;
  /** Raw keypair bytes (alternative to solanaKeypairPath) */
  solanaKeypairBytes?: Uint8Array;
  /** Solana RPC URL for Irys. Defaults to matching devnet/mainnet RPC. */
  solanaRpcUrl?: string;
  /**
   * Minimum Irys balance in SOL before auto-funding.
   * Defaults to 0.005 SOL.
   */
  minBalanceSol?: number;
  /**
   * Amount to fund when balance is low, in SOL.
   * Defaults to 0.02 SOL.
   */
  fundAmountSol?: number;
}

export interface ArweaveUploadResult {
  txId: string;
  /** https://gateway.irys.xyz/{txId} */
  url: string;
}

// ─── Irys client factory ──────────────────────────────────────────────────────

const IRYS_NODE_DEVNET = 'https://devnet.irys.xyz';
const IRYS_NODE_MAINNET = 'https://node2.irys.xyz';
const IRYS_GATEWAY = 'https://gateway.irys.xyz';

function getIrysNode(network: 'devnet' | 'mainnet'): string {
  return network === 'devnet' ? IRYS_NODE_DEVNET : IRYS_NODE_MAINNET;
}

function getSolanaRpcUrl(network: 'devnet' | 'mainnet', override?: string): string {
  if (override) return override;
  return network === 'devnet'
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
}

function loadKeypairBytes(config: ArweaveUploaderConfig): Buffer {
  if (config.solanaKeypairBytes) {
    return Buffer.from(config.solanaKeypairBytes);
  }
  const keypairPath =
    config.solanaKeypairPath ?? `${homedir()}/.config/solana/id.json`;
  const raw = JSON.parse(readFileSync(keypairPath, 'utf8')) as number[];
  return Buffer.from(raw);
}

async function createIrysClient(config: ArweaveUploaderConfig): Promise<Irys> {
  const secretKey = loadKeypairBytes(config);
  const irys = new Irys({
    url: getIrysNode(config.network),
    token: 'solana',
    key: secretKey,
    config: {
      providerUrl: getSolanaRpcUrl(config.network, config.solanaRpcUrl),
    },
  });
  await irys.ready();

  // Check balance and auto-fund if needed
  const minBalance = config.minBalanceSol ?? 0.005;
  const fundAmount = config.fundAmountSol ?? 0.02;

  try {
    const rawBalance = await irys.getLoadedBalance();
    const balanceSol = irys.utils.fromAtomic(rawBalance).toNumber();
    if (balanceSol < minBalance) {
      await irys.fund(irys.utils.toAtomic(fundAmount));
    }
  } catch {
    // Funding failure is non-fatal — upload may still succeed if there's residual balance
  }

  return irys;
}

// ─── Upload functions ─────────────────────────────────────────────────────────

/**
 * Upload a raw image buffer to Arweave via Irys.
 * Returns the Arweave transaction ID and gateway URL.
 */
export async function uploadImage(
  buffer: Buffer,
  mime: string,
  config: ArweaveUploaderConfig,
): Promise<ArweaveUploadResult> {
  const irys = await createIrysClient(config);

  const receipt = await irys.upload(buffer, {
    tags: [
      { name: 'Content-Type', value: mime },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '4.0.0' },
      { name: 'Type', value: 'nft-image' },
    ],
  });

  return {
    txId: receipt.id,
    url: `${IRYS_GATEWAY}/${receipt.id}`,
  };
}

/**
 * Upload a JSON metadata object to Arweave via Irys.
 * Returns the Arweave transaction ID and gateway URL.
 */
export async function uploadMetadata(
  json: Record<string, unknown>,
  config: ArweaveUploaderConfig,
): Promise<ArweaveUploadResult> {
  const irys = await createIrysClient(config);
  const data = Buffer.from(JSON.stringify(json, null, 2), 'utf8');

  const receipt = await irys.upload(data, {
    tags: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'App-Version', value: '4.0.0' },
      { name: 'Type', value: 'nft-metadata' },
    ],
  });

  return {
    txId: receipt.id,
    url: `${IRYS_GATEWAY}/${receipt.id}`,
  };
}

/**
 * Full pipeline: upload image + build + upload metadata JSON.
 *
 * Builds a metadata JSON from UniversalNFTMetadata with the Arweave image URI
 * embedded, then uploads both. Returns Arweave URIs for both.
 */
export async function uploadNFT(
  metadata: UniversalNFTMetadata,
  imageBuffer: Buffer,
  imageMime: string,
  config: ArweaveUploaderConfig,
): Promise<{ imageUri: string; metadataUri: string }> {
  // 1. Upload image
  const imageResult = await uploadImage(imageBuffer, imageMime, config);

  // 2. Build metadata JSON with Arweave image URI
  const metaJson: Record<string, unknown> = {
    name: metadata.name,
    symbol: 'REBORN',
    description: metadata.description,
    image: imageResult.url,
    attributes: metadata.attributes,
    properties: {
      files: [{ uri: imageResult.url, type: imageMime }],
      category: imageMime.startsWith('video/') ? 'video' : 'image',
      provenance: {
        source_chain: metadata.provenance.source_chain,
        source_contract: metadata.provenance.source_contract,
        source_token_id: metadata.provenance.token_id,
        dwallet_address: metadata.provenance.dwallet_id || undefined,
        original_metadata_uri: metadata.provenance.original_metadata_uri,
        fetched_at: metadata.provenance.fetched_at,
      },
    },
  };

  if (metadata.animation_url) metaJson['animation_url'] = metadata.animation_url;
  if (metadata.external_url) metaJson['external_url'] = metadata.external_url;

  // 3. Upload metadata
  const metaResult = await uploadMetadata(metaJson, config);

  return {
    imageUri: imageResult.url,
    metadataUri: metaResult.url,
  };
}

/**
 * Check the current Irys (Arweave) upload balance in SOL.
 */
export async function getArweaveBalance(config: ArweaveUploaderConfig): Promise<number> {
  const irys = await createIrysClient(config);
  const raw = await irys.getLoadedBalance();
  return irys.utils.fromAtomic(raw).toNumber();
}
