/**
 * Seal hash construction for Ika Tensei v3
 * Byte layout MUST match PRD §6.1 exactly
 */

import { ChainId, DESTINATION_CHAIN_ID } from './chains';

/**
 * Construct seal hash bytes per PRD §6.1
 * 
 * Byte layout:
 * Offset  Size   Field                      Encoding
 * 0       2      source_chain_id            u16 big-endian
 * 2       2      destination_chain_id       u16 big-endian (always 3 = Solana)
 * 4       1      source_contract_length     u8
 * 5       N      source_contract_address    raw bytes (N = length)
 * 5+N     1      token_id_length            u8
 * 6+N     M      token_id                   raw bytes (M = length)
 * 6+N+M   32     attestation_pubkey         Ed25519 pubkey (always 32 bytes)
 * 38+N+M  8      nonce                      u64 big-endian
 */
export function constructSealHashBytes(
  sourceChainId: ChainId,
  sourceContract: Uint8Array,
  tokenId: Uint8Array,
  attestationPubkey: Uint8Array, // 32 bytes Ed25519
  nonce: bigint
): Uint8Array {
  // Validate inputs
  if (attestationPubkey.length !== 32) {
    throw new Error(`Attestation pubkey must be 32 bytes, got ${attestationPubkey.length}`);
  }
  if (sourceContract.length > 64) {
    throw new Error(`Source contract too long: ${sourceContract.length} bytes (max 64)`);
  }
  if (tokenId.length > 64) {
    throw new Error(`Token ID too long: ${tokenId.length} bytes (max 64)`);
  }

  const destChainId = DESTINATION_CHAIN_ID;
  
  // Calculate total size
  // 2 + 2 + 1 + N + 1 + M + 32 + 8 = 46 + N + M
  const totalSize = 46 + sourceContract.length + tokenId.length;
  
  const buffer = new Uint8Array(totalSize);
  let offset = 0;

  // source_chain_id (u16 BE) - 2 bytes
  buffer[offset++] = (sourceChainId >> 8) & 0xff;
  buffer[offset++] = sourceChainId & 0xff;

  // destination_chain_id (u16 BE) - 2 bytes
  buffer[offset++] = (destChainId >> 8) & 0xff;
  buffer[offset++] = destChainId & 0xff;

  // source_contract_length (u8) - 1 byte
  buffer[offset++] = sourceContract.length;

  // source_contract_address (N bytes)
  buffer.set(sourceContract, offset);
  offset += sourceContract.length;

  // token_id_length (u8) - 1 byte
  buffer[offset++] = tokenId.length;

  // token_id (M bytes)
  buffer.set(tokenId, offset);
  offset += tokenId.length;

  // attestation_pubkey (32 bytes)
  buffer.set(attestationPubkey, offset);
  offset += 32;

  // nonce (u64 BE) - 8 bytes
  const nonceNum = Number(nonce);
  buffer[offset++] = (nonceNum >> 56) & 0xff;
  buffer[offset++] = (nonceNum >> 48) & 0xff;
  buffer[offset++] = (nonceNum >> 40) & 0xff;
  buffer[offset++] = (nonceNum >> 32) & 0xff;
  buffer[offset++] = (nonceNum >> 24) & 0xff;
  buffer[offset++] = (nonceNum >> 16) & 0xff;
  buffer[offset++] = (nonceNum >> 8) & 0xff;
  buffer[offset++] = nonceNum & 0xff;

  return buffer;
}

/**
 * Hash seal data using SHA-256, truncated to 32 bytes for PDA seed
 * This is what gets signed by the dWallet and verified on Solana
 */
export async function hashSealData(sealBytes: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', sealBytes.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Synchronous SHA-256 hash (uses Node.js crypto module)
 */
export function hashSealDataSync(sealBytes: Uint8Array): Uint8Array {
  const { createHash } = require('crypto');
  const hash = createHash('sha256').update(sealBytes).digest();
  return new Uint8Array(hash);
}

/**
 * Encode token ID based on chain type
 * Per PRD §6.2
 */
export function encodeTokenId(tokenId: string | number | bigint, chainId: ChainId): Uint8Array {
  switch (chainId) {
    case ChainId.ETHEREUM: {
      // uint256 -> 32 bytes big-endian
      let num: bigint;
      if (typeof tokenId === 'string') {
        num = tokenId.startsWith('0x') ? BigInt(tokenId) : BigInt(tokenId);
      } else {
        num = BigInt(tokenId);
      }
      const ethBytes = new Uint8Array(32);
      for (let i = 31; i >= 0; i--) {
        ethBytes[i] = Number(num & 0xffn);
        num = num >> 1n;
      }
      return ethBytes;
    }

    case ChainId.SOLANA:
      // Mint pubkey -> 32 bytes raw
      if (typeof tokenId === 'string') {
        // Assume base58 decoded to 32 bytes
        // For simplicity, treat as raw bytes if already provided
        return new TextEncoder().encode(tokenId).slice(0, 32);
      }
      // Handle ArrayBuffer/Uint8Array input
      return new Uint8Array(tokenId as unknown as ArrayBuffer);

    case ChainId.SUI:
      // Object ID -> 32 bytes raw
      if (typeof tokenId === 'string') {
        return new TextEncoder().encode(tokenId).slice(0, 32);
      }
      // Handle ArrayBuffer/Uint8Array input
      return new Uint8Array(tokenId as unknown as ArrayBuffer);

    case ChainId.BITCOIN: {
      // txid:index format - 34 bytes (32 txid + 2 index)
      if (typeof tokenId === 'string') {
        const [txid, index] = tokenId.split(':');
        if (!txid || !index) {
          throw new Error('Bitcoin token ID must be txid:index format');
        }
        const result = new Uint8Array(34);
        // txid is hex, convert to bytes
        const txidBytes = hexToBytes(txid);
        result.set(txidBytes, 0);
        // index as u16 BE
        const idx = parseInt(index, 10);
        result[32] = (idx >> 8) & 0xff;
        result[33] = idx & 0xff;
        return result;
      }
      // Handle ArrayBuffer/Uint8Array input
      return new Uint8Array(tokenId as unknown as ArrayBuffer);
    }

    case ChainId.NEAR:
      // String -> UTF-8 bytes, variable length
      return new TextEncoder().encode(tokenId as string);

    default:
      throw new Error(`Unknown chain: ${chainId}`);
  }
}

/**
 * Helper: hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Parse seal hash bytes back to components (for verification/debugging)
 */
export interface ParsedSealData {
  sourceChainId: ChainId;
  destChainId: ChainId;
  sourceContract: Uint8Array;
  tokenId: Uint8Array;
  attestationPubkey: Uint8Array;
  nonce: bigint;
}

export function parseSealHashBytes(bytes: Uint8Array): ParsedSealData {
  let offset = 0;

  // source_chain_id (u16 BE)
  const sourceChainId = (bytes[offset++] << 8) | bytes[offset++];

  // destination_chain_id (u16 BE)
  const destChainId = (bytes[offset++] << 8) | bytes[offset++];

  // source_contract_length (u8)
  const sourceContractLength = bytes[offset++];
  if (sourceContractLength === undefined) {
    throw new Error('Invalid seal bytes: source contract length missing');
  }
  const sourceContract = bytes.slice(offset, offset + sourceContractLength);
  offset += sourceContractLength;

  // token_id_length (u8)
  const tokenIdLength = bytes[offset++];
  if (tokenIdLength === undefined) {
    throw new Error('Invalid seal bytes: token ID length missing');
  }
  const tokenId = bytes.slice(offset, offset + tokenIdLength);
  offset += tokenIdLength;

  // attestation_pubkey (32 bytes)
  const attestationPubkey = bytes.slice(offset, offset + 32);
  offset += 32;

  // nonce (u64 BE)
  let nonce = 0n;
  for (let i = 0; i < 8; i++) {
    const b = bytes[offset++];
    if (b === undefined) {
      throw new Error('Invalid seal bytes: nonce incomplete');
    }
    nonce = (nonce << 8n) | BigInt(b);
  }

  return {
    sourceChainId: sourceChainId as ChainId,
    destChainId: destChainId as ChainId,
    sourceContract,
    tokenId,
    attestationPubkey,
    nonce,
  };
}
