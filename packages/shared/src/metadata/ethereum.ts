/**
 * Ethereum ERC-721/1155 Metadata Adapter
 * Fetches and normalizes metadata from Ethereum-based NFTs
 *
 * Tier 1: Alchemy NFT API (fast, normalized, cached)
 * Tier 2: Direct RPC tokenURI() / uri() + IPFS gateway rotation
 * Special cases: CryptoPunks, on-chain base64 SVGs, ERC-1155 {id} substitution
 */

import type { UniversalNFTMetadata } from './types.js';

export class EthereumMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'EthereumMetadataError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CRYPTOPUNKS_CONTRACT = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb';

const IPFS_GATEWAYS = [
  'https://nftstorage.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://w3s.link/ipfs/',
] as const;

/** ERC-721 tokenURI(uint256) selector */
const SELECTOR_TOKEN_URI = '0x0c15a77a';
/** ERC-1155 uri(uint256) selector */
const SELECTOR_ERC1155_URI = '0x0e89341c';
/** name() selector */
const SELECTOR_NAME = '0x06fdde03';
/** symbol() selector */
const SELECTOR_SYMBOL = '0x95d89b41';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface EthereumResolverConfig {
  /** Alchemy API key – enables Tier 1 fetch */
  alchemyApiKey?: string;
  /**
   * Alchemy chain name, e.g. 'eth-mainnet', 'polygon-mainnet', 'arb-mainnet'.
   * Defaults to 'eth-mainnet'.
   */
  alchemyChainName?: string;
}

// ─── Alchemy API (Tier 1) ────────────────────────────────────────────────────

interface AlchemyNFTResponse {
  contract?: { address?: string; name?: string; symbol?: string };
  tokenId?: string;
  name?: string;
  description?: string;
  image?: {
    originalUrl?: string;
    cachedUrl?: string;
    contentType?: string;
  };
  animation?: { originalUrl?: string };
  collection?: { name?: string };
  raw?: { metadata?: Record<string, unknown> };
  error?: { message?: string };
}

async function fetchFromAlchemy(
  contractAddress: string,
  tokenId: string,
  alchemyApiKey: string,
  chainName: string,
): Promise<AlchemyNFTResponse | null> {
  const url =
    `https://${chainName}.g.alchemy.com/nft/v3/${alchemyApiKey}/getNFTMetadata` +
    `?contractAddress=${contractAddress}&tokenId=${tokenId}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as AlchemyNFTResponse;
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── IPFS Gateway Rotation ───────────────────────────────────────────────────

async function fetchJsonFromIpfs(cid: string): Promise<Record<string, unknown>> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const resp = await fetch(gateway + cid, {
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) return (await resp.json()) as Record<string, unknown>;
    } catch {
      // try next gateway
    }
  }
  throw new EthereumMetadataError(`IPFS resolution failed for CID ${cid} across all gateways`);
}

/** Resolve any URI (ipfs://, ar://, data:, https://) to a JSON object */
async function resolveMetadataUri(uri: string): Promise<Record<string, unknown>> {
  // on-chain base64 data URI
  const decoded = decodeDataUri(uri);
  if (decoded) {
    if (decoded.type === 'json') return decoded.data;
    // SVG data → wrap in minimal metadata object
    return { image: uri, name: 'On-chain SVG' };
  }

  if (uri.startsWith('ipfs://')) {
    return fetchJsonFromIpfs(uri.slice(7));
  }
  if (uri.startsWith('ar://')) {
    const resp = await fetch(`https://arweave.net/${uri.slice(5)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new EthereumMetadataError(`Arweave fetch failed: ${resp.status}`);
    return (await resp.json()) as Record<string, unknown>;
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const resp = await fetch(uri, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) throw new EthereumMetadataError(`HTTP fetch failed: ${resp.status}`);
    return (await resp.json()) as Record<string, unknown>;
  }
  throw new EthereumMetadataError(`Unrecognized URI scheme: ${uri}`);
}

// ─── Base64 Data URI Decoder ─────────────────────────────────────────────────

type DecodedDataUri =
  | { type: 'json'; data: Record<string, unknown> }
  | { type: 'svg'; data: string }
  | null;

function decodeDataUri(dataUri: string): DecodedDataUri {
  if (dataUri.startsWith('data:application/json;base64,')) {
    const b64 = dataUri.slice('data:application/json;base64,'.length);
    try {
      const raw = Buffer.from(b64, 'base64').toString('utf8');
      return { type: 'json', data: JSON.parse(raw) as Record<string, unknown> };
    } catch {
      return null;
    }
  }
  if (dataUri.startsWith('data:application/json;charset=utf-8,')) {
    const raw = decodeURIComponent(dataUri.slice('data:application/json;charset=utf-8,'.length));
    try {
      return { type: 'json', data: JSON.parse(raw) as Record<string, unknown> };
    } catch {
      return null;
    }
  }
  if (dataUri.startsWith('data:image/svg+xml;base64,')) {
    const b64 = dataUri.slice('data:image/svg+xml;base64,'.length);
    return { type: 'svg', data: Buffer.from(b64, 'base64').toString('utf8') };
  }
  return null;
}

// ─── Direct RPC helpers ───────────────────────────────────────────────────────

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });

  const result = (await response.json()) as { result?: string; error?: { message: string } };
  if (result.error) {
    throw new Error(`Ethereum RPC error: ${result.error.message}`);
  }
  return result.result ?? '';
}

function encodeUint256Call(selector: string, tokenId: string): string {
  const paddedId = BigInt(tokenId).toString(16).padStart(64, '0');
  return `${selector}${paddedId}`;
}

/** ERC-1155 {id} substitution – lowercase hex, zero-padded to 64 chars */
function substituteTokenId(uri: string, tokenId: string): string {
  const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
  return uri.replace('{id}', hexId);
}

function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleaned.length <= 64) {
    const padded = cleaned.padEnd(64, '0');
    const firstByte = parseInt(padded.slice(0, 2), 16);
    if (firstByte <= 32) {
      const len = firstByte * 2;
      const strData = padded.slice(2, 2 + len);
      return Buffer.from(strData, 'hex').toString('utf8').replace(/\0/g, '');
    }
  }
  try {
    return Buffer.from(cleaned, 'hex').toString('utf8').replace(/\0/g, '');
  } catch {
    return cleaned;
  }
}

async function fetchCollectionInfo(
  rpcUrl: string,
  contractAddress: string,
): Promise<{ name: string; symbol: string }> {
  let name = '';
  let symbol = '';
  try {
    const nameData = await ethCall(rpcUrl, contractAddress, SELECTOR_NAME);
    name = decodeString(nameData);
  } catch { /* optional */ }
  try {
    const symbolData = await ethCall(rpcUrl, contractAddress, SELECTOR_SYMBOL);
    symbol = decodeString(symbolData);
  } catch { /* optional */ }
  return { name, symbol };
}

// ─── CryptoPunks special case ────────────────────────────────────────────────

function buildCryptoPunksMetadata(
  tokenId: string,
  contractAddress: string,
  sealHash: string,
  dwalletId: string,
): UniversalNFTMetadata {
  const imageUrl = `https://cryptopunks.app/public/images/cryptopunks/punk${tokenId}.png`;
  return {
    name: `CryptoPunk #${tokenId}`,
    description:
      `CryptoPunk #${tokenId} — one of 10,000 unique collectible characters ` +
      `from Larva Labs on Ethereum.`,
    image: imageUrl,
    external_url: `https://cryptopunks.app/cryptopunks/details/${tokenId}`,
    attributes: [
      { trait_type: 'Contract', value: contractAddress },
      { trait_type: 'Token ID', value: tokenId },
    ],
    collection: {
      name: 'CryptoPunks',
      family: 'PUNK',
    },
    provenance: {
      source_chain: 'ethereum',
      source_contract: contractAddress.toLowerCase(),
      token_id: tokenId,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      fetched_at: new Date().toISOString(),
    },
  };
}

// ─── Attribute normalizer ────────────────────────────────────────────────────

function normalizeAttributes(
  raw: unknown,
): Array<{ trait_type: string; value: string | number; display_type?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((attr: unknown) => {
    const a = attr as Record<string, unknown>;
    return {
      trait_type: String(a['trait_type'] ?? ''),
      value: (typeof a['value'] === 'number' ? a['value'] : String(a['value'] ?? '')) as
        | string
        | number,
      display_type: a['display_type'] ? String(a['display_type']) : undefined,
    };
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchEthereumMetadata(
  rpcUrl: string,
  contractAddress: string,
  tokenId: string,
  sealHash: string = '',
  dwalletId: string = '',
  config: EthereumResolverConfig = {},
): Promise<UniversalNFTMetadata> {
  try {
    // ── CryptoPunks special case ──────────────────────────────────────────
    if (contractAddress.toLowerCase() === CRYPTOPUNKS_CONTRACT) {
      // Try Alchemy first for rich data; fall back to synthetic
      if (config.alchemyApiKey) {
        const alchemyData = await fetchFromAlchemy(
          contractAddress,
          tokenId,
          config.alchemyApiKey,
          config.alchemyChainName ?? 'eth-mainnet',
        );
        if (alchemyData) {
          return normalizeAlchemyResponse(alchemyData, contractAddress, tokenId, sealHash, dwalletId);
        }
      }
      return buildCryptoPunksMetadata(tokenId, contractAddress, sealHash, dwalletId);
    }

    // ── Tier 1: Alchemy NFT API ───────────────────────────────────────────
    if (config.alchemyApiKey) {
      const alchemyData = await fetchFromAlchemy(
        contractAddress,
        tokenId,
        config.alchemyApiKey,
        config.alchemyChainName ?? 'eth-mainnet',
      );
      if (alchemyData) {
        return normalizeAlchemyResponse(alchemyData, contractAddress, tokenId, sealHash, dwalletId);
      }
    }

    // ── Tier 2: Direct RPC ────────────────────────────────────────────────
    return await fetchViaDirectRpc(rpcUrl, contractAddress, tokenId, sealHash, dwalletId);
  } catch (error) {
    if (error instanceof EthereumMetadataError) throw error;
    throw new EthereumMetadataError(
      `Failed to fetch Ethereum metadata for ${contractAddress}/${tokenId}`,
      error instanceof Error ? error : undefined,
    );
  }
}

// ─── Alchemy response normalizer ─────────────────────────────────────────────

function normalizeAlchemyResponse(
  data: AlchemyNFTResponse,
  contractAddress: string,
  tokenId: string,
  sealHash: string,
  dwalletId: string,
): UniversalNFTMetadata {
  const rawMeta = (data.raw?.metadata ?? {}) as Record<string, unknown>;

  const imageUrl =
    data.image?.originalUrl ??
    data.image?.cachedUrl ??
    String(rawMeta['image'] ?? '');

  const attributes = normalizeAttributes(rawMeta['attributes'] ?? []);

  const collectionName =
    data.collection?.name ??
    data.contract?.name ??
    data.contract?.symbol ??
    'Unknown Collection';

  return {
    name: data.name ?? String(rawMeta['name'] ?? `Token ${tokenId}`),
    description: data.description ?? String(rawMeta['description'] ?? ''),
    image: imageUrl,
    animation_url: data.animation?.originalUrl ?? undefined,
    external_url: rawMeta['external_url'] ? String(rawMeta['external_url']) : undefined,
    attributes,
    collection: {
      name: collectionName,
      family: data.contract?.symbol ?? undefined,
    },
    provenance: {
      source_chain: 'ethereum',
      source_contract: contractAddress.toLowerCase(),
      token_id: tokenId,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      fetched_at: new Date().toISOString(),
    },
    raw_metadata: rawMeta,
  };
}

// ─── Direct RPC resolver ──────────────────────────────────────────────────────

async function fetchViaDirectRpc(
  rpcUrl: string,
  contractAddress: string,
  tokenId: string,
  sealHash: string,
  dwalletId: string,
): Promise<UniversalNFTMetadata> {
  // Try ERC-721 tokenURI first, then ERC-1155 uri()
  let tokenUri = '';
  let isErc1155 = false;

  try {
    const raw = await ethCall(rpcUrl, contractAddress, encodeUint256Call(SELECTOR_TOKEN_URI, tokenId));
    tokenUri = decodeString(raw);
  } catch {
    // Try ERC-1155
  }

  if (!tokenUri) {
    try {
      const raw = await ethCall(rpcUrl, contractAddress, encodeUint256Call(SELECTOR_ERC1155_URI, tokenId));
      tokenUri = decodeString(raw);
      if (tokenUri) {
        isErc1155 = true;
        tokenUri = substituteTokenId(tokenUri, tokenId);
      }
    } catch { /* fall through */ }
  }

  if (!tokenUri) {
    throw new EthereumMetadataError(
      `No tokenURI returned for ${contractAddress}/${tokenId}`,
    );
  }

  // Resolve metadata JSON
  const rawMetadata = await resolveMetadataUri(tokenUri);

  // Get image (may itself be a data URI for on-chain SVGs)
  let imageUrl = String(rawMetadata['image'] ?? '');
  const imageDecoded = decodeDataUri(imageUrl);
  if (imageDecoded?.type === 'svg') {
    // Keep the data URI as the image – callers can re-upload to Arweave
    imageUrl = `data:image/svg+xml;base64,${Buffer.from(imageDecoded.data).toString('base64')}`;
  }

  // Collection info
  const { name: collectionName, symbol: collectionSymbol } = await fetchCollectionInfo(rpcUrl, contractAddress);

  const attributes = normalizeAttributes(rawMetadata['attributes'] ?? rawMetadata['properties'] ?? []);

  return {
    name: String(rawMetadata['name'] ?? `Token ${tokenId}`),
    description: String(rawMetadata['description'] ?? ''),
    image: imageUrl,
    animation_url: rawMetadata['animation_url'] ? String(rawMetadata['animation_url']) : undefined,
    external_url: rawMetadata['external_url'] ? String(rawMetadata['external_url']) : undefined,
    attributes,
    collection: {
      name: collectionName || collectionSymbol || 'Unknown Collection',
      family: collectionSymbol || undefined,
    },
    provenance: {
      source_chain: isErc1155 ? 'ethereum-erc1155' : 'ethereum',
      source_contract: contractAddress.toLowerCase(),
      token_id: tokenId,
      seal_hash: sealHash,
      dwallet_id: dwalletId,
      sealed_at: Date.now(),
      original_metadata_uri: tokenUri,
      fetched_at: new Date().toISOString(),
    },
    raw_metadata: rawMetadata,
  };
}
