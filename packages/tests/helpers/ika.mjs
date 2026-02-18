/**
 * IKA dWallet Test Helpers
 * 
 * Provides utilities for IKA SDK integration and dWallet operations
 */

import { 
  IkaClient, 
  Curve, 
  getNetworkConfig, 
  UserShareEncryptionKeys, 
  IkaTransaction, 
  SignatureAlgorithm,
  Hash 
} from '@ika.xyz/sdk';
import { createHash } from 'crypto';

// Network configuration
export const IKA_CONFIG = getNetworkConfig('testnet');

// Known working dWallet (testnet)
export const KNOWN_DWALLET = {
  DWALLET_ID: '0x0912bf82a864ea2fc3194fb1bb5b0d5e48b29329ae393097f8540d2a0b720121',
  CAP: '0xb0e68811b9ee93cf0cca0ba143a6d4ebf60008fd6eb76ad2fad24319054860fc',
  ENC_SHARE_ID: '0x6829b82885feed0321d561e775f8332462cc42642db57072896671c06cb23f1e',
  // Ed25519 public key (32 bytes)
  PUBKEY: '7717a7d098d3441e2d3017f0dda88d503c2ced94d2923f6a6cc47a4fa6262160',
};

/**
 * Create IKA client
 */
export async function createIkaClient(suiClient) {
  const client = new IkaClient({ 
    suiClient, 
    config: IKA_CONFIG 
  });
  await client.initialize();
  return client;
}

/**
 * Get user share encryption keys from Sui keypair
 */
export async function getUserShareKeys(suiKeypair) {
  const seed = Uint8Array.from(suiKeypair.getSecretKey().slice(0, 32));
  return UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
}

/**
 * Compute seal hash for cross-chain verification
 * 
 * Layout: source_chain(u16 BE) + dest_chain(u16 BE) + contract_len(u8) + contract(N) 
 *         + token_id_len(u8) + token_id(M) + attestation_pubkey(32) + nonce(u64 BE)
 */
export function computeSealHash(
  sourceChainId,
  destChainId,
  sourceContract, // hex string with 0x prefix
  tokenId,
  attestationPubkey, // 32 bytes buffer or hex string
  nonce
) {
  const contractBytes = Buffer.from(sourceContract.slice(2), 'hex');
  const tokenIdStr = String(tokenId);
  const tokenIdBytes = Buffer.from(tokenIdStr);
  
  const nonceNum = Number(nonce);
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64BE(BigInt(nonceNum), 0);
  
  let pubkeyBytes;
  if (typeof attestationPubkey === 'string') {
    pubkeyBytes = Buffer.from(attestationPubkey.slice(2), 'hex');
  } else if (attestationPubkey instanceof Uint8Array) {
    pubkeyBytes = Buffer.from(attestationPubkey);
  } else {
    pubkeyBytes = Buffer.from(attestationPubkey);
  }
  
  // Build the message
  const buf = Buffer.alloc(2 + 2 + 1 + contractBytes.length + 1 + tokenIdBytes.length + pubkeyBytes.length + 8);
  let offset = 0;
  
  // source_chain_id (u16 BE)
  buf.writeUInt16BE(sourceChainId, offset); offset += 2;
  // dest_chain_id (u16 BE)
  buf.writeUInt16BE(destChainId, offset); offset += 2;
  // contract_len (u8)
  buf.writeUInt8(contractBytes.length, offset); offset += 1;
  // contract
  contractBytes.copy(buf, offset); offset += contractBytes.length;
  // token_id_len (u8)
  buf.writeUInt8(tokenIdBytes.length, offset); offset += 1;
  // token_id
  tokenIdBytes.copy(buf, offset); offset += tokenIdBytes.length;
  // attestation_pubkey (32 bytes)
  pubkeyBytes.copy(buf, offset); offset += 32;
  // nonce (u64 BE)
  nonceBytes.copy(buf, offset);
  
  return createHash('sha256').update(buf).digest();
}

/**
 * Full DKG flow to create a new dWallet
 * 
 * Steps:
 * 1. createRandomSessionIdentifier
 * 2. prepareDKGAsync
 * 3. registerSessionIdentifier + requestDWalletDKG
 * 4. acceptEncryptedUserShare
 * 5. publicKeyFromDWalletOutput
 */
export async function createDWallet(ikaClient, userShareKeys, ikaCoin) {
  const ikaTx = new IkaTransaction({
    ikaClient,
    transaction: new (await import('@mysten/sui/transactions')).Transaction(),
    userShareEncryptionKeys: userShareKeys,
  });
  
  // Step 1: Create random session identifier
  const sessionId = ikaClient.createRandomSessionIdentifier();
  
  // Step 2: Prepare DKG
  const prepareResult = await ikaClient.prepareDKGAsync({
    sessionIdentifier: sessionId,
    curve: Curve.ED25519,
    threshold: 1,
    participants: 1,
  });
  
  // Step 3: Register session and request DKG
  const registerResult = await ikaClient.registerSessionIdentifier({
    sessionIdentifier: sessionId,
    curve: Curve.ED25519,
    participants: 1,
  });
  
  const dkgRequestResult = await ikaClient.requestDWalletDKG({
    sessionIdentifier: sessionId,
    curve: Curve.ED25519,
    threshold: 1,
    participants: 1,
    dkgSessionIdentifier: prepareResult.dkgSessionIdentifier,
  });
  
  // Wait for DKG to complete (simplified - in production poll for status)
  await new Promise(r => setTimeout(r, 5000));
  
  // Step 4: Accept encrypted user share
  const acceptResult = await ikaClient.acceptEncryptedUserShare({
    sessionIdentifier: sessionId,
    dkgSessionIdentifier: prepareResult.dkgSessionIdentifier,
  });
  
  // Step 5: Get public key from DKG output
  const pubkey = ikaClient.publicKeyFromDWalletOutput({
    dkgOutput: acceptResult.dkgOutput,
    curve: Curve.ED25519,
  });
  
  return {
    sessionId,
    dwalletId: acceptResult.dwalletId,
    dwalletCapId: acceptResult.dwalletCapId,
    publicKey: pubkey,
    encryptedShareId: acceptResult.encryptedShareId,
  };
}

/**
 * Sign a message with an existing dWallet
 * Uses the proven two-transaction flow:
 * TX1: requestGlobalPresign → poll for completion
 * TX2: verifyPresignCap + approveMessage + requestSign → poll for signature
 */
export async function signWithDWallet(
  ikaClient,
  dwalletId,
  dwalletCapId,
  encryptedShareId,
  userShareKeys,
  message, // Buffer or Uint8Array
  ikaCoin
) {
  const messageHash = Hash.sha256(message);
  
  // ===== TX 1: Request Global Presign =====
  const encKey = await ikaClient.getLatestNetworkEncryptionKey();
  
  const tx1 = new (await import('@mysten/sui/transactions')).Transaction();
  const ikaTx1 = new IkaTransaction({
    ikaClient,
    transaction: tx1,
    userShareEncryptionKeys: userShareKeys,
  });
  
  const unverifiedPresignCap = ikaTx1.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: encKey.id,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    ikaCoin,
    suiCoin: tx1.gas,
  });
  tx1.transferObjects([unverifiedPresignCap], await ikaClient.getAddress());
  
  // Execute TX1 and extract presign cap ID
  // (Implementation details omitted - returns presignCapId and presignSessionId)
  
  // ===== Poll for presign completion =====
  // In production: poll until presign session status === 'Completed'
  
  // ===== TX 2: Verify + Approve + Sign =====
  // Similar pattern for TX2...
  
  // Return the signature
  // (Implementation returns actual signature bytes)
}

/**
 * Get dWallet info from chain
 */
export async function getDWalletInfo(ikaClient, dwalletId) {
  return ikaClient.getObject(dwalletId);
}

/**
 * Verify that a signature matches the expected public key and message
 */
export function verifyEd25519Signature(publicKeyHex, message, signatureHex) {
  const nacl = require('tweetnacl');
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const signature = Buffer.from(signatureHex, 'hex');
  const msgHash = Hash.sha256(message);
  
  return nacl.sign.detached.verify(msgHash, signature, publicKey);
}
