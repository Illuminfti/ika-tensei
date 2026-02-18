#!/usr/bin/env node
/**
 * Mirror Ika-chan NFT data from Walrus to Arweave via Irys.
 * Then update the Solana NFT's URI to point to Arweave.
 */
import Irys from '@irys/sdk';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';

const WALRUS_AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';
const IMAGE_BLOB = '9ASBu9iTnkUun3LV6OKP-VdryWoobvNicoMqVLH4ajY';
const META_BLOB = 'Udr8c44HpNM9XzWLqVmfbGcUMrp_u8r0SaTIUSaF5xU';

async function main() {
  console.log('🔄 Mirroring Walrus → Arweave via Irys\n');

  // Load Solana keypair
  const kpData = JSON.parse(readFileSync(homedir() + '/.config/solana/id.json', 'utf8'));
  const secretKey = Uint8Array.from(kpData);
  const kp = Keypair.fromSecretKey(secretKey);
  console.log('Solana wallet:', kp.publicKey.toBase58());

  // Init Irys (devnet)
  const irys = new Irys({
    url: 'https://devnet.irys.xyz',
    token: 'solana',
    key: secretKey,
    config: { providerUrl: 'https://api.devnet.solana.com' },
  });
  await irys.ready();
  console.log('Irys address:', irys.address);

  // Check balance
  const bal = await irys.getLoadedBalance();
  const balSol = irys.utils.fromAtomic(bal).toNumber();
  console.log('Irys balance:', balSol, 'SOL');

  // Fund if needed (image ~25KB + meta ~2.5KB = needs very little)
  if (balSol < 0.001) {
    console.log('Funding Irys with 0.01 SOL...');
    try {
      const fundResult = await irys.fund(irys.utils.toAtomic(0.01));
      console.log('Funded:', fundResult.id);
      // Wait for funding to settle
      await new Promise(r => setTimeout(r, 5000));
      const newBal = await irys.getLoadedBalance();
      console.log('New balance:', irys.utils.fromAtomic(newBal).toNumber(), 'SOL');
    } catch (e) {
      console.error('Fund error:', e.message);
      // Try with less
      try {
        const fundResult = await irys.fund(irys.utils.toAtomic(0.005));
        console.log('Funded (smaller):', fundResult.id);
        await new Promise(r => setTimeout(r, 5000));
      } catch (e2) {
        console.error('Fund retry error:', e2.message);
      }
    }
  }

  // 1. Upload image to Arweave
  console.log('\n📸 Uploading image...');
  const imgResp = await fetch(`${WALRUS_AGG}/${IMAGE_BLOB}`);
  if (!imgResp.ok) throw new Error('Failed to fetch image from Walrus');
  const imgData = Buffer.from(await imgResp.arrayBuffer());
  console.log(`  Fetched from Walrus: ${imgData.length} bytes`);

  const imgReceipt = await irys.upload(imgData, {
    tags: [
      { name: 'Content-Type', value: 'image/jpeg' },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'Walrus-Blob-Id', value: IMAGE_BLOB },
      { name: 'Type', value: 'nft-image' },
    ],
  });
  const arweaveImageUrl = `https://arweave.net/${imgReceipt.id}`;
  console.log(`  ✅ Arweave image: ${arweaveImageUrl}`);

  // 2. Fetch metadata, update image URL, upload
  console.log('\n📋 Uploading metadata...');
  const metaResp = await fetch(`${WALRUS_AGG}/${META_BLOB}`);
  if (!metaResp.ok) throw new Error('Failed to fetch metadata from Walrus');
  const metaJson = await metaResp.json();
  
  // Update image to Arweave URL
  metaJson.image = arweaveImageUrl;
  metaJson.properties = metaJson.properties || {};
  metaJson.properties.files = [
    { uri: arweaveImageUrl, type: 'image/jpeg', cdn: true },
  ];
  metaJson.properties.walrus = {
    image_blob_id: IMAGE_BLOB,
    metadata_blob_id: META_BLOB,
    image_url: `${WALRUS_AGG}/${IMAGE_BLOB}`,
    metadata_url: `${WALRUS_AGG}/${META_BLOB}`,
  };

  const metaBuffer = Buffer.from(JSON.stringify(metaJson, null, 2));
  const metaReceipt = await irys.upload(metaBuffer, {
    tags: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Ika-Tensei' },
      { name: 'Walrus-Blob-Id', value: META_BLOB },
      { name: 'Type', value: 'nft-metadata' },
    ],
  });
  const arweaveMetaUrl = `https://arweave.net/${metaReceipt.id}`;
  console.log(`  ✅ Arweave metadata: ${arweaveMetaUrl}`);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  ARWEAVE MIRROR COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Image:    ${arweaveImageUrl}`);
  console.log(`  Metadata: ${arweaveMetaUrl}`);
  console.log(`\n  Walrus originals preserved:`);
  console.log(`  Image:    ${WALRUS_AGG}/${IMAGE_BLOB}`);
  console.log(`  Metadata: ${WALRUS_AGG}/${META_BLOB}`);
  console.log('═'.repeat(60));
  
  // NOTE: To update the Solana NFT URI to point to Arweave,
  // we'd need to call update_metadata on the program.
  // Current Metaplex Core assets with ImmutableMetadata plugin
  // cannot be updated (by design — proves authenticity).
  // For future mints, use Arweave URL directly.
  console.log('\n⚠️  Current reborn NFT has ImmutableMetadata plugin.');
  console.log('   URI points to Walrus. Future mints should use Arweave URL.');
  console.log('   Indexers will find the Arweave version via the same metadata content.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
