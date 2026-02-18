/**
 * dWallet Signing Test v3 - Two-phase flow
 * 
 * Phase 1: Submit presign request, wait for network completion
 * Phase 2: Submit sign request with completed presign
 * 
 * Run with --phase1 or --phase2, or no args to do both.
 */

import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction, SignatureAlgorithm, Hash 
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';

const TEST_MESSAGE = createHash('sha256').update('ika-tensei-seal-test-v3').digest();
const STATE_FILE = '/tmp/dwallet-sign-v3-state.json';

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  return {};
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retryRpc(fn, label, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e) {
      if ((e.message?.includes('429') || e.message?.includes('rate')) && i < maxRetries - 1) {
        console.log(`   ⏳ Rate limited (${label}), wait ${3000*(i+1)}ms`);
        await sleep(3000 * (i + 1));
      } else throw e;
    }
  }
}

async function setup() {
  const ikaConfig = getNetworkConfig('testnet');
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await retryRpc(() => ikaClient.initialize(), 'init');

  const keystore = JSON.parse(readFileSync(process.env.HOME + '/.sui/sui_config/sui.keystore', 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const address = suiKeypair.getPublicKey().toSuiAddress();
  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);

  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  const ikaCoins = await retryRpc(() => suiClient.getCoins({ owner: address, coinType: ikaType }), 'getCoins');
  const encKey = await retryRpc(() => ikaClient.getLatestNetworkEncryptionKey(), 'getEncKey');

  console.log(`Address: ${address}`);
  console.log(`Message: ${TEST_MESSAGE.toString('hex')}`);
  console.log(`IKA coins: ${ikaCoins.data.length}, Enc key: ${encKey.id.slice(0,16)}...`);

  return { ikaConfig, suiClient, ikaClient, suiKeypair, address, userShareKeys, ikaCoins, encKey };
}

async function executeTx(suiClient, suiKeypair, tx) {
  const txBytes = await tx.build({ client: suiClient });
  const signedTx = await suiKeypair.signTransaction(txBytes);
  return retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signedTx.bytes,
    signature: signedTx.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }), 'executeTx');
}

// ========== PHASE 1: Request Presign ==========
async function phase1() {
  console.log('\n========== PHASE 1: Request Global Presign ==========\n');
  const ctx = await setup();

  const tx = new Transaction();
  tx.setSender(ctx.address);
  tx.setGasBudget(500_000_000);

  const ikaTx = new IkaTransaction({ 
    ikaClient: ctx.ikaClient, 
    transaction: tx, 
    userShareEncryptionKeys: ctx.userShareKeys 
  });

  const ikaCoinObj = tx.object(ctx.ikaCoins.data[0].coinObjectId);

  console.log('Requesting global presign (EdDSA/Ed25519)...');
  const unverifiedPresignCap = ikaTx.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: ctx.encKey.id,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    ikaCoin: ikaCoinObj,
    suiCoin: tx.gas,
  });

  // Transfer the presign cap to ourselves so we can use it later
  tx.transferObjects([unverifiedPresignCap], ctx.address);

  console.log('Executing presign transaction...');
  const result = await executeTx(ctx.suiClient, ctx.suiKeypair, tx);

  console.log(`TX: ${result.digest}`);
  console.log(`Status: ${result.effects?.status?.status}`);

  if (result.effects?.status?.status === 'failure') {
    console.error(`Error: ${result.effects?.status?.error}`);
    process.exit(1);
  }

  // Find created objects
  const created = result.objectChanges?.filter(o => o.type === 'created') || [];
  console.log(`Created ${created.length} objects:`);
  
  let presignCapId = null;
  let presignSessionId = null;
  
  for (const obj of created) {
    console.log(`  ${obj.objectId} type=${obj.objectType?.split('::').pop()}`);
    if (obj.objectType?.includes('UnverifiedPresignCap') || obj.objectType?.includes('PresignCap')) {
      presignCapId = obj.objectId;
    }
    if (obj.objectType?.includes('PresignSession')) {
      presignSessionId = obj.objectId;
    }
  }

  // Also check events for presign session
  for (const evt of (result.events || [])) {
    console.log(`  Event: ${evt.type?.split('::').pop()}`);
    if (evt.parsedJson?.presign_session_id) {
      presignSessionId = evt.parsedJson.presign_session_id;
    }
    if (evt.parsedJson) {
      console.log(`    ${JSON.stringify(evt.parsedJson).slice(0, 120)}`);
    }
  }

  const state = {
    presignCapId,
    presignSessionId,
    txDigest: result.digest,
    phase: 1,
    timestamp: Date.now(),
    created: created.map(c => ({ id: c.objectId, type: c.objectType?.split('::').pop() })),
  };
  saveState(state);
  
  console.log(`\nPresign Cap: ${presignCapId}`);
  console.log(`Presign Session: ${presignSessionId}`);
  console.log(`State saved to ${STATE_FILE}`);
  
  if (presignSessionId) {
    console.log('\nWaiting for presign completion (polling)...');
    await pollPresign(ctx, presignSessionId);
  } else {
    console.log('\n⚠️  No presign session ID found. Check created objects manually.');
    console.log('Run with --phase2 after presign completes.');
  }
}

async function pollPresign(ctx, sessionId) {
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    try {
      const session = await ctx.ikaClient.getPresign(sessionId);
      const state = session.state?.$kind || 'unknown';
      console.log(`  Poll ${i+1}: state=${state}`);
      
      if (state === 'Completed') {
        console.log('✅ Presign COMPLETED!');
        const savedState = loadState();
        savedState.presignCompleted = true;
        savedState.presignData = session;
        saveState(savedState);
        
        // Continue to phase 2
        await phase2();
        return;
      } else if (state === 'Failed' || state === 'Rejected') {
        console.error(`❌ Presign ${state}`);
        process.exit(1);
      }
    } catch (e) {
      console.log(`  Poll ${i+1}: error=${e.message?.slice(0, 50)}`);
    }
  }
  console.log('⚠️  Presign not completed after 150s. Run --phase2 later.');
}

// ========== PHASE 2: Sign with completed presign ==========
async function phase2() {
  console.log('\n========== PHASE 2: Sign Message ==========\n');
  const savedState = loadState();
  
  if (!savedState.presignCapId) {
    console.error('No presign cap ID in state. Run phase1 first.');
    process.exit(1);
  }

  const ctx = await setup();

  // Fetch objects
  const dWallet = await retryRpc(() => ctx.ikaClient.getDWallet(DWALLET_ID), 'getDWallet');
  console.log(`dWallet state: ${dWallet.state?.$kind}`);

  const encShare = await retryRpc(() => ctx.ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID), 'getEncShare');
  console.log(`Encrypted share: ${encShare.state?.$kind}`);

  // Get presign session if we have it
  let presign = null;
  if (savedState.presignSessionId) {
    presign = await retryRpc(() => ctx.ikaClient.getPresign(savedState.presignSessionId), 'getPresign');
    console.log(`Presign session state: ${presign.state?.$kind}`);
    if (presign.state?.$kind !== 'Completed') {
      console.error('Presign not completed yet. Wait and retry.');
      process.exit(1);
    }
  }

  const tx = new Transaction();
  tx.setSender(ctx.address);
  tx.setGasBudget(500_000_000);

  const ikaTx = new IkaTransaction({ 
    ikaClient: ctx.ikaClient, 
    transaction: tx, 
    userShareEncryptionKeys: ctx.userShareKeys 
  });

  const ikaCoinObj = tx.object(ctx.ikaCoins.data[0].coinObjectId);

  // Verify presign cap
  console.log('Verifying presign cap...');
  const verifiedPresignCap = ikaTx.verifyPresignCap({
    presign,
    unverifiedPresignCap: savedState.presignCapId,
  });

  // Approve message
  console.log('Approving message...');
  const messageApproval = ikaTx.approveMessage({
    dWalletCap: DWALLET_CAP,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    hashScheme: Hash.SHA512,
    message: Array.from(TEST_MESSAGE),
  });

  // Request sign
  console.log('Requesting sign...');
  const signResult = await ikaTx.requestSign({
    dWallet,
    messageApproval,
    hashScheme: Hash.SHA512,
    verifiedPresignCap,
    presign,
    encryptedUserSecretKeyShare: encShare,
    message: Array.from(TEST_MESSAGE),
    signatureScheme: SignatureAlgorithm.EdDSA,
    ikaCoin: ikaCoinObj,
    suiCoin: tx.gas,
  });

  console.log('Sign result:', signResult);

  // Execute
  console.log('Executing sign transaction...');
  const result = await executeTx(ctx.suiClient, ctx.suiKeypair, tx);

  console.log(`TX: ${result.digest}`);
  console.log(`Status: ${result.effects?.status?.status}`);

  if (result.effects?.status?.status === 'failure') {
    console.error(`Error: ${result.effects?.status?.error}`);
    process.exit(1);
  }

  // Look for signature in events/objects
  const events = result.events || [];
  console.log(`Events: ${events.length}`);
  for (const evt of events) {
    console.log(`  ${evt.type?.split('::').pop()}`);
    if (evt.parsedJson) console.log(`    ${JSON.stringify(evt.parsedJson).slice(0, 200)}`);
  }

  const created = result.objectChanges?.filter(o => o.type === 'created') || [];
  console.log(`Created: ${created.length}`);
  for (const obj of created) {
    console.log(`  ${obj.objectId} type=${obj.objectType?.split('::').pop()}`);
  }

  // Poll for signature completion
  let signSessionId = null;
  for (const obj of created) {
    if (obj.objectType?.includes('SignSession') || obj.objectType?.includes('PartialUserSignature')) {
      signSessionId = obj.objectId;
    }
  }

  if (signSessionId) {
    console.log(`\nPolling sign session ${signSessionId}...`);
    for (let i = 0; i < 30; i++) {
      await sleep(5000);
      try {
        const signSession = await ctx.ikaClient.getSignOutput(signSessionId);
        const state = signSession.state?.$kind || 'unknown';
        console.log(`  Poll ${i+1}: state=${state}`);
        
        if (state === 'Completed') {
          console.log('\n🎉🎉🎉 SIGNATURE COMPLETED! 🎉🎉🎉');
          console.log('Signature:', JSON.stringify(signSession.state?.Completed)?.slice(0, 200));
          
          saveState({ ...savedState, signature: signSession.state?.Completed, phase: 'done' });
          return;
        }
      } catch (e) {
        console.log(`  Poll ${i+1}: ${e.message?.slice(0, 50)}`);
      }
    }
  }

  console.log('\n✅ Sign transaction submitted. Check for completion.');
}

// Main
const args = process.argv.slice(2);
if (args.includes('--phase2')) {
  phase2().catch(e => { console.error(e); process.exit(1); });
} else {
  phase1().catch(e => { console.error(e); process.exit(1); });
}
