#!/usr/bin/env node
/**
 * Ika-chan PROPER E2E v2: Fresh dWallet, real NFT seal, full cross-chain flow.
 * 
 * Step 1: Seal Ika-chan NFT on Sui (register_seal_native) — transfers NFT to dWallet address
 * Step 2: Sign seal hash with IKA dWallet (2PC-MPC Ed25519)
 * Step 3: Register collection on Solana
 * Step 4: Verify seal on Solana (Ed25519 precompile)
 * Step 5: Mint reborn NFT on Solana (Metaplex Core)
 * Step 6: Mark reborn on Sui (close the loop)
 */
import { 
  IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, 
  IkaTransaction, SignatureAlgorithm, Hash, publicKeyFromDWalletOutput
} from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { 
  Connection, PublicKey, Transaction as SolanaTx, TransactionInstruction, 
  SystemProgram, Keypair, Ed25519Program, sendAndConfirmTransaction 
} from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { blake2b } from '@noble/hashes/blake2b';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const SOLANA_RPC = 'https://api.devnet.solana.com';

// Sui contracts
const TENSEI_PKG = '0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e';
const SEAL_REGISTRY = '0xffa3bb04b8cdb11c905900da846cc92f70049654b2d9661269c8ba73c3e71294';
const SEAL_VAULT = '0x0fccb85175e9f0a0ad99e445bdde187be2a2967d73b0402cb4ca147c5273b9a0';
const NFT_PKG = '0xfd39b11f25362af7b8655d98190d285b889f35d81b9367b1ddaa822bb3412fe7';
const MINT_CAP = '0x32f426c0105b223f284d790b80a07b7a4196fc6544efa4c4c88fa7ec710a96da';
const IKACHAN_NFT_TYPE = `${NFT_PKG}::ika_nft::IkaNFT`;

// NEW dWallet (fresh, Active, never sealed)
const DW = JSON.parse(readFileSync('/tmp/new-dwallet.json', 'utf8'));
const DWALLET_ID = DW.dwalletId;
const DWALLET_CAP = DW.dwalletCapId;
const ENCRYPTED_SHARE_ID = DW.encryptedShareId;
const DWALLET_PUBKEY_HEX = DW.pubkeyHex;

// Solana
const SOLANA_PROGRAM = new PublicKey('mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa');
const MPL_CORE = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

// Walrus
const WALRUS_IMAGE_URL = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/9ASBu9iTnkUun3LV6OKP-VdryWoobvNicoMqVLH4ajY';
const WALRUS_METADATA_URL = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/Udr8c44HpNM9XzWLqVmfbGcUMrp_u8r0SaTIUSaF5xU';

// Constants
const CHAIN_SUI = 2, CHAIN_SOLANA = 3;
const NFT_NAME = 'Ika-chan Reborn #2';
const NFT_DESC = 'Cross-chain reincarnation via IKA dWallet 2PC-MPC. いかちゃん最強！🦑';
const COLLECTION_NAME = 'Ika Tensei Genesis';

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = {
  step: (n, m) => console.log(`\n${'═'.repeat(60)}\n  STEP ${n}: ${m}\n${'═'.repeat(60)}`),
  info: m => console.log(`  ℹ  ${m}`),
  ok: m => console.log(`  ✅ ${m}`),
  err: m => console.error(`  ❌ ${m}`),
  link: (l, u) => console.log(`  🔗 ${l}: ${u}`),
};

async function retry(fn, label, max = 12) {
  for (let i = 0; i < max; i++) {
    try { return await fn(); } 
    catch (e) { 
      if (i < max - 1 && e.message?.match(/429|rate|fetch failed|ECONNRESET/i)) {
        await sleep(3000 * (i + 1));
      } else throw e;
    }
  }
}

function anchorDisc(name) {
  return createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

function computeSealHash(srcChain, contract, tokenId, attestPub, nonce) {
  // Must match Sui contract's compute_seal_hash exactly:
  // source_chain_id(u16 BE) + dest_chain_id(u16 BE=0x0003) + 
  // contract_len(u8) + contract + token_id_len(u8) + token_id +
  // attestation_pubkey(32) + nonce(u64 BE)
  const destChain = 3; // Solana
  const buf = Buffer.alloc(2 + 2 + 1 + contract.length + 1 + tokenId.length + 32 + 8);
  let off = 0;
  buf.writeUInt16BE(srcChain, off); off += 2;
  buf.writeUInt16BE(destChain, off); off += 2;
  buf.writeUInt8(contract.length, off); off += 1;
  contract.copy(buf, off); off += contract.length;
  buf.writeUInt8(tokenId.length, off); off += 1;
  tokenId.copy(buf, off); off += tokenId.length;
  Buffer.from(attestPub).copy(buf, off); off += 32;
  buf.writeBigUInt64BE(BigInt(nonce), off);
  return createHash('sha256').update(buf).digest();
}

// State file for resume
const STATE_FILE = '/tmp/e2e-proper-v2-state.json';
let S = {};
function save() { writeFileSync(STATE_FILE, JSON.stringify(S, null, 2)); }

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  try { S = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { S = {}; }

  console.log('\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN PROPER E2E v2');
  console.log('  Fresh dWallet → Seal → Sign → Solana Reborn');
  console.log('█'.repeat(60));

  // ── Setup ──
  const ks = JSON.parse(readFileSync(homedir() + '/.sui/sui_config/sui.keystore', 'utf8'));
  const kb = Buffer.from(ks[0], 'base64');
  const suiKp = Ed25519Keypair.fromSecretKey(kb.slice(1));
  const addr = suiKp.getPublicKey().toSuiAddress();
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaCfg = getNetworkConfig('testnet');
  const ikaClient = new IkaClient({ suiClient, config: ikaCfg });
  await retry(() => ikaClient.initialize(), 'ika');
  const ikaType = `${ikaCfg.packages.ikaPackage}::ika::IKA`;
  const seed = Uint8Array.from(kb.slice(1, 33));
  const userKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  const solKd = JSON.parse(readFileSync(homedir() + '/.config/solana/id.json', 'utf8'));
  const solKp = Keypair.fromSecretKey(Buffer.from(solKd));
  const solConn = new Connection(SOLANA_RPC, 'confirmed');

  const attestPub = Buffer.from(DWALLET_PUBKEY_HEX, 'hex');
  const nonce = S.nonce || Date.now();
  S.nonce = nonce;
  const sourceContract = Buffer.from(NFT_PKG.replace('0x', ''), 'hex');
  const tokenId = Buffer.alloc(8);
  tokenId.writeBigUInt64BE(2n); // NFT #2
  const sealHash = computeSealHash(CHAIN_SUI, sourceContract, tokenId, attestPub, nonce);
  S.sealHash = sealHash.toString('hex');

  // dWallet Sui address = blake2b-256(0x00 || pubkey)
  const dwalletSuiAddr = '0x' + Buffer.from(blake2b(Buffer.concat([Buffer.from([0x00]), attestPub]), { dkLen: 32 })).toString('hex');

  log.info(`Seal hash: ${S.sealHash}`);
  log.info(`Sui: ${addr}`);
  log.info(`Sol: ${solKp.publicKey.toBase58()}`);
  log.info(`dWallet: ${DWALLET_ID}`);
  log.info(`dWallet pubkey: ${DWALLET_PUBKEY_HEX}`);
  log.info(`dWallet Sui addr: ${dwalletSuiAddr}`);
  save();

  // ═══════════════════════════════════════════════════════════
  // STEP 0: Mint a FRESH Ika-chan NFT #2
  // ═══════════════════════════════════════════════════════════
  let nftId = S.nftId;
  if (!nftId) {
    log.step(0, 'Mint fresh Ika-chan NFT #2');
    const tx0 = new Transaction();
    tx0.setSender(addr);
    tx0.setGasBudget(50_000_000);
    tx0.moveCall({
      target: `${NFT_PKG}::ika_nft::mint_and_transfer`,
      arguments: [
        tx0.object(MINT_CAP),
        tx0.pure.string(NFT_NAME),
        tx0.pure.string(NFT_DESC),
        tx0.pure.string(WALRUS_IMAGE_URL),
        tx0.pure.string('Cross-chain reincarnation test'),
        tx0.pure.string(COLLECTION_NAME),
        tx0.pure.u64(2),
        tx0.pure.address(addr),
      ],
    });
    const txB0 = await tx0.build({ client: suiClient });
    const sig0 = await suiKp.signTransaction(txB0);
    const res0 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sig0.bytes, signature: sig0.signature,
      options: { showEffects: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'mint');
    if (res0.effects?.status?.status === 'failure') throw new Error('Mint failed: ' + res0.effects?.status?.error);
    for (const o of (res0.objectChanges || [])) {
      if (o.type === 'created' && o.objectType?.includes('IkaNFT')) nftId = o.objectId;
    }
    S.nftId = nftId;
    S.mintTx = res0.digest;
    log.ok(`Minted: ${nftId}`);
    log.link('TX', `https://suiscan.xyz/testnet/tx/${res0.digest}`);
    save();
  } else {
    log.step(0, `NFT already minted: ${nftId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Seal NFT on Sui (register_seal_native<IkaNFT>)
  // ═══════════════════════════════════════════════════════════
  if (!S.sealTx) {
    log.step(1, 'Seal Ika-chan NFT on Sui');
    const tx1 = new Transaction();
    tx1.setSender(addr);
    tx1.setGasBudget(100_000_000);
    tx1.moveCall({
      target: `${TENSEI_PKG}::registry::register_seal_native`,
      typeArguments: [IKACHAN_NFT_TYPE],
      arguments: [
        tx1.object(SEAL_REGISTRY),
        tx1.object(SEAL_VAULT),
        tx1.object(nftId),
        tx1.pure.id(DWALLET_ID),
        tx1.pure.id(DWALLET_CAP),
        tx1.pure.id(DWALLET_ID),      // attestation = same (Ed25519)
        tx1.pure.id(DWALLET_CAP),     // attestation cap = same
        tx1.pure.vector('u8', Array.from(attestPub)),
        tx1.pure.vector('u8', Array.from(attestPub)),
        tx1.pure.address(dwalletSuiAddr),
        tx1.pure.vector('u8', Array.from(sourceContract)),
        tx1.pure.vector('u8', Array.from(tokenId)),
        tx1.pure.u64(nonce),
        tx1.pure.vector('u8', Array.from(Buffer.from(NFT_NAME))),
        tx1.pure.vector('u8', Array.from(Buffer.from(NFT_DESC))),
        tx1.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_URL))),
        tx1.pure.vector('u8', Array.from(Buffer.from('Udr8c44HpNM9XzWLqVmfbGcUMrp_u8r0SaTIUSaF5xU'))),
        tx1.pure.vector('u8', Array.from(Buffer.from('9ASBu9iTnkUun3LV6OKP-VdryWoobvNicoMqVLH4ajY'))),
        tx1.pure.vector('u8', Array.from(Buffer.from(COLLECTION_NAME))),
      ],
    });
    const txB1 = await tx1.build({ client: suiClient });
    const sig1 = await suiKp.signTransaction(txB1);
    const res1 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sig1.bytes, signature: sig1.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'seal');
    if (res1.effects?.status?.status === 'failure') throw new Error('Seal failed: ' + res1.effects?.status?.error);
    S.sealTx = res1.digest;
    log.ok(`SEALED: ${res1.digest}`);
    log.link('TX', `https://suiscan.xyz/testnet/tx/${res1.digest}`);
    for (const e of (res1.events || [])) {
      if (e.type?.includes('NFTSealed')) {
        log.ok('NFTSealed event emitted');
        if (e.parsedJson?.seal_hash) log.info(`Event seal_hash: ${Buffer.from(e.parsedJson.seal_hash).toString('hex').slice(0,20)}...`);
      }
    }
    save();
  } else {
    log.step(1, `Seal cached: ${S.sealTx}`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Sign with IKA dWallet (2PC-MPC Ed25519)
  // ═══════════════════════════════════════════════════════════
  if (!S.signatureHex) {
    log.step(2, 'IKA dWallet signing (2PC-MPC Ed25519)');

    // TX1: Presign
    log.info('Presign request...');
    const encKey = await retry(() => ikaClient.getLatestNetworkEncryptionKey(), 'ek');
    const coins = await retry(() => suiClient.getCoins({ owner: addr, coinType: ikaType }), 'coins');
    
    const txP = new Transaction(); txP.setSender(addr); txP.setGasBudget(100_000_000);
    const ikaTxP = new IkaTransaction({ ikaClient, transaction: txP, userShareEncryptionKeys: userKeys });
    const upc = ikaTxP.requestGlobalPresign({
      dwalletNetworkEncryptionKeyId: encKey.id,
      curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      ikaCoin: txP.object(coins.data[0].coinObjectId),
      suiCoin: txP.gas,
    });
    txP.transferObjects([upc], addr);
    
    const txBP = await txP.build({ client: suiClient });
    const sigP = await suiKp.signTransaction(txBP);
    const resP = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sigP.bytes, signature: sigP.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'presign');
    if (resP.effects?.status?.status === 'failure') throw new Error('Presign: ' + resP.effects?.status?.error);
    S.presignTx = resP.digest;
    log.ok(`Presign: ${resP.digest}`);
    
    let pcId = null, psId = null;
    for (const o of (resP.objectChanges || [])) {
      if (o.type === 'created') {
        const t = o.objectType?.split('::').pop() || '';
        if (t.includes('UnverifiedPresignCap')) pcId = o.objectId;
        if (t.includes('PresignSession')) psId = o.objectId;
      }
    }
    for (const e of (resP.events || [])) {
      if (e.parsedJson?.presign_session_id) psId = e.parsedJson.presign_session_id;
    }
    log.info(`PresignCap: ${pcId}, Session: ${psId}`);

    // Poll presign completion
    log.info('Polling presign MPC...');
    let pObj = null;
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      try {
        pObj = await ikaClient.getPresign(psId);
        if (pObj.state?.$kind === 'Completed') {
          log.ok(`Presign complete (${(i+1)*3}s)`);
          break;
        }
        if (i % 10 === 0) log.info(`  Poll ${i+1}: ${pObj.state?.$kind || '?'}`);
      } catch (e) {
        if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0, 40)}`);
      }
    }
    if (!pObj || pObj.state?.$kind !== 'Completed') throw new Error('Presign timeout');

    // TX2: Sign
    log.info('Signing...');
    const dw = await retry(() => ikaClient.getDWallet(DWALLET_ID), 'dw');
    
    // Need public_output from dWallet for getDWallet to return proper state
    // Get it from on-chain
    const dwObj = await retry(() => suiClient.getObject({ id: DWALLET_ID, options: { showContent: true } }), 'dwObj');
    const dwPO = dwObj.data?.content?.fields?.state?.fields?.public_output;
    if (dwPO) dw.publicOutput = Uint8Array.from(dwPO);
    
    const es = await retry(() => ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID), 'es');
    const coins2 = await retry(() => suiClient.getCoins({ owner: addr, coinType: ikaType }), 'c2');
    
    const txS = new Transaction(); txS.setSender(addr); txS.setGasBudget(100_000_000);
    const ikaTxS = new IkaTransaction({ ikaClient, transaction: txS, userShareEncryptionKeys: userKeys });
    const vpc = ikaTxS.verifyPresignCap({ presign: pObj, unverifiedPresignCap: pcId });
    const ma = ikaTxS.approveMessage({
      dWalletCap: DWALLET_CAP,
      curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      hashScheme: Hash.SHA512,
      message: Array.from(sealHash),
    });
    await ikaTxS.requestSign({
      dWallet: dw,
      messageApproval: ma,
      hashScheme: Hash.SHA512,
      verifiedPresignCap: vpc,
      presign: pObj,
      encryptedUserSecretKeyShare: es,
      message: Array.from(sealHash),
      signatureScheme: SignatureAlgorithm.EdDSA,
      ikaCoin: txS.object(coins2.data[0].coinObjectId),
      suiCoin: txS.gas,
    });
    
    const txBS = await txS.build({ client: suiClient });
    const sigS = await suiKp.signTransaction(txBS);
    const resS = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sigS.bytes, signature: sigS.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'sign');
    if (resS.effects?.status?.status === 'failure') throw new Error('Sign: ' + resS.effects?.status?.error);
    S.signTx = resS.digest;
    log.ok(`Sign TX: ${resS.digest}`);

    // Find SignSession
    let ssId = null;
    for (const o of (resS.objectChanges || [])) {
      if (o.type === 'created') {
        const t = o.objectType?.split('::').pop() || '';
        if (t.includes('SignSession')) ssId = o.objectId;
      }
    }
    for (const e of (resS.events || [])) {
      if (e.parsedJson?.sign_session_id) ssId = e.parsedJson.sign_session_id;
    }

    // Poll for signature
    log.info('Polling for MPC signature...');
    let sigBytes = null;
    for (let i = 0; i < 80; i++) {
      await sleep(3000);
      if (ssId) {
        try {
          const obj = await retry(() => suiClient.getObject({ id: ssId, options: { showContent: true } }), 'ss');
          const f = obj.data?.content?.fields;
          if (f) {
            const st = f.state;
            const k = st?.variant || st?.$kind || '';
            if (k === 'Completed' || k === 'Signed') {
              const s = st?.fields?.signature || f.signature;
              if (s && Array.isArray(s) && s.length >= 64) {
                sigBytes = Buffer.from(s);
                log.ok(`Signature: ${sigBytes.toString('hex').slice(0, 32)}... (${s.length}B)`);
                break;
              }
            }
            if (f.output) {
              try {
                const oo = await retry(() => suiClient.getObject({ id: f.output, options: { showContent: true } }), 'so');
                const ff = oo.data?.content?.fields;
                if (ff?.signature && Array.isArray(ff.signature) && ff.signature.length >= 64) {
                  sigBytes = Buffer.from(ff.signature);
                  log.ok(`Sig from output: ${sigBytes.toString('hex').slice(0, 32)}...`);
                  break;
                }
              } catch {}
            }
            if (i % 5 === 0) log.info(`  Poll ${i+1}: ${k || JSON.stringify(st).slice(0, 50)}`);
          }
        } catch (e) {
          if (i % 10 === 0) log.info(`  Poll ${i+1}: ${e.message?.slice(0, 50)}`);
        }
      }

      // Fallback: check owned SignOutput objects
      if (i > 0 && i % 15 === 0) {
        try {
          const sigPkg = ikaCfg.packages.ikaPackage;
          const owned = await retry(() => suiClient.getOwnedObjects({
            owner: addr, options: { showContent: true, showType: true },
          }), 'owned');
          for (const o of (owned.data || [])) {
            const ff = o.data?.content?.fields;
            if (ff?.signature && Array.isArray(ff.signature) && ff.signature.length >= 64) {
              sigBytes = Buffer.from(ff.signature);
              log.ok(`Found signature in owned objects`);
              break;
            }
          }
          if (sigBytes) break;
        } catch {}
      }
    }

    if (sigBytes) {
      S.signatureHex = sigBytes.toString('hex');
    } else {
      log.err('Signature not retrieved. Check Sui explorer.');
    }
    save();
  } else {
    log.step(2, `Signature cached: ${S.signatureHex?.slice(0, 32)}...`);
  }

  if (!S.signatureHex) { log.err('No signature. Cannot continue.'); return; }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Solana — Register Collection
  // ═══════════════════════════════════════════════════════════
  const srcChainLE = Buffer.alloc(2);
  srcChainLE.writeUInt16LE(CHAIN_SUI);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('ika_config')], SOLANA_PROGRAM);
  const [collPda] = PublicKey.findProgramAddressSync([Buffer.from('collection'), srcChainLE, sourceContract], SOLANA_PROGRAM);
  const [recordPda] = PublicKey.findProgramAddressSync([Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM);
  const [mintAuth] = PublicKey.findProgramAddressSync([Buffer.from('reincarnation_mint'), sealHash], SOLANA_PROGRAM);

  if (!S.solRegTx) {
    log.step(3, 'Solana: Register Collection');
    const collInfo = await solConn.getAccountInfo(collPda);
    if (!collInfo) {
      const nameB = Buffer.from(COLLECTION_NAME);
      const data = Buffer.concat([
        anchorDisc('register_collection'), srcChainLE,
        Buffer.from([sourceContract.length, 0, 0, 0]), sourceContract,
        Buffer.from([nameB.length, 0, 0, 0]), nameB,
        Buffer.alloc(8), // royalty
      ]);
      const ix = new TransactionInstruction({
        programId: SOLANA_PROGRAM,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: collPda, isSigner: false, isWritable: true },
          { pubkey: solKp.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(ix), [solKp]);
      S.solRegTx = sig;
      log.ok(`Collection: ${sig}`);
    } else {
      S.solRegTx = 'exists';
      log.ok('Collection already exists');
    }
    save();
  } else {
    log.step(3, 'Collection cached');
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Solana — Verify Seal (Ed25519 Precompile)
  // ═══════════════════════════════════════════════════════════
  if (!S.solVerifyTx) {
    log.step(4, 'Solana: Verify Seal');
    const recInfo = await solConn.getAccountInfo(recordPda);
    if (!recInfo) {
      const sigBuf = Buffer.from(S.signatureHex, 'hex');
      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: attestPub, message: sealHash, signature: sigBuf,
      });
      const aPub = new PublicKey(attestPub);
      const vData = Buffer.concat([
        anchorDisc('verify_seal'), sealHash, srcChainLE,
        Buffer.from([sourceContract.length, 0, 0, 0]), sourceContract,
        Buffer.from([tokenId.length, 0, 0, 0]), tokenId,
        aPub.toBuffer(), solKp.publicKey.toBuffer(),
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
      const sig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(ed25519Ix).add(vIx), [solKp]);
      S.solVerifyTx = sig;
      log.ok(`Verified: ${sig}`);
      log.link('Solscan', `https://solscan.io/tx/${sig}?cluster=devnet`);
    } else {
      S.solVerifyTx = 'exists';
      log.ok('Already verified');
    }
    save();
  } else {
    log.step(4, 'Verify cached');
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Solana — Mint Reborn (Metaplex Core)
  // ═══════════════════════════════════════════════════════════
  if (!S.solMintTx) {
    log.step(5, 'Solana: Mint Reborn NFT');
    const assetKp = Keypair.generate();
    const nameB = Buffer.from(NFT_NAME);
    const uriB = Buffer.from(WALRUS_METADATA_URL);
    const mData = Buffer.concat([
      anchorDisc('mint_reborn'), sealHash,
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
    const sig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(mIx), [solKp, assetKp]);
    S.solMintTx = sig;
    S.solAssetId = assetKp.publicKey.toBase58();
    log.ok(`🎉 REBORN: ${S.solAssetId}`);
    log.link('Solscan (Mint)', `https://solscan.io/tx/${sig}?cluster=devnet`);
    log.link('Solscan (NFT)', `https://solscan.io/token/${S.solAssetId}?cluster=devnet`);
    save();
  } else {
    log.step(5, `Mint cached: ${S.solAssetId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 6: Mark Reborn on Sui
  // ═══════════════════════════════════════════════════════════
  if (S.solAssetId && !S.markRebornTx) {
    log.step(6, 'Mark Reborn on Sui');
    const mintPub = new PublicKey(S.solAssetId);
    const tx6 = new Transaction(); tx6.setSender(addr); tx6.setGasBudget(50_000_000);
    tx6.moveCall({
      target: `${TENSEI_PKG}::registry::mark_reborn`,
      arguments: [
        tx6.object(SEAL_REGISTRY),
        tx6.pure.vector('u8', Array.from(sealHash)),
        tx6.pure.vector('u8', Array.from(mintPub.toBytes())),
      ],
    });
    const txB6 = await tx6.build({ client: suiClient });
    const sig6 = await suiKp.signTransaction(txB6);
    const res6 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sig6.bytes, signature: sig6.signature,
      options: { showEffects: true, showEvents: true },
      requestType: 'WaitForLocalExecution',
    }), 'mark');
    if (res6.effects?.status?.status !== 'failure') {
      S.markRebornTx = res6.digest;
      log.ok(`Marked: ${res6.digest}`);
      log.link('TX', `https://suiscan.xyz/testnet/tx/${res6.digest}`);
    } else {
      log.err(`mark_reborn: ${res6.effects?.status?.error}`);
    }
    save();
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN E2E v2 COMPLETE');
  console.log('█'.repeat(60));
  console.log(`
  🔷 SUI TESTNET:
     NFT (sealed):    https://suiscan.xyz/testnet/object/${S.nftId}
     Seal TX:         https://suiscan.xyz/testnet/tx/${S.sealTx}
     dWallet:         https://suiscan.xyz/testnet/object/${DWALLET_ID}
     ${S.markRebornTx ? 'Mark Reborn TX:  https://suiscan.xyz/testnet/tx/' + S.markRebornTx : ''}

  🔐 IKA 2PC-MPC:
     Presign TX:      https://suiscan.xyz/testnet/tx/${S.presignTx || 'N/A'}
     Sign TX:         https://suiscan.xyz/testnet/tx/${S.signTx || 'N/A'}
     Signature:       ${S.signatureHex?.slice(0, 40) || 'N/A'}...

  🟣 SOLANA DEVNET:
     Program:         https://solscan.io/account/${SOLANA_PROGRAM}?cluster=devnet
     Verify TX:       ${S.solVerifyTx ? 'https://solscan.io/tx/' + S.solVerifyTx + '?cluster=devnet' : 'N/A'}
     Mint TX:         ${S.solMintTx ? 'https://solscan.io/tx/' + S.solMintTx + '?cluster=devnet' : 'N/A'}
     Reborn NFT:      ${S.solAssetId ? 'https://solscan.io/token/' + S.solAssetId + '?cluster=devnet' : 'N/A'}

  📊 SEAL:
     Hash:    ${S.sealHash}
     Flow:    Mint → Seal → dWallet Sign → Ed25519 Verify → Metaplex Mint → Mark Reborn
  `);
}

main().catch(e => { log.err(e.message); console.error(e.stack?.split('\n').slice(0, 5).join('\n')); process.exit(1); });
