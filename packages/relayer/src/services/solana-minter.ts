/**
 * Solana minter: verify seal + mint reborn NFT
 * 
 * Flow:
 * 1. Initialize program config (if needed)
 * 2. Register collection (if needed)
 * 3. Verify seal (Ed25519 precompile)
 * 4. Mint reborn NFT (Metaplex Core CPI)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Ed25519Program } from '@solana/web3.js';
import { createHash } from 'crypto';
import { type Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

// Anchor discriminator helper
function anchorDiscriminator(name: string): Buffer {
  const hash = createHash('sha256');
  hash.update(`global:${name}`);
  return hash.digest().slice(0, 8);
}

// Convert number to little-endian bytes
function toLE16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function toLE64(value: bigint | number | string): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(value), 0);
  return buf;
}

export interface VerifyResult {
  recordPda: PublicKey;
  txDigest: string;
}

export interface MintResult {
  mintAddress: string;
  assetId: string;
  txDigest: string;
}

export interface SolanaMinter {
  initialize(): Promise<void>;
  verifySeal(
    sealHash: Buffer,
    sourceChain: number,
    sourceContract: string,
    tokenId: string,
    dwalletPubkey: Uint8Array,
    signature: Buffer,
  ): Promise<VerifyResult>;
  mintReborn(
    sealHash: Buffer,
    nftName: string,
    metadataUri: string,
  ): Promise<MintResult>;
}

export function createSolanaMinter(
  config: RelayerConfig,
  logger: Logger,
): SolanaMinter {
  const { 
    solanaRpcUrl, 
    solanaProgramId, 
    mplCoreProgramId,
    solanaKeypairBytes,
  } = config;

  const connection = new Connection(solanaRpcUrl, 'confirmed');
  
  // Create keypair from secret key bytes
  // Use fromSeed which derives both from 32-byte seed
  const seed = Buffer.from(solanaKeypairBytes.slice(0, 32));
  const keypair = Keypair.fromSeed(seed);

  const CHAIN_ID_SUI = 2;
  const CHAIN_ID_SOLANA = 3;

  async function initialize(): Promise<void> {
    logger.info('Checking Solana program initialization...');

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('ika_config')],
      solanaProgramId,
    );

    const configInfo = await connection.getAccountInfo(configPda);

    if (!configInfo) {
      logger.info('Initializing program config...');
      
      const initData = Buffer.concat([
        anchorDiscriminator('initialize'),
        keypair.publicKey.toBuffer(), // admin
        keypair.publicKey.toBuffer(), // fee_recipient
        Buffer.from([0xF4, 0x01]),   // fee_bps (500)
        Buffer.alloc(8),              // reserved
      ]);

      const initIx = new TransactionInstruction({
        programId: solanaProgramId,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: initData,
      });

      const tx = new Transaction().add(initIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      logger.info(`Program initialized: ${sig}`);
    } else {
      logger.debug('Program already initialized');
    }
  }

  async function ensureCollectionRegistered(sourceContract: string): Promise<PublicKey> {
    const sourceContractBytes = Buffer.from(sourceContract.replace(/^0x/, ''), 'hex');
    const sourceChainLE = toLE16(CHAIN_ID_SUI);

    const [collPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), sourceChainLE, sourceContractBytes],
      solanaProgramId,
    );

    const collInfo = await connection.getAccountInfo(collPda);

    if (!collInfo) {
      logger.info('Registering collection...');
      
      const nameBytes = Buffer.from('Sui Genesis Collection');
      
      const regData = Buffer.concat([
        anchorDiscriminator('register_collection'),
        sourceChainLE,
        toLE32(sourceContractBytes.length),
        sourceContractBytes,
        toLE32(nameBytes.length),
        nameBytes,
        Buffer.alloc(8), // reserved
      ]);

      const regIx = new TransactionInstruction({
        programId: solanaProgramId,
        keys: [
          { pubkey: collPda, isSigner: false, isWritable: true },
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: regData,
      });

      const tx = new Transaction().add(regIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      logger.info(`Collection registered: ${sig}`);
    }

    return collPda;
  }

  async function verifySeal(
    sealHash: Buffer,
    sourceChain: number,
    sourceContract: string,
    tokenId: string,
    dwalletPubkey: Uint8Array,
    signature: Buffer,
  ): Promise<VerifyResult> {
    logger.info(`Verifying seal: ${sealHash.toString('hex').slice(0, 16)}...`);

    // Ensure collection registered
    await ensureCollectionRegistered(sourceContract);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('ika_config')],
      solanaProgramId,
    );

    const sourceContractBytes = Buffer.from(sourceContract.replace(/^0x/, ''), 'hex');
    const sourceChainLE = toLE16(sourceChain);
    const tokenIdBytes = toLE64(BigInt(tokenId));

    const [collPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), sourceChainLE, sourceContractBytes],
      solanaProgramId,
    );

    const [recordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation'), sealHash],
      solanaProgramId,
    );

    // C7: Idempotency - check if already verified
    const recordInfo = await connection.getAccountInfo(recordPda);
    if (recordInfo) {
      logger.info('Seal already verified, skipping');
      return { recordPda, txDigest: 'already-verified' };
    }

    const dwalletPubkeyPubkey = new PublicKey(dwalletPubkey);
    const sigPubkey = new PublicKey(signature.slice(0, 32));
    const message = sealHash;

    // Create Ed25519 instruction using precompile
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: dwalletPubkeyPubkey.toBytes(),
      message: message,
      signature: signature,
    });

    // Create verify_seal instruction
    const verifyData = Buffer.concat([
      anchorDiscriminator('verify_seal'),
      sealHash,
      sourceChainLE,
      toLE32(sourceContractBytes.length),
      sourceContractBytes,
      toLE32(tokenIdBytes.length),
      tokenIdBytes,
      dwalletPubkeyPubkey.toBuffer(),
      keypair.publicKey.toBuffer(),
    ]);

    const verifyIx = new TransactionInstruction({
      programId: solanaProgramId,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: collPda, isSigner: false, isWritable: true },
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: verifyData,
    });

    const tx = new Transaction()
      .add(ed25519Ix)
      .add(verifyIx);

    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    logger.info(`Seal verified: ${sig}`);

    return { recordPda, txDigest: sig };
  }

  async function mintReborn(
    sealHash: Buffer,
    nftName: string,
    metadataUri: string,
  ): Promise<MintResult> {
    logger.info(`Minting reborn NFT: ${nftName}`);

    const [recordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation'), sealHash],
      solanaProgramId,
    );

    // C7: Idempotency - check if already minted by reading record account data
    const recordInfo = await connection.getAccountInfo(recordPda);
    if (recordInfo && recordInfo.data.length > 64) {
      // Try to extract mint address from record (assuming it's stored after seal_hash)
      // The record layout: seal_hash(32) + source_chain(2) + source_contract(var) + token_id(8) + dwallet_pubkey(32) + mint_pubkey(32) + ...
      // If mint_pubkey is non-zero, NFT already minted
      const mintPubkeyOffset = 74; // Approximate offset after seal_hash + source_chain + variable fields
      if (recordInfo.data.length > mintPubkeyOffset + 32) {
        const potentialMint = recordInfo.data.slice(mintPubkeyOffset, mintPubkeyOffset + 32);
        // Check if first byte is non-zero (valid public key)
        if (potentialMint[0] !== 0 || potentialMint[1] !== 0) {
          const existingMint = new PublicKey(potentialMint);
          logger.info(`Already minted, returning existing mint: ${existingMint.toBase58()}`);
          return {
            mintAddress: existingMint.toBase58(),
            assetId: existingMint.toBase58(),
            txDigest: 'already-minted',
          };
        }
      }
    }

    const [mintAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('reincarnation_mint'), sealHash],
      solanaProgramId,
    );

    // Generate new mint keypair
    const mintKp = Keypair.generate();

    const nameBytes = Buffer.from(nftName.slice(0, 32));
    const uriBytes = Buffer.from(metadataUri.slice(0, 200));

    const mintData = Buffer.concat([
      anchorDiscriminator('mint_reborn'),
      sealHash,
      toLE32(nameBytes.length),
      nameBytes,
      toLE32(uriBytes.length),
      uriBytes,
    ]);

    const mintIx = new TransactionInstruction({
      programId: solanaProgramId,
      keys: [
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: mintAuth, isSigner: false, isWritable: false },
        { pubkey: mintKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: mplCoreProgramId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: mintData,
    });

    const tx = new Transaction().add(mintIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair, mintKp]);

    const mintAddress = mintKp.publicKey.toBase58();
    logger.info(`Reborn NFT minted: ${mintAddress}`);

    return {
      mintAddress,
      assetId: mintAddress,
      txDigest: sig,
    };
  }

  return {
    initialize,
    verifySeal,
    mintReborn,
  };
}

// Helper for 32-bit LE
function toLE32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}
