#!/usr/bin/env node
/**
 * Create a new Ed25519 dWallet via IKA SDK.
 * Correct flow: single TX with session registration + DKG request.
 * bytesToHash for prepareDKGAsync = same random bytes used for session.
 */
import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction, prepareDKGAsync, createRandomSessionIdentifier
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn,m=12){for(let i=0;i<m;i++){try{return await fn();}catch(e){if(i<m-1)await sleep(3000*(i+1));else throw e;}}}

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

async function main() {
  const ks = JSON.parse(readFileSync(homedir()+'/.sui/sui_config/sui.keystore','utf8'));
  const kb = Buffer.from(ks[0],'base64');
  const kp = Ed25519Keypair.fromSecretKey(kb.slice(1));
  const addr = kp.getPublicKey().toSuiAddress();
  const suiClient = new SuiClient({ url: SUI_RPC });
  const cfg = getNetworkConfig('testnet');
  const ika = new IkaClient({ suiClient, config: cfg });
  await retry(() => ika.initialize());
  const ikaType = `${cfg.packages.ikaPackage}::ika::IKA`;
  const seed = Uint8Array.from(kb.slice(1,33));
  const keys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  const encKey = await retry(() => ika.getLatestNetworkEncryptionKey());
  const coins = await retry(() => suiClient.getCoins({ owner: addr, coinType: ikaType }));
  console.log(`Addr: ${addr}, IKA coins: ${coins.data.length}`);

  // Step 1: Generate random session bytes (SAME bytes for both session registration AND prepareDKG)
  const sessionBytes = createRandomSessionIdentifier();
  console.log('Session bytes (32B):', Buffer.from(sessionBytes).toString('hex').slice(0,20) + '...');

  // Step 2: Prepare DKG crypto using these EXACT session bytes
  console.log('Preparing DKG crypto (WASM)...');
  const dkgInput = await prepareDKGAsync(ika, Curve.ED25519, keys, sessionBytes, addr);
  console.log('DKG input ready:', Object.keys(dkgInput).join(', '));
  // SAVE userPublicOutput for the second step (acceptEncryptedUserShare)
  const userPublicOutputHex = Buffer.from(dkgInput.userPublicOutput).toString('hex');

  // Step 3: Build single TX: registerSessionIdentifier + requestDWalletDKG
  console.log('Building DKG transaction...');
  const tx = new Transaction();
  tx.setSender(addr);
  tx.setGasBudget(500_000_000);
  const ikaTx = new IkaTransaction({ ikaClient: ika, transaction: tx, userShareEncryptionKeys: keys });
  
  // Register the session identifier (returns a SessionIdentifier object)
  const sessId = ikaTx.registerSessionIdentifier(sessionBytes);
  
  // Request DKG with the session identifier
  const moveCallResult = await ikaTx.requestDWalletDKG({
    dkgRequestInput: dkgInput,
    sessionIdentifier: sessId,
    dwalletNetworkEncryptionKeyId: encKey.id,
    curve: Curve.ED25519,
    ikaCoin: tx.object(coins.data[0].coinObjectId),
    suiCoin: tx.gas,
  });
  
  // Transfer DWalletCap to self (result[0])
  const resultIdx = moveCallResult?.Result;
  if (resultIdx !== undefined) {
    tx.transferObjects([{ $kind: 'NestedResult', NestedResult: [resultIdx, 0] }], addr);
  }

  // Execute
  const txB = await tx.build({ client: suiClient });
  const sig = await kp.signTransaction(txB);
  const res = await retry(() => suiClient.executeTransactionBlock({
    transactionBlock: sig.bytes, signature: sig.signature,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    requestType: 'WaitForLocalExecution',
  }));
  
  console.log('DKG TX:', res.digest);
  if (res.effects?.status?.status === 'failure') throw new Error('DKG failed: ' + res.effects?.status?.error);

  let capId = null, encShareId = null, dwalletId = null;
  for (const o of (res.objectChanges || [])) {
    if (o.type === 'created') {
      const t = o.objectType?.split('::').pop() || '';
      console.log('  Created:', t.slice(0,45), o.objectId);
      if (t.includes('DWalletCap')) capId = o.objectId;
      if (t.includes('EncryptedUserSecretKeyShare')) encShareId = o.objectId;
      if (t.includes('DWallet') && !t.includes('Cap') && !t.includes('Session') && !t.includes('Event') && !t.includes('Encrypted')) dwalletId = o.objectId;
    }
  }

  console.log('\nDKG submitted! Polling for network verification...');
  
  // Try getting dWallet ID from cap if not found in object changes
  if (!dwalletId && capId) {
    await sleep(2000);
    try {
      const capObj = await retry(() => suiClient.getObject({ id: capId, options: { showContent: true } }));
      dwalletId = capObj.data?.content?.fields?.dwallet_id;
      console.log('dWallet from cap:', dwalletId);
    } catch {}
  }

  // Poll for DKG completion
  let pubkeyHex = null;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    if (dwalletId) {
      try {
        const dw = await retry(() => ika.getDWallet(dwalletId));
        const state = dw.state?.$kind || dw.state?.variant || '';
        if (dw.pubkey && dw.pubkey.length > 0 && state !== 'AwaitingNetworkDKGVerification') {
          // Check if it's actually completed (has valid pubkey and not rejected)
          if (state === 'NetworkRejectedDKGVerification') {
            console.log('❌ NETWORK REJECTED DKG');
            break;
          }
          pubkeyHex = Buffer.from(dw.pubkey).toString('hex');
          if (pubkeyHex !== '0'.repeat(64)) {
            console.log(`✅ DKG COMPLETE (${(i+1)*3}s)`);
            console.log('Ed25519 Pubkey:', pubkeyHex);
            break;
          }
        }
        if (i % 5 === 0) console.log(`  Poll ${i+1}: ${state}`);
      } catch (e) {
        if (i % 5 === 0) console.log(`  Poll ${i+1}: ${e.message?.slice(0,50)}`);
      }
    }
  }

  const result = { dwalletId, dwalletCapId: capId, encryptedShareId: encShareId, pubkeyHex, dkgTx: res.digest, userPublicOutputHex };
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  writeFileSync('/tmp/new-dwallet.json', JSON.stringify(result, null, 2));
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.stack?.split('\n').slice(0,3).join('\n')); process.exit(1); });
