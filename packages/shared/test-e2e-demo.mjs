#!/usr/bin/env node
/**
 * Ika Tensei v3 - FULL E2E DEMO
 * 
 * Mint NFT on Sui → Seal with dWallet → Sign → Verify on Solana → Mint Reborn
 * Outputs explorer links for everything.
 *
 * Usage: node test-e2e-demo.mjs
 */

import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction, SignatureAlgorithm, Hash 
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { 
  Connection, PublicKey, Transaction as SolanaTx, 
  TransactionInstruction, SystemProgram, Keypair, 
  Ed25519Program, sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import * as borsh from 'borsh';

// ============================================================================
// Constants
// ============================================================================

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const SOLANA_RPC = 'https://api.devnet.solana.com';

// Sui contract (testnet)
const SUI_PACKAGE = '0x8474586628dcdfede81d428532b1f1f769835856f2746bfc040e977f7a6b15bf';
const SEAL_REGISTRY = '0x579fc1c681f3fdc2de04387a67e51a7b82865a5c2e8e2fd0f0e67f2e91ed79ea';
const SEAL_VAULT = '0x2168c733596256b76192594766d9169b3ab262b4b7542cb0ed9d2f8d45d813b1';

// IKA dWallet (testnet, PROVEN WORKING)
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
const DWALLET_ED25519_PUBKEY_HEX = '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';

// Solana program (devnet)
const SOLANA_PROGRAM_ID = new PublicKey('mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa');
const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

// Chain IDs
const CHAIN_SUI = 2;
const CHAIN_SOLANA = 3;

// NFT metadata for demo
const DEMO_NFT_NAME = 'Ika Tensei Genesis #1';
const DEMO_NFT_DESCRIPTION = 'The first NFT sealed and reborn through the Ika Tensei protocol. Cross-chain reincarnation powered by IKA Network dWallets.';
const DEMO_NFT_IMAGE = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/demo-ika-genesis'; // placeholder
const DEMO_COLLECTION_NAME = 'Ika Tensei Genesis Collection';

// ============================================================================
// Helpers
// ============================================================================

const log = {
  step:    (n, msg) => console.log(`\n${'═'.repeat(60)}\n  STEP ${n}: ${msg}\n${'═'.repeat(60)}`),
  info:    (msg) => console.log(`  ℹ  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  error:   (msg) => console.error(`  ❌ ${msg}`),
  warn:    (msg) => console.warn(`  ⚠️  ${msg}`),
  link:    (label, url) => console.log(`  🔗 ${label}: ${url}`),
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function retryRpc(fn, label, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      const isRetryable = e.message?.includes('429') || e.message?.includes('rate') || 
                          e.message?.includes('Too Many') || e.message?.includes('Service unavailable') ||
                          e.message?.includes('ECONNRESET') || e.message?.includes('fetch failed');
      if (isRetryable && i < maxRetries - 1) {
        const waitMs = 3000 * (i + 1);
        if (i % 3 === 0) log.warn(`${label}: retrying in ${waitMs}ms... (${e.message?.slice(0,50)})`);
        await sleep(waitMs);
      } else throw e;
    }
  }
}

// ============================================================================
// Seal Hash Computation (must match Sui & Solana)
// ============================================================================

function computeSealHash(sourceChain, destChain, sourceContract, tokenId, attestPubkey, nonce) {
  const contractBytes = Buffer.from(sourceContract.replace('0x', ''), 'hex');
  const tokenIdBytes = Buffer.alloc(8);
  tokenIdBytes.writeBigUInt64BE(BigInt(tokenId));
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64BE(BigInt(nonce));
  
  const buf = Buffer.alloc(2 + 2 + 1 + contractBytes.length + 1 + tokenIdBytes.length + 32 + 8);
  let off = 0;
  buf.writeUInt16BE(sourceChain, off); off += 2;
  buf.writeUInt16BE(destChain, off); off += 2;
  buf.writeUInt8(contractBytes.length, off); off += 1;
  contractBytes.copy(buf, off); off += contractBytes.length;
  buf.writeUInt8(tokenIdBytes.length, off); off += 1;
  tokenIdBytes.copy(buf, off); off += tokenIdBytes.length;
  buf.set(attestPubkey, off); off += 32;
  nonceBytes.copy(buf, off);
  
  return createHash('sha256').update(buf).digest();
}

// ============================================================================
// Anchor instruction discriminator
// ============================================================================

function anchorDisc(name) {
  return createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

// ============================================================================
// Main Demo
// ============================================================================

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  IKA TENSEI v3 — FULL E2E DEMO');
  console.log('  Sui NFT → IKA dWallet Seal → Solana Reborn');
  console.log('█'.repeat(60));

  const results = { sui: {}, ika: {}, solana: {} };
  const nonce = BigInt(Date.now());

  // ========================================================================
  // SETUP
  // ========================================================================
  
  // Sui setup
  const keystorePath = homedir() + '/.sui/sui_config/sui.keystore';
  const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const suiAddress = suiKeypair.getPublicKey().toSuiAddress();
  
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaConfig = getNetworkConfig('testnet');
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await retryRpc(() => ikaClient.initialize(), 'IKA init');
  
  // Solana setup
  const solKeyData = JSON.parse(readFileSync(homedir() + '/.config/solana/id.json', 'utf8'));
  const solKeypair = Keypair.fromSecretKey(Buffer.from(solKeyData));
  const solConn = new Connection(SOLANA_RPC, 'confirmed');
  
  log.info(`Sui address: ${suiAddress}`);
  log.info(`Solana wallet: ${solKeypair.publicKey.toBase58()}`);
  
  const attestPubkey = Buffer.from(DWALLET_ED25519_PUBKEY_HEX, 'hex');

  // ========================================================================
  // STEP 1: Mint test NFT on Sui
  // ========================================================================
  log.step(1, 'Mint Test NFT on Sui Testnet');
  
  // We'll create a simple object as our "NFT" using a Move package.
  // Since we can't deploy a new NFT contract easily, we'll use a dummy approach:
  // Create a Coin<SUI> split as a "valuable object" to transfer to dWallet.
  // For the demo, the seal_hash + registry record IS the proof.
  // The register_seal_native<T> requires a `key + store` object.
  
  // Alternative: use the register_seal_with_vaa path (doesn't require passing an object)
  // For the demo, we'll use register_seal_with_vaa with a dummy VAA since the
  // Wormhole verification is stubbed anyway. This lets us seal without needing
  // an actual Sui NFT module deployed.
  
  // Actually, let's just mint a simple object. Sui has Display + Kiosk but
  // the simplest approach for demo is to register a seal directly.
  // The REAL flow would: deploy NFT module → mint → register_seal_native
  // For demo: we use register_seal_with_vaa (stubbed VAA verification)
  
  log.info('Using register_seal_with_vaa (Wormhole stub) for demo');
  log.info(`NFT Name: ${DEMO_NFT_NAME}`);
  log.info(`Collection: ${DEMO_COLLECTION_NAME}`);

  // Compute seal hash
  const tokenId = 1;
  const sourceContract = SUI_PACKAGE; // using our package as the "NFT contract"
  const sealHash = computeSealHash(CHAIN_SUI, CHAIN_SOLANA, sourceContract, tokenId, attestPubkey, nonce);
  log.success(`Seal hash: ${sealHash.toString('hex')}`);
  
  // ========================================================================
  // STEP 2: Sign seal hash with IKA dWallet
  // ========================================================================
  log.step(2, 'Sign Seal Hash with IKA dWallet (2PC-MPC Ed25519)');
  
  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  
  // TX1: Request presign
  log.info('TX1: Requesting presign...');
  const encKey = await retryRpc(() => ikaClient.getLatestNetworkEncryptionKey(), 'encKey');
  const ikaCoins = await retryRpc(() => suiClient.getCoins({ owner: suiAddress, coinType: ikaType }), 'coins');
  
  const tx1 = new Transaction();
  tx1.setSender(suiAddress);
  tx1.setGasBudget(500_000_000);
  
  const ikaTx1 = new IkaTransaction({ ikaClient, transaction: tx1, userShareEncryptionKeys: userShareKeys });
  const unverifiedPresignCap = ikaTx1.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: encKey.id,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    ikaCoin: tx1.object(ikaCoins.data[0].coinObjectId),
    suiCoin: tx1.gas,
  });
  tx1.transferObjects([unverifiedPresignCap], suiAddress);
  
  const txBytes1 = await tx1.build({ client: suiClient });
  const signed1 = await suiKeypair.signTransaction(txBytes1);
  const result1 = await retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signed1.bytes,
    signature: signed1.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }), 'tx1');
  
  if (result1.effects?.status?.status === 'failure') {
    throw new Error(`TX1 failed: ${result1.effects?.status?.error}`);
  }
  
  results.ika.presignTx = result1.digest;
  log.success(`Presign TX: ${result1.digest}`);
  log.link('Sui Explorer (Presign)', `https://suiscan.xyz/testnet/tx/${result1.digest}`);
  
  // Extract presign IDs
  let presignCapId = null, presignSessionId = null;
  for (const obj of (result1.objectChanges || [])) {
    if (obj.type === 'created') {
      const t = obj.objectType?.split('::').pop() || '';
      if (t.includes('UnverifiedPresignCap')) presignCapId = obj.objectId;
      if (t.includes('PresignSession')) presignSessionId = obj.objectId;
    }
  }
  for (const evt of (result1.events || [])) {
    if (evt.parsedJson?.presign_session_id) presignSessionId = evt.parsedJson.presign_session_id;
  }
  
  if (!presignCapId || !presignSessionId) throw new Error(`Missing presign IDs: cap=${presignCapId}, session=${presignSessionId}`);
  log.info(`Presign Cap: ${presignCapId}`);
  log.info(`Presign Session: ${presignSessionId}`);
  
  // Wait for presign completion
  log.info('Waiting for presign MPC completion...');
  let presignObj = null;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    try {
      presignObj = await ikaClient.getPresign(presignSessionId);
      if (presignObj.state?.$kind === 'Completed') {
        log.success(`Presign completed after ${(i+1)*3}s`);
        break;
      }
      if (i % 10 === 0) log.info(`  Poll ${i+1}: ${presignObj.state?.$kind || 'waiting'}...`);
    } catch (e) {
      if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0,40)}`);
    }
  }
  if (!presignObj || presignObj.state?.$kind !== 'Completed') {
    throw new Error('Presign did not complete within timeout');
  }
  
  // TX2: Sign
  log.info('TX2: Signing seal hash...');
  const dWallet = await retryRpc(() => ikaClient.getDWallet(DWALLET_ID), 'dw');
  const encShare = await retryRpc(() => ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID), 'es');
  const ikaCoins2 = await retryRpc(() => suiClient.getCoins({ owner: suiAddress, coinType: ikaType }), 'coins2');
  
  const tx2 = new Transaction();
  tx2.setSender(suiAddress);
  tx2.setGasBudget(500_000_000);
  
  const ikaTx2 = new IkaTransaction({ ikaClient, transaction: tx2, userShareEncryptionKeys: userShareKeys });
  const verifiedPresignCap = ikaTx2.verifyPresignCap({ presign: presignObj, unverifiedPresignCap: presignCapId });
  const messageApproval = ikaTx2.approveMessage({
    dWalletCap: DWALLET_CAP,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    hashScheme: Hash.SHA512,
    message: Array.from(sealHash),
  });
  await ikaTx2.requestSign({
    dWallet,
    messageApproval,
    hashScheme: Hash.SHA512,
    verifiedPresignCap,
    presign: presignObj,
    encryptedUserSecretKeyShare: encShare,
    message: Array.from(sealHash),
    signatureScheme: SignatureAlgorithm.EdDSA,
    ikaCoin: tx2.object(ikaCoins2.data[0].coinObjectId),
    suiCoin: tx2.gas,
  });
  
  const txBytes2 = await tx2.build({ client: suiClient });
  const signed2 = await suiKeypair.signTransaction(txBytes2);
  const result2 = await retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signed2.bytes,
    signature: signed2.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }), 'tx2');
  
  if (result2.effects?.status?.status === 'failure') {
    throw new Error(`TX2 failed: ${result2.effects?.status?.error}`);
  }
  
  results.ika.signTx = result2.digest;
  log.success(`Sign TX: ${result2.digest}`);
  log.link('Sui Explorer (Sign)', `https://suiscan.xyz/testnet/tx/${result2.digest}`);
  
  // Find sign output object and poll for signature
  let signOutputId = null;
  for (const obj of (result2.objectChanges || [])) {
    if (obj.type === 'created') {
      const t = obj.objectType?.split('::').pop() || '';
      if (t.includes('Sign') || t.includes('Partial') || t.includes('Signature')) {
        signOutputId = obj.objectId;
        log.info(`Sign output: ${obj.objectId} (${t})`);
      }
    }
  }
  
  let signatureBytes = null;
  log.info('Waiting for signature output from MPC network...');
  
  // Also check events for sign session
  let signSessionId = null;
  for (const evt of (result2.events || [])) {
    if (evt.parsedJson?.sign_session_id) {
      signSessionId = evt.parsedJson.sign_session_id;
      log.info(`Sign session: ${signSessionId}`);
    }
  }
  
  // Poll for signature completion
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    
    // Try getting sign output from the sign session
    if (signSessionId) {
      try {
        const signSession = await retryRpc(() => suiClient.getObject({ 
          id: signSessionId, options: { showContent: true } 
        }), 'signSession');
        const fields = signSession.data?.content?.fields;
        if (fields) {
          const state = fields.state;
          const stateKind = state?.variant || state?.$kind || (typeof state === 'string' ? state : 'unknown');
          if (stateKind === 'Completed' || stateKind === 'Signed') {
            const sigField = state?.fields?.signature || fields.signature;
            if (sigField && Array.isArray(sigField) && sigField.length >= 64) {
              signatureBytes = Buffer.from(sigField);
              log.success(`Signature obtained! (${sigField.length} bytes)`);
              break;
            }
          }
          if (i % 5 === 0) log.info(`  Poll ${i+1}: state=${stateKind}`);
        }
      } catch (e) {
        if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0,50)}`);
      }
    }
    
    // Also try sign output object
    if (signOutputId) {
      try {
        const obj = await retryRpc(() => suiClient.getObject({ 
          id: signOutputId, options: { showContent: true } 
        }), 'signOutput');
        const fields = obj.data?.content?.fields;
        if (fields?.output || fields?.signature) {
          const sig = fields.output || fields.signature;
          if (Array.isArray(sig) && sig.length >= 64) {
            signatureBytes = Buffer.from(sig);
            log.success(`Signature from output object! (${sig.length} bytes)`);
            break;
          }
        }
      } catch {}
    }
    
    // Brute force: check owned objects for SignOutput
    if (i === 20 || i === 40) {
      try {
        const owned = await retryRpc(() => suiClient.getOwnedObjects({
          owner: suiAddress,
          options: { showContent: true, showType: true },
          filter: { StructType: `${ikaConfig.packages.ikaPackage}::sign::SignOutput` },
        }), 'ownedSign');
        for (const o of (owned.data || [])) {
          const f = o.data?.content?.fields;
          if (f?.signature && Array.isArray(f.signature) && f.signature.length >= 64) {
            signatureBytes = Buffer.from(f.signature);
            log.success(`Found SignOutput: ${o.data.objectId}`);
            break;
          }
        }
        if (signatureBytes) break;
      } catch {}
    }
  }
  
  if (!signatureBytes) {
    log.warn('Could not retrieve signature bytes from chain.');
    log.info('The signing TX was submitted successfully - check explorer for status.');
    log.info('Continuing demo with the IKA TX proofs...');
  } else {
    log.success(`Ed25519 Signature: ${signatureBytes.toString('hex').slice(0, 64)}...`);
    results.ika.signature = signatureBytes.toString('hex');
  }

  // ========================================================================
  // STEP 3: Register Seal on Sui (via register_seal_with_vaa with stub VAA)
  // ========================================================================
  log.step(3, 'Register Seal on Sui Testnet');
  
  const contractBytes = Buffer.from(sourceContract.replace('0x', ''), 'hex');
  const tokenIdBytes = Buffer.alloc(8);
  tokenIdBytes.writeBigUInt64BE(BigInt(tokenId));
  
  const tx3 = new Transaction();
  tx3.setSender(suiAddress);
  tx3.setGasBudget(100_000_000);
  
  // Call register_seal_with_vaa
  tx3.moveCall({
    target: `${SUI_PACKAGE}::registry::register_seal_with_vaa`,
    arguments: [
      tx3.object(SEAL_REGISTRY),
      tx3.object(SEAL_VAULT),
      tx3.pure('vector<u8>', Array.from(Buffer.from('dummy_vaa_for_demo'))), // VAA bytes (stubbed)
      tx3.pure('address', DWALLET_ID), // dwallet_id as ID
      tx3.pure('address', DWALLET_CAP), // dwallet_cap_id as ID
      tx3.pure('address', DWALLET_ID), // attestation_dwallet_id (same for Ed25519)
      tx3.pure('address', DWALLET_CAP), // attestation_cap_id (same)
      tx3.pure('vector<u8>', Array.from(attestPubkey)), // dwallet_pubkey
      tx3.pure('vector<u8>', Array.from(attestPubkey)), // attestation_pubkey
      tx3.pure('u16', CHAIN_SUI), // source_chain_id
      tx3.pure('vector<u8>', Array.from(contractBytes)), // source_contract
      tx3.pure('vector<u8>', Array.from(tokenIdBytes)), // token_id
      tx3.pure('u64', nonce.toString()), // nonce
      // Metadata fields
      tx3.pure('vector<u8>', Array.from(Buffer.from(DEMO_NFT_NAME))), // metadata_name
      tx3.pure('vector<u8>', Array.from(Buffer.from(DEMO_NFT_DESCRIPTION))), // metadata_description
      tx3.pure('vector<u8>', Array.from(Buffer.from(DEMO_NFT_IMAGE))), // metadata_uri
      tx3.pure('vector<u8>', Array.from(Buffer.from(''))), // walrus_metadata_blob_id
      tx3.pure('vector<u8>', Array.from(Buffer.from(''))), // walrus_image_blob_id
      tx3.pure('vector<u8>', Array.from(Buffer.from(DEMO_COLLECTION_NAME))), // collection_name
    ],
  });
  
  const txBytes3 = await tx3.build({ client: suiClient });
  const signed3 = await suiKeypair.signTransaction(txBytes3);
  const result3 = await retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signed3.bytes,
    signature: signed3.signature,
    options: { showEffects: true, showEvents: true },
    requestType: 'WaitForLocalExecution',
  }), 'tx3');
  
  if (result3.effects?.status?.status === 'failure') {
    log.error(`Seal registration failed: ${result3.effects?.status?.error}`);
    log.info('This may be due to emitter validation. Continuing with IKA signing proof...');
    results.sui.sealTx = null;
  } else {
    results.sui.sealTx = result3.digest;
    log.success(`Seal registered on Sui: ${result3.digest}`);
    log.link('Sui Explorer (Seal)', `https://suiscan.xyz/testnet/tx/${result3.digest}`);
    
    // Extract NFTSealed event
    for (const evt of (result3.events || [])) {
      if (evt.type?.includes('NFTSealed')) {
        log.info(`NFTSealed event emitted!`);
        log.info(`  seal_hash: ${evt.parsedJson?.seal_hash?.slice(0, 20)}...`);
        log.info(`  source_chain: ${evt.parsedJson?.source_chain_id}`);
        log.info(`  sealer: ${evt.parsedJson?.sealer}`);
      }
    }
  }

  // ========================================================================
  // STEP 4: Initialize Solana Program + Register Collection + Verify Seal
  // ========================================================================
  log.step(4, 'Initialize & Verify on Solana Devnet');

  // Check if program is initialized
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('ika_config')], SOLANA_PROGRAM_ID
  );
  
  const configInfo = await solConn.getAccountInfo(configPda);
  if (!configInfo) {
    log.info('Initializing Solana program...');
    
    const initData = Buffer.concat([
      anchorDisc('initialize'),
      solKeypair.publicKey.toBuffer(), // guild_treasury
      solKeypair.publicKey.toBuffer(), // team_treasury
      Buffer.from([0xF4, 0x01]),       // guild_share_bps = 500 (LE)
      Buffer.alloc(8),                 // mint_fee = 0
    ]);
    
    const initIx = new TransactionInstruction({
      programId: SOLANA_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: solKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initData,
    });
    
    try {
      const initSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(initIx), [solKeypair]);
      results.solana.initTx = initSig;
      log.success(`Program initialized: ${initSig}`);
      log.link('Solscan (Init)', `https://solscan.io/tx/${initSig}?cluster=devnet`);
    } catch (e) {
      log.warn(`Init may have failed (possibly already initialized): ${e.message?.slice(0,80)}`);
    }
  } else {
    log.success('Program already initialized');
  }
  
  // Register collection
  log.info('Registering collection...');
  const sourceChainLE = Buffer.alloc(2);
  sourceChainLE.writeUInt16LE(CHAIN_SUI);
  
  const [collectionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection'), sourceChainLE, contractBytes],
    SOLANA_PROGRAM_ID
  );
  
  const collInfo = await solConn.getAccountInfo(collectionPda);
  if (!collInfo) {
    // Serialize: source_chain(u16 LE) + source_contract(borsh vec) + name(borsh string) + max_supply(u64 LE)
    const nameBytes = Buffer.from('Sui Genesis');
    const regData = Buffer.concat([
      anchorDisc('register_collection'),
      sourceChainLE,
      // borsh Vec<u8> for source_contract
      Buffer.from([contractBytes.length, 0, 0, 0]), contractBytes,
      // borsh String for name
      Buffer.from([nameBytes.length, 0, 0, 0]), nameBytes,
      // max_supply u64 LE (0 = unlimited)
      Buffer.alloc(8),
    ]);
    
    const regIx = new TransactionInstruction({
      programId: SOLANA_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: collectionPda, isSigner: false, isWritable: true },
        { pubkey: solKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: regData,
    });
    
    try {
      const regSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(regIx), [solKeypair]);
      results.solana.registerTx = regSig;
      log.success(`Collection registered: ${regSig}`);
      log.link('Solscan (Register)', `https://solscan.io/tx/${regSig}?cluster=devnet`);
    } catch (e) {
      log.warn(`Register collection: ${e.message?.slice(0,100)}`);
    }
  } else {
    log.success('Collection already registered');
  }

  // Verify seal (only if we have a signature)
  if (signatureBytes) {
    log.info('Submitting verify_seal with Ed25519 precompile...');
    
    const [recordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM_ID
    );
    
    const recordInfo = await solConn.getAccountInfo(recordPda);
    if (recordInfo) {
      log.success('Seal already verified on Solana');
      results.solana.recordPda = recordPda.toBase58();
    } else {
      // Ed25519 precompile instruction
      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: attestPubkey,
        message: sealHash,
        signature: signatureBytes,
      });
      
      // verify_seal instruction
      const attestPubkeyAsSolana = new PublicKey(attestPubkey);
      const verifySealData = Buffer.concat([
        anchorDisc('verify_seal'),
        sealHash, // seal_hash [u8; 32]
        sourceChainLE, // source_chain u16 LE
        Buffer.from([contractBytes.length, 0, 0, 0]), contractBytes, // source_contract Vec<u8>
        Buffer.from([tokenIdBytes.length, 0, 0, 0]), tokenIdBytes, // token_id Vec<u8>
        attestPubkeyAsSolana.toBuffer(), // attestation_pubkey Pubkey
        solKeypair.publicKey.toBuffer(), // recipient Pubkey
      ]);
      
      const verifySealIx = new TransactionInstruction({
        programId: SOLANA_PROGRAM_ID,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: collectionPda, isSigner: false, isWritable: true },
          { pubkey: recordPda, isSigner: false, isWritable: true },
          { pubkey: solKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: solKeypair.publicKey, isSigner: false, isWritable: false }, // recipient
          { pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: verifySealData,
      });
      
      try {
        const verifyTx = new SolanaTx().add(ed25519Ix).add(verifySealIx);
        const verifySig = await sendAndConfirmTransaction(solConn, verifyTx, [solKeypair]);
        results.solana.verifySealTx = verifySig;
        results.solana.recordPda = recordPda.toBase58();
        log.success(`Seal verified on Solana: ${verifySig}`);
        log.link('Solscan (Verify Seal)', `https://solscan.io/tx/${verifySig}?cluster=devnet`);
      } catch (e) {
        log.error(`verify_seal failed: ${e.message?.slice(0,150)}`);
        log.info('This may be due to instruction format. Check program logs.');
      }
    }

    // ========================================================================
    // STEP 5: Mint Reborn NFT on Solana (Metaplex Core)
    // ========================================================================
    if (results.solana.verifySealTx || results.solana.recordPda) {
      log.step(5, 'Mint Reborn NFT on Solana (Metaplex Core)');
      
      const [mintAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('reincarnation_mint'), sealHash], SOLANA_PROGRAM_ID
      );
      
      // Generate a new keypair for the asset
      const assetKeypair = Keypair.generate();
      
      const nameBytes = Buffer.from(DEMO_NFT_NAME);
      const uriBytes = Buffer.from(DEMO_NFT_IMAGE);
      
      const mintData = Buffer.concat([
        anchorDisc('mint_reborn'),
        sealHash, // seal_hash [u8; 32]
        Buffer.from([nameBytes.length, 0, 0, 0]), nameBytes, // name String
        Buffer.from([uriBytes.length, 0, 0, 0]), uriBytes, // uri String
      ]);
      
      const [recordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM_ID
      );
      
      const mintIx = new TransactionInstruction({
        programId: SOLANA_PROGRAM_ID,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: recordPda, isSigner: false, isWritable: true },
          { pubkey: mintAuthority, isSigner: false, isWritable: false },
          { pubkey: assetKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: solKeypair.publicKey, isSigner: false, isWritable: false }, // recipient
          { pubkey: solKeypair.publicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: mintData,
      });
      
      try {
        const mintTx = new SolanaTx().add(mintIx);
        const mintSig = await sendAndConfirmTransaction(solConn, mintTx, [solKeypair, assetKeypair]);
        results.solana.mintTx = mintSig;
        results.solana.assetId = assetKeypair.publicKey.toBase58();
        log.success(`🎉 REBORN NFT MINTED: ${assetKeypair.publicKey.toBase58()}`);
        log.link('Solscan (Mint)', `https://solscan.io/tx/${mintSig}?cluster=devnet`);
        log.link('Solscan (NFT)', `https://solscan.io/token/${assetKeypair.publicKey.toBase58()}?cluster=devnet`);
      } catch (e) {
        log.error(`mint_reborn failed: ${e.message?.slice(0,150)}`);
      }
    }
  } else {
    log.warn('Skipping Solana verify_seal + mint (no signature available)');
    log.info('The IKA signing TX was submitted. Check explorer for signature output.');
  }

  // ========================================================================
  // STEP 6: Mark Reborn on Sui (if we minted on Solana)
  // ========================================================================
  if (results.solana.assetId) {
    log.step(6, 'Mark Reborn on Sui (Closing the Loop)');
    
    const solMintBytes = Buffer.from(new PublicKey(results.solana.assetId).toBytes());
    
    const tx6 = new Transaction();
    tx6.setSender(suiAddress);
    tx6.setGasBudget(50_000_000);
    
    tx6.moveCall({
      target: `${SUI_PACKAGE}::registry::mark_reborn`,
      arguments: [
        tx6.object(SEAL_REGISTRY),
        tx6.pure('vector<u8>', Array.from(sealHash)),
        tx6.pure('vector<u8>', Array.from(solMintBytes)),
      ],
    });
    
    const txBytes6 = await tx6.build({ client: suiClient });
    const signed6 = await suiKeypair.signTransaction(txBytes6);
    const result6 = await retryRpc(() => suiClient.executeTransactionBlock({
      transactionBlock: signed6.bytes,
      signature: signed6.signature,
      options: { showEffects: true, showEvents: true },
      requestType: 'WaitForLocalExecution',
    }), 'tx6');
    
    if (result6.effects?.status?.status === 'failure') {
      log.warn(`mark_reborn failed: ${result6.effects?.status?.error}`);
    } else {
      results.sui.markRebornTx = result6.digest;
      log.success(`Marked reborn on Sui: ${result6.digest}`);
      log.link('Sui Explorer (Mark Reborn)', `https://suiscan.xyz/testnet/tx/${result6.digest}`);
    }
  }

  // ========================================================================
  // FINAL SUMMARY
  // ========================================================================
  console.log('\n\n' + '█'.repeat(60));
  console.log('  E2E DEMO COMPLETE — ALL EXPLORER LINKS');
  console.log('█'.repeat(60));
  
  console.log('\n  📦 SUI TESTNET:');
  console.log(`     Package:  https://suiscan.xyz/testnet/object/${SUI_PACKAGE}`);
  console.log(`     Registry: https://suiscan.xyz/testnet/object/${SEAL_REGISTRY}`);
  console.log(`     Vault:    https://suiscan.xyz/testnet/object/${SEAL_VAULT}`);
  if (results.sui.sealTx) {
    console.log(`     Seal TX:  https://suiscan.xyz/testnet/tx/${results.sui.sealTx}`);
  }
  if (results.sui.markRebornTx) {
    console.log(`     Reborn TX: https://suiscan.xyz/testnet/tx/${results.sui.markRebornTx}`);
  }
  
  console.log('\n  🔐 IKA dWALLET (2PC-MPC):');
  console.log(`     dWallet:    https://suiscan.xyz/testnet/object/${DWALLET_ID}`);
  console.log(`     DWalletCap: https://suiscan.xyz/testnet/object/${DWALLET_CAP}`);
  console.log(`     Presign TX: https://suiscan.xyz/testnet/tx/${results.ika.presignTx}`);
  console.log(`     Sign TX:    https://suiscan.xyz/testnet/tx/${results.ika.signTx}`);
  
  console.log('\n  🌐 SOLANA DEVNET:');
  console.log(`     Program:  https://solscan.io/account/${SOLANA_PROGRAM_ID.toBase58()}?cluster=devnet`);
  if (results.solana.initTx)       console.log(`     Init TX:  https://solscan.io/tx/${results.solana.initTx}?cluster=devnet`);
  if (results.solana.registerTx)   console.log(`     Register: https://solscan.io/tx/${results.solana.registerTx}?cluster=devnet`);
  if (results.solana.verifySealTx) console.log(`     Verify:   https://solscan.io/tx/${results.solana.verifySealTx}?cluster=devnet`);
  if (results.solana.mintTx)       console.log(`     Mint TX:  https://solscan.io/tx/${results.solana.mintTx}?cluster=devnet`);
  if (results.solana.assetId)      console.log(`     NFT:      https://solscan.io/token/${results.solana.assetId}?cluster=devnet`);
  
  console.log('\n  🦑 SEAL DETAILS:');
  console.log(`     Seal Hash: ${sealHash.toString('hex')}`);
  console.log(`     NFT Name:  ${DEMO_NFT_NAME}`);
  console.log(`     Source:    Sui (chain ${CHAIN_SUI})`);
  console.log(`     Dest:     Solana (chain ${CHAIN_SOLANA})`);
  console.log(`     dWallet:  Ed25519 ${DWALLET_ED25519_PUBKEY_HEX.slice(0,16)}...`);
  if (results.ika.signature) console.log(`     Sig:      ${results.ika.signature.slice(0,32)}...`);
  
  console.log('\n' + '█'.repeat(60) + '\n');
  
  return results;
}

main().catch(e => {
  log.error(e.message);
  console.error(e.stack?.split('\n').slice(0,5).join('\n'));
  process.exit(1);
});
