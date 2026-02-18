import { IkaClient, Curve, getNetworkConfig, prepareDKGAsync, createRandomSessionIdentifier, publicKeyFromDWalletOutput, UserShareEncryptionKeys, IkaTransaction } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync } from 'fs';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

async function main() {
  console.log('=== IKA dWallet DKG Live Test ===\n');
  
  const ikaConfig = getNetworkConfig('testnet');
  console.log('✅ IKA testnet config loaded');
  console.log('   coordinator:', ikaConfig.objects.ikaDWalletCoordinator.objectID);
  console.log('   initialSharedVersion:', ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion);
  
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await ikaClient.initialize();
  console.log('✅ IKA client initialized');
  
  // Load keypair
  const keystore = JSON.parse(readFileSync(process.env.HOME + '/.sui/sui_config/sui.keystore', 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const address = suiKeypair.getPublicKey().toSuiAddress();
  console.log(`✅ Keypair: ${address}`);
  
  // User share encryption keys
  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  console.log('✅ Encryption keys ready');
  
  // Prepare DKG
  console.log('\n🔄 prepareDKGAsync...');
  const sessionBytes = createRandomSessionIdentifier();
  const dkgInput = await prepareDKGAsync(ikaClient, Curve.ED25519, userShareKeys, sessionBytes, address);
  console.log('✅ DKG input prepared');
  
  // Find IKA coin
  const ikaType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  const ikaCoins = await suiClient.getCoins({ owner: address, coinType: ikaType });
  if (!ikaCoins.data.length) throw new Error('No IKA coins!');
  const ikaCoinId = ikaCoins.data[0].coinObjectId;
  console.log(`   IKA coin: ${ikaCoinId}`);
  
  // Build TX using IkaTransaction
  const tx = new Transaction();
  const ikaTx = new IkaTransaction({
    ikaClient, transaction: tx, userShareEncryptionKeys: userShareKeys,
  });
  
  // Register user encryption key first (required before DKG)
  await ikaTx.registerEncryptionKey({ curve: Curve.ED25519 });
  console.log('✅ User encryption key registered in TX');
  
  const sessionId = ikaTx.registerSessionIdentifier(sessionBytes);
  const encKey = await ikaClient.getLatestNetworkEncryptionKey();
  console.log(`   Enc key: ${encKey.id}`);
  
  // DKG request
  const dkgResult = await ikaTx.requestDWalletDKG({
    curve: Curve.ED25519,
    dkgRequestInput: dkgInput,
    ikaCoin: tx.object(ikaCoinId),
    suiCoin: tx.gas,
    sessionIdentifier: sessionId,
    dwalletNetworkEncryptionKeyId: encKey.id,
  });
  
  // Transfer DWalletCap and destroy Option<ID>
  tx.transferObjects([dkgResult[0]], address);
  tx.moveCall({
    target: '0x1::option::destroy_none',
    typeArguments: ['0x2::object::ID'],
    arguments: [dkgResult[1]],
  });
  
  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  
  // Inspect the PTB before submitting
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: false });
  console.log(`   TX bytes: ${txBytes.length}`);
  
  // Dry run first
  console.log('🔄 Dry run...');
  const dryRun = await suiClient.dryRunTransactionBlock({
    transactionBlock: Buffer.from(txBytes).toString('base64'),
  });
  
  if (dryRun.effects?.status?.status !== 'success') {
    console.error('❌ Dry run failed:', dryRun.effects?.status?.error);
    
    // Log the transaction commands for debugging
    const txData = dryRun.input?.transaction;
    if (txData?.kind === 'ProgrammableTransaction') {
      console.log('\nTransaction commands:');
      txData.transactions.forEach((cmd, i) => {
        if (cmd.MoveCall) {
          console.log(`  [${i}] MoveCall: ${cmd.MoveCall.package}::${cmd.MoveCall.module}::${cmd.MoveCall.function}`);
          console.log(`       args: ${JSON.stringify(cmd.MoveCall.arguments)}`);
        } else {
          console.log(`  [${i}]`, JSON.stringify(cmd).slice(0, 200));
        }
      });
    }
    process.exit(1);
  }
  
  console.log('✅ Dry run SUCCESS!');
  
  // Execute
  console.log('🔄 Executing...');
  const txResult = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: suiKeypair,
    options: { showEffects: true, showObjectChanges: true },
  });
  
  console.log(`✅ TX: ${txResult.digest}`);
  
  const created = txResult.objectChanges?.filter(c => c.type === 'created') || [];
  console.log(`   Created objects: ${created.length}`);
  created.forEach(c => console.log(`   - ${c.objectType}: ${c.objectId}`));
  
  const capObj = created.find(c => c.objectType?.includes('DWalletCap'));
  if (capObj) {
    console.log(`\n🎉 DWalletCap: ${capObj.objectId}`);
    console.log('🔄 Waiting for Active state (up to 2 min)...');
    
    for (let i = 0; i < 60; i++) {
      try {
        const dw = await ikaClient.getDWalletInParticularState(capObj.objectId, 'Active');
        const pubOut = Uint8Array.from(dw.state.Active.public_output);
        const pubKey = await publicKeyFromDWalletOutput(Curve.ED25519, pubOut);
        console.log(`\n🔑 Ed25519 Public Key: ${Buffer.from(pubKey).toString('hex')}`);
        console.log('🎉 dWallet DKG COMPLETE!');
        return;
      } catch {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.log('\n⏳ Still in DKG... poll later.');
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
