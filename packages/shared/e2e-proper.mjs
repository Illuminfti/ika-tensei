#!/usr/bin/env node
/**
 * Ika-chan PROPER E2E: Mint on Sui → Seal (transfer to dWallet) → Sign → Solana Reborn → Mark Reborn
 */
import { IkaClient, Curve, getNetworkConfig, UserShareEncryptionKeys, IkaTransaction, SignatureAlgorithm, Hash } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { Connection, PublicKey, Transaction as SolanaTx, TransactionInstruction, SystemProgram, Keypair, Ed25519Program, sendAndConfirmTransaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const SOLANA_RPC = 'https://api.devnet.solana.com';

// Sui contracts
const TENSEI_PKG = '0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e';
const SEAL_REGISTRY = '0xffa3bb04b8cdb11c905900da846cc92f70049654b2d9661269c8ba73c3e71294';
const SEAL_VAULT = '0x0fccb85175e9f0a0ad99e445bdde187be2a2967d73b0402cb4ca147c5273b9a0';
const NFT_PKG = '0xfd39b11f25362af7b8655d98190d285b889f35d81b9367b1ddaa822bb3412fe7';

// The Ika-chan NFT we just minted
const IKACHAN_NFT_ID = '0x7da043319a6b66143a41a768eb4bf59650e1fda0b9be528382c0f8a052857dfe';
const IKACHAN_NFT_TYPE = `${NFT_PKG}::ika_nft::IkaNFT`;

// IKA dWallet
const DWALLET_CAP = '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const DWALLET_ID = '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
const DWALLET_PUBKEY_HEX = '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';

// Solana
const SOLANA_PROGRAM = new PublicKey('mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa');
const MPL_CORE = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

// Walrus
const WALRUS_IMAGE_BLOB = '9ASBu9iTnkUun3LV6OKP-VdryWoobvNicoMqVLH4ajY';
const WALRUS_METADATA_BLOB = 'Udr8c44HpNM9XzWLqVmfbGcUMrp_u8r0SaTIUSaF5xU';
const WALRUS_IMAGE_URL = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_IMAGE_BLOB}`;
const WALRUS_METADATA_URL = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_METADATA_BLOB}`;

const CHAIN_SUI = 2, CHAIN_SOLANA = 3;
const NFT_NAME = 'Ika-chan NFT #1';
const NFT_DESC = 'The legendary Ika-chan reborn through cross-chain sorcery. いかちゃん最強！🦑';
const COLLECTION_NAME = 'Ika Tensei Genesis';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = {
  step: (n, m) => console.log(`\n${'═'.repeat(60)}\n  STEP ${n}: ${m}\n${'═'.repeat(60)}`),
  info: m => console.log(`  ℹ  ${m}`),
  ok: m => console.log(`  ✅ ${m}`),
  err: m => console.error(`  ❌ ${m}`),
  warn: m => console.warn(`  ⚠️  ${m}`),
  link: (l, u) => console.log(`  🔗 ${l}:\n     ${u}`),
};
async function retry(fn, label, max=12) {
  for (let i=0;i<max;i++) { try { return await fn(); } catch(e) { if(i<max-1&&(e.message?.match(/429|rate|fetch failed/))) { await sleep(3000*(i+1)); } else throw e; } }
}
function anchorDisc(n) { return createHash('sha256').update(`global:${n}`).digest().slice(0,8); }
function computeSealHash(src, dst, contract, tokenId, pub, nonce) {
  const c=Buffer.from(contract.replace('0x',''),'hex'), t=Buffer.alloc(8), n=Buffer.alloc(8);
  t.writeBigUInt64BE(BigInt(tokenId)); n.writeBigUInt64BE(BigInt(nonce));
  const b=Buffer.alloc(2+2+1+c.length+1+t.length+32+8); let o=0;
  b.writeUInt16BE(src,o);o+=2; b.writeUInt16BE(dst,o);o+=2;
  b.writeUInt8(c.length,o);o+=1; c.copy(b,o);o+=c.length;
  b.writeUInt8(t.length,o);o+=1; t.copy(b,o);o+=t.length;
  b.set(pub,o);o+=32; n.copy(b,o);
  return createHash('sha256').update(b).digest();
}

const STATE_FILE = '/tmp/ikachan-proper-state.json';
let S = {};
function save() { writeFileSync(STATE_FILE, JSON.stringify(S,null,2)); }

async function main() {
  try { S = JSON.parse(readFileSync(STATE_FILE,'utf8')); } catch { S = {}; }

  console.log('\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN PROPER E2E — THE REAL DEAL');
  console.log('  Sui NFT → dWallet Seal → IKA Sign → Solana Reborn');
  console.log('█'.repeat(60));

  // Setup
  const ks = JSON.parse(readFileSync(homedir()+'/.sui/sui_config/sui.keystore','utf8'));
  const kb = Buffer.from(ks[0],'base64');
  const suiKp = Ed25519Keypair.fromSecretKey(kb.slice(1));
  const addr = suiKp.getPublicKey().toSuiAddress();
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaCfg = getNetworkConfig('testnet');
  const ikaClient = new IkaClient({ suiClient, config: ikaCfg });
  await retry(() => ikaClient.initialize(), 'ika');
  const ikaType = `${ikaCfg.packages.ikaPackage}::ika::IKA`;
  const seed = Uint8Array.from(kb.slice(1,33));
  const userKeys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.ED25519);
  const solKd = JSON.parse(readFileSync(homedir()+'/.config/solana/id.json','utf8'));
  const solKp = Keypair.fromSecretKey(Buffer.from(solKd));
  const solConn = new Connection(SOLANA_RPC, 'confirmed');
  const attestPub = Buffer.from(DWALLET_PUBKEY_HEX,'hex');
  const nonce = S.nonce || Date.now(); S.nonce = nonce;

  // Use the NFT package as source_contract for seal hash
  const sourceContract = NFT_PKG;
  const contractBytes = Buffer.from(sourceContract.replace('0x',''),'hex');
  const tokenId = 1;
  const tokenIdBytes = Buffer.alloc(8); tokenIdBytes.writeBigUInt64BE(BigInt(tokenId));
  const sealHash = computeSealHash(CHAIN_SUI, CHAIN_SOLANA, sourceContract, tokenId, attestPub, nonce);
  S.sealHash = sealHash.toString('hex');
  log.info(`Seal hash: ${S.sealHash}`);
  log.info(`Sui: ${addr} | Sol: ${solKp.publicKey.toBase58()}`);
  save();

  // Derive dWallet's Sui address from Ed25519 pubkey
  // Sui address = BLAKE2b-256(0x00 || pubkey_bytes)[0:32]
  // But for the contract, we pass it as an address parameter
  // The dWallet's Sui address: we need to compute it from the Ed25519 public key
  // Sui Ed25519 address = SHA3-256(0x00 || pubkey)[0:32]... actually let's just compute it
  const { blake2b } = await import('@noble/hashes/blake2b');
  const dwalletSuiAddr = '0x' + Buffer.from(blake2b(Buffer.concat([Buffer.from([0x00]), attestPub]), { dkLen: 32 })).toString('hex');
  log.info(`dWallet Sui addr: ${dwalletSuiAddr}`);

  // ========================================================================
  // STEP 1: Seal Ika-chan NFT on Sui (register_seal_native<IkaNFT>)
  // Transfers NFT to dWallet's Sui address permanently
  // ========================================================================
  if (!S.sealTx) {
    log.step(1, 'Seal Ika-chan NFT on Sui (register_seal_native)');

    // First check the NFT still exists and is owned by us
    const nftObj = await retry(() => suiClient.getObject({ id: IKACHAN_NFT_ID, options: { showOwner: true, showType: true } }), 'nft');
    if (!nftObj.data) throw new Error('NFT not found!');
    log.ok(`NFT exists: ${IKACHAN_NFT_ID}`);
    log.info(`Type: ${nftObj.data.type}`);
    log.link('NFT (before seal)', `https://suiscan.xyz/testnet/object/${IKACHAN_NFT_ID}`);

    const tx = new Transaction();
    tx.setSender(addr);
    tx.setGasBudget(100_000_000);

    tx.moveCall({
      target: `${TENSEI_PKG}::registry::register_seal_native`,
      typeArguments: [IKACHAN_NFT_TYPE],
      arguments: [
        tx.object(SEAL_REGISTRY),
        tx.object(SEAL_VAULT),
        tx.object(IKACHAN_NFT_ID),                          // nft (consumed!)
        tx.pure.id(DWALLET_ID),                              // dwallet_id
        tx.pure.id(DWALLET_CAP),                             // dwallet_cap_id
        tx.pure.id(DWALLET_ID),                              // attestation_dwallet_id (same for Ed25519)
        tx.pure.id(DWALLET_CAP),                             // attestation_dwallet_cap_id
        tx.pure.vector('u8', Array.from(attestPub)),          // dwallet_pubkey
        tx.pure.vector('u8', Array.from(attestPub)),          // attestation_pubkey
        tx.pure.address(dwalletSuiAddr),                      // dwallet_sui_address
        tx.pure.vector('u8', Array.from(contractBytes)),      // source_contract
        tx.pure.vector('u8', Array.from(tokenIdBytes)),       // token_id
        tx.pure.u64(nonce),                                   // nonce
        tx.pure.vector('u8', Array.from(Buffer.from(NFT_NAME))),
        tx.pure.vector('u8', Array.from(Buffer.from(NFT_DESC))),
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_URL))),
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_METADATA_BLOB))),
        tx.pure.vector('u8', Array.from(Buffer.from(WALRUS_IMAGE_BLOB))),
        tx.pure.vector('u8', Array.from(Buffer.from(COLLECTION_NAME))),
      ],
    });

    const txB = await tx.build({ client: suiClient });
    const sig = await suiKp.signTransaction(txB);
    const res = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: sig.bytes, signature: sig.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'seal');

    if (res.effects?.status?.status === 'failure') {
      throw new Error(`Seal failed: ${res.effects?.status?.error}`);
    }

    S.sealTx = res.digest;
    log.ok(`NFT SEALED: ${res.digest}`);
    log.link('Sui (Seal TX)', `https://suiscan.xyz/testnet/tx/${res.digest}`);

    // Check events
    for (const evt of (res.events || [])) {
      if (evt.type?.includes('NFTSealed')) {
        log.ok('NFTSealed event emitted!');
        if (evt.parsedJson) {
          log.info(`  seal_hash: ${Buffer.from(evt.parsedJson.seal_hash || []).toString('hex').slice(0,20)}...`);
          log.info(`  metadata_name: ${Buffer.from(evt.parsedJson.metadata_name || []).toString()}`);
        }
      }
    }

    // Check NFT was transferred to dWallet address
    for (const oc of (res.objectChanges || [])) {
      if (oc.objectId === IKACHAN_NFT_ID) {
        log.info(`NFT owner changed: ${JSON.stringify(oc.owner || '').slice(0,80)}`);
      }
    }

    log.link('NFT (after seal, now owned by dWallet)', `https://suiscan.xyz/testnet/object/${IKACHAN_NFT_ID}`);
    save();
  } else {
    log.step(1, 'Seal already done (cached)');
    log.link('Sui (Seal)', `https://suiscan.xyz/testnet/tx/${S.sealTx}`);
  }

  // ========================================================================
  // STEP 2: Sign seal hash with IKA dWallet
  // ========================================================================
  if (!S.signatureHex) {
    log.step(2, 'Sign with IKA dWallet (2PC-MPC Ed25519)');

    log.info('TX1: Presign...');
    const encKey = await retry(() => ikaClient.getLatestNetworkEncryptionKey(), 'ek');
    const coins = await retry(() => suiClient.getCoins({ owner: addr, coinType: ikaType }), 'c');
    const tx1 = new Transaction(); tx1.setSender(addr); tx1.setGasBudget(500_000_000);
    const ikaTx1 = new IkaTransaction({ ikaClient, transaction: tx1, userShareEncryptionKeys: userKeys });
    const upc = ikaTx1.requestGlobalPresign({
      dwalletNetworkEncryptionKeyId: encKey.id, curve: Curve.ED25519,
      signatureAlgorithm: SignatureAlgorithm.EdDSA,
      ikaCoin: tx1.object(coins.data[0].coinObjectId), suiCoin: tx1.gas,
    });
    tx1.transferObjects([upc], addr);
    const tb1 = await tx1.build({ client: suiClient });
    const s1 = await suiKp.signTransaction(tb1);
    const r1 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s1.bytes, signature: s1.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'tx1');
    if (r1.effects?.status?.status === 'failure') throw new Error(`Presign: ${r1.effects?.status?.error}`);
    S.presignTx = r1.digest;
    log.ok(`Presign: ${r1.digest}`);
    log.link('Sui (Presign)', `https://suiscan.xyz/testnet/tx/${r1.digest}`);

    let pcId=null, psId=null;
    for (const o of (r1.objectChanges||[])) { if(o.type==='created') { const t=o.objectType?.split('::').pop()||''; if(t.includes('UnverifiedPresignCap'))pcId=o.objectId; if(t.includes('PresignSession'))psId=o.objectId; }}
    for (const e of (r1.events||[])) { if(e.parsedJson?.presign_session_id)psId=e.parsedJson.presign_session_id; }
    if(!pcId||!psId) throw new Error(`Missing: cap=${pcId}, sess=${psId}`);

    log.info('Waiting for presign MPC...');
    let pObj=null;
    for(let i=0;i<60;i++) { await sleep(3000); try { pObj=await ikaClient.getPresign(psId); if(pObj.state?.$kind==='Completed'){log.ok(`Presign done (${(i+1)*3}s)`);break;} if(i%10===0)log.info(`  Poll ${i+1}: ${pObj.state?.$kind||'?'}`); } catch(e){if(i%10===0)log.info(`  Poll ${i+1}: ${e.message?.slice(0,40)}`);} }
    if(!pObj||pObj.state?.$kind!=='Completed') throw new Error('Presign timeout');

    log.info('TX2: Signing...');
    const dw = await retry(() => ikaClient.getDWallet(DWALLET_ID),'dw');
    const es = await retry(() => ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID),'es');
    const c2 = await retry(() => suiClient.getCoins({ owner: addr, coinType: ikaType }),'c2');
    const tx2 = new Transaction(); tx2.setSender(addr); tx2.setGasBudget(500_000_000);
    const ikaTx2 = new IkaTransaction({ ikaClient, transaction: tx2, userShareEncryptionKeys: userKeys });
    const vpc = ikaTx2.verifyPresignCap({ presign: pObj, unverifiedPresignCap: pcId });
    const ma = ikaTx2.approveMessage({ dWalletCap: DWALLET_CAP, curve: Curve.ED25519, signatureAlgorithm: SignatureAlgorithm.EdDSA, hashScheme: Hash.SHA512, message: Array.from(sealHash) });
    await ikaTx2.requestSign({ dWallet:dw, messageApproval:ma, hashScheme:Hash.SHA512, verifiedPresignCap:vpc, presign:pObj, encryptedUserSecretKeyShare:es, message:Array.from(sealHash), signatureScheme:SignatureAlgorithm.EdDSA, ikaCoin:tx2.object(c2.data[0].coinObjectId), suiCoin:tx2.gas });
    const tb2 = await tx2.build({ client: suiClient });
    const s2 = await suiKp.signTransaction(tb2);
    const r2 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s2.bytes, signature: s2.signature,
      options: { showEffects: true, showEvents: true, showObjectChanges: true },
      requestType: 'WaitForLocalExecution',
    }), 'tx2');
    if(r2.effects?.status?.status==='failure') throw new Error(`Sign: ${r2.effects?.status?.error}`);
    S.signTx = r2.digest;
    log.ok(`Sign TX: ${r2.digest}`);
    log.link('Sui (Sign)', `https://suiscan.xyz/testnet/tx/${r2.digest}`);

    let ssId=null;
    for(const o of(r2.objectChanges||[])){if(o.type==='created'){const t=o.objectType?.split('::').pop()||'';if(t.includes('SignSession')){ssId=o.objectId;}}}
    for(const e of(r2.events||[])){if(e.parsedJson?.sign_session_id)ssId=e.parsedJson.sign_session_id;}

    log.info('Waiting for MPC signature...');
    let sigBytes=null;
    for(let i=0;i<80;i++){await sleep(3000);if(ssId){try{const obj=await retry(()=>suiClient.getObject({id:ssId,options:{showContent:true}}),'ss');const f=obj.data?.content?.fields;if(f){const st=f.state;const k=st?.variant||st?.$kind||'';if(k==='Completed'||k==='Signed'){const s=st?.fields?.signature||f.signature;if(s&&Array.isArray(s)&&s.length>=64){sigBytes=Buffer.from(s);log.ok(`Signature: ${sigBytes.toString('hex').slice(0,32)}... (${s.length}B)`);break;}}if(f.output){try{const oo=await retry(()=>suiClient.getObject({id:f.output,options:{showContent:true}}),'o');const ff=oo.data?.content?.fields;if(ff?.signature&&Array.isArray(ff.signature)&&ff.signature.length>=64){sigBytes=Buffer.from(ff.signature);log.ok(`Sig from output: ${sigBytes.toString('hex').slice(0,32)}...`);break;}}catch{}}if(i%5===0)log.info(`  Poll ${i+1}: state=${k||JSON.stringify(st).slice(0,50)}`);}}catch(e){if(i%10===0)log.info(`  Poll ${i+1}: ${e.message?.slice(0,50)}`);}}
    if(i>0&&i%10===0){try{for(const tf of[`${ikaCfg.packages.ikaPackage}::sign::SignOutput`]){try{const owned=await retry(()=>suiClient.getOwnedObjects({owner:addr,options:{showContent:true,showType:true},filter:{StructType:tf}}),'ow');for(const o of(owned.data||[])){const ff=o.data?.content?.fields;if(ff?.signature&&Array.isArray(ff.signature)&&ff.signature.length>=64){sigBytes=Buffer.from(ff.signature);log.ok(`Found owned SignOutput`);break;}}if(sigBytes)break;}catch{}}if(sigBytes)break;}catch{}}}

    if(sigBytes){S.signatureHex=sigBytes.toString('hex');}else{log.warn('Sig not retrieved yet, check explorer');}
    save();
  } else {
    log.step(2,'Signature cached');
    log.info(`Sig: ${S.signatureHex.slice(0,32)}...`);
  }

  // ========================================================================
  // STEP 3: Solana - Register Collection + Verify Seal + Mint Reborn
  // ========================================================================
  const srcChainLE = Buffer.alloc(2); srcChainLE.writeUInt16LE(CHAIN_SUI);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('ika_config')], SOLANA_PROGRAM);
  const [collPda] = PublicKey.findProgramAddressSync([Buffer.from('collection'), srcChainLE, contractBytes], SOLANA_PROGRAM);
  const [recordPda] = PublicKey.findProgramAddressSync([Buffer.from('reincarnation'), sealHash], SOLANA_PROGRAM);

  if (!S.solRegTx) {
    log.step(3, 'Solana: Register Collection');
    const collInfo = await solConn.getAccountInfo(collPda);
    if (!collInfo) {
      const nameB = Buffer.from('Ika Tensei Genesis');
      const regData = Buffer.concat([anchorDisc('register_collection'), srcChainLE, Buffer.from([contractBytes.length,0,0,0]), contractBytes, Buffer.from([nameB.length,0,0,0]), nameB, Buffer.alloc(8)]);
      const regIx = new TransactionInstruction({ programId: SOLANA_PROGRAM, keys: [
        {pubkey:configPda,isSigner:false,isWritable:false},{pubkey:collPda,isSigner:false,isWritable:true},
        {pubkey:solKp.publicKey,isSigner:true,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}], data: regData });
      const regSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(regIx), [solKp]);
      S.solRegTx = regSig;
      log.ok(`Collection: ${regSig}`);
      log.link('Solscan (Register)', `https://solscan.io/tx/${regSig}?cluster=devnet`);
    } else { log.ok('Collection exists'); }
    save();
  }

  if (S.signatureHex && !S.solVerifyTx) {
    log.step(4, 'Solana: Verify Seal (Ed25519 Precompile)');
    const sigBuf = Buffer.from(S.signatureHex,'hex');
    const recInfo = await solConn.getAccountInfo(recordPda);
    if (!recInfo) {
      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({ publicKey: attestPub, message: sealHash, signature: sigBuf });
      const aPub = new PublicKey(attestPub);
      const vData = Buffer.concat([anchorDisc('verify_seal'), sealHash, srcChainLE, Buffer.from([contractBytes.length,0,0,0]), contractBytes, Buffer.from([tokenIdBytes.length,0,0,0]), tokenIdBytes, aPub.toBuffer(), solKp.publicKey.toBuffer()]);
      const vIx = new TransactionInstruction({ programId: SOLANA_PROGRAM, keys: [
        {pubkey:configPda,isSigner:false,isWritable:false},{pubkey:collPda,isSigner:false,isWritable:true},
        {pubkey:recordPda,isSigner:false,isWritable:true},{pubkey:solKp.publicKey,isSigner:true,isWritable:true},
        {pubkey:solKp.publicKey,isSigner:false,isWritable:false},
        {pubkey:new PublicKey('Sysvar1nstructions1111111111111111111111111'),isSigner:false,isWritable:false},
        {pubkey:SystemProgram.programId,isSigner:false,isWritable:false}], data: vData });
      const vSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(ed25519Ix).add(vIx), [solKp]);
      S.solVerifyTx = vSig;
      log.ok(`Seal verified: ${vSig}`);
      log.link('Solscan (Verify)', `https://solscan.io/tx/${vSig}?cluster=devnet`);
    } else { log.ok('Already verified'); S.solVerifyTx = S.solVerifyTx || 'cached'; }
    save();
  }

  if (S.solVerifyTx && !S.solMintTx) {
    log.step(5, 'Solana: Mint Reborn Ika-chan (Metaplex Core)');
    const [mintAuth] = PublicKey.findProgramAddressSync([Buffer.from('reincarnation_mint'), sealHash], SOLANA_PROGRAM);
    const assetKp = Keypair.generate();
    const nameB = Buffer.from(NFT_NAME), uriB = Buffer.from(WALRUS_METADATA_URL);
    const mData = Buffer.concat([anchorDisc('mint_reborn'), sealHash, Buffer.from([nameB.length,0,0,0]), nameB, Buffer.from([uriB.length,0,0,0]), uriB]);
    const mIx = new TransactionInstruction({ programId: SOLANA_PROGRAM, keys: [
      {pubkey:configPda,isSigner:false,isWritable:false},{pubkey:recordPda,isSigner:false,isWritable:true},
      {pubkey:mintAuth,isSigner:false,isWritable:false},{pubkey:assetKp.publicKey,isSigner:true,isWritable:true},
      {pubkey:solKp.publicKey,isSigner:false,isWritable:false},{pubkey:solKp.publicKey,isSigner:true,isWritable:true},
      {pubkey:MPL_CORE,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}], data: mData });
    const mSig = await sendAndConfirmTransaction(solConn, new SolanaTx().add(mIx), [solKp, assetKp]);
    S.solMintTx = mSig; S.solAssetId = assetKp.publicKey.toBase58();
    log.ok(`🎉 IKA-CHAN REBORN: ${S.solAssetId}`);
    log.link('Solscan (Mint)', `https://solscan.io/tx/${mSig}?cluster=devnet`);
    log.link('Solscan (NFT)', `https://solscan.io/token/${S.solAssetId}?cluster=devnet`);
    save();
  }

  // ========================================================================
  // STEP 6: Mark Reborn on Sui
  // ========================================================================
  if (S.solAssetId && !S.markRebornTx) {
    log.step(6, 'Mark Reborn on Sui (Close Loop)');
    const mintPub = new PublicKey(S.solAssetId);
    const tx6 = new Transaction(); tx6.setSender(addr); tx6.setGasBudget(50_000_000);
    tx6.moveCall({ target: `${TENSEI_PKG}::registry::mark_reborn`, arguments: [
      tx6.object(SEAL_REGISTRY), tx6.pure.vector('u8', Array.from(sealHash)), tx6.pure.vector('u8', Array.from(mintPub.toBytes())) ]});
    const tb6 = await tx6.build({ client: suiClient });
    const s6 = await suiKp.signTransaction(tb6);
    const r6 = await retry(() => suiClient.executeTransactionBlock({
      transactionBlock: s6.bytes, signature: s6.signature,
      options: { showEffects: true, showEvents: true }, requestType: 'WaitForLocalExecution',
    }), 'mark');
    if (r6.effects?.status?.status !== 'failure') {
      S.markRebornTx = r6.digest;
      log.ok(`Marked reborn: ${r6.digest}`);
      log.link('Sui (Reborn)', `https://suiscan.xyz/testnet/tx/${r6.digest}`);
    } else { log.err(`mark_reborn: ${r6.effects?.status?.error}`); }
    save();
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n\n' + '█'.repeat(60));
  console.log('  🦑 IKA-CHAN FULL PROPER E2E COMPLETE');
  console.log('█'.repeat(60));
  console.log(`
  📦 WALRUS:
     Image:    https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_IMAGE_BLOB}
     Metadata: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${WALRUS_METADATA_BLOB}

  🔷 SUI TESTNET:
     NFT Module:   https://suiscan.xyz/testnet/object/${NFT_PKG}
     Ika-chan NFT:  https://suiscan.xyz/testnet/object/${IKACHAN_NFT_ID}
     Tensei Pkg:   https://suiscan.xyz/testnet/object/${TENSEI_PKG}
     Registry:     https://suiscan.xyz/testnet/object/${SEAL_REGISTRY}
     Seal TX:      https://suiscan.xyz/testnet/tx/${S.sealTx}
     ${S.markRebornTx ? 'Reborn TX:    https://suiscan.xyz/testnet/tx/'+S.markRebornTx : ''}

  🔐 IKA dWALLET:
     dWallet:      https://suiscan.xyz/testnet/object/${DWALLET_ID}
     Presign TX:   https://suiscan.xyz/testnet/tx/${S.presignTx || 'N/A'}
     Sign TX:      https://suiscan.xyz/testnet/tx/${S.signTx || 'N/A'}
     Signature:    ${S.signatureHex?.slice(0,32) || 'N/A'}...

  🟣 SOLANA DEVNET:
     Program:      https://solscan.io/account/mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa?cluster=devnet
     ${S.solRegTx ? 'Register:     https://solscan.io/tx/'+S.solRegTx+'?cluster=devnet' : ''}
     ${S.solVerifyTx ? 'Verify Seal:  https://solscan.io/tx/'+S.solVerifyTx+'?cluster=devnet' : ''}
     ${S.solMintTx ? 'Mint Reborn:  https://solscan.io/tx/'+S.solMintTx+'?cluster=devnet' : ''}
     ${S.solAssetId ? 'Reborn NFT:   https://solscan.io/token/'+S.solAssetId+'?cluster=devnet' : ''}

  🦑 SEAL:
     Hash:  ${S.sealHash}
     NFT:   ${NFT_NAME}
     Flow:  Sui Mint → dWallet Seal → IKA Sign → Solana Verify → Metaplex Mint → Sui Mark Reborn
  `);
  console.log('█'.repeat(60) + '\n');
}

main().catch(e => { log.err(e.message); console.error(e.stack?.split('\n').slice(0,5).join('\n')); process.exit(1); });
