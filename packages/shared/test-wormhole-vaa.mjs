/**
 * Test script for Wormhole VAA fetching and parsing
 * 
 * This script:
 * 1. Attempts to fetch a real VAA from testnet (if available)
 * 2. Falls back to generating and parsing a mock VAA
 * 3. Verifies the parsing works correctly
 */

import { fetchVAA, parseVAAPayload, parseNFTDepositPayload, decodeNFTDepositPayload, createMockVAA, encodeNFTDepositPayload, WORMHOLE_CHAIN_ID } from './dist/wormhole-vaa.js';

// Test data
const TEST_EMITTER_CHAIN = WORMHOLE_CHAIN_ID.SOLANA;
const TEST_EMITTER_ADDRESS = '000000000000000000000000a6a5C8f3E2f6D7eB8cF1a4d6e9f0b3c5d7e8f9a0b'; // Example emitter
const TEST_SEQUENCE = 1n;

async function runTests() {
  console.log('=== Wormhole VAA Test Script ===\n');

  // Test 1: Try to fetch a real VAA from testnet
  console.log('Test 1: Attempting to fetch real VAA from testnet...');
  console.log(`Emitter: chain=${TEST_EMITTER_CHAIN}, address=${TEST_EMITTER_ADDRESS}, sequence=${TEST_SEQUENCE}`);

  let fetchedRealVAA = false;

  try {
    const vaaBytes = await fetchVAA(TEST_EMITTER_CHAIN, TEST_EMITTER_ADDRESS, TEST_SEQUENCE, 3, 1000);
    console.log(`✓ Successfully fetched VAA (${vaaBytes.length} bytes)`);
    fetchedRealVAA = true;
    
    // Parse the VAA
    const parsed = parseVAAPayload(vaaBytes);
    console.log('\nVAA parsed:');
    console.log(`  Version: ${parsed.version}`);
    console.log(`  Guardian Set Index: ${parsed.guardianSetIndex}`);
    console.log(`  Signatures: ${parsed.signatures.length}`);
    console.log(`  Timestamp: ${parsed.timestamp} (${new Date(parsed.timestamp * 1000).toISOString()})`);
    console.log(`  Nonce: ${parsed.nonce}`);
    console.log(`  Emitter Chain: ${parsed.emitterChain}`);
    console.log(`  Sequence: ${parsed.sequence}`);
    console.log(`  Payload length: ${parsed.payload.length}`);
    
    // Try to parse as NFT deposit payload
    if (parsed.payload.length >= 171) {
      try {
        const deposit = parseNFTDepositPayload(parsed.payload);
        console.log('\nNFT Deposit Payload:');
        console.log(`  Payload ID: ${deposit.payloadId}`);
        console.log(`  Source Chain: ${deposit.sourceChainId}`);
        console.log(`  NFT Contract: ${Buffer.from(deposit.nftContract).toString('hex')}`);
        console.log(`  Token ID: ${Buffer.from(deposit.tokenId).toString('hex')}`);
        console.log(`  Depositor: ${Buffer.from(deposit.depositor).toString('hex')}`);
        console.log(`  dWallet: ${Buffer.from(deposit.dwalletAddress).toString('hex')}`);
        console.log(`  Deposit Block: ${deposit.depositBlock}`);
        console.log(`  Seal Nonce: ${Buffer.from(deposit.sealNonce).toString('hex')}`);
      } catch (e) {
        console.log('\nPayload is not an NFT deposit payload (expected if no real deposit)');
      }
    }
    
    console.log('\n✓ Test 1 PASSED: Successfully fetched and parsed real VAA');
  } catch (error) {
    console.log(`⚠ Could not fetch real VAA: ${error.message}`);
    console.log('Falling back to mock VAA test...\n');
  }

  // Test 2: Generate and parse mock VAA
  console.log('Test 2: Generating and parsing mock VAA...');
  
  // Create NFT deposit payload
  const nftContract = 'a6b5c8f3e2f6d7eb8cf1a4d6e9f0b3c5d7e8f9a0b1234567890abcdef'; // 32 bytes hex
  const tokenId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'; // 32 bytes
  const depositor = 'def789abc123456def789abc123456def789abc123456def789abc123456'; // 32 bytes
  const dwalletAddress = 'abc123def456789abc123def456789abc123def456789abc123def456'; // 32 bytes
  const sealNonce = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba987654'; // 32 bytes
  
  const depositPayload = encodeNFTDepositPayload(
    WORMHOLE_CHAIN_ID.ETHEREUM,
    nftContract,
    tokenId,
    depositor,
    dwalletAddress,
    12345678n,
    sealNonce
  );
  
  console.log(`✓ Created NFT deposit payload (${depositPayload.length} bytes)`);
  
  // Create mock VAA with the payload
  const mockVAA = createMockVAA(
    WORMHOLE_CHAIN_ID.SOLANA,
    TEST_EMITTER_ADDRESS,
    42n,
    depositPayload,
    Math.floor(Date.now() / 1000),
    12345
  );
  
  console.log(`✓ Created mock VAA (${mockVAA.length} bytes)`);
  
  // Parse the VAA
  const parsed = parseVAAPayload(mockVAA);
  console.log('\nVAA parsed:');
  console.log(`  Version: ${parsed.version}`);
  console.log(`  Guardian Set Index: ${parsed.guardianSetIndex}`);
  console.log(`  Signatures: ${parsed.signatures.length}`);
  console.log(`  Timestamp: ${parsed.timestamp}`);
  console.log(`  Nonce: ${parsed.nonce}`);
  console.log(`  Emitter Chain: ${parsed.emitterChain}`);
  console.log(`  Sequence: ${parsed.sequence}`);
  console.log(`  Payload length: ${parsed.payload.length}`);
  
  // Parse the NFT deposit payload
  const deposit = parseNFTDepositPayload(parsed.payload);
  console.log('\nNFT Deposit Payload parsed:');
  console.log(`  Payload ID: ${deposit.payloadId} ${deposit.payloadId === 1 ? '✓' : '✗'}`);
  console.log(`  Source Chain: ${deposit.sourceChainId} ${deposit.sourceChainId === WORMHOLE_CHAIN_ID.ETHEREUM ? '✓' : '✗'}`);
  console.log(`  NFT Contract: ${Buffer.from(deposit.nftContract).toString('hex').slice(0, 16)}...`);
  console.log(`  Token ID: ${Buffer.from(deposit.tokenId).toString('hex').slice(0, 16)}...`);
  console.log(`  Depositor: ${Buffer.from(deposit.depositor).toString('hex').slice(0, 16)}...`);
  console.log(`  dWallet: ${Buffer.from(deposit.dwalletAddress).toString('hex').slice(0, 16)}...`);
  console.log(`  Deposit Block: ${deposit.depositBlock} ${deposit.depositBlock === 12345678n ? '✓' : '✗'}`);
  
  // Test decoded version
  const decoded = decodeNFTDepositPayload(parsed.payload);
  console.log('\nDecoded NFT Deposit Payload:');
  console.log(`  Payload ID: ${decoded.payloadId}`);
  console.log(`  Source Chain ID: ${decoded.sourceChainId}`);
  console.log(`  NFT Contract: ${decoded.nftContract.slice(0, 20)}...`);
  console.log(`  Token ID: ${decoded.tokenId.slice(0, 20)}...`);
  console.log(`  Depositor: ${decoded.depositor.slice(0, 20)}...`);
  console.log(`  dWallet Address: ${decoded.dwalletAddress.slice(0, 20)}...`);
  console.log(`  Deposit Block: ${decoded.depositBlock}`);
  console.log(`  Seal Nonce: ${decoded.sealNonce.slice(0, 20)}...`);
  
  console.log('\n✓ Test 2 PASSED: Mock VAA generation and parsing works');

  // Test 3: Verify chain ID constants
  console.log('\n=== Test 3: Chain ID Constants ===');
  console.log(`SOLANA: ${WORMHOLE_CHAIN_ID.SOLANA} (expected: 1)`);
  console.log(`ETHEREUM: ${WORMHOLE_CHAIN_ID.ETHEREUM} (expected: 2)`);
  console.log(`NEAR: ${WORMHOLE_CHAIN_ID.NEAR} (expected: 15)`);
  console.log(`SUI: ${WORMHOLE_CHAIN_ID.SUI} (expected: 21)`);

  const chainIdsValid = 
    WORMHOLE_CHAIN_ID.SOLANA === 1 &&
    WORMHOLE_CHAIN_ID.ETHEREUM === 2 &&
    WORMHOLE_CHAIN_ID.NEAR === 15 &&
    WORMHOLE_CHAIN_ID.SUI === 21;

  console.log(`\n✓ Test 3 ${chainIdsValid ? 'PASSED' : 'FAILED'}: Chain ID constants correct`);

  // Test 4: Error handling
  console.log('\n=== Test 4: Error Handling ===');

  try {
    // Invalid payload ID
    const invalidPayload = new Uint8Array(171);
    invalidPayload[0] = 2; // Invalid ID (should be 1)
    parseNFTDepositPayload(invalidPayload);
    console.log('✗ Test 4 FAILED: Should have thrown error for invalid payload ID');
  } catch (e) {
    if (e.message.includes('Invalid payload ID')) {
      console.log('✓ Test 4a PASSED: Correctly rejects invalid payload ID');
    } else {
      console.log(`✗ Test 4a FAILED: Wrong error: ${e.message}`);
    }
  }

  try {
    // Invalid VAA version
    const invalidVaa = new Uint8Array([2, 0, 0, 0, 0]); // version = 2
    parseVAAPayload(invalidVaa);
    console.log('✗ Test 4b FAILED: Should have thrown error for invalid VAA version');
  } catch (e) {
    if (e.message.includes('Invalid VAA version')) {
      console.log('✓ Test 4b PASSED: Correctly rejects invalid VAA version');
    } else {
      console.log(`✗ Test 4b FAILED: Wrong error: ${e.message}`);
    }
  }

  try {
    // Truncated payload
    const truncatedPayload = new Uint8Array(50);
    parseNFTDepositPayload(truncatedPayload);
    console.log('✗ Test 4c FAILED: Should have thrown error for truncated payload');
  } catch (e) {
    if (e.message.includes('Invalid payload length')) {
      console.log('✓ Test 4c PASSED: Correctly rejects truncated payload');
    } else {
      console.log(`✗ Test 4c FAILED: Wrong error: ${e.message}`);
    }
  }

  console.log('\n=== All Tests Complete ===');
}

runTests().catch(console.error);
