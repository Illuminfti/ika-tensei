/**
 * dWallet Signing Test v2 - Minimal approach
 * 
 * Flow:
 * 1. Request a global presign (if not already done)
 * 2. Wait for presign completion
 * 3. Build sign TX: verifyPresignCap + approveMessage + requestSign
 * 4. Execute and wait for signature
 */

import { IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, IkaTransaction, SignatureAlgorithm, Hash } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';

// Test message = a simulated seal hash
const TEST_MESSAGE = createHash('sha256').update('ika-tensei-seal-test-v1').digest();
console.log(`Test message (seal hash): ${TEST_MESSAGE.toString('hex')}`);

async function main() {
  const ikaConfig = getNetworkConfig('testnet');
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await ikaClient.initialize();

  const keystore = JSON.parse(readFileSync(process.env.HOME + '/.sui/sui_config/sui.keystore', 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const address = suiKeypair.getPublicKey().toSuiAddress();
  console.log(`Address: ${address}`);
  
  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  
  // IKA coin
  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  const ikaCoins = await suiClient.getCoins({ owner: address, coinType: ikaType });
  const ikaCoinId = ikaCoins.data[0].coinObjectId;
  console.log(`IKA coin: ${ikaCoinId}`);

  // ===== STEP 1: Request Global Presign =====
  console.log('\n--- Step 1: Request Global Presign ---');
  
  const tx1 = new Transaction();
  tx1.setSender(address);
  tx1.setGasBudget(100_000_000);
  
  const ikaTx1 = new IkaTransaction({ ikaClient, transaction: tx1, userShareEncryptionKeys: userShareKeys });
  
  // Get the network encryption key (retry on rate limit)
  let encKey;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      encKey = await ikaClient.getLatestNetworkEncryptionKey();
      break;
    } catch (e) {
      console.log(`   Retry ${attempt+1}/5: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  if (!encKey) throw new Error('Failed to get encryption key after 5 retries');
  console.log(`   Network enc key: ${encKey.id}`);
  
  // For EdDSA (Ed25519), use requestGlobalPresign
  const presignResult = ikaTx1.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: encKey.id,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    curve: Curve.ED25519,
    ikaCoin: tx1.object(ikaCoinId),
    suiCoin: tx1.gas,
  });
  
  // presignResult is UnverifiedPresignCap - need to transfer it to ourselves
  tx1.transferObjects([presignResult], address);
  
  console.log('🔄 Submitting presign request...');
  const result1 = await suiClient.signAndExecuteTransaction({
    transaction: tx1,
    signer: suiKeypair,
    options: { showEffects: true, showObjectChanges: true },
  });
  
  if (result1.effects?.status?.status !== 'success') {
    console.error('❌ Presign request failed:', result1.effects?.status?.error);
    process.exit(1);
  }
  
  console.log(`✅ Presign TX: ${result1.digest}`);
  
  // Find UnverifiedPresignCap
  const created = result1.objectChanges?.filter(c => c.type === 'created') || [];
  const presignCapObj = created.find(c => c.objectType?.includes('UnverifiedPresignCap'));
  const presignSessionObj = created.find(c => c.objectType?.includes('PresignSession'));
  
  if (!presignCapObj) {
    console.log('Created objects:', created.map(c => c.objectType));
    console.error('❌ No UnverifiedPresignCap found');
    process.exit(1);
  }
  
  console.log(`   UnverifiedPresignCap: ${presignCapObj.objectId}`);
  console.log(`   PresignSession: ${presignSessionObj?.objectId || 'N/A'}`);
  
  // ===== STEP 2: Wait for Presign Completion =====
  console.log('\n--- Step 2: Wait for Presign Completion ---');
  
  if (presignSessionObj) {
    for (let i = 0; i < 60; i++) {
      const obj = await suiClient.getObject({ id: presignSessionObj.objectId, options: { showContent: true } });
      const state = obj.data?.content?.fields?.state;
      if (state?.variant === 'Completed') {
        console.log(`✅ Presign completed (${i*3}s)`);
        break;
      }
      if (i === 59) {
        console.log('⏳ Presign still pending, continuing anyway...');
      }
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // ===== STEP 3: Verify Presign + Approve + Sign =====
  console.log('\n--- Step 3: Sign Message ---');
  
  // Need the dWallet and encrypted share as SDK objects
  // Since the SDK BCS parser can't handle Active state (enum 8), we need to construct mock objects
  // But requestSign internally calls decryptAndVerifySecretShare which needs proper BCS-parseable objects
  
  // Alternative: Use the raw coordinator move calls directly
  // Step 3a: verify_presign_cap
  // Step 3b: approve_message  
  // Step 3c: requestSign (this needs WASM computation, can't be done via raw calls)
  
  // The SDK's IkaTransaction.sign() method handles everything but needs proper SDK objects
  // Let's try the high-level sign method
  
  // First, get dWallet state from chain
  const dwRaw = await suiClient.getObject({ id: DWALLET_ID, options: { showContent: true } });
  const dwFields = dwRaw.data.content.fields;
  const publicOutput = dwFields.state.fields.public_output;
  
  // Get encrypted share state
  const shareRaw = await suiClient.getObject({ id: ENCRYPTED_SHARE_ID, options: { showContent: true } });
  const shareFields = shareRaw.data.content.fields;
  
  // Get presign state (if completed)
  let presignData = null;
  if (presignSessionObj) {
    const presignRaw = await suiClient.getObject({ id: presignSessionObj.objectId, options: { showContent: true } });
    presignData = presignRaw.data.content.fields;
  }
  
  // Construct SDK-compatible objects
  const dWalletObj = {
    id: { id: DWALLET_ID },
    curve: dwFields.curve,
    is_imported_key_dwallet: dwFields.is_imported_key_dwallet,
    public_user_secret_key_share: dwFields.public_user_secret_key_share,
    state: { Active: { public_output: publicOutput } },
    dwallet_cap_id: dwFields.dwallet_cap_id,
    dwallet_network_encryption_key_id: dwFields.dwallet_network_encryption_key_id,
    encrypted_user_secret_key_shares: dwFields.encrypted_user_secret_key_shares,
    sign_sessions: dwFields.sign_sessions,
    created_at_epoch: dwFields.created_at_epoch,
  };
  
  const encShareObj = {
    id: { id: ENCRYPTED_SHARE_ID },
    dwallet_id: shareFields.dwallet_id,
    encrypted_centralized_secret_share_and_proof: shareFields.encrypted_centralized_secret_share_and_proof,
    encryption_key_address: shareFields.encryption_key_address,
    encryption_key_id: shareFields.encryption_key_id,
    source_encrypted_user_secret_key_share_id: shareFields.source_encrypted_user_secret_key_share_id,
    state: { 
      KeyHolderSigned: { 
        user_output_signature: shareFields.state.fields.user_output_signature 
      }
    },
    created_at_epoch: shareFields.created_at_epoch,
  };
  
  console.log(`   dWallet public_output: ${publicOutput.length} bytes`);
  console.log(`   encShare state: KeyHolderSigned, sig: ${shareFields.state.fields.user_output_signature?.length} bytes`);
  
  // Build sign TX
  const tx2 = new Transaction();
  tx2.setSender(address);
  tx2.setGasBudget(150_000_000);
  
  // Get fresh IKA coin
  const ikaCoins2 = await suiClient.getCoins({ owner: address, coinType: ikaType });
  const ikaCoinId2 = ikaCoins2.data[0].coinObjectId;
  
  const ikaTx2 = new IkaTransaction({ ikaClient, transaction: tx2, userShareEncryptionKeys: userShareKeys });
  
  // Verify presign cap
  const verifiedPresign = ikaTx2.verifyPresignCap({ unverifiedPresignCap: presignCapObj.objectId });
  console.log('   ✅ verifyPresignCap');
  
  // Approve message (DWalletCap required)
  const approval = ikaTx2.approveMessage({
    dWalletCap: DWALLET_CAP,
    curve: Curve.ED25519,
    hashScheme: Hash.SHA512,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    message: Array.from(TEST_MESSAGE),
  });
  console.log('   ✅ approveMessage');
  
  // Request sign - this does WASM computation internally
  try {
    const signResult = await ikaTx2.requestSign({
      dWallet: dWalletObj,
      verifiedPresignCap: verifiedPresign,
      messageApproval: approval,
      message: Array.from(TEST_MESSAGE),
      hashScheme: Hash.SHA512,
      signatureScheme: SignatureAlgorithm.EdDSA,
      encryptedUserSecretKeyShare: encShareObj,
      presign: presignData ? {
        id: { id: presignSessionObj.objectId },
        curve: presignData.curve,
        signature_algorithm: presignData.signature_algorithm,
        state: { Completed: { presign: presignData.state.fields.presign } },
      } : undefined,
      ikaCoin: tx2.object(ikaCoinId2),
      suiCoin: tx2.gas,
    });
    console.log('   ✅ requestSign built');
    
    // Execute
    console.log('🔄 Submitting sign TX...');
    const result2 = await suiClient.signAndExecuteTransaction({
      transaction: tx2,
      signer: suiKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    
    if (result2.effects?.status?.status !== 'success') {
      console.error('❌ Sign TX failed:', result2.effects?.status?.error);
    } else {
      console.log(`✅ Sign TX: ${result2.digest}`);
      
      // Find the sign session
      const signCreated = result2.objectChanges?.filter(c => c.type === 'created') || [];
      const signSession = signCreated.find(c => c.objectType?.includes('SignSession'));
      console.log(`   SignSession: ${signSession?.objectId}`);
      
      // Wait for signature
      if (signSession) {
        console.log('🔄 Waiting for signature...');
        for (let i = 0; i < 60; i++) {
          const obj = await suiClient.getObject({ id: signSession.objectId, options: { showContent: true } });
          const state = obj.data?.content?.fields?.state;
          if (state?.variant === 'Completed' || state?.variant === 'Signed') {
            console.log(`\n✅ SIGNATURE RECEIVED!`);
            const sig = state.fields?.signature || state.fields?.output;
            if (sig) {
              console.log(`🔑 Signature: ${Buffer.from(sig).toString('hex')}`);
            }
            writeFileSync('/tmp/dwallet-sign-result.json', JSON.stringify({
              success: true,
              signTx: result2.digest,
              signSessionId: signSession.objectId,
              signature: sig ? Buffer.from(sig).toString('hex') : null,
            }, null, 2));
            console.log('\n🎉 dWallet SIGNING PROVEN! Ed25519 signature from 2PC-MPC!');
            return;
          }
          process.stdout.write('.');
          await new Promise(r => setTimeout(r, 3000));
        }
        console.log('\n⏳ Signature still pending...');
      }
    }
  } catch (e) {
    console.error('❌ Sign error:', e.message);
    console.error('   Stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
    
    writeFileSync('/tmp/dwallet-sign-result.json', JSON.stringify({
      success: false,
      error: e.message,
      timestamp: new Date().toISOString(),
    }, null, 2));
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
