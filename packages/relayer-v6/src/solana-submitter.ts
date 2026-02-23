/**
 * Solana Submitter – builds and sends mint_reborn transactions.
 *
 * Critical fixes applied:
 *  1. Instruction encoding via Anchor Borsh discriminator (NOT custom binary).
 *  2. PDA derivation seeds match the on-chain program exactly.
 *  3. Ed25519 precompile instruction prepended to every transaction.
 *  4. New asset Keypair generated for every mint (Metaplex Core requirement).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import { getConfig } from './config.js';
import type { ProcessedSeal, SubmissionResult } from './types.js';
import { logger } from './logger.js';

// Metaplex Core program ID (constant across all deployments)
const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

// ─── PDA seed constants (must match lib.rs exactly) ──────────────────────────
const SEED_USED_SIGNATURES = Buffer.from('used_signatures');
const SEED_COLLECTION_REGISTRY = Buffer.from('collection_registry');
const SEED_PROVENANCE = Buffer.from('provenance');
const SEED_COLLECTION = Buffer.from('reborn_collection');
const SEED_MINT_AUTHORITY = Buffer.from('mint_authority');

// ─── Anchor instruction discriminator ─────────────────────────────────────────
/**
 * Compute the 8-byte Anchor instruction discriminator.
 * Anchor defines it as the first 8 bytes of SHA256("global:<instruction_name>").
 */
function anchorDiscriminator(name: string): Buffer {
  return createHash('sha256')
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

const DISCRIMINATOR_MINT_REBORN = anchorDiscriminator('mint_reborn');

// ─── Borsh encoding helpers ───────────────────────────────────────────────────

/**
 * Encode the mint_reborn instruction arguments using Borsh, which is what Anchor
 * expects on-chain.
 *
 * Layout (all integers are little-endian):
 *   [u8; 8]  – discriminator
 *   [u8; 64] – signature (fixed-size array, no length prefix)
 *   [u8; 32] – dwallet_pubkey (fixed-size array, no length prefix)
 *   u16      – source_chain
 *   u32 + [] – nft_contract (Vec<u8>)
 *   u32 + [] – token_id (Vec<u8>)
 *   u32 + [] – token_uri (String = Vec<u8> of UTF-8)
 *   u32 + [] – collection_name (String)
 */
function encodeMintRebornArgs(
  signature: Uint8Array,
  dwalletPubkey: Uint8Array,
  sourceChain: number,
  nftContract: Uint8Array,
  tokenId: Uint8Array,
  tokenUri: string,
  collectionName: string,
): Buffer {
  if (signature.length !== 64) throw new Error('signature must be 64 bytes');
  if (dwalletPubkey.length !== 32) throw new Error('dwalletPubkey must be 32 bytes');

  const tokenUriBytes = Buffer.from(tokenUri, 'utf-8');
  const collectionNameBytes = Buffer.from(collectionName, 'utf-8');

  const totalLen =
    8 +   // discriminator
    64 +  // signature fixed array
    32 +  // dwallet_pubkey fixed array
    2 +   // source_chain u16
    4 + nftContract.length +      // Vec<u8>
    4 + tokenId.length +           // Vec<u8>
    4 + tokenUriBytes.length +     // String
    4 + collectionNameBytes.length; // String

  const buf = Buffer.alloc(totalLen);
  let offset = 0;

  // 1. Discriminator
  DISCRIMINATOR_MINT_REBORN.copy(buf, offset);
  offset += 8;

  // 2. signature: [u8; 64] (no length prefix for fixed arrays in Borsh)
  buf.set(signature, offset);
  offset += 64;

  // 3. dwallet_pubkey: [u8; 32]
  buf.set(dwalletPubkey, offset);
  offset += 32;

  // 4. source_chain: u16 LE
  buf.writeUInt16LE(sourceChain, offset);
  offset += 2;

  // 5. nft_contract: Vec<u8> → u32 len + bytes
  buf.writeUInt32LE(nftContract.length, offset);
  offset += 4;
  buf.set(nftContract, offset);
  offset += nftContract.length;

  // 6. token_id: Vec<u8>
  buf.writeUInt32LE(tokenId.length, offset);
  offset += 4;
  buf.set(tokenId, offset);
  offset += tokenId.length;

  // 7. token_uri: String
  buf.writeUInt32LE(tokenUriBytes.length, offset);
  offset += 4;
  tokenUriBytes.copy(buf, offset);
  offset += tokenUriBytes.length;

  // 8. collection_name: String
  buf.writeUInt32LE(collectionNameBytes.length, offset);
  offset += 4;
  collectionNameBytes.copy(buf, offset);
  // offset += collectionNameBytes.length; // not needed

  return buf;
}

// ─── SolanaSubmitter ──────────────────────────────────────────────────────────

export class SolanaSubmitter {
  private readonly connection: Connection;
  private readonly programId: PublicKey;

  constructor() {
    const config = getConfig();
    this.connection = new Connection(config.solanaRpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60_000,
    });
    this.programId = new PublicKey(config.solanaProgramId);
  }

  /** Verify Solana RPC is reachable. */
  async checkConnection(): Promise<boolean> {
    try {
      await this.connection.getVersion();
      return true;
    } catch (err) {
      logger.error({ err }, 'Solana connection check failed');
      return false;
    }
  }

  /**
   * Build and send the mint_reborn transaction with exponential-backoff retries.
   *
   * A fresh asset Keypair is generated for every call (Metaplex Core requires
   * the asset account to be a new, uninitialized keypair and a co-signer).
   */
  async submitMintReborn(
    seal: ProcessedSeal,
    relayerKeypair: Keypair,
  ): Promise<SubmissionResult> {
    const config = getConfig();
    let retries = 0;

    while (retries <= config.maxRetries) {
      try {
        // Generate a fresh asset keypair for each attempt
        const assetKeypair = Keypair.generate();

        const txHash = await this.sendTransaction(seal, relayerKeypair, assetKeypair);

        logger.info(
          { txHash, retries, receiver: Buffer.from(seal.receiver).toString('hex') },
          'mint_reborn submitted successfully',
        );

        return { success: true, txHash, retries };
      } catch (err) {
        retries++;

        if (retries <= config.maxRetries) {
          const delayMs = config.retryDelayMs * Math.pow(2, retries - 1);
          logger.warn(
            { err, attempt: retries, maxRetries: config.maxRetries, delayMs },
            'Transient error, retrying…',
          );
          await sleep(delayMs);
        } else {
          logger.error(
            { err, retries },
            'Max retries exceeded',
          );
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            retries,
          };
        }
      }
    }

    return { success: false, error: 'Unexpected loop exit', retries };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async sendTransaction(
    seal: ProcessedSeal,
    relayerKeypair: Keypair,
    assetKeypair: Keypair,
  ): Promise<string> {
    const {
      signature,
      dwalletPubkey,
      sourceChain,
      nftContract,
      tokenId,
      tokenUri,
      collectionName,
      receiver,
      messageHash,
    } = seal;

    // ── 1. Derive PDAs ────────────────────────────────────────────────────────
    const sourceChainBuf = Buffer.alloc(2);
    sourceChainBuf.writeUInt16LE(sourceChain);

    const [usedSignaturesPda] = PublicKey.findProgramAddressSync(
      [SEED_USED_SIGNATURES],
      this.programId,
    );

    const [registryPda] = PublicKey.findProgramAddressSync(
      [SEED_COLLECTION_REGISTRY],
      this.programId,
    );

    const [provenancePda] = PublicKey.findProgramAddressSync(
      [SEED_PROVENANCE, sourceChainBuf, Buffer.from(nftContract), Buffer.from(tokenId)],
      this.programId,
    );

    const [collectionPda] = PublicKey.findProgramAddressSync(
      [SEED_COLLECTION, sourceChainBuf, Buffer.from(nftContract)],
      this.programId,
    );

    const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
      [SEED_MINT_AUTHORITY, sourceChainBuf, Buffer.from(nftContract)],
      this.programId,
    );

    // ── 2. Receiver public key ────────────────────────────────────────────────
    const receiverPubkey = new PublicKey(receiver);

    // ── 3. Build Ed25519 pre-instruction ─────────────────────────────────────
    // The Solana program reads the Ed25519 instruction at index 0 from the
    // instructions sysvar to verify the dWallet signature.
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: dwalletPubkey,   // 32-byte Ed25519 public key
      message: messageHash,        // 32-byte SHA256 message hash
      signature: signature,        // 64-byte Ed25519 signature
    });

    // ── 4. Encode Borsh instruction data ──────────────────────────────────────
    const ixData = encodeMintRebornArgs(
      signature,
      dwalletPubkey,
      sourceChain,
      nftContract,
      tokenId,
      tokenUri,
      collectionName,
    );

    // ── 5. Build mint_reborn instruction ─────────────────────────────────────
    const mintRebornIx = {
      programId: this.programId,
      keys: [
        { pubkey: relayerKeypair.publicKey, isSigner: true,  isWritable: true  }, // payer
        { pubkey: receiverPubkey,           isSigner: false, isWritable: false }, // receiver
        { pubkey: usedSignaturesPda,        isSigner: false, isWritable: true  }, // used_signatures
        { pubkey: registryPda,              isSigner: false, isWritable: true  }, // registry
        { pubkey: provenancePda,            isSigner: false, isWritable: true  }, // provenance
        { pubkey: collectionPda,            isSigner: false, isWritable: true  }, // collection
        { pubkey: mintAuthorityPda,         isSigner: false, isWritable: false }, // mint_authority
        { pubkey: assetKeypair.publicKey,   isSigner: true,  isWritable: true  }, // asset
        { pubkey: MPL_CORE_PROGRAM_ID,      isSigner: false, isWritable: false }, // mpl_core_program
        { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // instructions_sysvar
      ],
      data: ixData,
    };

    // ── 6. Assemble transaction: Ed25519 verify FIRST, then mint ─────────────
    const transaction = new Transaction();
    transaction.add(ed25519Ix);   // index 0 → program reads this for verification
    transaction.add(mintRebornIx);

    // ── 7. Sign (relayer + asset) and send ────────────────────────────────────
    transaction.feePayer = relayerKeypair.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash('confirmed')
    ).blockhash;

    // Partial sign with both the relayer (paying fees) and the asset (required signer)
    transaction.partialSign(relayerKeypair);
    transaction.partialSign(assetKeypair);

    const rawTx = transaction.serialize();
    const txHash = await this.connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for on-chain confirmation
    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
    await this.connection.confirmTransaction(
      {
        signature: txHash,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed',
    );

    return txHash;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
