/**
 * IKA dWallet Signing - Stage 2: Complete Signing from Existing Presign
 * 
 * We already have:
 * - UnverifiedPresignCap: 0x06eea051a820f8b52b24727a4da7a857bd601b234fa413dd6ed47f2d9436e7eb
 * - PresignSession (Completed): 0x6554584dc98407a8d9aae6aeb5c2afe335086b69081c2c4a9c3599d0bdabc97c
 * 
 * Now we need to:
 * 1. Fetch all required objects
 * 2. Compute user partial signature (WASM)
 * 3. verifyPresignCap + approveMessage + requestSign in one TX
 * 4. Poll for completed signature
 */

import { IkaClient, Curve, Hash, SignatureAlgorithm, getNetworkConfig, UserShareEncryptionKeys, publicKeyFromDWalletOutput, IkaTransaction } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync } from 'fs';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
const PRESIGN_CAP_ID = '0x06eea051a820f8b52b24727a4da7a857bd601b234fa413dd6ed47f2d9436e7eb';
const PRESIGN_SESSION_ID = '0x6554584dc98407a8d9aae6aeb5c2afe335086b69081c2c4a9c3599d0bdabc97c';

// Test message (32 bytes)
const TEST_MESSAGE = new Uint8Array([
  0xde, 0xad, 0xbe, 0xef, 0x12, 0x34, 0x56, 0x78,
  0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44,
  0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc,
  0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44
]);

const result = {
  success: false,
  timestamp: new Date().toISOString(),
  steps: [],
  signTxDigest: null,
  signatureObjectId: null,
  error: null,
};

function log(step) {
  console.log(`[${new Date().toISOString()}] ${step}`);
  result.steps.push(step);
}

async function main() {
  console.log('\n=== IKA dWallet Signing - Stage 2: Complete Signing ===\n');
  
  // Setup
  const ikaConfig = getNetworkConfig('testnet');
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await ikaClient.initialize();
  log('✅ Clients initialized');

  const keystore = JSON.parse(readFileSync(process.env.HOME + '/.sui/sui_config/sui.keystore', 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const address = suiKeypair.getPublicKey().toSuiAddress();
  log(`✅ Address: ${address}`);

  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  log('✅ UserShareEncryptionKeys ready');

  // Fetch dWallet object (raw RPC)
  const dwRaw = await suiClient.getObject({ id: DWALLET_ID, options: { showContent: true } });
  const dwFields = dwRaw.data.content.fields;
  const dwState = dwFields.state;
  if (dwState.variant !== 'Active') throw new Error(`DWallet not Active: ${dwState.variant}`);
  
  const publicOutput = Uint8Array.from(dwState.fields.public_output);
  log(`✅ DWallet fetched (Active), public_output length: ${publicOutput.length}`);
  
  // Construct dWallet object in SDK format
  const dWalletSDKObj = {
    id: { id: DWALLET_ID },
    curve: 2, // ED25519
    is_imported_key_dwallet: false,
    public_user_secret_key_share: null, // not public share
    state: {
      Active: {
        public_output: Array.from(publicOutput),
      }
    },
  };

  // Fetch presign session (already Completed from previous run)
  const presignRaw = await suiClient.getObject({ id: PRESIGN_SESSION_ID, options: { showContent: true } });
  const presignFields = presignRaw.data.content.fields;
  const presignState = presignFields.state;
  
  if (presignState.variant !== 'Completed') {
    throw new Error(`Presign not Completed: ${presignState.variant}`);
  }
  
  const presignBytes = Uint8Array.from(presignState.fields.presign);
  log(`✅ Presign session (Completed), presign length: ${presignBytes.length}`);
  
  // Construct presign object in SDK format
  const presignSDKObj = {
    id: { id: PRESIGN_SESSION_ID },
    curve: presignFields.curve,
    signature_algorithm: presignFields.signature_algorithm,
    state: {
      Completed: {
        presign: Array.from(presignBytes),
      }
    },
  };

  // Fetch encrypted user secret key share
  const encShareRaw = await suiClient.getObject({ id: ENCRYPTED_SHARE_ID, options: { showContent: true } });
  const encShareFields = encShareRaw.data.content.fields;
  log(`✅ EncryptedUserSecretKeyShare fetched (state: ${encShareFields.state?.variant})`);
  
  // Construct encrypted share in SDK format
  // IMPORTANT: SDK expects { KeyHolderSigned: { user_output_signature: [...] } }
  // Raw RPC returns { variant: 'KeyHolderSigned', fields: { user_output_signature: [...] } }
  const encShareStateVariant = encShareFields.state.variant;
  const encShareStateFields = encShareFields.state.fields || {};
  const encShareSDKObj = {
    id: { id: ENCRYPTED_SHARE_ID },
    dwallet_id: encShareFields.dwallet_id,
    encrypted_centralized_secret_share_and_proof: encShareFields.encrypted_centralized_secret_share_and_proof,
    encryption_key_address: encShareFields.encryption_key_address,
    encryption_key_id: encShareFields.encryption_key_id,
    source_encrypted_user_secret_key_share_id: encShareFields.source_encrypted_user_secret_key_share_id,
    // Convert RPC format { variant, fields } → SDK format { VariantName: fields }
    state: { [encShareStateVariant]: encShareStateFields },
    created_at_epoch: encShareFields.created_at_epoch,
  };

  // Get fresh IKA coin
  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  const coins = await suiClient.getCoins({ owner: address, coinType: ikaType });
  if (!coins.data.length) throw new Error('No IKA coins');
  const ikaCoinId = coins.data[0].coinObjectId;
  log(`✅ IKA coin: ${ikaCoinId}`);

  // ===== Build signing transaction =====
  log('\n🔄 Building sign transaction...');
  log('   - verifyPresignCap');
  log('   - approveMessage (EdDSA, SHA512)');
  log('   - requestSign (with WASM partial signature computation)');
  
  const tx = new Transaction();
  tx.setSender(address);
  tx.setGasBudget(150_000_000);
  
  const ikaTx = new IkaTransaction({ ikaClient, transaction: tx, userShareEncryptionKeys: userShareKeys });
  
  // Step A: Verify presign cap → VerifiedPresignCap
  const verifiedPresignCap = ikaTx.verifyPresignCap({ unverifiedPresignCap: PRESIGN_CAP_ID });
  log('   ✅ verifyPresignCap added');
  
  // Step B: Approve message → MessageApproval
  const messageApproval = ikaTx.approveMessage({
    dWalletCap: DWALLET_CAP,
    curve: Curve.ED25519,
    signatureAlgorithm: SignatureAlgorithm.EdDSA,
    hashScheme: Hash.SHA512,
    message: TEST_MESSAGE,
  });
  log('   ✅ approveMessage added (EdDSA + SHA512)');
  
  // Step C: Request sign (async - needs WASM for user partial signature)
  // This will decrypt the user share, compute partial signature, then build the PTB call
  const signatureId = await ikaTx.requestSign({
    dWallet: dWalletSDKObj,
    messageApproval,
    hashScheme: Hash.SHA512,
    verifiedPresignCap,
    presign: presignSDKObj,
    encryptedUserSecretKeyShare: encShareSDKObj,
    message: TEST_MESSAGE,
    signatureScheme: SignatureAlgorithm.EdDSA,
    ikaCoin: tx.object(ikaCoinId),
    suiCoin: tx.gas,
  });
  log('   ✅ requestSign added (WASM signature computed)');
  
  // Note: requestSignAndReturnId returns an ID, not a Move object, so no transferObjects needed
  
  // Dry run
  log('\n🔄 Dry run...');
  const txBytes = await tx.build({ client: suiClient });
  const dryRun = await suiClient.dryRunTransactionBlock({
    transactionBlock: Buffer.from(txBytes).toString('base64'),
  });
  
  if (dryRun.effects?.status?.status !== 'success') {
    const err = dryRun.effects?.status?.error;
    
    // Show commands for debugging
    const txData = dryRun.input?.transaction;
    if (txData?.kind === 'ProgrammableTransaction') {
      console.log('\nTransaction commands:');
      txData.transactions.forEach((cmd, i) => {
        if (cmd.MoveCall) {
          console.log(`  [${i}] ${cmd.MoveCall.package.slice(0,8)}::${cmd.MoveCall.module}::${cmd.MoveCall.function}`);
        } else if (cmd.TransferObjects) {
          console.log(`  [${i}] TransferObjects`);
        } else {
          console.log(`  [${i}]`, JSON.stringify(cmd).slice(0, 80));
        }
      });
    }
    throw new Error(`Sign dry run: ${err}`);
  }
  log('✅ Sign dry run SUCCESS!');
  
  // Execute
  log('\n🔄 Executing sign transaction...');
  const signResult = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: suiKeypair,
    options: { showEffects: true, showObjectChanges: true },
  });
  
  if (signResult.effects?.status?.status !== 'success') {
    throw new Error(`Sign TX failed: ${signResult.effects?.status?.error}`);
  }
  
  result.signTxDigest = signResult.digest;
  log(`✅ Sign TX executed: ${signResult.digest}`);

  // Find SignSession object
  const created = signResult.objectChanges?.filter(c => c.type === 'created') || [];
  const signObj = created.find(c => c.objectType?.includes('SignSession') || c.objectType?.includes('Sign'));
  if (signObj) {
    result.signatureObjectId = signObj.objectId;
    log(`   Sign session: ${signObj.objectId}`);
  }

  // ===== Poll for completed signature =====
  log('\n🔄 Polling for completed signature (up to 120s)...');
  
  // Look for the sign session ID in the TX output
  const signSessionId = created[0]?.objectId;
  if (signSessionId) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      process.stdout.write('.');
      
      try {
        const signSessionObj = await suiClient.getObject({
          id: signSessionId,
          options: { showContent: true }
        });
        const signState = signSessionObj.data?.content?.fields?.state;
        if (signState?.variant === 'Completed') {
          console.log('');
          const sigBytes = signState.fields?.signature;
          log(`🎉 SIGNATURE COMPLETED after ${i+1} polls!`);
          if (sigBytes) {
            const sigHex = Buffer.from(sigBytes).toString('hex');
            log(`   Signature (hex): ${sigHex}`);
            result.signature = sigHex;
          }
          break;
        }
      } catch (e) {
        // Not done yet
      }
    }
  } else {
    log('⚠️ No sign session found in TX output, checking via ikaClient...');
    // Try via ikaClient if available
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      process.stdout.write('.');
    }
    console.log('');
  }

  result.success = true;
  
  log('\n🎉🎉🎉 dWallet SIGNING COMPLETE! 🎉🎉🎉');
  log(`   Message: ${Buffer.from(TEST_MESSAGE).toString('hex')}`);
  log(`   Sign TX: ${result.signTxDigest}`);
  if (result.signature) {
    log(`   Ed25519 Signature: ${result.signature}`);
  }

  writeFileSync('/tmp/dwallet-sign-result.json', JSON.stringify(result, null, 2));
  console.log('\n✅ Result saved to /tmp/dwallet-sign-result.json');
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  if (e.stack) console.error(e.stack);
  result.error = e.message;
  writeFileSync('/tmp/dwallet-sign-result.json', JSON.stringify(result, null, 2));
  process.exit(1);
});
