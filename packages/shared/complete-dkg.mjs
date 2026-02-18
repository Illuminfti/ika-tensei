#!/usr/bin/env node
/**
 * Complete DKG: accept encrypted user share after network verification.
 * dWallet state: AwaitingKeyHolderSignature -> Active
 */
import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn,m=12){for(let i=0;i<m;i++){try{return await fn();}catch(e){if(i<m-1)await sleep(3000*(i+1));else throw e;}}}

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

// From create-dwallet output
const DWALLET_STATE = JSON.parse(readFileSync('/tmp/new-dwallet.json','utf8'));
const DWALLET_ID = DWALLET_STATE.dwalletId;
const DWALLET_CAP_ID = DWALLET_STATE.dwalletCapId;
const ENC_SHARE_ID = DWALLET_STATE.encryptedShareId;

async function main() {
  const ks = JSON.parse(readFileSync(homedir()+'/.sui/sui_config/sui.keystore','utf8'));
  const kb = Buffer.from(ks[0],'base64');
  const kp = Ed25519Keypair.fromSecretKey(kb.slice(1));
  const addr = kp.getPublicKey().toSuiAddress();
  const suiClient = new SuiClient({ url: SUI_RPC });
  const cfg = getNetworkConfig('testnet');
  const ika = new IkaClient({ suiClient, config: cfg });
  await retry(() => ika.initialize());
  const seed = Uint8Array.from(kb.slice(1,33));
  const keys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);

  console.log('dWallet:', DWALLET_ID);
  console.log('EncShare:', ENC_SHARE_ID);

  // Get dWallet state
  const dw = await retry(() => ika.getDWallet(DWALLET_ID));
  const state = dw.state?.$kind || dw.state?.variant || '';
  console.log('State:', state);
  
  if (state !== 'AwaitingKeyHolderSignature') {
    console.log('Not in AwaitingKeyHolderSignature state, checking pubkey...');
    if (dw.pubkey && dw.pubkey.length > 0) {
      const pk = Buffer.from(dw.pubkey).toString('hex');
      console.log('Pubkey:', pk);
      DWALLET_STATE.pubkeyHex = pk;
      writeFileSync('/tmp/new-dwallet.json', JSON.stringify(DWALLET_STATE, null, 2));
    }
    return;
  }

  // We need the userPublicOutput from the DKG step
  // It was returned by prepareDKGAsync but we didn't save it...
  // However, the SDK's acceptEncryptedUserShare can reconstruct it from the dWallet object
  // Let's use the IkaTransaction.acceptEncryptedUserShare method
  
  const tx = new Transaction();
  tx.setSender(addr);
  tx.setGasBudget(500_000_000);
  const ikaTx = new IkaTransaction({ ikaClient: ika, transaction: tx, userShareEncryptionKeys: keys });
  
  // Get the encrypted share object
  const encShare = await retry(() => suiClient.getObject({ id: ENC_SHARE_ID, options: { showContent: true } }));
  console.log('EncShare fields:', Object.keys(encShare.data?.content?.fields || {}));
  
  // Use the EXACT userPublicOutput saved from prepareDKGAsync
  if (!DWALLET_STATE.userPublicOutputHex) {
    throw new Error('Missing userPublicOutputHex in state file - re-run create-dwallet.mjs');
  }
  const publicOutput = Buffer.from(DWALLET_STATE.userPublicOutputHex, 'hex');
  console.log('User public output length:', publicOutput.length);

  // Call acceptEncryptedUserShare
  await ikaTx.acceptEncryptedUserShare({
    dWallet: dw,
    userPublicOutput: Uint8Array.from(publicOutput),
    encryptedUserSecretKeyShareId: ENC_SHARE_ID,
  });
  
  const txB = await tx.build({ client: suiClient });
  const sig = await kp.signTransaction(txB);
  const res = await retry(() => suiClient.executeTransactionBlock({
    transactionBlock: sig.bytes, signature: sig.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }));
  
  console.log('Accept TX:', res.digest);
  if (res.effects?.status?.status === 'failure') throw new Error('Accept failed: ' + res.effects?.status?.error);
  
  // Poll for Active state
  console.log('Polling for Active state...');
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    try {
      const dw2 = await retry(() => ika.getDWallet(DWALLET_ID));
      const st = dw2.state?.$kind || dw2.state?.variant || '';
      if (dw2.pubkey && dw2.pubkey.length > 0 && st !== 'AwaitingKeyHolderSignature') {
        const pk = Buffer.from(dw2.pubkey).toString('hex');
        if (pk !== '0'.repeat(64)) {
          console.log(`✅ dWallet ACTIVE! (${(i+1)*3}s)`);
          console.log('Ed25519 Pubkey:', pk);
          DWALLET_STATE.pubkeyHex = pk;
          writeFileSync('/tmp/new-dwallet.json', JSON.stringify(DWALLET_STATE, null, 2));
          return;
        }
      }
      if (i % 5 === 0) console.log(`  Poll ${i+1}: ${st}`);
    } catch (e) {
      if (i % 5 === 0) console.log(`  Poll ${i+1}: ${e.message?.slice(0,50)}`);
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.stack?.split('\n').slice(0,5).join('\n')); process.exit(1); });
