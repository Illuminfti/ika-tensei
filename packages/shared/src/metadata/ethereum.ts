/**
 * Ethereum ERC-721/1155 Metadata Adapter
 * Fetches and normalizes metadata from Ethereum-based NFTs
 */

import type { UniversalNFTMetadata } from './types.js';

/**
 * Error class for Ethereum metadata resolution failures
 */
export class EthereumMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'EthereumMetadataError';
  }
}

/**
 * Makes an eth_call to an Ethereum contract
 */
async function ethCall(
  rpcUrl: string,
  to: string,
  data: string
): Promise<string> {
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

  const result = await response.json();
  if (result.error) {
    throw new Error(`Ethereum RPC error: ${result.error.message}`);
  }
  return result.result;
}

/**
 * Encodes a function call for ERC-721/1155 tokenURI
 * selector for tokenURI(uint256) = 0x0c15a77a
 */
function encodeTokenURI(tokenId: string): string {
  const paddedId = BigInt(tokenId).toString(16).padStart(64, '0');
  return `0x0c15a77a${paddedId}`;
}

/**
 * Encodes a function call for name() or symbol()
 * selector for name() = 0x06fdde03
 * selector for symbol() = 0x95d89b41
 */
function encodeName(): string {
  return '0x06fdde03';
}

function encodeSymbol(): string {
  return '0x95d89b41';
}

/**
 * Decodes a string from Ethereum bytes32/hex response
 */
function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  // Remove 0x prefix and decode
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  // If length is 64 or less, it's likely ASCII
  if (cleaned.length <= 64) {
    const padded = cleaned.padEnd(64, '0');
    // Check if it's ASCII or bytes32 string
    const firstByte = parseInt(padded.slice(0, 2), 16);
    if (firstByte <= 32) {
      // Short string format
      const len = firstByte * 2;
      const strData = padded.slice(2, 2 + len);
      return Buffer.from(strData, 'hex').toString('utf8').replace(/\0/g, '');
    }
  }
  // Fallback: try to decode as UTF-8
  try {
    return Buffer.from(cleaned, 'hex').toString('utf8').replace(/\0/g, '');
  } catch {
    return cleaned;
  }
}

/**
 * Fetches IPFS content and parses as JSON
 */
async function fetchIpfsJson(uri: string): Promise<Record<string, unknown>> {
  let url = uri;
  if (uri.startsWith('ipfs://')) {
    url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches Ethereum ERC-721/1155 metadata and normalizes to universal format
 */
export async function fetchEthereumMetadata(
  rpcUrl: string,
  contractAddress: string,
  tokenId: string,
  sealHash: string = '',
  dwalletId: string = ''
): Promise<UniversalNFTMetadata> {
  try {
    // Get token URI
    const tokenUriData = await ethCall(rpcUrl, contractAddress, encodeTokenURI(tokenId));
    const tokenUri = decodeString(tokenUriData);

    if (!tokenUri) {
      throw new EthereumMetadataError(`No token URI returned for token ${tokenId}`);
    }

    // Fetch metadata JSON
    const rawMetadata = await fetchIpfsJson(tokenUri);

    // Get collection info
    let collectionName = '';
    let collectionSymbol = '';

    try {
      const nameData = await ethCall(rpcUrl, contractAddress, encodeName());
      collectionName = decodeString(nameData);
    } catch {
      // name() might not exist, try symbol
    }

    try {
      const symbolData = await ethCall(rpcUrl, contractAddress, encodeSymbol());
      collectionSymbol = decodeString(symbolData);
    } catch {
      // symbol() might not exist
    }

    // Parse OpenSea-standard attributes
    const attributes = Array.isArray(rawMetadata.attributes)
      ? rawMetadata.attributes.map((attr: Record<string, unknown>) => ({
          trait_type: String(attr.trait_type ?? ''),
          value: String(attr.value ?? ''),
          display_type: attr.display_type ? String(attr.display_type) : undefined,
        }))
      : [];

    // Normalize to universal format
    const metadata: UniversalNFTMetadata = {
      name: String(rawMetadata.name ?? `Token ${tokenId}`),
      description: String(rawMetadata.description ?? ''),
      image: String(rawMetadata.image ?? ''),
      animation_url: rawMetadata.animation_url ? String(rawMetadata.animation_url) : undefined,
      external_url: rawMetadata.external_url ? String(rawMetadata.external_url) : undefined,
      attributes,
      collection: {
        name: collectionName || collectionSymbol || 'Unknown Collection',
        family: collectionSymbol || undefined,
      },
      provenance: {
        source_chain: 'ethereum',
        source_contract: contractAddress.toLowerCase(),
        token_id: tokenId,
        seal_hash: sealHash,
        dwallet_id: dwalletId,
        sealed_at: Date.now(),
        original_metadata_uri: tokenUri,
      },
      raw_metadata: rawMetadata as Record<string, unknown>,
    };

    return metadata;
  } catch (error) {
    if (error instanceof EthereumMetadataError) {
      throw error;
    }
    throw new EthereumMetadataError(
      `Failed to fetch Ethereum metadata for ${contractAddress}/${tokenId}`,
      error instanceof Error ? error : undefined
    );
  }
}
