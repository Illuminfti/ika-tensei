/**
 * Universal NFT Metadata Resolver
 * Main orchestrator that routes to chain-specific adapters with tiered fallback.
 *
 * Tiers:
 *   1. API-backed resolvers (Alchemy for EVM, Helius DAS for Solana)
 *   2. Direct RPC (tokenURI / getAsset / nft_token)
 *   3. resolveAndUpload — full pipeline: fetch → resolve image → upload to Arweave
 */

import { fetchEthereumMetadata, type EthereumResolverConfig } from './ethereum.js';
import { fetchSolanaMetadata, type SolanaResolverConfig } from './solana.js';
import { fetchSuiMetadata } from './sui.js';
import { fetchNearMetadata } from './near.js';
import { fetchAptosMetadata } from './aptos.js';
import type { UniversalNFTMetadata, MetaplexMetadataJson } from './types.js';
import {
  uploadImage,
  uploadMetadata,
  type ArweaveUploaderConfig,
} from '../arweave-uploader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedChain = 'ethereum' | 'solana' | 'sui' | 'near' | 'aptos';

/** API keys for Tier 1 resolvers */
export interface ResolverApiConfig {
  /** Alchemy API key for EVM chains */
  alchemyApiKey?: string;
  /**
   * Alchemy chain name, e.g. 'eth-mainnet', 'polygon-mainnet', 'arb-mainnet'.
   * Defaults to 'eth-mainnet'.
   */
  alchemyChainName?: string;
  /** Helius API key for Solana (enables DAS + compressed NFTs) */
  heliusApiKey?: string;
}

export interface ResolverConfig {
  chain: SupportedChain;
  rpcUrl: string;
  contract: string;
  tokenId: string;
  sealHash?: string;
  dwalletId?: string;
}

export interface ResolveAndUploadResult {
  imageUri: string;
  metadataUri: string;
  metadata: UniversalNFTMetadata;
}

export class MetadataResolverError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MetadataResolverError';
  }
}

// ─── Chain resolver ───────────────────────────────────────────────────────────

/**
 * Resolves metadata from any supported chain.
 * Optionally accepts API config for Tier 1 resolvers.
 */
export async function resolveMetadata(
  config: ResolverConfig,
  apiConfig?: ResolverApiConfig,
): Promise<UniversalNFTMetadata> {
  const { chain, rpcUrl, contract, tokenId, sealHash = '', dwalletId = '' } = config;

  const ethConfig: EthereumResolverConfig = {
    alchemyApiKey: apiConfig?.alchemyApiKey,
    alchemyChainName: apiConfig?.alchemyChainName,
  };

  const solConfig: SolanaResolverConfig = {
    heliusApiKey: apiConfig?.heliusApiKey,
  };

  switch (chain) {
    case 'ethereum':
      return fetchEthereumMetadata(rpcUrl, contract, tokenId, sealHash, dwalletId, ethConfig);

    case 'solana':
      return fetchSolanaMetadata(rpcUrl, contract, sealHash, dwalletId, solConfig);

    case 'sui':
      return fetchSuiMetadata(rpcUrl, contract, sealHash, dwalletId);

    case 'near':
      return fetchNearMetadata(rpcUrl, contract, tokenId, sealHash, dwalletId);

    case 'aptos':
      return fetchAptosMetadata(rpcUrl, contract, tokenId, sealHash, dwalletId);

    default: {
      const _exhaustive: never = chain;
      throw new MetadataResolverError(`Unsupported chain: ${_exhaustive}`);
    }
  }
}

// ─── Image fetcher ────────────────────────────────────────────────────────────

const IPFS_GATEWAYS = [
  'https://nftstorage.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://w3s.link/ipfs/',
] as const;

interface FetchedImage {
  buffer: Buffer;
  mime: string;
}

async function fetchIpfsCid(cid: string): Promise<FetchedImage> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const resp = await fetch(gateway + cid, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') ?? 'image/png';
      const buf = Buffer.from(await resp.arrayBuffer());
      return { buffer: buf, mime: contentType.split(';')[0]?.trim() ?? 'image/png' };
    } catch {
      // try next
    }
  }
  throw new MetadataResolverError(`IPFS fetch failed for CID ${cid} on all gateways`);
}

/**
 * Download image from any URI scheme to a Buffer.
 * Handles: ipfs://, ar://, data:image/svg+xml;base64, https://
 */
export async function fetchImageAsBuffer(imageUrl: string): Promise<FetchedImage> {
  // On-chain base64 SVG
  if (imageUrl.startsWith('data:image/svg+xml;base64,')) {
    const b64 = imageUrl.slice('data:image/svg+xml;base64,'.length);
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/svg+xml' };
  }
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match?.[1] && match?.[2]) {
      return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] };
    }
  }
  if (imageUrl.startsWith('ipfs://')) {
    return fetchIpfsCid(imageUrl.slice(7));
  }
  if (imageUrl.startsWith('ar://')) {
    const resp = await fetch(`https://arweave.net/${imageUrl.slice(5)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) throw new MetadataResolverError(`Arweave image fetch failed: ${resp.status}`);
    const contentType = resp.headers.get('content-type') ?? 'image/png';
    return {
      buffer: Buffer.from(await resp.arrayBuffer()),
      mime: contentType.split(';')[0]?.trim() ?? 'image/png',
    };
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new MetadataResolverError(`Image fetch failed: ${resp.status}`);
    const contentType = resp.headers.get('content-type') ?? 'image/png';
    return {
      buffer: Buffer.from(await resp.arrayBuffer()),
      mime: contentType.split(';')[0]?.trim() ?? 'image/png',
    };
  }
  throw new MetadataResolverError(`Unrecognised image URI: ${imageUrl}`);
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

/**
 * Full pipeline: fetch metadata → download image → upload to Arweave → return URIs.
 *
 * Steps:
 *   1. resolveMetadata() — chain-specific fetch with tiered API fallback
 *   2. fetchImageAsBuffer() — download image (handles all URI schemes)
 *   3. uploadImage() → Arweave image URI
 *   4. Build metadata JSON with Arweave image URI
 *   5. uploadMetadata() → Arweave metadata URI
 *   6. Return { imageUri, metadataUri, metadata }
 */
export async function resolveAndUpload(
  resolverConfig: ResolverConfig,
  uploaderConfig: ArweaveUploaderConfig,
  apiConfig?: ResolverApiConfig,
): Promise<ResolveAndUploadResult> {
  // Step 1: Fetch metadata
  const metadata = await resolveMetadata(resolverConfig, apiConfig);

  if (!metadata.image) {
    throw new MetadataResolverError('Metadata has no image URL — cannot upload');
  }

  // Step 2: Download image
  const { buffer: imageBuffer, mime: imageMime } = await fetchImageAsBuffer(metadata.image);

  // Step 3: Upload image to Arweave
  const imageResult = await uploadImage(imageBuffer, imageMime, uploaderConfig);

  // Step 4: Stamp image_arweave on metadata
  const updatedMetadata: UniversalNFTMetadata = {
    ...metadata,
    image_arweave: imageResult.url,
  };

  // Step 5: Build + upload metadata JSON
  const metaJson: Record<string, unknown> = {
    name: updatedMetadata.name,
    symbol: 'REBORN',
    description: updatedMetadata.description,
    image: imageResult.url,
    attributes: [
      ...updatedMetadata.attributes,
      { trait_type: 'Source Chain', value: updatedMetadata.provenance.source_chain },
      { trait_type: 'Source Collection', value: updatedMetadata.collection.name },
      {
        trait_type: 'Source Token ID',
        value: updatedMetadata.provenance.token_id,
      },
    ],
    properties: {
      files: [{ uri: imageResult.url, type: imageMime }],
      category: imageMime.startsWith('video/') ? 'video' : 'image',
      provenance: {
        source_chain: updatedMetadata.provenance.source_chain,
        source_contract: updatedMetadata.provenance.source_contract,
        source_token_id: updatedMetadata.provenance.token_id,
        dwallet_address: updatedMetadata.provenance.dwallet_id || undefined,
        original_metadata_uri: updatedMetadata.provenance.original_metadata_uri,
      },
    },
  };

  if (updatedMetadata.animation_url) metaJson['animation_url'] = updatedMetadata.animation_url;
  if (updatedMetadata.external_url) metaJson['external_url'] = updatedMetadata.external_url;

  const metaResult = await uploadMetadata(metaJson, uploaderConfig);

  return {
    imageUri: imageResult.url,
    metadataUri: metaResult.url,
    metadata: updatedMetadata,
  };
}

// ─── Metaplex JSON converter ──────────────────────────────────────────────────

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    html: 'text/html',
  };
  return mimeTypes[extension.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Converts UniversalNFTMetadata to Metaplex-compatible JSON (PRD v4 schema).
 * Provenance is nested inside properties.
 */
export function toMetaplexJson(
  metadata: UniversalNFTMetadata,
  sealHash: string,
  guildTreasury: string,
  teamTreasury: string,
  options?: {
    symbol?: string;
    sealTx?: string;
    sourceChainId?: number;
    dwalletAddress?: string;
  },
): MetaplexMetadataJson {
  const symbol = options?.symbol ?? 'REBORN';
  const imageUrl = metadata.image_arweave ?? metadata.image;
  const fileExtension = imageUrl.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeType = getMimeType(fileExtension);

  const attributes = metadata.attributes.map(attr => ({
    trait_type: attr.trait_type,
    value: attr.value,
  }));

  if (sealHash) attributes.push({ trait_type: 'Seal Hash', value: sealHash });

  // Category from animation
  let category = 'image';
  if (metadata.animation_url) {
    const ext = metadata.animation_url.split('.').pop()?.toLowerCase();
    if (ext === 'mp4' || ext === 'webm' || ext === 'mov') category = 'video';
    else if (ext === 'html' || ext === 'glb' || ext === 'gltf') category = 'html';
  }

  const metaplexJson: MetaplexMetadataJson = {
    name: metadata.name,
    symbol,
    description: metadata.description,
    image: imageUrl,
    animation_url: metadata.animation_url,
    external_url: metadata.external_url,
    attributes,
    properties: {
      files: [{ uri: imageUrl, type: mimeType }],
      category,
      creators: [
        { address: guildTreasury, share: 72 },
        { address: teamTreasury, share: 28 },
      ],
      provenance: {
        source_chain: metadata.provenance.source_chain,
        source_chain_id: options?.sourceChainId,
        source_contract: metadata.provenance.source_contract,
        source_token_id: metadata.provenance.token_id,
        dwallet_address: options?.dwalletAddress ?? (metadata.provenance.dwallet_id || undefined),
        seal_tx: options?.sealTx,
        original_metadata_uri: metadata.provenance.original_metadata_uri,
      },
    },
  };

  return metaplexJson;
}
