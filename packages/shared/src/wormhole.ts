/**
 * Wormhole deposit payload encoding for Ika Tensei v3
 * Per PRD §8.2 - 171 bytes total
 */

import { ChainId, WormholeChainId, toWormholeChainId } from './chains';

/**
 * Deposit payload ID - indicates this is an NFT deposit message */
export const DEPOSIT_PAYLOAD_ID = 1;

/**
 * Wormhole deposit payload structure per PRD §8.2:
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

export interface DepositPayload {
  payloadId: number;
  sourceChainId: WormholeChainId;
  nftContract: Uint8Array; // 32 bytes
  tokenId: Uint8Array; // 32 bytes
  depositor: Uint8Array; // 32 bytes
  dwalletAddress: Uint8Array; // 32 bytes
  depositBlock: bigint;
  sealNonce: Uint8Array; // 32 bytes
}

/** Decoded deposit payload for easier handling */
export interface DecodedDepositPayload {
  payloadId: number;
  sourceChainId: ChainId;
  nftContract: string;
  tokenId: string;
  depositor: string;
  dwalletAddress: string;
  depositBlock: bigint;
  sealNonce: bigint;
}

/**
 * Encode deposit payload for Wormhole message
 * @param sourceChainId - Our chain ID (ChainId enum)
 * @param nftContract - NFT contract address on source chain
 * @param tokenId - Token ID (should be 32 bytes padded)
 * @param depositor - Original owner address (32 bytes padded)
 * @param dwalletAddress - dWallet address on source chain (32 bytes padded)
 * @param depositBlock - Block number of deposit
 * @param sealNonce - Unique nonce for this seal (32 bytes)
 */
export function encodeDepositPayload(
  sourceChainId: ChainId,
  nftContract: Uint8Array,
  tokenId: Uint8Array,
  depositor: Uint8Array,
  dwalletAddress: Uint8Array,
  depositBlock: bigint,
  sealNonce: Uint8Array
): Uint8Array {
  const wormholeChainId = toWormholeChainId(sourceChainId);
  if (!wormholeChainId) {
    throw new Error(`Chain ${sourceChainId} not supported by Wormhole`);
  }

  const payload = new Uint8Array(171);
  let offset = 0;

  // payload_id (1 byte)
  payload[offset++] = DEPOSIT_PAYLOAD_ID;

  // source_chain_id (2 bytes u16 BE)
  payload[offset++] = (wormholeChainId >> 8) & 0xff;
  payload[offset++] = wormholeChainId & 0xff;

  // nft_contract (32 bytes, 0-padded)
  payload.set(padTo32Bytes(nftContract), offset);
  offset += 32;

  // token_id (32 bytes, 0-padded)
  payload.set(padTo32Bytes(tokenId), offset);
  offset += 32;

  // depositor (32 bytes, 0-padded)
  payload.set(padTo32Bytes(depositor), offset);
  offset += 32;

  // dwallet_address (32 bytes, 0-padded)
  payload.set(padTo32Bytes(dwalletAddress), offset);
  offset += 32;

  // deposit_block (8 bytes u64 BE)
  const depositBlockNum = Number(depositBlock);
  payload[offset++] = (depositBlockNum >> 56) & 0xff;
  payload[offset++] = (depositBlockNum >> 48) & 0xff;
  payload[offset++] = (depositBlockNum >> 40) & 0xff;
  payload[offset++] = (depositBlockNum >> 32) & 0xff;
  payload[offset++] = (depositBlockNum >> 24) & 0xff;
  payload[offset++] = (depositBlockNum >> 16) & 0xff;
  payload[offset++] = (depositBlockNum >> 8) & 0xff;
  payload[offset++] = depositBlockNum & 0xff;

  // seal_nonce (32 bytes)
  payload.set(padTo32Bytes(sealNonce), offset);

  return payload;
}

/**
 * Decode deposit payload from Wormhole message
 */
export function decodeDepositPayload(payload: Uint8Array): DecodedDepositPayload {
  if (payload.length !== 171) {
    throw new Error(`Invalid payload length: ${payload.length}, expected 171`);
  }

  let offset = 0;

  // payload_id (1 byte)
  const payloadId = payload[offset++];
  if (payloadId !== DEPOSIT_PAYLOAD_ID) {
    throw new Error(`Invalid payload ID: ${payloadId}, expected ${DEPOSIT_PAYLOAD_ID}`);
  }

  // source_chain_id (2 bytes u16 BE)
  const wormholeChainId = (payload[offset++] << 8) | payload[offset++];
  const sourceChainId = fromWormholeChainId(wormholeChainId);
  if (!sourceChainId) {
    throw new Error(`Unknown Wormhole chain ID: ${wormholeChainId}`);
  }

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

  // deposit_block (8 bytes u64 BE)
  let depositBlock = 0n;
  for (let i = 0; i < 8; i++) {
    const b = payload[offset++];
    if (b === undefined) {
      throw new Error('Invalid payload: deposit block incomplete');
    }
    depositBlock = (depositBlock << 8n) | BigInt(b);
  }

  // seal_nonce (32 bytes)
  const sealNonceBytes = payload.slice(offset, offset + 32);
  let sealNonce = 0n;
  for (let i = 0; i < 32; i++) {
    sealNonce = (sealNonce << 8n) | BigInt(sealNonceBytes[i]);
  }

  return {
    payloadId,
    sourceChainId,
    nftContract: bytesToHex(nftContract),
    tokenId: bytesToHex(tokenId),
    depositor: bytesToHex(depositor),
    dwalletAddress: bytesToHex(dwalletAddress),
    depositBlock,
    sealNonce,
  };
}

/**
 * Get the raw deposit payload from a full VAA (skip the VAA header)
 * VAA structure: 4-byte version + 4-byte guardian set index + signature count + signatures + timestamp + nonce + chain + emitter + sequence + payload
 */
export function extractPayloadFromVAA(vaaBytes: Uint8Array): Uint8Array {
  // Simplified VAA parsing - in production, use proper VAA parsing library
  // This assumes standard Wormhole VAA format
  let offset = 0;

  // Skip: version (1) + guardian_set_index (4) + signature_count (1) + signatures (65 * count)
  // Then: timestamp (4) + nonce (4) + emitter_chain (2) + emitter_address (32) + sequence (8)
  
  offset += 1; // version
  offset += 4; // guardian_set_index  
  const signatureCount = vaaBytes[offset++];
  if (signatureCount === undefined) {
    throw new Error('Invalid VAA: signature count missing');
  }
  offset += 65 * signatureCount; // skip signatures
  offset += 4; // timestamp
  offset += 4; // nonce
  offset += 2; // emitter_chain
  offset += 32; // emitter_address
  offset += 8; // sequence

  // Rest is the payload
  return vaaBytes.slice(offset);
}

/**
 * Helper: pad to 32 bytes with zeros
 */
function padTo32Bytes(data: Uint8Array): Uint8Array {
  if (data.length >= 32) {
    return data.slice(0, 32);
  }
  const padded = new Uint8Array(32);
  padded.set(data, 0);
  return padded;
}

/**
 * Helper: bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Import from chains - inline to avoid circular deps
 */
function fromWormholeChainId(wormholeId: number): ChainId | null {
  switch (wormholeId) {
    case 2: return ChainId.ETHEREUM;
    case 1: return ChainId.SOLANA;
    case 21: return ChainId.SUI;
    case 15: return ChainId.NEAR;
    default: return null;
  }
}
