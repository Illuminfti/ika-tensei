/**
 * NEAR NEP-177 Metadata Adapter
 * Fetches and normalizes metadata from NEAR NFTs
 */

import type { UniversalNFTMetadata } from './types.js';

/**
 * Error class for NEAR metadata resolution failures
 */
export class NearMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NearMetadataError';
  }
}

/**
 * Makes a view call to a NEAR contract
 */
async function nearViewCall(
  rpcUrl: string,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const argsBase64 = btoa(JSON.stringify(args));

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'query',
      params: {
        request_type: 'call_function',
        account_id: contractId,
        method_name: methodName,
        args_base64: argsBase64,
        finality: 'optimistic',
      },
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`NEAR RPC error: ${result.error.message}`);
  }

  if (!result.result?.result) {
    return null;
  }

  // Result is a base64-encoded JSON string
  const decoded = atob(result.result.result);
  return JSON.parse(decoded);
}

/**
 * Fetches NEAR NFT metadata for a specific token
 */
async function fetchNearTokenMetadata(
  rpcUrl: string,
  contractId: string,
  tokenId: string
): Promise<Record<string, unknown>> {
  const tokenData = await nearViewCall(rpcUrl, contractId, 'nft_token', { token_id: tokenId });
  return tokenData as Record<string, unknown>;
}

/**
 * Fetches NEAR NFT contract metadata
 */
async function fetchNearContractMetadata(
  rpcUrl: string,
  contractId: string
): Promise<Record<string, unknown>> {
  const metadata = await nearViewCall(rpcUrl, contractId, 'nft_metadata', {});
  return metadata as Record<string, unknown>;
}

/**
 * Fetches off-chain JSON for attributes or reference
 */
async function fetchNearOffChainJson(uri: string): Promise<Record<string, unknown>> {
  let url = uri;
  if (uri.startsWith('ipfs://')) {
    url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch off-chain metadata: ${response.status}`);
  }
  return response.json();
}

/**
 * Extracts media URL, handling IPFS and other schemes
 */
function extractMediaUrl(
  media?: string,
  _mediaHash?: string,
  baseUri?: string
): string {
  if (!media) {
    return '';
  }

  // Already a full URL
  if (media.startsWith('http://') || media.startsWith('https://')) {
    return media;
  }

  // IPFS
  if (media.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${media.slice(7)}`;
  }

  // NEAR IPFS style (CID with optional path)
  if (baseUri && !media.startsWith('http')) {
    const normalizedMedia = media.replace(/^\//, '');
    return `${baseUri.replace(/\/$/, '')}/${normalizedMedia}`;
  }

  return media;
}

/**
 * Fetches NEAR NEP-177 metadata and normalizes to universal format
 */
export async function fetchNearMetadata(
  rpcUrl: string,
  contractId: string,
  tokenId: string,
  sealHash: string = '',
  dwalletId: string = ''
): Promise<UniversalNFTMetadata> {
  try {
    // Fetch token data and contract metadata in parallel
    const [tokenData, contractMetadata] = await Promise.all([
      fetchNearTokenMetadata(rpcUrl, contractId, tokenId),
      fetchNearContractMetadata(rpcUrl, contractId),
    ]);

    if (!tokenData) {
      throw new NearMetadataError(`Token ${tokenId} not found in contract ${contractId}`);
    }

    const token = tokenData as {
      token_id: string;
      owner_id: string;
      token_metadata?: {
        title?: string;
        description?: string;
        media?: string;
        media_hash?: string;
        reference?: string;
        reference_hash?: string;
        issued_at?: string;
        expires_at?: string;
        starts_at?: string;
        updated_at?: string;
        extra?: string;
      };
      metadata?: {
        title?: string;
        description?: string;
        media?: string;
        media_hash?: string;
        reference?: string;
        reference_hash?: string;
        extra?: string;
      };
      base_uri?: string;
    };

    const contract = contractMetadata as {
      spec?: string;
      name?: string;
      symbol?: string;
      icon?: string;
      base_uri?: string;
      reference?: string;
      reference_hash?: string;
    };

    // Get token metadata
    const tokenMetadata = (token.token_metadata ?? token.metadata) as {
      title?: string;
      description?: string;
      media?: string;
      media_hash?: string;
      reference?: string;
      reference_hash?: string;
      extra?: string;
    };

    // Get base URI from contract or token
    const baseUri = token.base_uri ?? contract.base_uri ?? '';

    // Extract media URL
    const mediaUrl = extractMediaUrl(
      tokenMetadata.media,
      tokenMetadata.media_hash,
      baseUri
    );

    // Fetch reference JSON for additional metadata (attributes)
    let referenceData: Record<string, unknown> = {};
    if (tokenMetadata.reference) {
      try {
        referenceData = await fetchNearOffChainJson(tokenMetadata.reference);
      } catch {
        // Reference might be invalid, continue without it
      }
    }

    // Parse attributes from reference or extra
    const attributes: Array<{ trait_type: string; value: string | number }> = [];

    // From reference JSON attributes field
    if (referenceData.attributes && Array.isArray(referenceData.attributes)) {
      for (const attr of referenceData.attributes) {
        if (attr && typeof attr === 'object') {
          const a = attr as Record<string, unknown>;
          attributes.push({
            trait_type: String(a.trait_type ?? a.type ?? ''),
            value: String(a.value ?? a.display_type ?? ''),
          });
        }
      }
    }

    // From extra field (some contracts store attributes as JSON string)
    if (tokenMetadata.extra) {
      try {
        const extra = JSON.parse(tokenMetadata.extra);
        if (Array.isArray(extra)) {
          for (const attr of extra) {
            if (attr && typeof attr === 'object') {
              const a = attr as Record<string, unknown>;
              attributes.push({
                trait_type: String(a.trait_type ?? ''),
                value: String(a.value ?? ''),
              });
            }
          }
        }
      } catch {
        // Not valid JSON
      }
    }

    // Build collection info
    const collectionName = contract.name ?? 'NEAR Collection';

    const metadata: UniversalNFTMetadata = {
      name: tokenMetadata.title ?? `NEAR Token ${tokenId}`,
      description: tokenMetadata.description ?? String(referenceData.description ?? ''),
      image: mediaUrl,
      animation_url: referenceData.animation_url ? String(referenceData.animation_url) : undefined,
      external_url: referenceData.external_url ? String(referenceData.external_url) : undefined,
      attributes,
      collection: {
        name: collectionName,
        image: contract.icon ?? undefined,
        family: contract.symbol ?? undefined,
      },
      provenance: {
        source_chain: 'near',
        source_contract: contractId,
        token_id: tokenId,
        seal_hash: sealHash,
        dwallet_id: dwalletId,
        sealed_at: Date.now(),
        original_metadata_uri: tokenMetadata.reference ?? undefined,
      },
      raw_metadata: {
        ...tokenMetadata,
        ...referenceData,
        contract_metadata: contract,
      } as Record<string, unknown>,
    };

    return metadata;
  } catch (error) {
    if (error instanceof NearMetadataError) {
      throw error;
    }
    throw new NearMetadataError(
      `Failed to fetch NEAR metadata for ${contractId}/${tokenId}`,
      error instanceof Error ? error : undefined
    );
  }
}
