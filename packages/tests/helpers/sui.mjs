/**
 * Sui Test Helpers
 * 
 * Provides utilities for Sui client setup and transaction building
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync } from 'fs';

export const SUI_RPC = 'https://rpc-testnet.suiscan.xyz:443';

// Contract addresses (testnet)
export const CONTRACT_ADDRESSES = {
  // Main registry contract
  REGISTRY: '0xffa3bb04b8cdb11c905900da846cc92f70049654b2d9661269c8ba73c3e71294',
  VAULT: '0x0fccb85175e9f0a0ad99e445bdde187be2a2967d73b0402cb4ca147c5273b9a0',
  ADMIN_CAP: '0x55ced2b1b2d661192bd304bdbc53a65e535e523320797362f91db4fa9583a72a',
  PACKAGE: '0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e',
};

/**
 * Create Sui client and keypair from keystore
 */
export async function createSuiClient() {
  const client = new SuiClient({ url: SUI_RPC });
  return client;
}

/**
 * Load keypair from default keystore location
 */
export function loadSuiKeypair() {
  const keystorePath = process.env.HOME + '/.sui/sui_config/sui.keystore';
  const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
  const keyBytes = Buffer.from(keystore[0], 'base64');
  // Skip first byte (flag) and use the secret key
  return Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
}

/**
 * Get Sui address from keypair
 */
export async function getSuiAddress(keypair) {
  return keypair.getPublicKey().toSuiAddress();
}

/**
 * Retry RPC call with exponential backoff
 */
export async function retryRpc(fn, label, maxRetries = 8) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = 
        e.message?.includes('429') || 
        e.message?.includes('rate') || 
        e.message?.includes('Too Many') ||
        e.message?.includes('Service unavailable');
      
      if (isRateLimit && i < maxRetries - 1) {
        const waitMs = 3000 * (i + 1);
        console.log(`  ⚠️ ${label}: rate limited, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw e;
      }
    }
  }
}

/**
 * Wait for transaction to be processed
 */
export async function waitForTx(client, digest, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await client.getTransactionBlock({ 
        digest, 
        options: { showEffects: true } 
      });
      if (tx.effects?.status?.status === 'success' || 
          tx.effects?.status?.status === 'failure') {
        return tx;
      }
    } catch (e) {
      // Transaction not yet indexed, continue waiting
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Transaction ${digest} timed out after ${timeoutMs}ms`);
}

/**
 * Create a transaction with proper gas settings
 */
export function createTx(sender, gasBudget = 100_000_000) {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Execute transaction and wait for result
 */
export async function executeTx(client, keypair, tx) {
  const txBytes = await tx.build({ client });
  const signed = await keypair.signTransaction(txBytes);
  const result = await client.executeTransactionBlock({
    transactionBlock: signed.bytes,
    signature: signed.signature,
    options: { 
      showEffects: true, 
      showEvents: true, 
      showObjectChanges: true 
    },
    requestType: 'WaitForLocalExecution',
  });
  
  if (result.effects?.status?.status === 'failure') {
    throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
  }
  
  return result;
}

/**
 * Get coins of a specific type for an address
 */
export async function getCoins(client, owner, coinType) {
  return retryRpc(
    () => client.getCoins({ owner, coinType }),
    'getCoins'
  );
}

/**
 * Get the latest Sui epoch
 */
export async function getLatestEpoch(client) {
  return retryRpc(
    () => client.getLatestEpoch(),
    'getLatestEpoch'
  );
}
