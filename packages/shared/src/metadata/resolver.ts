/**
 * Universal NFT Metadata Resolver
 * Main orchestrator that routes to chain-specific adapters
 */

import { fetchEthereumMetadata } from './ethereum.js';
import { fetchSolanaMetadata } from './solana.js';
import { fetchSuiMetadata } from './sui.js';
import { fetchNearMetadata } from './near.js';
import type { UniversalNFTMetadata, MetaplexMetadataJson } from './types.js';

/**
 * Supported chain identifiers
 */
export type SupportedChain = 'ethereum' | 'solana' | 'sui' | 'near';

/**
 * Resolver configuration
 */
export interface ResolverConfig {
  chain: SupportedChain;
  rpcUrl: string;
  contract: string;
  tokenId: string;
  sealHash?: string;
  dwalletId?: string;
}

/**
 * Error class for metadata resolution failures
 */
export class MetadataResolverError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MetadataResolverError';
  }
}

/**
 * Resolves metadata from any supported chain
 * Routes to the appropriate adapter based on chain identifier
 */
export async function resolveMetadata(config: ResolverConfig): Promise<UniversalNFTMetadata> {
  const { chain, rpcUrl, contract, tokenId, sealHash = '', dwalletId = '' } = config;

  switch (chain) {
    case 'ethereum':
      return fetchEthereumMetadata(rpcUrl, contract, tokenId, sealHash, dwalletId);

    case 'solana':
      return fetchSolanaMetadata(rpcUrl, contract, sealHash, dwalletId);

    case 'sui':
      return fetchSuiMetadata(rpcUrl, contract, sealHash, dwalletId);

    case 'near':
      return fetchNearMetadata(rpcUrl, contract, tokenId, sealHash, dwalletId);

    default:
      throw new MetadataResolverError(`Unsupported chain: ${chain}`);
  }
}

/**
 * Converts UniversalNFTMetadata to Metaplex-compatible JSON
 * Used for Solana minting with proper royalty distribution
 */
export function toMetaplexJson(
  metadata: UniversalNFTMetadata,
  sealHash: string,
  guildTreasury: string,
  teamTreasury: string,
  symbol: string = 'IKA'
): MetaplexMetadataJson {
  // Determine file type from image URL
  const imageUrl = metadata.image_walrus || metadata.image;
  const fileExtension = imageUrl.split('.').pop()?.toLowerCase() || 'png';
  const mimeType = getMimeType(fileExtension);

  // Build attributes array
  const attributes = metadata.attributes.map(attr => ({
    trait_type: attr.trait_type,
    value: attr.value,
  }));

  // Add seal hash as attribute if provided
  if (sealHash) {
    attributes.push({
      trait_type: 'Seal Hash',
      value: sealHash,
    });
  }

  // Build creators array with royalty splits
  // 72% guild, 28% team (matching on-chain config)
  const creators = [
    {
      address: guildTreasury,
      share: 72,
    },
    {
      address: teamTreasury,
      share: 28,
    },
  ];

  // Determine category from animation_url
  let category: string;
  if (metadata.animation_url) {
    const animExt = metadata.animation_url.split('.').pop()?.toLowerCase();
    if (animExt === 'mp4' || animExt === 'webm' || animExt === 'mov') {
      category = 'video';
    } else if (animExt === 'html' || animExt === 'glb' || animExt === 'gltf') {
      category = 'html';
    } else {
      category = 'image';
    }
  } else {
    category = 'image';
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
      files: [
        {
          uri: imageUrl,
          type: mimeType,
        },
      ],
      category,
      creators,
    },
    provenance: {
      source_chain: metadata.provenance.source_chain,
      source_contract: metadata.provenance.source_contract,
      token_id: metadata.provenance.token_id,
      seal_hash: sealHash || metadata.provenance.seal_hash,
      dwallet_id: metadata.provenance.dwallet_id,
    },
  };

  return metaplexJson;
}

/**
 * Gets MIME type from file extension
 */
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

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}
