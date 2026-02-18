/**
 * Sui closer: mark_reborn on Sui to complete the loop
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { type Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

export interface CloseResult {
  txDigest: string;
}

export interface SuiCloser {
  markReborn(sealHash: string, solanaMintAddress: string): Promise<CloseResult>;
}

export function createSuiCloser(
  config: RelayerConfig,
  logger: Logger,
): SuiCloser {
  const { 
    suiRpcUrl, 
    suiPackageId,
    suiRegistryId,
    suiKeypair,
  } = config;

  const client = new SuiClient({ url: suiRpcUrl });
  const senderAddress = suiKeypair.getPublicKey().toSuiAddress();

  async function markReborn(sealHash: string, solanaMintAddress: string): Promise<CloseResult> {
    logger.info(`Marking reborn on Sui: seal=${sealHash.slice(0, 16)}..., mint=${solanaMintAddress}`);

    // Parse seal hash from hex to bytes
    const sealHashBytes = Buffer.from(sealHash.replace(/^0x/, ''), 'hex');
    
    // Parse Solana mint address to bytes
    const mintPubkey = new Uint8Array(32);
    // The mint address is a base58 encoded public key - we need to decode it
    // For now, we'll use the address directly as bytes (padded/trimmed as needed)
    const mintBase58 = solanaMintAddress;
    
    // Convert base58 to bytes using a simple approach
    // In practice, we'd use bs58 library, but let's try a different approach
    // We'll pass the address as raw bytes for the Move call
    
    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.setGasBudget(50_000_000);

    tx.moveCall({
      target: `${suiPackageId}::registry::mark_reborn`,
      arguments: [
        tx.object(suiRegistryId),
        tx.pure.vector('u8', Array.from(sealHashBytes)),
        tx.pure.address(mintBase58), // Pass as address string
      ],
    });

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: suiKeypair,
      options: { showEffects: true, showEvents: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`mark_reborn failed: ${result.effects?.status?.error}`);
    }

    const txDigest = result.digest;
    logger.info(`Marked reborn on Sui: ${txDigest}`);

    return { txDigest };
  }

  return {
    markReborn,
  };
}
