/**
 * Cross-language seal hash endianness test
 * 
 * This test verifies that the seal hash construction produces identical results
 * across TypeScript (this file) and Move (packages/sui-contracts/tests/seal_hash_cross_lang_tests.move)
 * 
 * PRD §6.1 specifies big-endian encoding for all multi-byte integers.
 * 
 * Test inputs (must match Move test exactly):
 * - source_chain_id: 2 (SUI)
 * - source_contract: "test_contract" (13 bytes UTF-8)
 * - token_id: "token_123" (9 bytes UTF-8)
 * - attestation_pubkey: 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (32 bytes)
 * - nonce: 1
 * 
 * Expected hash (SHA-256 of seal bytes): 75dfa84380ce26aa8c7a6a1885fed41a109e96f823d6847266ebb7464c95f436
 */

import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';

// Constants (duplicated from chains.ts to avoid ESM import issues in test)
const ChainId = { ETHEREUM: 1, SUI: 2, SOLANA: 3, NEAR: 4, BITCOIN: 5 };
const DESTINATION_CHAIN_ID = ChainId.SOLANA;

/**
 * Construct seal hash bytes per PRD §6.1
 * Must match Move's compute_seal_hash exactly
 */
function constructSealHashBytes(
  sourceChainId: number,
  sourceContract: Uint8Array,
  tokenId: Uint8Array,
  attestationPubkey: Uint8Array,
  nonce: bigint
): Uint8Array {
  const destChainId = DESTINATION_CHAIN_ID;
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
 * Hash seal data using SHA-256
 */
function hashSealDataSync(sealBytes: Uint8Array): Uint8Array {
  const hash = createHash('sha256').update(sealBytes).digest();
  return new Uint8Array(hash);
}

// Test inputs (matching Move test exactly)
const TEST_SOURCE_CHAIN_ID = 2; // SUI
const TEST_SOURCE_CONTRACT = new TextEncoder().encode('test_contract'); // 13 bytes
const TEST_TOKEN_ID = new TextEncoder().encode('token_123'); // 9 bytes
const TEST_ATTESTATION_PUBKEY = Uint8Array.from(
  { length: 32 },
  (_, i) => i + 1
); // 0x010203...1f20
const TEST_NONCE = 1n;

// Expected hash computed from these exact inputs
// This must match the Move test's expected hash exactly
const EXPECTED_HASH_HEX = '75dfa84380ce26aa8c7a6a1885fed41a109e96f823d6847266ebb7464c95f436';

describe('Seal Hash Cross-Language Endianness', () => {
  it('should produce expected hash matching Move contract', () => {
    const sealBytes = constructSealHashBytes(
      TEST_SOURCE_CHAIN_ID,
      TEST_SOURCE_CONTRACT,
      TEST_TOKEN_ID,
      TEST_ATTESTATION_PUBKEY,
      TEST_NONCE
    );
    
    const hash = hashSealDataSync(sealBytes);
    const hashHex = Buffer.from(hash).toString('hex');
    
    expect(hashHex).toBe(EXPECTED_HASH_HEX);
  });

  it('should produce correct byte layout per PRD §6.1', () => {
    const sealBytes = constructSealHashBytes(
      TEST_SOURCE_CHAIN_ID,
      TEST_SOURCE_CONTRACT,
      TEST_TOKEN_ID,
      TEST_ATTESTATION_PUBKEY,
      TEST_NONCE
    );
    
    // Byte layout verification:
    // Offset  Size   Field                      Value
    // 0       2      source_chain_id            0x0002 (2)
    // 2       2      destination_chain_id      0x0003 (3)
    // 4       1      source_contract_length    13
    // 5       13     source_contract           "test_contract"
    // 18      1      token_id_length           9
    // 19      9      token_id                  "token_123"
    // 28      32     attestation_pubkey         0x010203...1f20
    // 60      8      nonce                     0x0000000000000001
    
    expect(sealBytes.length).toBe(68); // 46 + 13 + 9
    
    // Verify source_chain_id (u16 BE)
    expect(sealBytes[0]).toBe(0x00);
    expect(sealBytes[1]).toBe(0x02);
    
    // Verify destination_chain_id (u16 BE) - always Solana (3)
    expect(sealBytes[2]).toBe(0x00);
    expect(sealBytes[3]).toBe(0x03);
    
    // Verify source_contract_length
    expect(sealBytes[4]).toBe(13);
    
    // Verify token_id_length
    expect(sealBytes[4 + 13 + 1]).toBe(9); // offset 18
    
    // Verify nonce (u64 BE) - should be 1
    expect(sealBytes[60]).toBe(0x00);
    expect(sealBytes[61]).toBe(0x00);
    expect(sealBytes[62]).toBe(0x00);
    expect(sealBytes[63]).toBe(0x00);
    expect(sealBytes[64]).toBe(0x00);
    expect(sealBytes[65]).toBe(0x00);
    expect(sealBytes[66]).toBe(0x00);
    expect(sealBytes[67]).toBe(0x01);
  });

  it('should use big-endian encoding for all multi-byte integers', () => {
    // Test with a larger chain ID to verify BE encoding
    const sealBytes = constructSealHashBytes(
      300, // 0x012C as u16
      new TextEncoder().encode('a'), // 1 byte contract
      new TextEncoder().encode('b'), // 1 byte token
      new Uint8Array(32), // 32 byte pubkey
      256n // 0x0100 as u64
    );
    
    // source_chain_id 300 = 0x012C should be [0x01, 0x2C] in BE
    expect(sealBytes[0]).toBe(0x01);
    expect(sealBytes[1]).toBe(0x2C);
    
    // nonce 256 = 0x0100 should be [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00] in BE
    // Last 8 bytes start at offset 60 (68 - 8)
    expect(sealBytes[60]).toBe(0x00);
    expect(sealBytes[61]).toBe(0x00);
    expect(sealBytes[62]).toBe(0x00);
    expect(sealBytes[63]).toBe(0x00);
    expect(sealBytes[64]).toBe(0x00);
    expect(sealBytes[65]).toBe(0x00);
    expect(sealBytes[66]).toBe(0x01);
    expect(sealBytes[67]).toBe(0x00);
  });
});
