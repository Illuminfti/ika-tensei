/**
 * Metadata Module
 * Universal NFT metadata resolution across multiple chains
 */

// Types
export type { UniversalNFTMetadata, MetaplexMetadataJson } from './types.js';

// Resolver
export { 
  resolveMetadata, 
  toMetaplexJson,
  type ResolverConfig,
  type SupportedChain,
  MetadataResolverError,
} from './resolver.js';

// Chain adapters
export { fetchEthereumMetadata, EthereumMetadataError } from './ethereum.js';
export { fetchSolanaMetadata, SolanaMetadataError } from './solana.js';
export { fetchSuiMetadata, SuiMetadataError } from './sui.js';
export { fetchNearMetadata, NearMetadataError } from './near.js';
