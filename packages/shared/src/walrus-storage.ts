/**
 * Walrus Decentralized Storage Module
 * Provides upload/download functionality for Walrus storage
 */

import type { MetaplexMetadataJson } from './metadata/types.js';

/**
 * Walrus Network Configuration
 */
export interface WalrusConfig {
  network: 'testnet' | 'mainnet';
}

/**
 * Upload result from Walrus
 */
export interface WalrusUploadResult {
  blobId: string;
  url: string;
  walrusUrl?: string;
}

/**
 * Walrus Service URLs
 */
const WALRUS_PUBLISHER_TESTNET = 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR_TESTNET = 'https://aggregator.walrus-testnet.walrus.space';
const WALRUS_PUBLISHER_MAINNET = 'https://publisher.walrus.walrus.space'; // Placeholder
const WALRUS_AGGREGATOR_MAINNET = 'https://aggregator.walrus.walrus.space'; // Placeholder

/**
 * Error class for Walrus storage operations
 */
export class WalrusStorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WalrusStorageError';
  }
}

/**
 * Gets the publisher URL for the given network
 */
function getPublisherUrl(network: 'testnet' | 'mainnet'): string {
  return network === 'testnet' ? WALRUS_PUBLISHER_TESTNET : WALRUS_PUBLISHER_MAINNET;
}

/**
 * Gets the aggregator URL for the given network
 */
function getAggregatorUrl(network: 'testnet' | 'mainnet'): string {
  return network === 'testnet' ? WALRUS_AGGREGATOR_TESTNET : WALRUS_AGGREGATOR_MAINNET;
}

/**
 * Converts data to Uint8Array
 */
function toUint8Array(data: Uint8Array | string): Uint8Array {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return data;
}

/**
 * Uploads a blob to Walrus storage
 */
export async function uploadBlob(
  data: Uint8Array | string,
  options?: { epochs?: number; network?: 'testnet' | 'mainnet' }
): Promise<WalrusUploadResult> {
  const network = options?.network ?? 'testnet';
  const epochs = options?.epochs ?? 1;
  
  const publisherUrl = getPublisherUrl(network);
  const dataBytes = toUint8Array(data);

  try {
    const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${epochs}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: dataBytes as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new WalrusStorageError(
        `Failed to upload blob: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    
    // The response contains the blob ID
    const blobId = result.blobId ?? result.blob_id ?? result.id;
    if (!blobId) {
      throw new WalrusStorageError('No blob ID returned from Walrus');
    }

    const aggregatorUrl = getAggregatorUrl(network);
    const url = `${aggregatorUrl}/v1/blobs/${blobId}`;

    return { blobId, url };
  } catch (error) {
    if (error instanceof WalrusStorageError) {
      throw error;
    }
    throw new WalrusStorageError(
      'Failed to upload blob to Walrus',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Downloads a blob from Walrus storage
 */
export async function downloadBlob(
  blobId: string,
  options?: { network?: 'testnet' | 'mainnet' }
): Promise<Uint8Array> {
  const network = options?.network ?? 'testnet';
  const aggregatorUrl = getAggregatorUrl(network);

  try {
    const response = await fetch(`${aggregatorUrl}/v1/blobs/${blobId}`);

    if (!response.ok) {
      throw new WalrusStorageError(
        `Failed to download blob: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    if (error instanceof WalrusStorageError) {
      throw error;
    }
    throw new WalrusStorageError(
      `Failed to download blob ${blobId}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Mirrors an image to Walrus storage
 * Fetches the image from the original URL and uploads to Walrus
 */
export async function mirrorImage(
  imageUrl: string,
  options?: { epochs?: number; network?: 'testnet' | 'mainnet' }
): Promise<WalrusUploadResult> {
  // Handle IPFS URLs
  let fetchUrl = imageUrl;
  if (imageUrl.startsWith('ipfs://')) {
    fetchUrl = `https://ipfs.io/ipfs/${imageUrl.slice(7)}`;
  } else if (imageUrl.startsWith('ar://')) {
    fetchUrl = `https://arweave.net/${imageUrl.slice(5)}`;
  }

  // Fetch the image
  let imageData: Uint8Array;
  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new WalrusStorageError(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    imageData = new Uint8Array(arrayBuffer);
  } catch (error) {
    if (error instanceof WalrusStorageError) {
      throw error;
    }
    throw new WalrusStorageError(
      `Failed to fetch image from ${imageUrl}`,
      error instanceof Error ? error : undefined
    );
  }

  // Upload to Walrus
  const result = await uploadBlob(imageData, {
    epochs: options?.epochs ?? 1,
    network: options?.network ?? 'testnet',
  });

  return {
    blobId: result.blobId,
    url: result.url,
    walrusUrl: result.url,
  };
}

/**
 * Uploads Metaplex metadata JSON to Walrus storage
 */
export async function uploadMetadataJson(
  metadata: MetaplexMetadataJson,
  options?: { epochs?: number; network?: 'testnet' | 'mainnet' }
): Promise<WalrusUploadResult> {
  const jsonString = JSON.stringify(metadata, null, 2);
  return uploadBlob(jsonString, options);
}

/**
 * Convenience function to mirror an image and get the Walrus URL
 */
export async function mirrorNftImage(
  metadata: UniversalNFTMetadata,
  options?: { epochs?: number; network?: 'testnet' | 'mainnet' }
): Promise<UniversalNFTMetadata> {
  if (!metadata.image) {
    return metadata;
  }

  // Skip if already a Walrus URL
  if (metadata.image.includes('walrus')) {
    return metadata;
  }

  const { url: arweaveUrl } = await mirrorImage(metadata.image, options);

  return {
    ...metadata,
    image_arweave: arweaveUrl,
  };
}

// Re-export for convenience
import type { UniversalNFTMetadata } from './metadata/types.js';
