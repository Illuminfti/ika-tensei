/**
 * Universal NFT Metadata Schema
 * Chain-agnostic metadata format for Ika Tensei cross-chain NFT resolution
 */

export interface UniversalNFTMetadata {
  name: string;
  description: string;
  image: string;
  image_arweave?: string;
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
    fetched_at: string;
  };
  raw_metadata?: Record<string, unknown>;
}

/**
 * Metaplex-compatible JSON for Solana minting (PRD v4 schema)
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
    provenance: {
      source_chain: string;
      source_chain_id?: number;
      source_contract: string;
      source_token_id: string;
      dwallet_address?: string;
      seal_tx?: string;
      original_metadata_uri?: string;
    };
  };
}
