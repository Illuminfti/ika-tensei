/**
 * Reborn NFT Metadata Builder
 *
 * Takes UniversalNFTMetadata + Arweave image URI → builds the
 * Metaplex-compatible reborn metadata JSON exactly matching PRD v4 spec.
 *
 * Output format: Metaplex-compatible JSON for upload to Arweave via Irys,
 * then used as the `uri` when minting a Metaplex Core asset on Solana.
 */

import type { UniversalNFTMetadata } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RebornAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

export interface RebornProvenanceProperties {
  source_chain: string;
  source_chain_id: number;
  source_contract: string;
  source_token_id: string;
  dwallet_address: string;
  seal_tx: string;
  original_metadata_uri?: string;
}

export interface RebornMetadataJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  animation_url?: string;
  external_url?: string;
  attributes: RebornAttribute[];
  properties: {
    files: Array<{ uri: string; type: string }>;
    category: string;
    creators: Array<{ address: string; share: number }>;
    provenance: RebornProvenanceProperties;
  };
}

export interface BuildRebornMetadataParams {
  /** Resolved original NFT metadata from source chain */
  original: UniversalNFTMetadata;
  /** Arweave URI for the uploaded image (via Irys) */
  imageArweaveUri: string;
  /** Arweave URI for uploaded animation/video (optional) */
  animationArweaveUri?: string;
  /** dWallet address that permanently holds the sealed original */
  dwalletAddress: string;
  /** Solana transaction signature of the seal operation */
  sealTx: string;
  /** Protocol treasury address (for creators array) */
  protocolTreasury?: string;
}

// ── Chain metadata ─────────────────────────────────────────────────────────────

const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  sui: 2,
  solana: 3,
  near: 4,
  bitcoin: 5,
  polygon: 6,
  arbitrum: 7,
  optimism: 8,
  base: 9,
  bsc: 10,
  avalanche: 11,
  fantom: 12,
  moonbeam: 13,
  celo: 14,
  klaytn: 15,
  scroll: 16,
  mantle: 17,
  blast: 18,
  linea: 19,
  gnosis: 20,
  aurora: 21,
  berachain: 22,
  aptos: 23,
};

const CHAIN_DISPLAY_NAME: Record<string, string> = {
  ethereum: 'Ethereum',
  sui: 'Sui',
  solana: 'Solana',
  near: 'NEAR',
  bitcoin: 'Bitcoin',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  bsc: 'BNB Chain',
  avalanche: 'Avalanche',
  fantom: 'Fantom',
  moonbeam: 'Moonbeam',
  celo: 'Celo',
  klaytn: 'Klaytn',
  scroll: 'Scroll',
  mantle: 'Mantle',
  blast: 'Blast',
  linea: 'Linea',
  gnosis: 'Gnosis',
  aurora: 'Aurora',
  berachain: 'Berachain',
  aptos: 'Aptos',
};

/**
 * Get the block explorer URL for the original NFT on source chain.
 */
function getExternalUrl(
  chain: string,
  contract: string,
  tokenId: string,
): string {
  const c = chain.toLowerCase();
  switch (c) {
    case 'ethereum':
      return `https://etherscan.io/nft/${contract}/${tokenId}`;
    case 'polygon':
      return `https://polygonscan.com/nft/${contract}/${tokenId}`;
    case 'arbitrum':
      return `https://arbiscan.io/nft/${contract}/${tokenId}`;
    case 'optimism':
      return `https://optimistic.etherscan.io/nft/${contract}/${tokenId}`;
    case 'base':
      return `https://basescan.org/nft/${contract}/${tokenId}`;
    case 'bsc':
      return `https://bscscan.com/nft/${contract}/${tokenId}`;
    case 'avalanche':
      return `https://snowtrace.io/nft/${contract}/${tokenId}`;
    case 'fantom':
      return `https://ftmscan.com/nft/${contract}/${tokenId}`;
    case 'sui':
      return `https://suiscan.xyz/mainnet/object/${tokenId}`;
    case 'solana':
      return `https://solscan.io/token/${tokenId}`;
    case 'near':
      return `https://nearblocks.io/nft-token/${contract}/${tokenId}`;
    case 'aptos':
      return `https://explorer.aptoslabs.com/object/${tokenId}`;
    default:
      return `https://ika-tensei.io/nft/${c}/${contract}/${tokenId}`;
  }
}

/**
 * Get MIME type string for a file URI.
 */
function guessMimeType(uri: string): string {
  if (!uri) return 'image/png';
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return 'model/gltf-binary';
  return 'image/png'; // safe default
}

// ── Main builder ───────────────────────────────────────────────────────────────

/**
 * Build the Metaplex-compatible reborn metadata JSON per PRD v4 spec.
 *
 * Rules:
 * - Name:        "{original.name} ✦ Reborn"
 * - Description: "Originally {name} from {collection} on {chain}. Sealed and reborn..."
 * - Attributes:  All original attributes preserved + 5 provenance attributes appended
 * - external_url: Source chain block explorer link
 * - properties.provenance: Full cryptographic provenance object
 */
export function buildRebornMetadata(
  params: BuildRebornMetadataParams,
): RebornMetadataJson {
  const {
    original,
    imageArweaveUri,
    animationArweaveUri,
    dwalletAddress,
    sealTx,
    protocolTreasury,
  } = params;

  const chain = original.provenance.source_chain;
  const chainDisplay = CHAIN_DISPLAY_NAME[chain.toLowerCase()] ?? chain;
  const chainId = CHAIN_ID_MAP[chain.toLowerCase()] ?? 0;
  const contract = original.provenance.source_contract;
  const tokenId = original.provenance.token_id;
  const collectionName = original.collection.name || 'Unknown Collection';

  // ── Name ──────────────────────────────────────────────────────────────────
  const rebornName = `${original.name} ✦ Reborn`;

  // ── Description ───────────────────────────────────────────────────────────
  const description =
    `Originally ${original.name} from the ${collectionName} collection on ${chainDisplay}. ` +
    `Sealed and reborn on Solana through Ika Tensei — the NFT reincarnation protocol.`;

  // ── Attributes: original + provenance ─────────────────────────────────────
  // Preserve all original attributes
  const preservedAttributes: RebornAttribute[] = (original.attributes ?? []).map(attr => ({
    trait_type: attr.trait_type,
    value: attr.value,
    ...(attr.display_type ? { display_type: attr.display_type } : {}),
  }));

  // Append provenance attributes as per PRD v4
  const sealDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const provenanceAttributes: RebornAttribute[] = [
    { trait_type: 'Source Chain', value: chainDisplay },
    { trait_type: 'Source Collection', value: collectionName },
    { trait_type: 'Source Token ID', value: tokenId },
    { trait_type: 'Seal Date', value: sealDate },
    { trait_type: 'dWallet Address', value: dwalletAddress },
    { trait_type: 'Provenance', value: 'Ika Tensei Reborn' },
  ];

  const attributes = [...preservedAttributes, ...provenanceAttributes];

  // ── External URL ──────────────────────────────────────────────────────────
  const external_url = getExternalUrl(chain, contract, tokenId);

  // ── Files array ───────────────────────────────────────────────────────────
  const imageMime = guessMimeType(imageArweaveUri);
  const files: Array<{ uri: string; type: string }> = [
    { uri: imageArweaveUri, type: imageMime },
  ];
  if (animationArweaveUri) {
    files.push({ uri: animationArweaveUri, type: guessMimeType(animationArweaveUri) });
  }

  // ── Provenance object ─────────────────────────────────────────────────────
  const provenance: RebornProvenanceProperties = {
    source_chain: chain,
    source_chain_id: chainId,
    source_contract: contract,
    source_token_id: tokenId,
    dwallet_address: dwalletAddress,
    seal_tx: sealTx,
    ...(original.provenance.original_metadata_uri
      ? { original_metadata_uri: original.provenance.original_metadata_uri }
      : {}),
  };

  // ── Creators ──────────────────────────────────────────────────────────────
  const creators = protocolTreasury
    ? [{ address: protocolTreasury, share: 100 }]
    : [];

  // ── Assemble ──────────────────────────────────────────────────────────────
  const metadata: RebornMetadataJson = {
    name: rebornName,
    symbol: 'REBORN',
    description,
    image: imageArweaveUri,
    external_url,
    attributes,
    properties: {
      files,
      category: animationArweaveUri ? 'video' : 'image',
      creators,
      provenance,
    },
  };

  if (animationArweaveUri) {
    metadata.animation_url = animationArweaveUri;
  }

  return metadata;
}
