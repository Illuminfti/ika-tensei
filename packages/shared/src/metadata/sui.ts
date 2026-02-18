/**
 * Sui NFT Metadata Adapter
 * Fetches and normalizes metadata from Sui NFTs
 */

import type { UniversalNFTMetadata } from './types.js';

/**
 * Error class for Sui metadata resolution failures
 */
export class SuiMetadataError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SuiMetadataError';
  }
}

/**
 * Fetches an object from Sui RPC
 */
async function suiGetObject(
  rpcUrl: string,
  objectId: string,
  options?: { showContent?: boolean; showDisplay?: boolean }
): Promise<Record<string, unknown>> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getObject',
      params: [
        objectId,
        {
          showContent: options?.showContent ?? true,
          showDisplay: options?.showDisplay ?? true,
        },
      ],
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Sui RPC error: ${result.error.message}`);
  }

  return result.result;
}

/**
 * Extracts Display fields from Sui object
 */
function extractDisplayFields(display?: Record<string, unknown>): Record<string, string> {
  if (!display || !display.data) {
    return {};
  }

  const data = display.data as Record<string, Record<string, string>>;
  const fields: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'value' in value) {
      fields[key] = String(value.value);
    }
  }

  return fields;
}

/**
 * Extracts fields from Sui object content
 */
function extractContentFields(content?: Record<string, unknown>): Record<string, unknown> {
  if (!content) {
    return {};
  }

  // Handle different content types
  if (content.fields) {
    return content.fields as Record<string, unknown>;
  }

  return content;
}

/**
 * Extracts attributes from Sui object
 * Looks for common attribute fields
 */
function extractAttributes(content: Record<string, unknown>): Array<{ trait_type: string; value: string | number; display_type?: string }> {
  const attributes: Array<{ trait_type: string; value: string | number; display_type?: string }> = [];

  // Check for attributes/properties field
  const attrsField = content.attributes ?? content.properties ?? content.props;
  if (attrsField && typeof attrsField === 'object') {
    for (const [key, value] of Object.entries(attrsField)) {
      if (typeof value === 'string' || typeof value === 'number') {
        attributes.push({ trait_type: key, value });
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects like { value: "...", display_type: "..." }
        const nested = value as Record<string, unknown>;
        attributes.push({
          trait_type: key,
          value: String(nested.value ?? JSON.stringify(nested)),
          display_type: nested.display_type ? String(nested.display_type) : undefined,
        });
      }
    }
  }

  // Also check for URL-encoded attributes
  const urlAttrs = content.url_attributes ?? content.attributes_url;
  if (urlAttrs && typeof urlAttrs === 'string') {
    try {
      const parsed = JSON.parse(urlAttrs);
      for (const [key, value] of Object.entries(parsed)) {
        attributes.push({ trait_type: key, value: String(value) });
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return attributes;
}

/**
 * Extracts the Move type from the object
 */
function extractMoveType(objectType?: string): string {
  if (!objectType) {
    return 'Unknown';
  }

  // Extract module::Type from full type string
  // e.g., "0x2::nft::NFT" -> "nft::NFT"
  const match = objectType.match(/::([^:]+)$/);
  return match ? match[1] : objectType;
}

/**
 * Fetches Sui NFT metadata and normalizes to universal format
 */
export async function fetchSuiMetadata(
  rpcUrl: string,
  objectId: string,
  sealHash: string = '',
  dwalletId: string = ''
): Promise<UniversalNFTMetadata> {
  try {
    // Fetch object with display and content
    const objectData = await suiGetObject(rpcUrl, objectId, {
      showContent: true,
      showDisplay: true,
    });

    if (!objectData || objectData.status !== 'Exists') {
      throw new SuiMetadataError(`Object ${objectId} not found`);
    }

    const data = objectData.data as Record<string, unknown> | undefined;
    if (!data) {
      throw new SuiMetadataError(`Object ${objectId} has no data`);
    }

    // Extract display fields
    const displayFields = extractDisplayFields(data.display as Record<string, unknown> | undefined);

    // Extract content fields
    const contentFields = extractContentFields(data.content as Record<string, unknown> | undefined);

    // Extract object type for collection
    const objectType = extractMoveType(data.type as string | undefined);

    // Extract attributes
    const attributes = extractAttributes(contentFields);

    // Build image URL
    let image = displayFields.image_url 
      ?? displayFields.image 
      ?? contentFields.image_url 
      ?? contentFields.image 
      ?? contentFields.url 
      ?? '';
    
    if (typeof image === 'object' && image !== null) {
      image = String((image as Record<string, unknown>).url ?? (image as Record<string, unknown>).link ?? '');
    }

    // Build external URL
    let externalUrl = displayFields.project_url 
      ?? displayFields.external_url 
      ?? contentFields.project_url 
      ?? contentFields.external_url 
      ?? contentFields.url 
      ?? '';
    
    if (typeof externalUrl === 'object' && externalUrl !== null) {
      externalUrl = String((externalUrl as Record<string, unknown>).url ?? '');
    }

    // Get creator
    const creator = displayFields.creator 
      ?? contentFields.creator 
      ?? '';

    // Get name and description
    const name = displayFields.name 
      ?? contentFields.name 
      ?? contentFields.title 
      ?? `Sui NFT ${objectId.slice(0, 8)}`;

    const description = displayFields.description 
      ?? contentFields.description 
      ?? '';

    // Build collection info
    const collectionName = displayFields.collection 
      ?? contentFields.collection 
      ?? objectType 
      ?? 'Unknown Collection';

    const metadata: UniversalNFTMetadata = {
      name: String(name),
      description: String(description),
      image: String(image),
      external_url: externalUrl ? String(externalUrl) : undefined,
      animation_url: contentFields.animation_url ? String(contentFields.animation_url) : undefined,
      attributes,
      collection: {
        name: String(collectionName),
        family: creator ? String(creator) : undefined,
      },
      provenance: {
        source_chain: 'sui',
        source_contract: objectType,
        token_id: objectId,
        seal_hash: sealHash,
        dwallet_id: dwalletId,
        sealed_at: Date.now(),
        fetched_at: new Date().toISOString(),
      },
      raw_metadata: {
        ...contentFields,
        display: displayFields,
      } as Record<string, unknown>,
    };

    return metadata;
  } catch (error) {
    if (error instanceof SuiMetadataError) {
      throw error;
    }
    throw new SuiMetadataError(
      `Failed to fetch Sui metadata for ${objectId}`,
      error instanceof Error ? error : undefined
    );
  }
}
