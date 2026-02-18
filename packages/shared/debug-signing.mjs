/**
 * Debug dWallet signing - diagnose the SDK deserialization issue
 */
import { IkaClient, getNetworkConfig } from '@ika.xyz/sdk';
import { SuiClient } from '@mysten/sui/client';

const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';
const ENCRYPTED_SHARE_ID = '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';

async function main() {
  const ikaConfig = getNetworkConfig('testnet');
  const suiClient = new SuiClient({ url: SUI_RPC });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
  await ikaClient.initialize();

  console.log('--- Fetching encrypted share via SDK ---');
  const share = await ikaClient.getEncryptedUserSecretKeyShare(ENCRYPTED_SHARE_ID);
  
  console.log('Share type:', typeof share);
  console.log('Share keys:', Object.keys(share));
  console.log('State:', JSON.stringify(share.state, null, 2));
  
  // Check the specific path the SDK checks at line 1461
  console.log('\n--- SDK check path ---');
  console.log('share.state:', typeof share.state);
  console.log('share.state.KeyHolderSigned:', share.state?.KeyHolderSigned);
  console.log('share.state.KeyHolderSigned?.user_output_signature:', share.state?.KeyHolderSigned?.user_output_signature);
  
  // Check alternative paths
  if (share.state?.variant) {
    console.log('\nVariant-style state:');
    console.log('  variant:', share.state.variant);
    console.log('  fields:', share.state.fields);
  }
  
  // Enumerate all properties
  console.log('\nAll state properties:');
  for (const [k, v] of Object.entries(share.state || {})) {
    console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v)?.slice(0, 100) : v);
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
