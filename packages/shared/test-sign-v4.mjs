/**
 * dWallet Signing Test v4 - Proper two-TX flow
 * 
 * TX1: requestGlobalPresign → get presign session + unverified cap
 * WAIT: Poll presign session until Completed
 * TX2: verifyPresignCap + approveMessage + requestSign
 * WAIT: Poll for signature output
 */

import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction, SignatureAlgorithm, Hash 
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';

const TEST_MESSAGE = createHash('sha256').update('ika-tensei-seal-test-v4').digest();

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retryRpc(fn, label, maxRetries = 8) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e) {
      if ((e.message?.includes('429') || e.message?.includes('rate') || e.message?.includes('Too Many')) && i < maxRetries - 1) {
        await sleep(3000 * (i + 1));
      } else throw e;
    }
  }
}

async function main() {
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
  const ikaCoins = await retryRpc(() => suiClient.getCoins({ owner: address, coinType: ikaType }), 'coins');
  const encKey = await retryRpc(() => ikaClient.getLatestNetworkEncryptionKey(), 'encKey');

  console.log(`Address: ${address}`);
  console.log(`Message: ${TEST_MESSAGE.toString('hex')}`);

  // ===== TX 1: Request presign =====
  console.log('\n=== TX 1: Request Global Presign ===');
  
  const tx1 = new Transaction();
  tx1.setSender(address);
  tx1.setGasBudget(500_000_000);

  const ikaTx1 = new IkaTransaction({ ikaClient, transaction: tx1, userShareEncryptionKeys: userShareKeys });
  const ikaCoin1 = tx1.object(ikaCoins.data[0].coinObjectId);
  
  const unverifiedPresignCap = ikaTx1.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: encKey.id,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    ikaCoin: ikaCoin1,
    suiCoin: tx1.gas,
  });
  tx1.transferObjects([unverifiedPresignCap], address);

  const txBytes1 = await tx1.build({ client: suiClient });
  const signed1 = await suiKeypair.signTransaction(txBytes1);
  const result1 = await retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signed1.bytes,
    signature: signed1.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }), 'tx1');

  console.log(`TX1: ${result1.digest} | Status: ${result1.effects?.status?.status}`);
  if (result1.effects?.status?.status === 'failure') {
    console.error(result1.effects?.status?.error);
    process.exit(1);
  }

  // Extract presign cap ID and presign session ID
  const objectChanges = result1.objectChanges || [];
  let presignCapId = null;
  let presignSessionId = null;

  for (const obj of objectChanges) {
    if (obj.type === 'created') {
      const shortType = obj.objectType?.split('::').pop();
      console.log(`  Created: ${obj.objectId} (${shortType})`);
      if (shortType?.includes('UnverifiedPresignCap')) presignCapId = obj.objectId;
      if (shortType?.includes('PresignSession')) presignSessionId = obj.objectId;
    }
  }

  // Also check events
  for (const evt of (result1.events || [])) {
    if (evt.parsedJson?.presign_session_id) {
      presignSessionId = evt.parsedJson.presign_session_id;
    }
  }

  console.log(`Presign Cap: ${presignCapId}`);
  console.log(`Presign Session: ${presignSessionId}`);

  if (!presignCapId) { console.error('No presign cap created!'); process.exit(1); }

  // ===== WAIT: Poll for presign completion =====
  console.log('\n=== Waiting for presign completion ===');
  
  let presignObj = null;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    try {
      presignObj = await ikaClient.getPresign(presignSessionId);
      const stateKind = presignObj.state?.$kind;
      if (i % 5 === 0 || stateKind === 'Completed') {
        console.log(`  Poll ${i+1}: ${stateKind}`);
      }
      if (stateKind === 'Completed') {
        console.log('✅ Presign completed!');
        break;
      }
    } catch (e) {
      if (e.message?.includes('deleted') || e.message?.includes('not found') || e.message?.includes('undefined')) {
        // Object might have been consumed, check raw RPC
        try {
          const rawObj = await suiClient.getObject({ id: presignSessionId, options: { showContent: true } });
          if (rawObj.error?.code === 'deleted') {
            console.log(`  Poll ${i+1}: Object deleted (may have been processed)`);
            // Try to fetch via previous version
            break;
          }
        } catch (_) {}
      }
      if (i % 5 === 0) console.log(`  Poll ${i+1}: ${e.message?.slice(0, 60)}`);
    }
  }

  if (!presignObj || presignObj.state?.$kind !== 'Completed') {
    console.error('Presign did not complete in time. The object may have been consumed.');
    console.log('Trying to proceed with TX2 anyway...');
  }

  // ===== TX 2: Sign =====
  console.log('\n=== TX 2: Verify + Approve + Sign ===');

  // Re-fetch objects (they may have changed versions)
  const dWallet = await retryRpc(() => ikaClient.getDWallet(DWALLET_ID), 'dw');
  const encShare = await retryRpc(() => ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID), 'es');
  
  // Re-fetch IKA coins (version may have changed after TX1)
  const ikaCoins2 = await retryRpc(() => suiClient.getCoins({ owner: address, coinType: ikaType }), 'coins2');
  
  console.log(`dWallet: ${dWallet.state?.$kind} | EncShare: ${encShare.state?.$kind}`);

  const tx2 = new Transaction();
  tx2.setSender(address);
  tx2.setGasBudget(500_000_000);

  const ikaTx2 = new IkaTransaction({ ikaClient, transaction: tx2, userShareEncryptionKeys: userShareKeys });
  const ikaCoin2 = tx2.object(ikaCoins2.data[0].coinObjectId);

  // Verify presign cap
  const verifiedPresignCap = ikaTx2.verifyPresignCap({
    presign: presignObj,
    unverifiedPresignCap: presignCapId,
  });

  // Approve message
  const messageApproval = ikaTx2.approveMessage({
    dWalletCap: DWALLET_CAP,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    hashScheme: Hash.SHA512,
    message: Array.from(TEST_MESSAGE),
  });

  // Request sign
  const signResult = await ikaTx2.requestSign({
    dWallet,
    messageApproval,
    hashScheme: Hash.SHA512,
    verifiedPresignCap,
    presign: presignObj,
    encryptedUserSecretKeyShare: encShare,
    message: Array.from(TEST_MESSAGE),
    signatureScheme: SignatureAlgorithm.EdDSA,
    ikaCoin: ikaCoin2,
    suiCoin: tx2.gas,
  });

  console.log('Sign instruction built successfully');

  const txBytes2 = await tx2.build({ client: suiClient });
  const signed2 = await suiKeypair.signTransaction(txBytes2);
  const result2 = await retryRpc(() => suiClient.executeTransactionBlock({
    transactionBlock: signed2.bytes,
    signature: signed2.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }), 'tx2');

  console.log(`TX2: ${result2.digest} | Status: ${result2.effects?.status?.status}`);
  
  if (result2.effects?.status?.status === 'failure') {
    console.error(`Error: ${result2.effects?.status?.error}`);
    process.exit(1);
  }

  // Show what was created
  for (const obj of (result2.objectChanges || [])) {
    if (obj.type === 'created') {
      console.log(`  Created: ${obj.objectId} (${obj.objectType?.split('::').pop()})`);
    }
  }
  for (const evt of (result2.events || [])) {
    console.log(`  Event: ${evt.type?.split('::').pop()}`);
    if (evt.parsedJson) console.log(`    ${JSON.stringify(evt.parsedJson).slice(0, 200)}`);
  }

  // ===== WAIT: Poll for signature =====
  console.log('\n=== Waiting for signature ===');
  
  // Find sign session or partial signature
  let signOutputId = null;
  for (const obj of (result2.objectChanges || [])) {
    if (obj.type === 'created') {
      const t = obj.objectType?.split('::').pop() || '';
      if (t.includes('Sign') || t.includes('Partial') || t.includes('Signature')) {
        signOutputId = obj.objectId;
        console.log(`Sign output candidate: ${obj.objectId} (${t})`);
      }
    }
  }

  if (signOutputId) {
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      try {
        const rawObj = await suiClient.getObject({ id: signOutputId, options: { showContent: true } });
        if (rawObj.data?.content?.fields) {
          const fields = rawObj.data.content.fields;
          const state = fields.state;
          if (state?.variant) {
            console.log(`  Poll ${i+1}: ${state.variant}`);
            if (state.variant === 'Completed' || state.variant === 'Signed') {
              console.log('\n🎉🎉🎉 SIGNATURE COMPLETED! 🎉🎉🎉');
              console.log('Signature data:', JSON.stringify(state.fields)?.slice(0, 300));
              return;
            }
          } else if (fields.signature) {
            console.log('\n🎉🎉🎉 SIGNATURE FOUND! 🎉🎉🎉');
            const sig = fields.signature;
            if (Array.isArray(sig)) {
              console.log(`Signature (${sig.length} bytes): ${Buffer.from(sig).toString('hex')}`);
            } else {
              console.log('Signature:', JSON.stringify(sig)?.slice(0, 200));
            }
            return;
          }
        }
      } catch (e) {
        if (i % 5 === 0) console.log(`  Poll ${i+1}: ${e.message?.slice(0, 60)}`);
      }
    }
  }

  console.log('\nSign TX submitted. Check explorer for completion.');
  console.log(`TX2 digest: ${result2.digest}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
