/**
 * Metadata Module
 * Universal NFT metadata resolution across multiple chains
 */

// Types
export type { UniversalNFTMetadata, MetaplexMetadataJson } from './types.js';

// Resolver
export {
  resolveMetadata,
  resolveAndUpload,
  toMetaplexJson,
  fetchImageAsBuffer,
  type ResolverConfig,
  type SupportedChain,
  type ResolverApiConfig,
  type ResolveAndUploadResult,
  MetadataResolverError,
} from './resolver.js';

// Chain adapters
export { fetchEthereumMetadata, EthereumMetadataError, type EthereumResolverConfig } from './ethereum.js';
export { fetchSolanaMetadata, SolanaMetadataError, type SolanaResolverConfig } from './solana.js';
export { fetchSuiMetadata, SuiMetadataError } from './sui.js';
export { fetchNearMetadata, NearMetadataError } from './near.js';
export { fetchAptosMetadata, AptosMetadataError } from './aptos.js';

// Reborn metadata builder (PRD v4)
export {
  buildRebornMetadata,
  type BuildRebornMetadataParams,
  type RebornMetadataJson,
  type RebornProvenanceProperties,
  type RebornAttribute,
} from './reborn-builder.js';
