/**
 * Solana Submitter - Builds and submits transactions to Solana
 * 
 * Uses @solana/web3.js and @coral-xyz/anchor to call mint_reborn
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { getConfig } from './config.js';
import type { ProcessedSeal, SubmissionResult } from './types.js';
import { logger } from './logger.js';

/**
 * Mint instruction data structure (matches Solana program)
 */
interface MintRebornInstructionData {
  signature: number[];  // 64 bytes
  dwalletPubkey: number[];  // 32 bytes
  sourceChain: number;
  nftContract: number[];
  tokenId: number[];
  tokenUri: string;
  collectionName: string;
}

/**
 * SolanaSubmitter handles building and submitting transactions to Solana
 */
export class SolanaSubmitter {
  private connection: Connection;
  private programId: PublicKey;
  
  constructor() {
    const config = getConfig();
    this.connection = new Connection(config.solanaRpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    this.programId = new PublicKey(config.solanaProgramId);
  }

  /**
   * Check if Solana connection is alive
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.connection.getVersion();
      return true;
    } catch (error) {
      logger.error({ error }, 'Solana connection check failed');
      return false;
    }
  }

  /**
   * Build and submit a mint_reborn transaction
   */
  async submitMintReborn(
    seal: ProcessedSeal,
    relayerKeypair: any  // Keypair type loaded externally
  ): Promise<SubmissionResult> {
    const config = getConfig();
    let retries = 0;

    while (retries <= config.maxRetries) {
      try {
        const txHash = await this.sendTransaction(seal, relayerKeypair);
        
        logger.info({
          txHash,
          tokenId: seal.tokenId,
          receiver: seal.receiver,
          retries,
        }, 'Successfully submitted mint_reborn transaction');
        
        return {
          success: true,
          txHash,
          retries,
        };
      } catch (error) {
        retries++;
        
        if (retries <= config.maxRetries) {
          const delay = config.retryDelayMs * Math.pow(2, retries - 1);
          logger.warn({
            error,
            retry: retries,
            maxRetries: config.maxRetries,
            delayMs: delay,
          }, 'Transient failure, retrying...');
          
          await this.sleep(delay);
        } else {
          logger.error({
            error,
            tokenId: seal.tokenId,
            receiver: seal.receiver,
          }, 'Max retries exceeded, giving up');
          
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retries,
          };
        }
      }
    }

    // Should not reach here, but TypeScript needs this
    return {
      success: false,
      error: 'Unexpected error in submitMintReborn',
      retries,
    };
  }

  /**
   * Build and send the transaction
   */
  private async sendTransaction(
    seal: ProcessedSeal,
    relayerKeypair: any
  ): Promise<string> {
    const { signature, dwalletPubkey, sourceChain, nftContract, tokenId, tokenUri, collectionName, receiver } = seal;

    // Create instruction data
    const instructionData = this.encodeInstructionData({
      signature: Array.from(signature),
      dwalletPubkey: Array.from(dwalletPubkey),
      sourceChain,
      nftContract: this.stringToBytes(nftContract),
      tokenId: this.stringToBytes(tokenId),
      tokenUri,
      collectionName,
    });

    // Get receiver public key
    const receiverPubkey = new PublicKey(receiver);

    // Get program derived addresses
    const nftContractBytes = this.stringToBytes(nftContract);
    const tokenIdBytes = this.stringToBytes(tokenId);
    
    const [collectionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), this.hashBytes(nftContractBytes)],
      this.programId
    );

    const [provenancePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('provenance'),
        this.hashBytes(nftContractBytes),
        this.hashBytes(tokenIdBytes),
      ],
      this.programId
    );

    const [usedSignaturesPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('used_signatures')],
      this.programId
    );

    // Build the transaction
    const transaction = new Transaction();

    // Add the mint_reborn instruction
    transaction.add({
      programId: this.programId,
      keys: [
        { pubkey: relayerKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: receiverPubkey, isSigner: false, isWritable: true },
        { pubkey: collectionPda, isSigner: false, isWritable: true },
        { pubkey: provenancePda, isSigner: false, isWritable: true },
        { pubkey: usedSignaturesPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    // Send the transaction
    const txHash = await this.connection.sendTransaction(transaction, [relayerKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await this.connection.confirmTransaction(txHash, 'confirmed');

    return txHash;
  }

  /**
   * Encode instruction data for mint_reborn
   * This is a simplified version - in production you'd use the Anchor IDL
   */
  private encodeInstructionData(data: MintRebornInstructionData): Buffer {
    // Create a buffer with the instruction data
    // Layout: discriminator (8) + signature (64) + dwalletPubkey (32) + sourceChain (2) + ...
    const buffer = Buffer.alloc(4096);
    let offset = 0;

    // Instruction discriminator (mint_reborn = 0)
    buffer.writeUInt32LE(0, offset);
    offset += 8;

    // Signature (64 bytes)
    buffer.writeUInt8(data.signature.length, offset++);
    data.signature.forEach(b => buffer.writeUInt8(b, offset++));

    // dwalletPubkey (32 bytes)
    buffer.writeUInt8(data.dwalletPubkey.length, offset++);
    data.dwalletPubkey.forEach(b => buffer.writeUInt8(b, offset++));

    // sourceChain (2 bytes)
    buffer.writeUInt16LE(data.sourceChain, offset);
    offset += 2;

    // nftContract (variable)
    buffer.writeUInt8(data.nftContract.length, offset++);
    data.nftContract.forEach(b => buffer.writeUInt8(b, offset++));

    // tokenId (variable)
    buffer.writeUInt8(data.tokenId.length, offset++);
    data.tokenId.forEach(b => buffer.writeUInt8(b, offset++));

    // tokenUri (string)
    const uriBytes = Buffer.from(data.tokenUri);
    buffer.writeUInt32LE(uriBytes.length, offset);
    offset += 4;
    uriBytes.copy(buffer, offset);
    offset += uriBytes.length;

    // collectionName (string)
    const nameBytes = Buffer.from(data.collectionName);
    buffer.writeUInt32LE(nameBytes.length, offset);
    offset += 4;
    nameBytes.copy(buffer, offset);
    offset += nameBytes.length;

    return buffer.subarray(0, offset);
  }

  /**
   * Convert string to byte array
   */
  private stringToBytes(str: string): number[] {
    // Handle hex string (0x...) or regular string
    if (str.startsWith('0x')) {
      const hex = str.slice(2);
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
      }
      return bytes;
    }
    return Array.from(Buffer.from(str));
  }

  /**
   * Simple hash function for PDA derivation
   */
  private hashBytes(data: number[]): Buffer {
    // Simple SHA-like hash for PDA (simplified - in production use proper hashing)
    const buffer = Buffer.from(data);
    // For PDA derivation, we just use the data directly ( Solana will hash it internally)
    // In production with Anchor, you'd use the proper hash from @solana/buffer-layout or similar
    return buffer;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
