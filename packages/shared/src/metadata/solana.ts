/**
 * Solana Metaplex Metadata Adapter
 * Fetches and normalizes metadata from Solana Metaplex NFTs
 */

import type { UniversalNFTMetadata } from './types.js';

/**
 * Error class for Solana metadata resolution failures
 */
export class SolanaMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SolanaMetadataError';
  }
}

/**
 * Metaplex Metadata Program ID
 */
const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/**
 * Fetches account data from Solana RPC
 */
async function getSolanaAccount(
  rpcUrl: string,
  address: string
): Promise<{ data: string; executable: boolean } | null> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        address,
        { encoding: 'base64', commitment: 'confirmed' },
      ],
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Solana RPC error: ${result.error.message}`);
  }

  if (!result.result?.value) {
    return null;
  }

  return {
    data: result.result.value.data[0],
    executable: result.result.value.executable,
  };
}

/**
 * Fetches off-chain JSON metadata from a URI
 */
async function fetchOffChainJson(uri: string): Promise<Record<string, unknown>> {
  let url = uri;
  if (uri.startsWith('ipfs://')) {
    url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  } else if (uri.startsWith('ar://')) {
    url = `https://arweave.net/${uri.slice(5)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch off-chain metadata: ${response.status}`);
  }
  return response.json();
}

/**
 * Deserializes Metaplex metadata from on-chain account data
 * Simplified version - real implementation would use full Borsh deserialization
 */
interface MetaplexOnChainData {
  key: number;
  updateAuthority: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Array<{
    address: string;
    verified: boolean;
    share: number;
  }> | null;
  collection: { verified: boolean; key: string } | null;
}

/**
 * Decodes a length-prefixed string from base64 buffer
 */
function decodeLengthPrefixedString(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
  const length = buffer[offset];
  const strBytes = buffer.slice(offset + 1, offset + 1 + length);
  const value = new TextDecoder().decode(strBytes);
  return { value, newOffset: offset + 1 + length };
}

/**
 * Deserializes Metaplex metadata account data
 */
function deserializeMetaplexMetadata(data: string): MetaplexOnChainData {
  // Data is base64 encoded, first byte is key (3 = Metadata)
  const buffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));

  let offset = 0;

  // Skip prefix bytes (some accounts have additional prefix)
  // Find the actual metadata by looking for key = 3
  while (offset < buffer.length && buffer[offset] !== 3) {
    offset++;
  }
  if (offset >= buffer.length) {
    throw new Error('Invalid Metaplex metadata: no key=3 found');
  }

  // Key (1 byte)
  const key = buffer[offset];
  offset += 1;

  // Update authority (32 bytes - pubkey)
  const updateAuthority = Array.from(buffer.slice(offset, offset + 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  offset += 32;

  // Mint (32 bytes - pubkey)
  const mint = Array.from(buffer.slice(offset, offset + 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  offset += 32;

  // Name (length-prefixed string)
  const nameResult = decodeLengthPrefixedString(buffer, offset);
  const name = nameResult.value;
  offset = nameResult.newOffset;

  // Symbol (length-prefixed string)
  const symbolResult = decodeLengthPrefixedString(buffer, offset);
  const symbol = symbolResult.value;
  offset = symbolResult.newOffset;

  // URI (length-prefixed string)
  const uriResult = decodeLengthPrefixedString(buffer, offset);
  const uri = uriResult.value;
  offset = uriResult.newOffset;

  // Seller fee basis points (2 bytes)
  const sellerFeeBasisPoints = buffer[offset] | (buffer[offset + 1] << 8);
  offset += 2;

  // Creators (optional)
  let creators: MetaplexOnChainData['creators'] = null;
  const hasCreators = buffer[offset];
  offset += 1;

  if (hasCreators) {
    const creatorCount = buffer[offset];
    offset += 1;
    creators = [];

    for (let i = 0; i < creatorCount; i++) {
      const creatorAddress = Array.from(buffer.slice(offset, offset + 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      offset += 32;

      const verified = buffer[offset] === 1;
      offset += 1;

      const share = buffer[offset];
      offset += 1;

      creators.push({ address: creatorAddress, verified, share });
    }
  }

  // Collection (optional)
  let collection: MetaplexOnChainData['collection'] = null;
  const hasCollection = buffer[offset];
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

  return {
    key,
    updateAuthority,
    mint,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    creators,
    collection,
  };
}

/**
 * Fetches Solana Metaplex metadata and normalizes to universal format
 */
export async function fetchSolanaMetadata(
  rpcUrl: string,
  mintAddress: string,
  sealHash: string = '',
  dwalletId: string = ''
): Promise<UniversalNFTMetadata> {
  try {
    // Derive metadata PDA address
    // In production, use @solana/web3.js ProgramDerivedAddress
    const pda = await _deriveSolanaMetadataPda(mintAddress);
    const accountData = await getSolanaAccount(rpcUrl, pda);

    if (!accountData) {
      throw new SolanaMetadataError(`No metadata account found for mint ${mintAddress}`);
    }

    const onChainMetadata = deserializeMetaplexMetadata(accountData.data);

    // Fetch off-chain JSON
    const offChainMetadata = await fetchOffChainJson(onChainMetadata.uri);

    // Parse attributes from off-chain metadata
    const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> = Array.isArray(offChainMetadata.attributes)
      ? offChainMetadata.attributes.map((attr: Record<string, unknown>) => ({
          trait_type: String(attr.trait_type ?? ''),
          value: String(attr.value ?? ''),
          display_type: attr.display_type ? String(attr.display_type) : undefined,
        }))
      : [];

    // Get image from properties.files if available
    let image = String(offChainMetadata.image ?? '');
    if (!image && offChainMetadata.properties) {
      const props = offChainMetadata.properties as Record<string, unknown>;
      const files = props.files as Array<Record<string, unknown>> | undefined;
      if (files && Array.isArray(files)) {
        const imageFile = files.find((f: Record<string, unknown>) => 
          String(f.type ?? '').startsWith('image/')
        );
        if (imageFile) {
          image = String(imageFile.uri ?? '');
        }
      }
    }

    // Determine collection name
    const collectionName = onChainMetadata.collection
      ? onChainMetadata.name.replace(/ #\d+$/, '').trim()
      : onChainMetadata.symbol || onChainMetadata.name || 'Unknown Collection';

    const metadata: UniversalNFTMetadata = {
      name: onChainMetadata.name,
      description: String(offChainMetadata.description ?? ''),
      image,
      animation_url: offChainMetadata.animation_url ? String(offChainMetadata.animation_url) : undefined,
      external_url: offChainMetadata.external_url ? String(offChainMetadata.external_url) : undefined,
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
      },
      raw_metadata: {
        ...onChainMetadata,
        ...offChainMetadata,
      } as Record<string, unknown>,
    };

    return metadata;
  } catch (error) {
    if (error instanceof SolanaMetadataError) {
      throw error;
    }
    throw new SolanaMetadataError(
      `Failed to fetch Solana metadata for ${mintAddress}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Derives the metadata PDA for a given mint address
 * Uses a simplified derivation - production code should use @solana/web3.js
 */
async function _deriveSolanaMetadataPda(mintAddress: string): Promise<string> {
  // This is a placeholder - proper implementation needs @solana/web3.js
  // For the actual PDA derivation, we need to use ProgramDerivedAddress
  // with seeds: ["metadata", METADATA_PROGRAM_ID, mint_pubkey]
  
  // For now, construct using the API method
  const response = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getProgramAccounts',
      params: [
        METADATA_PROGRAM_ID,
        {
          commitment: 'confirmed',
          filters: [
            { memcmp: { offset: 33, bytes: mintAddress } },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  if (result.result && result.result.length > 0) {
    return result.result[0].pubkey;
  }

  throw new Error(`Could not derive metadata PDA for ${mintAddress}`);
}
