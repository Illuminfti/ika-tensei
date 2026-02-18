/**
 * Wormhole VAA (Verified Action Approval) fetching and parsing
 * For Ika Tensei v3 - NFT Reincarnation Protocol
 * 
 * VAA Format:
 * - Header: version (1) + guardianSetIndex (4) + signatures
 * - Body: timestamp (4) + nonce (4) + emitterChain (2) + emitterAddress (32) + sequence (8) + consistencyLevel (1) + payload
 */

// Chain types imported from chains (used in other parts of the codebase)
// import { ChainId, WormholeChainId, toWormholeChainId } from './chains';

/**
 * Wormhole chain ID constants (as used in VAA)
 * These are the official Wormhole chain IDs
 */
export const WORMHOLE_CHAIN_ID = {
  SOLANA: 1,
  ETHEREUM: 2,
  TERRA: 3,
  SOLANA_DEVNET: 4,
  TERRA_DEVNET: 5,
  NEAR: 15,
  NEAR_TESTNET: 16,
  AVALANCHE: 6,
  FANTOM: 10,
  ALGORAND: 8,
  SUI: 21,
  APTOS: 22,
  ARBITRUM: 23,
  OPTIMISM: 24,
  BASE: 25,
} as const;

export type WormholeChainIdConstant = typeof WORMHOLE_CHAIN_ID[keyof typeof WORMHOLE_CHAIN_ID];

/** Testnet API endpoints */
const TESTNET_API_PRIMARY = 'https://api.testnet.wormholescan.io';
const TESTNET_API_ALT = 'https://wormhole-v2-testnet-api.certus.one';

/** Polling configuration */
const DEFAULT_MAX_RETRIES = 30;
const DEFAULT_RETRY_DELAY_MS = 2000;

/**
 * Fetch a VAA from Wormhole testnet API
 * Polls until the VAA is available (VAAs take ~60s to finalize on testnet)
 * 
 * @param emitterChain - Wormhole chain ID of the emitter
 * @param emitterAddress - Emitter address (hex string without 0x prefix)
 * @param sequence - Sequence number of the message
 * @param maxRetries - Maximum number of polling attempts (default: 30)
 * @param retryDelayMs - Delay between retries in ms (default: 2000)
 * @returns Raw VAA bytes
 */
export async function fetchVAA(
  emitterChain: number,
  emitterAddress: string,
  sequence: bigint,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  retryDelayMs: number = DEFAULT_RETRY_DELAY_MS
): Promise<Uint8Array> {
  // Normalize emitter address (remove 0x prefix if present)
  const normalizedEmitter = emitterAddress.startsWith('0x') 
    ? emitterAddress.slice(2) 
    : emitterAddress;
  
  // Format emitter as zero-padded 64-char hex (32 bytes)
  const paddedEmitter = normalizedEmitter.padStart(64, '0').toLowerCase();
  
  const sequenceHex = sequence.toString(16);
  
  // Try primary API first
  const primaryUrl = `${TESTNET_API_PRIMARY}/api/v1/signed_vaa/${emitterChain}/${paddedEmitter}/${sequenceHex}`;
  const altUrl = `${TESTNET_API_ALT}/v1/signed_vaa/${emitterChain}/${paddedEmitter}/${sequenceHex}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Try primary API
    try {
      const response = await fetch(primaryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as { vaaBytes?: string };
        if (data.vaaBytes) {
          return base64ToUint8Array(data.vaaBytes);
        }
      } else if (response.status === 404) {
        // VAA not ready yet, continue polling
      } else {
        console.warn(`Primary API error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      lastError = err as Error;
      console.warn(`Primary API fetch failed: ${lastError.message}`);
    }
    
    // Try alt API if primary failed
    try {
      const response = await fetch(altUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as { vaa?: string };
        if (data.vaa) {
          return base64ToUint8Array(data.vaa);
        }
      } else if (response.status === 404) {
        // VAA not ready yet, continue polling
      } else {
        console.warn(`Alt API error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      lastError = err as Error;
      console.warn(`Alt API fetch failed: ${lastError.message}`);
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  throw new Error(
    `Failed to fetch VAA after ${maxRetries} attempts. ` +
    `Emitter: ${emitterChain}/${paddedEmitter}/${sequenceHex}. ` +
    `Last error: ${lastError?.message ?? 'Unknown'}`
  );
}

/**
 * Parse VAA header and body
 * Returns parsed VAA structure with all metadata and payload
 * 
 * VAA Structure:
 * - Header:
 *   - version: 1 byte (always 1)
 *   - guardianSetIndex: 4 bytes (u32 LE)
 *   - signatures: for each signature:
 *     - index: 1 byte (guardian index)
 *     - signature: 64 bytes (r + s, no recovery byte)
 * - Body:
 *   - timestamp: 4 bytes (u32 LE, Unix time)
 *   - nonce: 4 bytes (u32 LE)
 *   - emitterChain: 2 bytes (u16 LE)
 *   - emitterAddress: 32 bytes
 *   - sequence: 8 bytes (u64 LE)
 *   - consistencyLevel: 1 byte
 *   - payload: variable length
 */
export interface ParsedVAA {
  version: number;
  guardianSetIndex: number;
  signatures: VAASignature[];
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: Uint8Array;
  sequence: bigint;
  consistencyLevel: number;
  payload: Uint8Array;
}

export interface VAASignature {
  guardianIndex: number;
  signature: Uint8Array; // 64 bytes
}

/**
 * Parse a VAA byte array into its components
 */
export function parseVAAPayload(vaaBytes: Uint8Array): ParsedVAA {
  let offset = 0;
  
  // === HEADER ===
  
  // version (1 byte)
  const version = vaaBytes[offset++];
  if (version !== 1) {
    throw new Error(`Invalid VAA version: ${version}, expected 1`);
  }
  
  // guardianSetIndex (4 bytes LE)
  const guardianSetIndex = readUInt32LE(vaaBytes, offset);
  offset += 4;
  
  // signatures
  const signatureCount = vaaBytes[offset++];
  const signatures: VAASignature[] = [];
  
  for (let i = 0; i < signatureCount; i++) {
    const guardianIndex = vaaBytes[offset++];
    const signature = vaaBytes.slice(offset, offset + 64);
    offset += 64;
    
    signatures.push({ guardianIndex, signature });
  }
  
  // === BODY ===
  
  // timestamp (4 bytes LE)
  const timestamp = readUInt32LE(vaaBytes, offset);
  offset += 4;
  
  // nonce (4 bytes LE)
  const nonce = readUInt32LE(vaaBytes, offset);
  offset += 4;
  
  // emitterChain (2 bytes LE)
  const emitterChain = readUInt16LE(vaaBytes, offset);
  offset += 2;
  
  // emitterAddress (32 bytes)
  const emitterAddress = vaaBytes.slice(offset, offset + 32);
  offset += 32;
  
  // sequence (8 bytes LE)
  const sequence = readUInt64LE(vaaBytes, offset);
  offset += 8;
  
  // consistencyLevel (1 byte)
  const consistencyLevel = vaaBytes[offset++];
  
  // payload (rest)
  const payload = vaaBytes.slice(offset);
  
  return {
    version,
    guardianSetIndex,
    signatures,
    timestamp,
    nonce,
    emitterChain,
    emitterAddress,
    sequence,
    consistencyLevel,
    payload,
  };
}

/**
 * Parse NFT deposit payload from VAA payload
 * Matches the custom Ika Tensei payload format:
 * 
 * Byte Layout:
 * Offset  Size   Field
 * 0       1      payload_id          (always 1 = NFT_DEPOSIT)
 * 1       2      source_chain_id     (Wormhole chain ID, u16 BE)
 * 3       32     nft_contract        (contract address, 0-padded to 32 bytes)
 * 35      32     token_id            (token ID, 0-padded to 32 bytes)
 * 67      32     depositor           (original owner address, 0-padded to 32 bytes)
 * 99      32     dwallet_address     (dWallet address on source chain, 0-padded to 32 bytes)
 * 131     8      deposit_block       (block number, u64 BE)
 * 139     32     seal_nonce          (unique nonce, prevents replay)
 * Total: 171 bytes
 */
export interface NFTDepositPayload {
  payloadId: number;
  sourceChainId: number;
  nftContract: Uint8Array; // 32 bytes
  tokenId: Uint8Array; // 32 bytes
  depositor: Uint8Array; // 32 bytes
  dwalletAddress: Uint8Array; // 32 bytes
  depositBlock: bigint;
  sealNonce: Uint8Array; // 32 bytes
}

/** Decoded deposit payload with human-readable strings */
export interface DecodedNFTDepositPayload {
  payloadId: number;
  sourceChainId: number;
  nftContract: string;
  tokenId: string;
  depositor: string;
  dwalletAddress: string;
  depositBlock: bigint;
  sealNonce: string;
}

/**
 * Parse NFT deposit payload from raw payload bytes
 */
export function parseNFTDepositPayload(payload: Uint8Array): NFTDepositPayload {
  if (payload.length < 171) {
    throw new Error(`Invalid payload length: ${payload.length}, expected at least 171`);
  }
  
  let offset = 0;
  
  // payload_id (1 byte)
  const payloadId = payload[offset++];
  if (payloadId !== 1) {
    throw new Error(`Invalid payload ID: ${payloadId}, expected 1 (NFT_DEPOSIT)`);
  }
  
  // source_chain_id (2 bytes BE - note: different from VAA body which uses LE)
  const sourceChainId = (payload[offset] << 8) | payload[offset + 1];
  offset += 2;
  
  // nft_contract (32 bytes)
  const nftContract = payload.slice(offset, offset + 32);
  offset += 32;
  
  // token_id (32 bytes)
  const tokenId = payload.slice(offset, offset + 32);
  offset += 32;
  
  // depositor (32 bytes)
  const depositor = payload.slice(offset, offset + 32);
  offset += 32;
  
  // dwallet_address (32 bytes)
  const dwalletAddress = payload.slice(offset, offset + 32);
  offset += 32;
  
  // deposit_block (8 bytes BE)
  const depositBlock = readUInt64BE(payload, offset);
  offset += 8;
  
  // seal_nonce (32 bytes)
  const sealNonce = payload.slice(offset, offset + 32);
  
  return {
    payloadId,
    sourceChainId,
    nftContract,
    tokenId,
    depositor,
    dwalletAddress,
    depositBlock,
    sealNonce,
  };
}

/**
 * Parse and decode NFT deposit payload to human-readable format
 */
export function decodeNFTDepositPayload(payload: Uint8Array): DecodedNFTDepositPayload {
  const parsed = parseNFTDepositPayload(payload);
  
  return {
    payloadId: parsed.payloadId,
    sourceChainId: parsed.sourceChainId,
    nftContract: bytesToHex(parsed.nftContract),
    tokenId: bytesToHex(parsed.tokenId),
    depositor: bytesToHex(parsed.depositor),
    dwalletAddress: bytesToHex(parsed.dwalletAddress),
    depositBlock: parsed.depositBlock,
    sealNonce: bytesToHex(parsed.sealNonce),
  };
}

// ============= Helper Functions =============

/**
 * Read Uint16 from byte array (Little Endian)
 */
function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/**
 * Read Uint32 from byte array (Little Endian)
 */
function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] 
    | (bytes[offset + 1] << 8) 
    | (bytes[offset + 2] << 16) 
    | (bytes[offset + 3] << 24);
}

/**
 * Read Uint64 from byte array (Little Endian)
 */
function readUInt64LE(bytes: Uint8Array, offset: number): bigint {
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  }
  return result;
}

/**
 * Read Uint64 from byte array (Big Endian)
 */
function readUInt64BE(bytes: Uint8Array, offset: number): bigint {
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result = (result << 8n) | BigInt(bytes[offset + i]);
  }
  return result;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Create a mock VAA for testing purposes
 * This generates a valid VAA structure with the given payload
 */
export function createMockVAA(
  emitterChain: number,
  emitterAddress: string | Uint8Array,
  sequence: bigint,
  payload: Uint8Array,
  timestamp: number = Math.floor(Date.now() / 1000),
  nonce: number = 0
): Uint8Array {
  // Convert emitter address to bytes if string
  const emitterBytes = typeof emitterAddress === 'string' 
    ? hexToBytes(emitterAddress)
    : emitterAddress;
  
  // Ensure 32 bytes
  if (emitterBytes.length !== 32) {
    throw new Error('Emitter address must be 32 bytes');
  }
  
  // Build VAA manually
  const parts: Uint8Array[] = [];
  
  // Header
  parts.push(new Uint8Array([1])); // version
  parts.push(uint32ToLE(0)); // guardianSetIndex (0 for testnet)
  parts.push(new Uint8Array([1])); // 1 signature
  
  // Mock signature (64 bytes of zeros + 1 byte guardian index)
  const mockSig = new Uint8Array(65);
  mockSig[0] = 0; // guardian index
  parts.push(mockSig);
  
  // Body
  parts.push(uint32ToLE(timestamp));
  parts.push(uint32ToLE(nonce));
  parts.push(uint16ToLE(emitterChain));
  parts.push(emitterBytes);
  parts.push(uint64ToLE(sequence));
  parts.push(new Uint8Array([32])); // consistencyLevel
  parts.push(payload);
  
  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const vaa = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    vaa.set(part, offset);
    offset += part.length;
  }
  
  return vaa;
}

/**
 * Convert number to Uint8Array (Little Endian)
 */
function uint32ToLE(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

/**
 * Convert number to Uint8Array (Little Endian)
 */
function uint16ToLE(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  return bytes;
}

/**
 * Convert bigint to Uint8Array (Little Endian)
 */
function uint64ToLE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

/**
 * Encode NFT deposit payload (for creating mock VAAs)
 */
export function encodeNFTDepositPayload(
  sourceChainId: number,
  nftContract: string | Uint8Array,
  tokenId: string | Uint8Array,
  depositor: string | Uint8Array,
  dwalletAddress: string | Uint8Array,
  depositBlock: bigint,
  sealNonce: string | Uint8Array
): Uint8Array {
  const payload = new Uint8Array(171);
  let offset = 0;
  
  // payload_id (1 byte) - always 1 for NFT deposit
  payload[offset++] = 1;
  
  // source_chain_id (2 bytes BE)
  payload[offset++] = (sourceChainId >> 8) & 0xff;
  payload[offset++] = sourceChainId & 0xff;
  
  // nft_contract (32 bytes)
  const nftContractBytes = typeof nftContract === 'string' ? hexToBytes(nftContract) : nftContract;
  payload.set(padTo32Bytes(nftContractBytes), offset);
  offset += 32;
  
  // token_id (32 bytes)
  const tokenIdBytes = typeof tokenId === 'string' ? hexToBytes(tokenId) : tokenId;
  payload.set(padTo32Bytes(tokenIdBytes), offset);
  offset += 32;
  
  // depositor (32 bytes)
  const depositorBytes = typeof depositor === 'string' ? hexToBytes(depositor) : depositor;
  payload.set(padTo32Bytes(depositorBytes), offset);
  offset += 32;
  
  // dwallet_address (32 bytes)
  const dwalletAddressBytes = typeof dwalletAddress === 'string' ? hexToBytes(dwalletAddress) : dwalletAddress;
  payload.set(padTo32Bytes(dwalletAddressBytes), offset);
  offset += 32;
  
  // deposit_block (8 bytes BE)
  payload[offset++] = Number((depositBlock >> 56n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 48n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 40n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 32n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 24n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 16n) & 0xffn);
  payload[offset++] = Number((depositBlock >> 8n) & 0xffn);
  payload[offset++] = Number(depositBlock & 0xffn);
  
  // seal_nonce (32 bytes)
  const sealNonceBytes = typeof sealNonce === 'string' ? hexToBytes(sealNonce) : sealNonce;
  payload.set(padTo32Bytes(sealNonceBytes), offset);
  
  return payload;
}

function padTo32Bytes(data: Uint8Array): Uint8Array {
  if (data.length >= 32) {
    return data.slice(0, 32);
  }
  const padded = new Uint8Array(32);
  padded.set(data, 0);
  return padded;
}
