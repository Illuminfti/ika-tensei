/**
 * Test script for IkaDWalletService
 * 
 * This script demonstrates how to use the IKA dWallet integration.
 * It requires IKA testnet tokens to actually execute the DKG flow.
 * 
 * Usage:
 *   npx tsx test-ika-dwallet.ts
 * 
 * Or compile and run:
 *   npx tsc --noEmit && npx ts-node test-ika-dwallet.ts
 */

import { IkaDWalletService, IkaDWalletConfig, IkaDWalletLogger, IkaDWalletStorage, DKGOutput } from './src/ika-dwallet';

// Simple console logger
const logger: IkaDWalletLogger = {
  info: (msg) => console.log('[INFO]', msg),
  warn: (msg) => console.warn('[WARN]', msg),
  error: (msg) => console.error('[ERROR]', msg),
  debug: (msg) => console.log('[DEBUG]', msg),
};

// In-memory storage for DKG cache (in production, use persistent storage)
class InMemoryDkgStorage implements IkaDWalletStorage {
  private store = new Map<string, DKGOutput>();

  async get(key: string): Promise<DKGOutput | null> {
    const value = this.store.get(key);
    if (value) {
      return {
        userPublicOutput: new Uint8Array(value.userPublicOutput),
        userSecretKeyShare: new Uint8Array(value.userSecretKeyShare),
      };
    }
    return null;
  }

  async set(key: string, value: DKGOutput): Promise<void> {
    this.store.set(key, {
      userPublicOutput: new Uint8Array(value.userPublicOutput),
      userSecretKeyShare: new Uint8Array(value.userSecretKeyShare),
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

async function main() {
  console.log('=== IKA dWallet Service Test ===\n');

  // Sui testnet RPC
  const suiRpcUrl = 'https://rpc.testnet.sui.io';
  
  // IKA network (use 'testnet' for IKA testnet)
  const ikaNetwork = 'testnet';
  
  // Demo keypair (NOT A REAL WALLET - FOR TESTING ONLY)
  // In production, load from secure storage or wallet
  const demoKeypairBytes = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  
  // Configuration
  const config: IkaDWalletConfig = {
    suiRpcUrl,
    ikaNetwork,
    suiKeypairBytes: demoKeypairBytes,
    dkgStorage: new InMemoryDkgStorage(),
    logger,
  };

  // Create service instance
  const dwalletService = new IkaDWalletService(config);

  try {
    // Initialize (connects to Sui and IKA)
    console.log('Initializing IkaDWalletService...\n');
    await dwalletService.initialize();
    
    console.log('Service initialized!');
    console.log('Sui Address:', dwalletService.getSuiAddress());
    console.log('');

    // Create Ed25519 dWallet (Solana-compatible)
    console.log('Creating Ed25519 dWallet (this will execute DKG on testnet)...\n');
    
    const dwalletRef = await dwalletService.createDWallet('ED25519');
    
    console.log('dWallet created successfully!');
    console.log('  dWallet ID:', dwalletRef.dwalletId);
    console.log('  dWallet Cap ID:', dwalletRef.dwalletCapId);
    console.log('  Curve:', dwalletRef.curve);
    console.log('  Public Key:', Buffer.from(dwalletRef.publicKey).toString('hex'));
    console.log('  Solana Address:', dwalletRef.solanaAddress);
    console.log('');

    // Sign a test message
    const testMessage = new TextEncoder().encode('Hello from Ika Tensei v3!');
    console.log('Signing test message...');
    console.log('  Message:', new TextDecoder().decode(testMessage));
    
    const signature = await dwalletService.signMessage(dwalletRef, testMessage);
    
    console.log('Signature:', Buffer.from(signature).toString('hex'));
    console.log('  Signature length:', signature.length, 'bytes');
    console.log('');

    // Demonstrate transfer (would transfer to SealVault in production)
    console.log('Transfer DWalletCap (demo - would need real cap ID):');
    // In real usage:
    // const txDigest = await dwalletService.transferDWalletCap(dwalletRef.dwalletCapId, '<recipient-address>');
    // console.log('  Transaction:', txDigest);
    console.log('  (Skipped - requires real dWallet cap)');
    console.log('');

    console.log('=== All tests passed! ===');

  } catch (error) {
    console.error('Error:', error);
    
    // Expected errors when running without IKA tokens:
    // - "Insufficient gas" - no SUI for transactions
    // - "DKG transaction failed" - no IKA tokens for DKG
    // - "Timeout waiting for dWallet DKG completion" - network issues
    
    if (error instanceof Error) {
      console.log('\nNote: This error is expected if you do not have IKA testnet tokens.');
      console.log('To get tokens, visit: https://ika.xyz/faucet');
    }
    
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
