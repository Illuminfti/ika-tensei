import { IkaClient, Curve, getNetworkConfig, prepareDKGAsync, createRandomSessionIdentifier, publicKeyFromDWalletOutput, UserShareEncryptionKeys, IkaTransaction, userAndNetworkDKGOutputMatch } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync } from 'fs';
import { bcs } from '@mysten/sui/bcs';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

// DWallet #2 from create-dwallet-full.mjs
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';

async function main() {
  console.log('=== Accept dWallet Encrypted Share ===\n');
  
  const ikaConfig = getNetworkConfig('testnet');
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await ikaClient.initialize();
  
  const keystore = JSON.parse(readFileSync(process.env.HOME + '/.sui/sui_config/sui.keystore', 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
  const address = suiKeypair.getPublicKey().toSuiAddress();
  
  const seed = Uint8Array.from(keyBytes.slice(1, 33));
  const userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  
  // Load saved state
  const saved = JSON.parse(readFileSync('/tmp/dwallet-dkg-state.json', 'utf8'));
  const userPublicOutput = Uint8Array.from(saved.userPublicOutput);
  console.log(`userPublicOutput: ${userPublicOutput.length} bytes`);
  
  // Get on-chain state
  const obj = await suiClient.getObject({ id: DWALLET_ID, options: { showContent: true } });
  const state = obj.data.content.fields.state;
  console.log(`State: ${state.variant}`);
  
  if (state.variant === 'Active') {
    console.log('🎉 Already Active!');
    return;
  }
  
  if (state.variant !== 'AwaitingKeyHolderSignature') {
    console.log('Not ready yet');
    return;
  }
  
  const onChainPubOutput = Uint8Array.from(state.fields.public_output);
  console.log(`On-chain output: ${onChainPubOutput.length} bytes`);
  
  // Verify match
  const isMatch = await userAndNetworkDKGOutputMatch(Curve.ED25519, userPublicOutput, onChainPubOutput).catch(e => { console.log('Match error:', e.message); return false; });
  console.log(`Output match: ${isMatch}`);
  
  if (!isMatch) {
    console.error('❌ Mismatch! Cannot proceed.');
    return;
  }
  
  // Sign
  const mockDWallet = {
    id: { id: DWALLET_ID },
    curve: 2,
    state: { AwaitingKeyHolderSignature: { public_output: Array.from(onChainPubOutput) } }
  };
  const sig = await userShareKeys.getUserOutputSignature(mockDWallet, userPublicOutput);
  console.log(`Signature: ${sig.length} bytes`);
  
  // Submit
  const tx = new Transaction();
  const coordRef = tx.sharedObjectRef({
    objectId: ikaConfig.objects.ikaDWalletCoordinator.objectID,
    initialSharedVersion: ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion,
    mutable: true,
  });
  
  tx.moveCall({
    target: `${ikaConfig.packages.ikaDwallet2pcMpcPackage}::coordinator::accept_encrypted_user_share`,
    arguments: [
      coordRef,
      tx.pure.id(DWALLET_ID),
      tx.pure.id(SHARE_ID),
      tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(sig))),
    ],
  });
  
  tx.setSender(address);
  tx.setGasBudget(50_000_000);
  
  console.log('🔄 Submitting...');
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: suiKeypair,
    options: { showEffects: true },
  });
  
  if (result.effects?.status?.status !== 'success') {
    console.error('❌ Failed:', result.effects?.status?.error);
    return;
  }
  
  console.log(`✅ TX: ${result.digest}`);
  
  // Check final state
  await new Promise(r => setTimeout(r, 3000));
  const final = await suiClient.getObject({ id: DWALLET_ID, options: { showContent: true } });
  const finalState = final.data.content.fields.state;
  console.log(`Final state: ${finalState.variant}`);
  
  if (finalState.variant === 'Active') {
    const pubOut = Uint8Array.from(finalState.fields.public_output);
    try {
      const pubKey = await publicKeyFromDWalletOutput(Curve.ED25519, pubOut);
      console.log(`🔑 Ed25519 Public Key: ${Buffer.from(pubKey).toString('hex')}`);
      console.log('🎉🎉🎉 dWallet ACTIVE! Core thesis PROVEN! 🎉🎉🎉');
    } catch(e) {
      console.log('Key extraction:', e.message);
    }
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
