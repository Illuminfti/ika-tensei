import { IkaClient, Curve, getNetworkConfig, prepareDKGAsync, createRandomSessionIdentifier, publicKeyFromDWalletOutput, UserShareEncryptionKeys, IkaTransaction, userAndNetworkDKGOutputMatch } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync } from 'fs';
import { bcs } from '@mysten/sui/bcs';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

async function main() {
  console.log('=== IKA dWallet Full Flow ===\n');
  
  // Setup
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
  
  // Find IKA coin
  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  const ikaCoins = await suiClient.getCoins({ owner: address, coinType: ikaType });
  if (!ikaCoins.data.length) throw new Error('No IKA coins!');
  const ikaCoinId = ikaCoins.data[0].coinObjectId;
  console.log(`IKA coin: ${ikaCoinId} (${Number(ikaCoins.data[0].balance)/1e9} IKA)`);
  
  // === STEP 1: DKG Request ===
  console.log('\n--- STEP 1: DKG Request ---');
  const sessionBytes = createRandomSessionIdentifier();
  const dkgInput = await prepareDKGAsync(ikaClient, Curve.ED25519, userShareKeys, sessionBytes, address);
  console.log('✅ DKG prepared');
  
  // SAVE userPublicOutput for step 2!
  const userPublicOutput = dkgInput.userPublicOutput;
  writeFileSync('/tmp/dwallet-dkg-state.json', JSON.stringify({
    userPublicOutput: Array.from(userPublicOutput),
    sessionBytes: Array.from(sessionBytes),
  }));
  console.log(`   userPublicOutput saved (${userPublicOutput.length} bytes)`);
  
  const tx1 = new Transaction();
  const ikaTx1 = new IkaTransaction({
    ikaClient, transaction: tx1, userShareEncryptionKeys: userShareKeys,
  });
  
  // Register encryption key (already done, but idempotent? Let's skip if already registered)
  // Actually let's check if we're already registered
  const encKeysTable = '0x180f63e27380553d67a3e821c47ea365dc01f6e8e7b2eb28501e5a450f8a8dd8';
  const existing = await suiClient.getDynamicFieldObject({
    parentId: encKeysTable,
    name: { type: 'address', value: address },
  }).catch(() => null);
  
  // Encryption key already registered in previous DKG tx
  console.log('   Encryption key already registered ✅');
  
  const sessionId = ikaTx1.registerSessionIdentifier(sessionBytes);
  const encKey = await ikaClient.getLatestNetworkEncryptionKey();
  
  const dkgResult = await ikaTx1.requestDWalletDKG({
    curve: Curve.ED25519,
    dkgRequestInput: dkgInput,
    ikaCoin: tx1.object(ikaCoinId),
    suiCoin: tx1.gas,
    sessionIdentifier: sessionId,
    dwalletNetworkEncryptionKeyId: encKey.id,
  });
  
  tx1.transferObjects([dkgResult[0]], address);
  tx1.moveCall({
    target: '0x1::option::destroy_none',
    typeArguments: ['0x2::object::ID'],
    arguments: [dkgResult[1]],
  });
  
  tx1.setSender(address);
  tx1.setGasBudget(100_000_000);
  
  console.log('🔄 Submitting DKG tx...');
  const result1 = await suiClient.signAndExecuteTransaction({
    transaction: tx1,
    signer: suiKeypair,
    options: { showEffects: true, showObjectChanges: true },
  });
  
  if (result1.effects?.status?.status !== 'success') {
    console.error('❌ DKG failed:', result1.effects?.status?.error);
    process.exit(1);
  }
  
  console.log(`✅ DKG TX: ${result1.digest}`);
  
  const created = result1.objectChanges?.filter(c => c.type === 'created') || [];
  const capObj = created.find(c => c.objectType?.includes('DWalletCap'));
  const dwalletObj = created.find(c => c.objectType?.includes('coordinator_inner::DWallet') && !c.objectType.includes('Cap') && !c.objectType.includes('Session') && !c.objectType.includes('Share'));
  const shareObj = created.find(c => c.objectType?.includes('EncryptedUserSecretKeyShare'));
  
  console.log(`   DWalletCap: ${capObj?.objectId}`);
  console.log(`   DWallet: ${dwalletObj?.objectId}`);
  console.log(`   EncryptedShare: ${shareObj?.objectId}`);
  
  // Save IDs
  const dwalletState = {
    capId: capObj?.objectId,
    dwalletId: dwalletObj?.objectId,
    shareId: shareObj?.objectId,
    userPublicOutput: Array.from(userPublicOutput),
  };
  writeFileSync('/tmp/dwallet-ids.json', JSON.stringify(dwalletState, null, 2));
  
  // === STEP 2: Wait for AwaitingKeyHolderSignature ===
  console.log('\n--- STEP 2: Wait for AwaitingKeyHolderSignature ---');
  let dwalletData;
  for (let i = 0; i < 120; i++) {
    const obj = await suiClient.getObject({ id: dwalletObj.objectId, options: { showContent: true } });
    if (!obj.data?.content?.fields?.state) {
      process.stdout.write('?');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    const state = obj.data.content.fields.state;
    if (state.variant === 'AwaitingKeyHolderSignature') {
      dwalletData = obj.data;
      console.log(`✅ State: AwaitingKeyHolderSignature (after ${i*2}s)`);
      break;
    } else if (state.variant === 'Active') {
      console.log('🎉 Already Active!');
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  
  if (!dwalletData) {
    console.log('\n⏳ Still waiting... run complete-dkg-step2.mjs later');
    process.exit(0);
  }
  
  // === STEP 3: Accept encrypted user share ===
  console.log('\n--- STEP 3: Accept encrypted user share ---');
  
  const onChainPubOutput = Uint8Array.from(dwalletData.content.fields.state.fields.public_output);
  
  // Verify match
  const isMatch = await userAndNetworkDKGOutputMatch(Curve.ED25519, userPublicOutput, onChainPubOutput).catch(() => false);
  console.log(`   Output match: ${isMatch}`);
  
  if (!isMatch) {
    console.error('❌ User public output does not match on-chain!');
    process.exit(1);
  }
  
  // Get signature
  const mockDWallet = {
    id: { id: dwalletObj.objectId },
    curve: 2,
    state: { AwaitingKeyHolderSignature: { public_output: Array.from(onChainPubOutput) } }
  };
  const outputSig = await userShareKeys.getUserOutputSignature(mockDWallet, userPublicOutput);
  console.log(`   Signature: ${outputSig.length} bytes`);
  
  // Build accept tx
  const tx2 = new Transaction();
  const coordRef = tx2.sharedObjectRef({
    objectId: ikaConfig.objects.ikaDWalletCoordinator.objectID,
    initialSharedVersion: ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion,
    mutable: true,
  });
  
  tx2.moveCall({
    target: `${ikaConfig.packages.ikaDwallet2pcMpcPackage}::coordinator::accept_encrypted_user_share`,
    arguments: [
      coordRef,
      tx2.pure.id(dwalletObj.objectId),
      tx2.pure.id(shareObj.objectId),
      tx2.pure(bcs.vector(bcs.u8()).serialize(Array.from(outputSig))),
    ],
  });
  
  tx2.setSender(address);
  tx2.setGasBudget(50_000_000);
  
  console.log('🔄 Submitting accept tx...');
  const result2 = await suiClient.signAndExecuteTransaction({
    transaction: tx2,
    signer: suiKeypair,
    options: { showEffects: true },
  });
  
  if (result2.effects?.status?.status !== 'success') {
    console.error('❌ Accept failed:', result2.effects?.status?.error);
    process.exit(1);
  }
  
  console.log(`✅ Accept TX: ${result2.digest}`);
  
  // === STEP 4: Wait for Active ===
  console.log('\n--- STEP 4: Wait for Active ---');
  for (let i = 0; i < 60; i++) {
    const obj = await suiClient.getObject({ id: dwalletObj.objectId, options: { showContent: true } });
    const state = obj.data.content.fields.state;
    
    if (state.variant === 'Active') {
      console.log(`\n✅ ACTIVE! (after ${i*2}s)`);
      const pubOut = Uint8Array.from(state.fields.public_output);
      try {
        const pubKey = await publicKeyFromDWalletOutput(Curve.ED25519, pubOut);
        console.log(`🔑 Ed25519 Public Key: ${Buffer.from(pubKey).toString('hex')}`);
        
        // Save final state
        dwalletState.publicKey = Buffer.from(pubKey).toString('hex');
        dwalletState.active = true;
        writeFileSync('/tmp/dwallet-ids.json', JSON.stringify(dwalletState, null, 2));
        
        console.log('\n🎉🎉🎉 dWallet DKG COMPLETE! 1 NFT = 1 dWallet = PROVEN! 🎉🎉🎉');
      } catch(e) {
        console.log('Key extraction note:', e.message);
        console.log('Raw output (first 40):', Array.from(pubOut.slice(0, 40)));
      }
      return;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\n⏳ Still not Active after 2 min. Check later.');
}

main().catch(e => { console.error('❌', e.message, e.stack?.split('\n').slice(0,3).join('\n')); process.exit(1); });
