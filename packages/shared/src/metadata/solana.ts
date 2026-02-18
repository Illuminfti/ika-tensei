/**
 * Solana Metaplex Metadata Adapter
 *
 * Tier 1: Helius DAS API (getAsset) — handles standard + compressed NFTs
 * Tier 2: Direct Metaplex account read + off-chain JSON fetch
 */

import type { UniversalNFTMetadata } from './types.js';

export class SolanaMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SolanaMetadataError';
  }
}

const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface SolanaResolverConfig {
  /** Helius API key — enables Tier 1 DAS fetch (also handles compressed NFTs) */
  heliusApiKey?: string;
}

// ─── Helius DAS API (Tier 1) ──────────────────────────────────────────────────

interface DASAsset {
  id: string;
  interface?: string;
  content?: {
    json_uri?: string;
    metadata?: {
      name?: string;
      description?: string;
      symbol?: string;
      attributes?: Array<Record<string, unknown>>;
    };
    files?: Array<{ uri?: string; mime?: string }>;
    links?: {
      image?: string;
      animation_url?: string;
      external_url?: string;
    };
  };
  grouping?: Array<{ group_key: string; group_value: string }>;
  compression?: {
    compressed?: boolean;
    data_hash?: string;
    creator_hash?: string;
    asset_hash?: string;
    tree?: string;
    seq?: number;
    leaf_id?: number;
  };
  error?: string;
}

async function fetchFromHelius(
  mintAddress: string,
  heliusApiKey: string,
): Promise<DASAsset | null> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: mintAddress },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const result = (await resp.json()) as { result?: DASAsset; error?: unknown };
    if (result.error || !result.result) return null;
    return result.result;
  } catch {
    return null;
  }
}

function normalizeHeliusAsset(
  asset: DASAsset,
  mintAddress: string,
  sealHash: string,
  dwalletId: string,
): UniversalNFTMetadata {
  const content = asset.content ?? {};
  const meta = content.metadata ?? {};
  const links = content.links ?? {};

  // Determine image URL: links.image > files[0].uri > empty
  let imageUrl = links.image ?? '';
  if (!imageUrl && Array.isArray(content.files) && content.files.length > 0) {
    imageUrl = content.files[0]?.uri ?? '';
  }

  // Parse attributes
  const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> =
    Array.isArray(meta.attributes)
      ? meta.attributes.map((a: Record<string, unknown>) => ({
          trait_type: String(a['trait_type'] ?? ''),
          value: (typeof a['value'] === 'number'
            ? a['value']
            : String(a['value'] ?? '')) as string | number,
          display_type: a['display_type'] ? String(a['display_type']) : undefined,
        }))
      : [];

  // Collection from grouping
  const collectionGrouping = (asset.grouping ?? []).find(g => g.group_key === 'collection');
  const collectionName = collectionGrouping?.group_value ?? meta.symbol ?? 'Unknown Collection';

  // Add compression info as attribute if cNFT
  if (asset.compression?.compressed) {
    attributes.push({ trait_type: 'Type', value: 'Compressed NFT' });
  }

  return {
    name: meta.name ?? `Solana NFT ${mintAddress.slice(0, 8)}`,
    description: meta.description ?? '',
    image: imageUrl,
    animation_url: links.animation_url ?? undefined,
    external_url: links.external_url ?? undefined,
    attributes,
    collection: {
      name: collectionName,
      family: meta.symbol ?? undefined,
    },
    provenance: {
      source_chain: 'solana',
      source_contract: mintAddress,
      token_id: mintAddress,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      original_metadata_uri: content.json_uri ?? undefined,
      fetched_at: new Date().toISOString(),
    },
    raw_metadata: {
      das_asset: asset as unknown as Record<string, unknown>,
    },
  };
}

// ─── Direct RPC (Tier 2) ──────────────────────────────────────────────────────

async function getSolanaAccount(
  rpcUrl: string,
  address: string,
): Promise<{ data: string; executable: boolean } | null> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [address, { encoding: 'base64', commitment: 'confirmed' }],
    }),
  });

  const result = (await response.json()) as {
    result?: { value?: { data: string[]; executable: boolean } };
    error?: { message: string };
  };
  if (result.error) throw new Error(`Solana RPC error: ${result.error.message}`);
  if (!result.result?.value) return null;

  return {
    data: result.result.value.data[0] ?? '',
    executable: result.result.value.executable,
  };
}

async function fetchOffChainJson(uri: string): Promise<Record<string, unknown>> {
  let url = uri;
  if (uri.startsWith('ipfs://')) {
    url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  } else if (uri.startsWith('ar://')) {
    url = `https://arweave.net/${uri.slice(5)}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch off-chain metadata: ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

interface MetaplexOnChainData {
  key: number;
  updateAuthority: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Array<{ address: string; verified: boolean; share: number }> | null;
  collection: { verified: boolean; key: string } | null;
}

function decodeLengthPrefixedString(
  buffer: Uint8Array,
  offset: number,
): { value: string; newOffset: number } {
  const length = buffer[offset] ?? 0;
  const strBytes = buffer.slice(offset + 1, offset + 1 + length);
  const value = new TextDecoder().decode(strBytes);
  return { value, newOffset: offset + 1 + length };
}

function deserializeMetaplexMetadata(data: string): MetaplexOnChainData {
  const buffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  let offset = 0;

  while (offset < buffer.length && buffer[offset] !== 3) offset++;
  if (offset >= buffer.length) throw new Error('Invalid Metaplex metadata: no key=3 found');

  const key = buffer[offset] ?? 0;
  offset += 1;

  const updateAuthority = Array.from(buffer.slice(offset, offset + 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  offset += 32;

  const mint = Array.from(buffer.slice(offset, offset + 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  offset += 32;

  const nameResult = decodeLengthPrefixedString(buffer, offset);
  const name = nameResult.value;
  offset = nameResult.newOffset;

  const symbolResult = decodeLengthPrefixedString(buffer, offset);
  const symbol = symbolResult.value;
  offset = symbolResult.newOffset;

  const uriResult = decodeLengthPrefixedString(buffer, offset);
  const uri = uriResult.value;
  offset = uriResult.newOffset;

  const sellerFeeBasisPoints = (buffer[offset] ?? 0) | ((buffer[offset + 1] ?? 0) << 8);
  offset += 2;

  let creators: MetaplexOnChainData['creators'] = null;
  const hasCreators = buffer[offset] ?? 0;
  offset += 1;

  if (hasCreators) {
    const creatorCount = buffer[offset] ?? 0;
    offset += 1;
    creators = [];
    for (let i = 0; i < creatorCount; i++) {
      const creatorAddress = Array.from(buffer.slice(offset, offset + 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      offset += 32;
      const verified = buffer[offset] === 1;
      offset += 1;
      const share = buffer[offset] ?? 0;
      offset += 1;
      creators.push({ address: creatorAddress, verified, share });
    }
  }

  let collection: MetaplexOnChainData['collection'] = null;
  const hasCollection = buffer[offset] ?? 0;
  offset += 1;

  if (hasCollection) {
    const collectionKey = Array.from(buffer.slice(offset, offset + 32))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    offset += 32;
    const verified = buffer[offset] === 1;
    offset += 1;
    collection = { key: collectionKey, verified };
  }

  return { key, updateAuthority, mint, name, symbol, uri, sellerFeeBasisPoints, creators, collection };
}

async function deriveSolanaMetadataPda(mintAddress: string, rpcUrl: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getProgramAccounts',
      params: [
        METADATA_PROGRAM_ID,
        { commitment: 'confirmed', filters: [{ memcmp: { offset: 33, bytes: mintAddress } }] },
      ],
    }),
  });

  const result = (await response.json()) as {
    result?: Array<{ pubkey: string }>;
    error?: { message: string };
  };
  if (result.result && result.result.length > 0 && result.result[0]) {
    return result.result[0].pubkey;
  }
  throw new Error(`Could not derive metadata PDA for ${mintAddress}`);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchSolanaMetadata(
  rpcUrl: string,
  mintAddress: string,
  sealHash: string = '',
  dwalletId: string = '',
  config: SolanaResolverConfig = {},
): Promise<UniversalNFTMetadata> {
  try {
    // ── Tier 1: Helius DAS API ─────────────────────────────────────────────
    if (config.heliusApiKey) {
      const asset = await fetchFromHelius(mintAddress, config.heliusApiKey);
      if (asset) {
        return normalizeHeliusAsset(asset, mintAddress, sealHash, dwalletId);
      }
    }

    // ── Tier 2: Direct Metaplex account read ──────────────────────────────
    const pda = await deriveSolanaMetadataPda(mintAddress, rpcUrl);
    const accountData = await getSolanaAccount(rpcUrl, pda);

    if (!accountData) {
      throw new SolanaMetadataError(`No metadata account found for mint ${mintAddress}`);
    }

    const onChainMetadata = deserializeMetaplexMetadata(accountData.data);
    const offChainMetadata = await fetchOffChainJson(onChainMetadata.uri);

    const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> =
      Array.isArray(offChainMetadata['attributes'])
        ? (offChainMetadata['attributes'] as Array<Record<string, unknown>>).map(attr => ({
            trait_type: String(attr['trait_type'] ?? ''),
            value: String(attr['value'] ?? ''),
            display_type: attr['display_type'] ? String(attr['display_type']) : undefined,
          }))
        : [];

    let image = String(offChainMetadata['image'] ?? '');
    if (!image && offChainMetadata['properties']) {
      const props = offChainMetadata['properties'] as Record<string, unknown>;
      const files = props['files'] as Array<Record<string, unknown>> | undefined;
      if (files && Array.isArray(files)) {
        const imageFile = files.find(f => String(f['type'] ?? '').startsWith('image/'));
        if (imageFile) image = String(imageFile['uri'] ?? '');
      }
    }

    const collectionName = onChainMetadata.collection
      ? onChainMetadata.name.replace(/ #\d+$/, '').trim()
      : onChainMetadata.symbol || onChainMetadata.name || 'Unknown Collection';

    return {
      name: onChainMetadata.name,
      description: String(offChainMetadata['description'] ?? ''),
      image,
      animation_url: offChainMetadata['animation_url']
        ? String(offChainMetadata['animation_url'])
        : undefined,
      external_url: offChainMetadata['external_url']
        ? String(offChainMetadata['external_url'])
        : undefined,
      attributes,
      collection: {
        name: collectionName,
        family: onChainMetadata.symbol || undefined,
      },
      provenance: {
        source_chain: 'solana',
        source_contract: mintAddress,
        token_id: mintAddress,
        seal_hash: sealHash,
        dwallet_id: dwalletId,
        sealed_at: Date.now(),
        original_metadata_uri: onChainMetadata.uri,
        fetched_at: new Date().toISOString(),
      },
      raw_metadata: {
        ...onChainMetadata,
        ...offChainMetadata,
      } as Record<string, unknown>,
    };
  } catch (error) {
    if (error instanceof SolanaMetadataError) throw error;
    throw new SolanaMetadataError(
      `Failed to fetch Solana metadata for ${mintAddress}`,
      error instanceof Error ? error : undefined,
    );
  }
}
