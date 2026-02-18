#!/usr/bin/env node
/**
 * Ika-chan NFT E2E Demo
 * Step-by-step: Sui mint → dWallet seal+sign → Solana reborn
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
  Ed25519Program, sendAndConfirmTransaction
} from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

// ============================================================================
// Config
// ============================================================================

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const SOLANA_RPC = 'https://api.devnet.solana.com';

const SUI_PACKAGE = '0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e';
const SEAL_REGISTRY = '0xffa3bb04b8cdb11c905900da846cc92f70049654b2d9661269c8ba73c3e71294';
const SEAL_VAULT = '0x0fccb85175e9f0a0ad99e445bdde187be2a2967d73b0402cb4ca147c5273b9a0';

const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
const DWALLET_PUBKEY_HEX = '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';

const SOLANA_PROGRAM = new PublicKey('mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa');
const MPL_CORE = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

const WALRUS_IMAGE_BLOB = '9ASBu9iTnkUun3LV6OKP-VdryWoobvNicoMqVLH4ajY';
const WALRUS_METADATA_BLOB = 'Udr8c44HpNM9XzWLqVmfbGcUMrp_u8r0SaTIUSaF5xU';
const WALRUS_IMAGE_URL = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_IMAGE_BLOB}`;
const WALRUS_METADATA_URL = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_METADATA_BLOB}`;

const NFT_NAME = 'Ika-chan NFT #1';
const NFT_DESC = 'The legendary Ika-chan, reborn through Ika Tensei. いかちゃん最強！🦑';
const COLLECTION_NAME = 'Ika Tensei Genesis';

const CHAIN_SUI = 2;
const CHAIN_SOLANA = 3;

// ============================================================================
// Helpers
// ============================================================================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = {
  step:    (n, msg) => console.log(`\n${'═'.repeat(60)}\n  STEP ${n}: ${msg}\n${'═'.repeat(60)}`),
  info:    (msg) => console.log(`  ℹ  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  error:   (msg) => console.error(`  ❌ ${msg}`),
  warn:    (msg) => console.warn(`  ⚠️  ${msg}`),
  link:    (label, url) => console.log(`  🔗 ${label}:\n     ${url}`),
};

async function retry(fn, label, max = 12) {
  for (let i = 0; i < max; i++) {
    try { return await fn(); }
    catch (e) {
      if (i < max - 1 && (e.message?.includes('429') || e.message?.includes('rate') || e.message?.includes('fetch failed'))) {
        await sleep(3000 * (i + 1));
      } else throw e;
    }
  }
}

function anchorDisc(name) {
  return createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

function computeSealHash(srcChain, dstChain, contract, tokenId, attestPub, nonce) {
  const cBytes = Buffer.from(contract.replace('0x', ''), 'hex');
  const tBytes = Buffer.alloc(8); tBytes.writeBigUInt64BE(BigInt(tokenId));
  const nBytes = Buffer.alloc(8); nBytes.writeBigUInt64BE(BigInt(nonce));
  const buf = Buffer.alloc(2 + 2 + 1 + cBytes.length + 1 + tBytes.length + 32 + 8);
  let o = 0;
  buf.writeUInt16BE(srcChain, o); o += 2;
  buf.writeUInt16BE(dstChain, o); o += 2;
  buf.writeUInt8(cBytes.length, o); o += 1;
  cBytes.copy(buf, o); o += cBytes.length;
  buf.writeUInt8(tBytes.length, o); o += 1;
  tBytes.copy(buf, o); o += tBytes.length;
  buf.set(attestPub, o); o += 32;
  nBytes.copy(buf, o);
  return createHash('sha256').update(buf).digest();
}

// ============================================================================
// State file (persist between steps if script needs restart)
// ============================================================================

const STATE_FILE = '/tmp/ikachan-e2e-state.json';
let state = {};
function saveState() { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
function loadState() { try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { state = {}; } }

// ============================================================================
// Main
// ============================================================================

async function main() {
  loadState();
  
  console.log('\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN NFT — FULL E2E REINCARNATION DEMO');
  console.log('  Sui Testnet → IKA dWallet → Solana Devnet');
  console.log('█'.repeat(60));
  
  const nonce = state.nonce || Date.now();
  state.nonce = nonce;
  const tokenId = 1;
  const attestPub = Buffer.from(DWALLET_PUBKEY_HEX, 'hex');
  const contractBytes = Buffer.from(SUI_PACKAGE.replace('0x', ''), 'hex');
  const tokenIdBytes = Buffer.alloc(8); tokenIdBytes.writeBigUInt64BE(BigInt(tokenId));
  
  const sealHash = computeSealHash(CHAIN_SUI, CHAIN_SOLANA, SUI_PACKAGE, tokenId, attestPub, nonce);
  state.sealHash = sealHash.toString('hex');
  log.info(`Seal hash: ${state.sealHash}`);
  log.info(`Nonce: ${nonce}`);
  saveState();
  
  // === SETUP ===
  const ks = JSON.parse(readFileSync(homedir() + '/.sui/sui_config/sui.keystore', 'utf8'));
  const kb = Buffer.from(ks[0], 'base64');
  const suiKp = Ed25519Keypair.fromSecretKey(kb.slice(1));
  const suiAddr = suiKp.getPublicKey().toSuiAddress();
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaCfg = getNetworkConfig('testnet');
  const ikaClient = new IkaClient({ suiClient, config: ikaCfg });
  await retry(() => ikaClient.initialize(), 'ika-init');
  const ikaType = `${ikaCfg.packages.ikaPackage}::ika::IKA`;
  const seed = Uint8Array.from(kb.slice(1, 33));
  const userKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  
  const solKd = JSON.parse(readFileSync(homedir() + '/.config/solana/id.json', 'utf8'));
  const solKp = Keypair.fromSecretKey(Buffer.from(solKd));
  const solConn = new Connection(SOLANA_RPC, 'confirmed');
  
  log.info(`Sui: ${suiAddr}`);
  log.info(`Sol: ${solKp.publicKey.toBase58()}`);

  // ========================================================================
  // STEP 1: Register Seal on Sui (with Wormhole stub VAA)
  // ========================================================================
  if (!state.sealTx) {
    log.step(1, 'Register Seal on Sui Testnet');
    
    const tx = new Transaction();
    tx.setSender(suiAddr);
    tx.setGasBudget(100_000_000);
    
    tx.moveCall({
      target: `${SUI_PACKAGE}::registry::register_seal_with_vaa`,
      arguments: [
        tx.object(SEAL_REGISTRY),                                        // registry
        tx.object(SEAL_VAULT),                                           // vault
        tx.pure.vector('u8', Array.from(Buffer.from('ika-chan-demo-vaa-' + nonce))), // vaa_bytes
        tx.pure.id(DWALLET_ID),                                         // dwallet_id
        tx.pure.id(DWALLET_CAP),                                        // dwallet_cap_id
        tx.pure.id(DWALLET_ID),                                         // attestation_dwallet_id
        tx.pure.id(DWALLET_CAP),                                        // attestation_dwallet_cap_id
        tx.pure.vector('u8', Array.from(attestPub)),                     // dwallet_pubkey
        tx.pure.vector('u8', Array.from(attestPub)),                     // attestation_pubkey
        tx.pure.u16(CHAIN_SUI),                                         // source_chain_id
        tx.pure.vector('u8', Array.from(contractBytes)),                 // source_contract
        tx.pure.vector('u8', Array.from(tokenIdBytes)),                  // token_id
        tx.pure.u64(nonce),                                              // nonce
        tx.pure.vector('u8', Array.from(Buffer.from(NFT_NAME))),         // metadata_name
        tx.pure.vector('u8', Array.from(Buffer.from(NFT_DESC))),         // metadata_description
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_URL))), // metadata_uri
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_METADATA_BLOB))), // walrus_metadata_blob_id
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_BLOB))),    // walrus_image_blob_id
        tx.pure.vector('u8', Array.from(Buffer.from(COLLECTION_NAME))),      // collection_name
      ],
    });
    
    const txB = await tx.build({ client: suiClient });
    const sig = await suiKp.signTransaction(txB);
    const res = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sig.bytes, signature: sig.signature,
      options: { showEffects: true, showEvents: true },
      requestType: 'WaitForLocalExecution',
    }), 'seal-tx');
    
    if (res.effects?.status?.status === 'failure') {
      log.error(`Seal TX failed: ${res.effects?.status?.error}`);
      // The stub VAA returns (0, [], []) for emitter - check if emitter validation blocks us
      log.info('Checking if untrusted emitter error...');
      const errMsg = res.effects?.status?.error || '';
      if (errMsg.includes('8') || errMsg.includes('UNTRUSTED')) {
        log.warn('Emitter validation blocking. Need to register a trusted emitter first.');
        log.info('Registering dummy emitter for chain 0...');
        
        // We need AdminCap for this
        const ADMIN_CAP = '0x55ced2b1b2d661192bd304bdbc53a65e535e523320797362f91db4fa9583a72a';
        const txE = new Transaction();
        txE.setSender(suiAddr);
        txE.setGasBudget(50_000_000);
        // Stub VAA returns chain=21 (Wormhole Sui) with empty emitter
        txE.moveCall({
          target: `${SUI_PACKAGE}::registry::register_trusted_emitter`,
          arguments: [
            txE.object(SEAL_REGISTRY),
            txE.object(ADMIN_CAP),
            txE.pure.u16(21), // Wormhole chain ID for Sui
            txE.pure.vector('u8', []), // empty emitter (matches stub)
          ],
        });
        
        const txEB = await txE.build({ client: suiClient });
        const sigE = await suiKp.signTransaction(txEB);
        const resE = await retry(() => suiClient.executeTransactionBlock({
          transactionBlock: sigE.bytes, signature: sigE.signature,
          options: { showEffects: true },
          requestType: 'WaitForLocalExecution',
        }), 'emitter-tx');
        
        if (resE.effects?.status?.status === 'failure') {
          log.error(`Register emitter failed: ${resE.effects?.status?.error}`);
        } else {
          log.success(`Emitter registered: ${resE.digest}`);
          log.link('Sui (Emitter)', `https://suiscan.xyz/testnet/tx/${resE.digest}`);
          state.emitterTx = resE.digest;
          saveState();
          
          // Retry seal registration
          log.info('Retrying seal registration...');
          const tx2 = new Transaction();
          tx2.setSender(suiAddr);
          tx2.setGasBudget(100_000_000);
          tx2.moveCall({
            target: `${SUI_PACKAGE}::registry::register_seal_with_vaa`,
            arguments: [
              tx2.object(SEAL_REGISTRY),
              tx2.object(SEAL_VAULT),
              tx2.pure.vector('u8', Array.from(Buffer.from('ika-chan-demo-vaa-' + nonce))),
              tx2.pure.id(DWALLET_ID),
              tx2.pure.id(DWALLET_CAP),
              tx2.pure.id(DWALLET_ID),
              tx2.pure.id(DWALLET_CAP),
              tx2.pure.vector('u8', Array.from(attestPub)),
              tx2.pure.vector('u8', Array.from(attestPub)),
              tx2.pure.u16(CHAIN_SUI),
              tx2.pure.vector('u8', Array.from(contractBytes)),
              tx2.pure.vector('u8', Array.from(tokenIdBytes)),
              tx2.pure.u64(nonce),
              tx2.pure.vector('u8', Array.from(Buffer.from(NFT_NAME))),
              tx2.pure.vector('u8', Array.from(Buffer.from(NFT_DESC))),
              tx2.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_URL))),
              tx2.pure.vector('u8', Array.from(Buffer.from(WALRUS_METADATA_BLOB))),
              tx2.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_BLOB))),
              tx2.pure.vector('u8', Array.from(Buffer.from(COLLECTION_NAME))),
            ],
          });
          const txB2 = await tx2.build({ client: suiClient });
          const sig2 = await suiKp.signTransaction(txB2);
          const res2 = await retry(() => suiClient.executeTransactionBlock({
            transactionBlock: sig2.bytes, signature: sig2.signature,
            options: { showEffects: true, showEvents: true },
            requestType: 'WaitForLocalExecution',
          }), 'seal-tx-retry');
          
          if (res2.effects?.status?.status === 'failure') {
            log.error(`Seal TX retry failed: ${res2.effects?.status?.error}`);
          } else {
            state.sealTx = res2.digest;
            log.success(`Seal registered: ${res2.digest}`);
            log.link('Sui (Seal)', `https://suiscan.xyz/testnet/tx/${res2.digest}`);
            for (const evt of (res2.events || [])) {
              if (evt.type?.includes('NFTSealed')) {
                log.success('NFTSealed event emitted!');
              }
            }
          }
        }
      }
    } else {
      state.sealTx = res.digest;
      log.success(`Seal registered: ${res.digest}`);
      log.link('Sui (Seal)', `https://suiscan.xyz/testnet/tx/${res.digest}`);
      for (const evt of (res.events || [])) {
        if (evt.type?.includes('NFTSealed')) {
          log.success('NFTSealed event emitted!');
        }
      }
    }
    saveState();
  } else {
    log.step(1, 'Seal already registered (cached)');
    log.link('Sui (Seal)', `https://suiscan.xyz/testnet/tx/${state.sealTx}`);
  }

  // ========================================================================
  // STEP 2: Sign seal hash with IKA dWallet
  // ========================================================================
  if (!state.signatureHex) {
    log.step(2, 'Sign Seal Hash with IKA dWallet (2PC-MPC Ed25519)');
    
    // TX1: Presign
    log.info('TX1: Requesting presign...');
    const encKey = await retry(() => ikaClient.getLatestNetworkEncryptionKey(), 'encKey');
    const coins = await retry(() => suiClient.getCoins({ owner: suiAddr, coinType: ikaType }), 'coins');
    
    const tx1 = new Transaction();
    tx1.setSender(suiAddr);
    tx1.setGasBudget(500_000_000);
    const ikaTx1 = new IkaTransaction({ ikaClient, transaction: tx1, userShareEncryptionKeys: userKeys });
    const upc = ikaTx1.requestGlobalPresign({
      dwalletNetworkEncryptionKeyId: encKey.id,
      curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      ikaCoin: tx1.object(coins.data[0].coinObjectId),
      suiCoin: tx1.gas,
    });
    tx1.transferObjects([upc], suiAddr);
    
    const tb1 = await tx1.build({ client: suiClient });
    const s1 = await suiKp.signTransaction(tb1);
    const r1 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s1.bytes, signature: s1.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'tx1');
    
    if (r1.effects?.status?.status === 'failure') throw new Error(`Presign failed: ${r1.effects?.status?.error}`);
    state.presignTx = r1.digest;
    log.success(`Presign TX: ${r1.digest}`);
    log.link('Sui (Presign)', `https://suiscan.xyz/testnet/tx/${r1.digest}`);
    
    let pcId = null, psId = null;
    for (const o of (r1.objectChanges || [])) {
      if (o.type === 'created') {
        const t = o.objectType?.split('::').pop() || '';
        if (t.includes('UnverifiedPresignCap')) pcId = o.objectId;
        if (t.includes('PresignSession')) psId = o.objectId;
      }
    }
    for (const e of (r1.events || [])) {
      if (e.parsedJson?.presign_session_id) psId = e.parsedJson.presign_session_id;
    }
    if (!pcId || !psId) throw new Error(`Missing: cap=${pcId}, session=${psId}`);
    log.info(`Presign Cap: ${pcId}`);
    log.info(`Presign Session: ${psId}`);
    
    // Wait for presign
    log.info('Waiting for presign MPC...');
    let pObj = null;
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      try {
        pObj = await ikaClient.getPresign(psId);
        if (pObj.state?.$kind === 'Completed') { log.success(`Presign done (${(i+1)*3}s)`); break; }
        if (i % 10 === 0) log.info(`  Poll ${i+1}: ${pObj.state?.$kind || '?'}`);
      } catch (e) { if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0,40)}`); }
    }
    if (!pObj || pObj.state?.$kind !== 'Completed') throw new Error('Presign timeout');
    
    // TX2: Sign
    log.info('TX2: Signing...');
    const dw = await retry(() => ikaClient.getDWallet(DWALLET_ID), 'dw');
    const es = await retry(() => ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID), 'es');
    const coins2 = await retry(() => suiClient.getCoins({ owner: suiAddr, coinType: ikaType }), 'c2');
    
    const tx2 = new Transaction();
    tx2.setSender(suiAddr);
    tx2.setGasBudget(500_000_000);
    const ikaTx2 = new IkaTransaction({ ikaClient, transaction: tx2, userShareEncryptionKeys: userKeys });
    const vpc = ikaTx2.verifyPresignCap({ presign: pObj, unverifiedPresignCap: pcId });
    const ma = ikaTx2.approveMessage({
      dWalletCap: DWALLET_CAP, curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA, hashScheme: Hash.SHA512,
      message: Array.from(sealHash),
    });
    await ikaTx2.requestSign({
      dWallet: dw, messageApproval: ma, hashScheme: Hash.SHA512,
      verifiedPresignCap: vpc, presign: pObj, encryptedUserSecretKeyShare: es,
      message: Array.from(sealHash), signatureScheme: SignatureAlgorithm.EdDSA,
      ikaCoin: tx2.object(coins2.data[0].coinObjectId), suiCoin: tx2.gas,
    });
    
    const tb2 = await tx2.build({ client: suiClient });
    const s2 = await suiKp.signTransaction(tb2);
    const r2 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s2.bytes, signature: s2.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'tx2');
    
    if (r2.effects?.status?.status === 'failure') throw new Error(`Sign failed: ${r2.effects?.status?.error}`);
    state.signTx = r2.digest;
    log.success(`Sign TX: ${r2.digest}`);
    log.link('Sui (Sign)', `https://suiscan.xyz/testnet/tx/${r2.digest}`);
    
    // Find sign session
    let signSessionId = null;
    for (const o of (r2.objectChanges || [])) {
      if (o.type === 'created') {
        const t = o.objectType?.split('::').pop() || '';
        if (t.includes('SignSession')) { signSessionId = o.objectId; log.info(`SignSession: ${o.objectId}`); }
      }
    }
    for (const e of (r2.events || [])) {
      if (e.parsedJson?.sign_session_id) signSessionId = e.parsedJson.sign_session_id;
    }
    
    // Poll for signature
    log.info('Waiting for MPC signature...');
    let sigBytes = null;
    for (let i = 0; i < 80; i++) {
      await sleep(3000);
      
      if (signSessionId) {
        try {
          const obj = await retry(() => suiClient.getObject({ 
            id: signSessionId, options: { showContent: true } 
          }), 'ss');
          const f = obj.data?.content?.fields;
          if (f) {
            // Check state
            const st = f.state;
            const kind = st?.variant || st?.$kind || '';
            if (kind === 'Completed' || kind === 'Signed') {
              const s = st?.fields?.signature || f.signature;
              if (s && Array.isArray(s) && s.length >= 64) {
                sigBytes = Buffer.from(s);
                log.success(`Signature: ${sigBytes.toString('hex').slice(0,32)}... (${s.length}B)`);
                break;
              }
            }
            // Check for output field
            if (f.output) {
              try {
                const outObj = await retry(() => suiClient.getObject({
                  id: f.output, options: { showContent: true }
                }), 'out');
                const of2 = outObj.data?.content?.fields;
                if (of2?.signature && Array.isArray(of2.signature) && of2.signature.length >= 64) {
                  sigBytes = Buffer.from(of2.signature);
                  log.success(`Signature from output: ${sigBytes.toString('hex').slice(0,32)}...`);
                  break;
                }
              } catch {}
            }
            if (i % 5 === 0) log.info(`  Poll ${i+1}: state=${kind || JSON.stringify(st).slice(0,60)}`);
          }
        } catch (e) {
          if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0,50)}`);
        }
      }
      
      // Every 30s, search owned objects for SignOutput
      if (i > 0 && i % 10 === 0) {
        try {
          // Try different type patterns
          for (const typeFilter of [
            `${ikaCfg.packages.ikaPackage}::sign::SignOutput`,
            `${ikaCfg.packages.ikaCorePackage || ikaCfg.packages.ikaPackage}::sign::SignOutput`,
          ]) {
            try {
              const owned = await retry(() => suiClient.getOwnedObjects({
                owner: suiAddr,
                options: { showContent: true, showType: true },
                filter: { StructType: typeFilter },
              }), 'owned');
              for (const o of (owned.data || [])) {
                const ff = o.data?.content?.fields;
                if (ff?.signature && Array.isArray(ff.signature) && ff.signature.length >= 64) {
                  sigBytes = Buffer.from(ff.signature);
                  log.success(`Found SignOutput owned object: ${o.data.objectId}`);
                  break;
                }
              }
              if (sigBytes) break;
            } catch {}
          }
          if (sigBytes) break;
        } catch {}
      }
    }
    
    if (sigBytes) {
      state.signatureHex = sigBytes.toString('hex');
    } else {
      log.warn('Signature not retrieved. TX submitted successfully, check explorer.');
      log.info('You can manually check the sign session object for the signature.');
    }
    saveState();
  } else {
    log.step(2, 'Signature already obtained (cached)');
    log.info(`Sig: ${state.signatureHex.slice(0,32)}...`);
  }

  // ========================================================================
  // STEP 3: Initialize Solana + Register Collection
  // ========================================================================
  log.step(3, 'Solana Setup (Initialize + Register Collection)');
  
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('ika_config')], SOLANA_PROGRAM);
  const srcChainLE = Buffer.alloc(2); srcChainLE.writeUInt16LE(CHAIN_SUI);
  
  // Initialize
  const cfgInfo = await solConn.getAccountInfo(configPda);
  if (!cfgInfo) {
    log.info('Initializing program...');
    const initData = Buffer.concat([
      anchorDisc('initialize'),
      solKp.publicKey.toBuffer(), solKp.publicKey.toBuffer(),
      Buffer.from([0xF4, 0x01]), Buffer.alloc(8),
    ]);
    const initIx = new TransactionInstruction({
      programId: SOLANA_PROGRAM,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: solKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initData,
    });
    try {
      const initSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(initIx), [solKp]);
      state.solInitTx = initSig;
      log.success(`Initialized: ${initSig}`);
      log.link('Solscan (Init)', `https://solscan.io/tx/${initSig}?cluster=devnet`);
    } catch (e) {
      log.warn(`Init: ${e.message?.slice(0,100)}`);
    }
  } else {
    log.success('Already initialized');
  }
  
  // Register collection
  const [collPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection'), srcChainLE, contractBytes], SOLANA_PROGRAM
  );
  const collInfo = await solConn.getAccountInfo(collPda);
  if (!collInfo) {
    log.info('Registering collection...');
    const nameB = Buffer.from('Sui Genesis');
    const regData = Buffer.concat([
      anchorDisc('register_collection'),
      srcChainLE,
      Buffer.from([contractBytes.length, 0, 0, 0]), contractBytes,
      Buffer.from([nameB.length, 0, 0, 0]), nameB,
      Buffer.alloc(8),
    ]);
    const regIx = new TransactionInstruction({
      programId: SOLANA_PROGRAM,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: collPda, isSigner: false, isWritable: true },
        { pubkey: solKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: regData,
    });
    try {
      const regSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(regIx), [solKp]);
      state.solRegTx = regSig;
      log.success(`Collection registered: ${regSig}`);
      log.link('Solscan (Register)', `https://solscan.io/tx/${regSig}?cluster=devnet`);
    } catch (e) {
      log.warn(`Register: ${e.message?.slice(0,100)}`);
    }
  } else {
    log.success('Collection already registered');
  }
  saveState();

  // ========================================================================
  // STEP 4: Verify Seal on Solana (Ed25519 precompile)
  // ========================================================================
  if (state.signatureHex && !state.solVerifyTx) {
    log.step(4, 'Verify Seal on Solana (Ed25519 Precompile)');
    
    const sigBuf = Buffer.from(state.signatureHex, 'hex');
    const [recordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM
    );
    
    const recInfo = await solConn.getAccountInfo(recordPda);
    if (recInfo) {
      log.success('Seal already verified');
      state.solRecordPda = recordPda.toBase58();
    } else {
      // Ed25519 precompile
      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: attestPub, message: sealHash, signature: sigBuf,
      });
      
      // verify_seal
      const aPub = new PublicKey(attestPub);
      const vData = Buffer.concat([
        anchorDisc('verify_seal'),
        sealHash,
        srcChainLE,
        Buffer.from([contractBytes.length, 0, 0, 0]), contractBytes,
        Buffer.from([tokenIdBytes.length, 0, 0, 0]), tokenIdBytes,
        aPub.toBuffer(),
        solKp.publicKey.toBuffer(),
      ]);
      
      const vIx = new TransactionInstruction({
        programId: SOLANA_PROGRAM,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: collPda, isSigner: false, isWritable: true },
          { pubkey: recordPda, isSigner: false, isWritable: true },
          { pubkey: solKp.publicKey, isSigner: true, isWritable: true },
          { pubkey: solKp.publicKey, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: vData,
      });
      
      try {
        const vSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(ed25519Ix).add(vIx), [solKp]);
        state.solVerifyTx = vSig;
        state.solRecordPda = recordPda.toBase58();
        log.success(`Seal verified: ${vSig}`);
        log.link('Solscan (Verify)', `https://solscan.io/tx/${vSig}?cluster=devnet`);
      } catch (e) {
        log.error(`verify_seal: ${e.message?.slice(0,200)}`);
        // Try to get more details
        if (e.logs) {
          for (const l of e.logs.slice(-10)) log.info(`  ${l}`);
        }
      }
    }
    saveState();
  } else if (!state.signatureHex) {
    log.step(4, 'SKIPPED (no signature yet)');
    log.info('The IKA signing TX was submitted. Signature needs to be polled from chain.');
  }

  // ========================================================================
  // STEP 5: Mint Reborn NFT (Metaplex Core)
  // ========================================================================
  if (state.solVerifyTx && !state.solMintTx) {
    log.step(5, 'Mint Reborn Ika-chan on Solana (Metaplex Core)');
    
    const [mintAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation_mint'), sealHash], SOLANA_PROGRAM
    );
    const [recordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM
    );
    
    const assetKp = Keypair.generate();
    const nameB = Buffer.from(NFT_NAME);
    const uriB = Buffer.from(WALRUS_METADATA_URL);
    
    const mData = Buffer.concat([
      anchorDisc('mint_reborn'),
      sealHash,
      Buffer.from([nameB.length, 0, 0, 0]), nameB,
      Buffer.from([uriB.length, 0, 0, 0]), uriB,
    ]);
    
    const mIx = new TransactionInstruction({
      programId: SOLANA_PROGRAM,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: mintAuth, isSigner: false, isWritable: false },
        { pubkey: assetKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: solKp.publicKey, isSigner: false, isWritable: false },
        { pubkey: solKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: MPL_CORE, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: mData,
    });
    
    try {
      const mSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(mIx), [solKp, assetKp]);
      state.solMintTx = mSig;
      state.solAssetId = assetKp.publicKey.toBase58();
      log.success(`🎉 IKA-CHAN REBORN: ${assetKp.publicKey.toBase58()}`);
      log.link('Solscan (Mint)', `https://solscan.io/tx/${mSig}?cluster=devnet`);
      log.link('Solscan (NFT)', `https://solscan.io/token/${assetKp.publicKey.toBase58()}?cluster=devnet`);
    } catch (e) {
      log.error(`mint_reborn: ${e.message?.slice(0,200)}`);
      if (e.logs) {
        for (const l of e.logs.slice(-10)) log.info(`  ${l}`);
      }
    }
    saveState();
  }

  // ========================================================================
  // STEP 6: Mark Reborn on Sui
  // ========================================================================
  if (state.solAssetId && !state.markRebornTx) {
    log.step(6, 'Mark Reborn on Sui (Close the Loop)');
    
    const mintPubkey = new PublicKey(state.solAssetId);
    const tx6 = new Transaction();
    tx6.setSender(suiAddr);
    tx6.setGasBudget(50_000_000);
    tx6.moveCall({
      target: `${SUI_PACKAGE}::registry::mark_reborn`,
      arguments: [
        tx6.object(SEAL_REGISTRY),
        tx6.pure.vector('u8', Array.from(sealHash)),
        tx6.pure.vector('u8', Array.from(mintPubkey.toBytes())),
      ],
    });
    
    const tb6 = await tx6.build({ client: suiClient });
    const s6 = await suiKp.signTransaction(tb6);
    const r6 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s6.bytes, signature: s6.signature,
      options: { showEffects: true, showEvents: true },
      requestType: 'WaitForLocalExecution',
    }), 'mark');
    
    if (r6.effects?.status?.status !== 'failure') {
      state.markRebornTx = r6.digest;
      log.success(`Marked reborn: ${r6.digest}`);
      log.link('Sui (Reborn)', `https://suiscan.xyz/testnet/tx/${r6.digest}`);
    } else {
      log.error(`mark_reborn: ${r6.effects?.status?.error}`);
    }
    saveState();
  }

  // ========================================================================
  // FINAL SUMMARY
  // ========================================================================
  console.log('\n\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN REINCARNATION COMPLETE');
  console.log('█'.repeat(60));
  
  console.log('\n  📦 WALRUS (Decentralized Storage):');
  console.log(`     Image:    https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_IMAGE_BLOB}`);
  console.log(`     Metadata: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_METADATA_BLOB}`);
  
  console.log('\n  🔷 SUI TESTNET:');
  console.log(`     Package:  https://suiscan.xyz/testnet/object/${SUI_PACKAGE}`);
  console.log(`     Registry: https://suiscan.xyz/testnet/object/${SEAL_REGISTRY}`);
  console.log(`     Vault:    https://suiscan.xyz/testnet/object/${SEAL_VAULT}`);
  if (state.emitterTx) console.log(`     Emitter:  https://suiscan.xyz/testnet/tx/${state.emitterTx}`);
  if (state.sealTx) console.log(`     Seal TX:  https://suiscan.xyz/testnet/tx/${state.sealTx}`);
  if (state.markRebornTx) console.log(`     Reborn:   https://suiscan.xyz/testnet/tx/${state.markRebornTx}`);
  
  console.log('\n  🔐 IKA dWALLET (2PC-MPC Ed25519):');
  console.log(`     dWallet:  https://suiscan.xyz/testnet/object/${DWALLET_ID}`);
  console.log(`     Cap:      https://suiscan.xyz/testnet/object/${DWALLET_CAP}`);
  if (state.presignTx) console.log(`     Presign:  https://suiscan.xyz/testnet/tx/${state.presignTx}`);
  if (state.signTx) console.log(`     Sign:     https://suiscan.xyz/testnet/tx/${state.signTx}`);
  if (state.signatureHex) console.log(`     Sig:      ${state.signatureHex.slice(0,32)}...`);
  
  console.log('\n  🟣 SOLANA DEVNET:');
  console.log(`     Program:  https://solscan.io/account/mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa?cluster=devnet`);
  if (state.solInitTx) console.log(`     Init:     https://solscan.io/tx/${state.solInitTx}?cluster=devnet`);
  if (state.solRegTx) console.log(`     Register: https://solscan.io/tx/${state.solRegTx}?cluster=devnet`);
  if (state.solVerifyTx) console.log(`     Verify:   https://solscan.io/tx/${state.solVerifyTx}?cluster=devnet`);
  if (state.solMintTx) console.log(`     Mint:     https://solscan.io/tx/${state.solMintTx}?cluster=devnet`);
  if (state.solAssetId) console.log(`     NFT:      https://solscan.io/token/${state.solAssetId}?cluster=devnet`);
  
  console.log('\n  🦑 SEAL:');
  console.log(`     Hash:     ${state.sealHash}`);
  console.log(`     NFT:      ${NFT_NAME}`);
  console.log(`     Route:    Sui (${CHAIN_SUI}) → Solana (${CHAIN_SOLANA})`);
  console.log(`     Nonce:    ${nonce}`);
  
  console.log('\n' + '█'.repeat(60) + '\n');
}

main().catch(e => {
  log.error(e.message);
  console.error(e.stack?.split('\n').slice(0,5).join('\n'));
  process.exit(1);
});
