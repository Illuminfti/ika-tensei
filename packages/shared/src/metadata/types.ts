/**
 * Universal NFT Metadata Schema
 * Chain-agnostic metadata format for Ika Tensei cross-chain NFT resolution
 */

export interface UniversalNFTMetadata {
  name: string;
  description: string;
  image: string;
  image_walrus?: string;
  animation_url?: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  collection: {
    name: string;
    image?: string;
    image_walrus?: string;
    family?: string;
  };
  provenance: {
    source_chain: string;
    source_contract: string;
    token_id: string;
    seal_hash: string;
    dwallet_id: string;
    sealed_at: number;
    original_metadata_uri?: string;
  };
  raw_metadata?: Record<string, unknown>;
}

/**
 * Metaplex-compatible JSON for Solana minting
 * Used when converting universal metadata to Solana-compatible format
 */
export interface MetaplexMetadataJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  animation_url?: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
  provenance: {
    source_chain: string;
    source_contract: string;
    token_id: string;
    seal_hash: string;
    dwallet_id: string;
  };
}
