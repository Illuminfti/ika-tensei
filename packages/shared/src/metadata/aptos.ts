/**
 * Aptos NFT Metadata Adapter
 *
 * Supports:
 *   Token v1 — TokenDataId → PropertyMap via on-chain view functions
 *   Token v2 (Digital Asset Standard) — object with 0x4::token::Token resource
 *
 * Auto-detection: attempts Token v2 first (check for 0x4::token::Token resource),
 * then falls back to Token v1 interpretation.
 */

import type { UniversalNFTMetadata } from './types.js';

export class AptosMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AptosMetadataError';
  }
}

const DEFAULT_APTOS_NODE = 'https://fullnode.mainnet.aptoslabs.com/v1';

// ─── API helpers ──────────────────────────────────────────────────────────────

async function aptosGetResource(
  nodeUrl: string,
  address: string,
  resourceType: string,
): Promise<Record<string, unknown> | null> {
  const url = `${nodeUrl}/accounts/${encodeURIComponent(address)}/resource/${encodeURIComponent(resourceType)}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function aptosViewFunction(
  nodeUrl: string,
  fn: string,
  typeArgs: string[],
  args: unknown[],
): Promise<unknown[] | null> {
  try {
    const resp = await fetch(`${nodeUrl}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: fn, type_arguments: typeArgs, arguments: args }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as unknown[];
  } catch {
    return null;
  }
}

async function fetchOffChainJson(uri: string): Promise<Record<string, unknown>> {
  let url = uri;
  if (uri.startsWith('ipfs://')) url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  else if (uri.startsWith('ar://')) url = `https://arweave.net/${uri.slice(5)}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error(`Failed to fetch metadata JSON: ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}

// ─── Token v2 (Digital Asset Standard) ───────────────────────────────────────

interface TokenV2Resource {
  data?: {
    uri?: string;
    name?: string;
    description?: string;
  };
}

async function fetchTokenV2(
  nodeUrl: string,
  objectAddress: string,
  sealHash: string,
  dwalletId: string,
): Promise<UniversalNFTMetadata | null> {
  const resource = await aptosGetResource(nodeUrl, objectAddress, '0x4::token::Token');
  if (!resource) return null;

  const tokenRes = resource as TokenV2Resource;
  const tokenData = tokenRes.data ?? {};
  const uri = tokenData.uri ?? '';

  if (!uri) return null;

  // Also try to read collection
  let collectionName = 'Unknown Collection';
  try {
    const collRes = await aptosGetResource(nodeUrl, objectAddress, '0x4::token::TokenIdentifiers');
    if (collRes) {
      const cdata = (collRes as { data?: { collection_name?: string | { inner?: string } } }).data;
      if (cdata?.collection_name) {
        collectionName =
          typeof cdata.collection_name === 'string'
            ? cdata.collection_name
            : String(cdata.collection_name.inner ?? '');
      }
    }
  } catch { /* optional */ }

  // Fetch off-chain JSON
  let offChain: Record<string, unknown> = {};
  try {
    offChain = await fetchOffChainJson(uri);
  } catch { /* use on-chain data only */ }

  const name =
    tokenData.name ?? String(offChain['name'] ?? `Aptos NFT ${objectAddress.slice(0, 8)}`);
  const description = tokenData.description ?? String(offChain['description'] ?? '');
  const image = String(offChain['image'] ?? '');

  const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> =
    Array.isArray(offChain['attributes'])
      ? (offChain['attributes'] as Array<Record<string, unknown>>).map(a => ({
          trait_type: String(a['trait_type'] ?? ''),
          value: (typeof a['value'] === 'number'
            ? a['value']
            : String(a['value'] ?? '')) as string | number,
          display_type: a['display_type'] ? String(a['display_type']) : undefined,
        }))
      : [];

  return {
    name,
    description,
    image,
    animation_url: offChain['animation_url'] ? String(offChain['animation_url']) : undefined,
    external_url: offChain['external_url'] ? String(offChain['external_url']) : undefined,
    attributes,
    collection: { name: collectionName },
    provenance: {
      source_chain: 'aptos',
      source_contract: objectAddress,
      token_id: objectAddress,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      original_metadata_uri: uri,
      fetched_at: new Date().toISOString(),
    },
    raw_metadata: { token_v2: { uri, name: tokenData.name }, off_chain: offChain },
  };
}

// ─── Token v1 ────────────────────────────────────────────────────────────────

/**
 * Token v1 tokenId format: "{creator}::{collection}::{name}::{property_version}"
 * If property_version is omitted, defaults to "0".
 */
function parseTokenV1Id(tokenId: string): {
  creator: string;
  collection: string;
  name: string;
  propertyVersion: string;
} | null {
  const parts = tokenId.split('::');
  if (parts.length < 3) return null;
  return {
    creator: parts[0] ?? '',
    collection: parts[1] ?? '',
    name: parts[2] ?? '',
    propertyVersion: parts[3] ?? '0',
  };
}

async function fetchTokenV1(
  nodeUrl: string,
  creatorAddress: string,
  tokenId: string,
  sealHash: string,
  dwalletId: string,
): Promise<UniversalNFTMetadata | null> {
  const parsed = parseTokenV1Id(tokenId);
  if (!parsed) return null;

  const { creator, collection, name: tokenName, propertyVersion } = parsed;

  // Call view function to get token data URI
  const result = await aptosViewFunction(
    nodeUrl,
    '0x3::token::get_token_uri',
    [],
    [creator, collection, tokenName, parseInt(propertyVersion, 10)],
  );

  let uri = '';
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'string') {
    uri = result[0];
  }

  if (!uri) {
    // Fallback: read from TokenStore resource
    const tokenStore = await aptosGetResource(nodeUrl, creatorAddress, '0x3::token::TokenStore');
    if (!tokenStore) return null;
  }

  let offChain: Record<string, unknown> = {};
  if (uri) {
    try {
      offChain = await fetchOffChainJson(uri);
    } catch { /* use partial data */ }
  }

  const image = String(offChain['image'] ?? '');
  const description = String(offChain['description'] ?? '');

  const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> =
    Array.isArray(offChain['attributes'])
      ? (offChain['attributes'] as Array<Record<string, unknown>>).map(a => ({
          trait_type: String(a['trait_type'] ?? ''),
          value: (typeof a['value'] === 'number'
            ? a['value']
            : String(a['value'] ?? '')) as string | number,
          display_type: a['display_type'] ? String(a['display_type']) : undefined,
        }))
      : [];

  return {
    name: tokenName || String(offChain['name'] ?? `Aptos NFT`),
    description,
    image,
    animation_url: offChain['animation_url'] ? String(offChain['animation_url']) : undefined,
    external_url: offChain['external_url'] ? String(offChain['external_url']) : undefined,
    attributes,
    collection: { name: collection || 'Unknown Collection' },
    provenance: {
      source_chain: 'aptos',
      source_contract: creatorAddress,
      token_id: tokenId,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      original_metadata_uri: uri || undefined,
      fetched_at: new Date().toISOString(),
    },
    raw_metadata: { token_v1: { creator, collection, name: tokenName, propertyVersion }, off_chain: offChain },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches Aptos NFT metadata.
 *
 * @param rpcUrl   Aptos fullnode RPC URL (defaults to mainnet if empty)
 * @param contract Creator address (for Token v1) or unused (for Token v2)
 * @param tokenId  For Token v2: the object address.
 *                 For Token v1: "{creator}::{collection}::{name}::{propertyVersion}"
 */
export async function fetchAptosMetadata(
  rpcUrl: string,
  contract: string,
  tokenId: string,
  sealHash: string = '',
  dwalletId: string = '',
): Promise<UniversalNFTMetadata> {
  const nodeUrl = rpcUrl || DEFAULT_APTOS_NODE;

  try {
    // ── Auto-detect: try Token v2 first ──────────────────────────────────
    // Token v2: tokenId looks like an object address (0x prefixed hex, ~66 chars)
    const isObjectAddress = /^0x[0-9a-fA-F]{60,}$/.test(tokenId);

    if (isObjectAddress) {
      const v2 = await fetchTokenV2(nodeUrl, tokenId, sealHash, dwalletId);
      if (v2) return v2;
    }

    // ── Token v1 ──────────────────────────────────────────────────────────
    const v1 = await fetchTokenV1(nodeUrl, contract, tokenId, sealHash, dwalletId);
    if (v1) return v1;

    // ── Last resort: try as object address even if not matching pattern ───
    if (!isObjectAddress) {
      const v2Fallback = await fetchTokenV2(nodeUrl, tokenId, sealHash, dwalletId);
      if (v2Fallback) return v2Fallback;
    }

    throw new AptosMetadataError(
      `Could not resolve Aptos NFT metadata for contract=${contract}, tokenId=${tokenId}`,
    );
  } catch (error) {
    if (error instanceof AptosMetadataError) throw error;
    throw new AptosMetadataError(
      `Failed to fetch Aptos metadata for ${contract}/${tokenId}`,
      error instanceof Error ? error : undefined,
    );
  }
}
