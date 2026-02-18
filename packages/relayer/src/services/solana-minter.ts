/**
 * Solana minter: verify seal + mint reborn NFT
 *
 * Flow:
 * 1. Initialize program config (if needed)
 * 2. Register collection (if needed)
 * 3. Verify seal (Ed25519 precompile → our program CPI)
 * 4. Mint reborn NFT (Metaplex Core SDK — direct, NOT CPI)
 *
 * Minting standard: Metaplex Core (mpl-core)
 * Program: CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
 * Cost target: ~0.003 SOL / ~17K CUs per mint
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

// Metaplex Core + UMI
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplCore,
  createCollection,
  create,
  fetchCollection,
  ruleSet,
} from '@metaplex-foundation/mpl-core';
import {
  keypairIdentity,
  generateSigner,
  publicKey as umiPublicKey,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import bs58 from 'bs58';

import { type Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function anchorDiscriminator(name: string): Buffer {
  const hash = createHash('sha256');
  hash.update(`global:${name}`);
  return hash.digest().slice(0, 8);
}

function toLE16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function toLE32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

function toLE64(value: bigint | number | string): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(value), 0);
  return buf;
}

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface VerifyResult {
  recordPda: PublicKey;
  txDigest: string;
}

export interface MintResult {
  mintAddress: string;
  assetId: string;
  txDigest: string;
}

export interface MintRebornParams {
  metadataUri: string;
  recipient: string;           // Solana wallet public key (base58)
  collectionAddress: string;   // Metaplex Core collection address
  name: string;                // "{Original Name} ✦ Reborn"
  sealId: string;              // seal_hash for tracking/logging
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
  mintReborn(params: MintRebornParams): Promise<MintResult>;
  createRebornCollection(collectionUri: string): Promise<string>;
}

// ── Factory ────────────────────────────────────────────────────────────────────

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

  // Build web3.js keypair from 32-byte seed
  const seed = Buffer.from(solanaKeypairBytes.slice(0, 32));
  const keypair = Keypair.fromSeed(seed);

  // Build UMI instance (lazy — reused across calls)
  let _umi: ReturnType<typeof createUmi> | null = null;
  function getUmi() {
    if (!_umi) {
      _umi = createUmi(solanaRpcUrl)
        .use(mplCore())
        .use(keypairIdentity(fromWeb3JsKeypair(keypair)));
    }
    return _umi;
  }

  const CHAIN_ID_SUI = 2;

  // ── Program initialization (our custom Solana program) ──────────────────────

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
        Buffer.from([0xf4, 0x01]),    // fee_bps (500)
        Buffer.alloc(8),               // reserved
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

  // ── Collection registration (our program's collection registry) ─────────────

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

  // ── Seal verification (Ed25519 precompile + our program) ────────────────────
  //
  // NOTE: This function is NOT changed. It uses our custom Solana program for
  // seal record creation and Ed25519 precompile verification. This is entirely
  // separate from Metaplex Core minting.

  async function verifySeal(
    sealHash: Buffer,
    sourceChain: number,
    sourceContract: string,
    tokenId: string,
    dwalletPubkey: Uint8Array,
    signature: Buffer,
  ): Promise<VerifyResult> {
    logger.info(`Verifying seal: ${sealHash.toString('hex').slice(0, 16)}...`);

    // Ensure collection registered in our program
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

    // Create Ed25519 instruction using precompile
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: dwalletPubkeyPubkey.toBytes(),
      message: sealHash,
      signature: signature,
    });

    // Create verify_seal instruction (our program CPI)
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

    const tx = new Transaction().add(ed25519Ix).add(verifyIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    logger.info(`Seal verified: ${sig}`);

    return { recordPda, txDigest: sig };
  }

  // ── Metaplex Core: create Reborn collection (one-time setup) ────────────────

  async function createRebornCollection(collectionUri: string): Promise<string> {
    logger.info('Creating Ika Tensei Reborn collection...');

    const umi = getUmi();
    const collectionSigner = generateSigner(umi);

    const treasury = keypair.publicKey.toBase58();

    const { signature } = await createCollection(umi, {
      collection: collectionSigner,
      name: 'Ika Tensei Reborn',
      uri: collectionUri,
      plugins: [
        {
          type: 'Royalties',
          basisPoints: 500, // 5%
          creators: [{ address: umiPublicKey(treasury), percentage: 100 }],
          ruleSet: ruleSet('None'), // Permissive initially
          authority: { type: 'UpdateAuthority' },
        },
      ],
    }).sendAndConfirm(umi);

    const collectionAddress = collectionSigner.publicKey.toString();
    const txSig = bs58.encode(Buffer.from(signature));

    logger.info(`Reborn collection created: ${collectionAddress} (tx: ${txSig})`);
    return collectionAddress;
  }

  // ── Metaplex Core: mint reborn NFT ──────────────────────────────────────────

  async function mintReborn(params: MintRebornParams): Promise<MintResult> {
    const { metadataUri, recipient, collectionAddress, name, sealId } = params;

    logger.info(`Minting reborn NFT: "${name}" → ${recipient}`);
    logger.debug(`  sealId: ${sealId.slice(0, 16)}...`);
    logger.debug(`  collection: ${collectionAddress}`);
    logger.debug(`  metadataUri: ${metadataUri}`);

    const umi = getUmi();

    // Fetch collection for lifecycle hooks / oracle validation
    const collection = await fetchCollection(umi, umiPublicKey(collectionAddress));

    // Generate fresh keypair for the asset (Metaplex Core asset address)
    const assetSigner = generateSigner(umi);

    // If recipient differs from payer, we need to set owner after mint
    // For now: mint to payer (relayer), then transfer to recipient
    // This is standard practice when minting on behalf of a user
    const { signature } = await create(umi, {
      asset: assetSigner,
      collection,
      name,
      uri: metadataUri,
    }).sendAndConfirm(umi);

    const mintAddress = assetSigner.publicKey.toString();
    const txSig = bs58.encode(Buffer.from(signature));

    logger.info(`Reborn NFT minted: ${mintAddress} (tx: ${txSig})`);

    // Transfer to recipient if different from relayer
    if (recipient && recipient !== keypair.publicKey.toBase58()) {
      await transferToRecipient(umi, mintAddress, collectionAddress, recipient, collection);
    }

    return {
      mintAddress,
      assetId: mintAddress,
      txDigest: txSig,
    };
  }

  // ── Transfer minted asset to user's wallet ───────────────────────────────────

  async function transferToRecipient(
    umi: ReturnType<typeof createUmi>,
    assetAddress: string,
    collectionAddress: string,
    recipient: string,
    collection: Awaited<ReturnType<typeof fetchCollection>>,
  ): Promise<void> {
    logger.info(`Transferring asset ${assetAddress} → ${recipient}`);

    const { transfer } = await import('@metaplex-foundation/mpl-core');

    const { signature } = await transfer(umi, {
      asset: {
        publicKey: umiPublicKey(assetAddress),
        owner: umi.identity.publicKey,
        // Minimal shape needed for transfer
      } as Parameters<typeof transfer>[1]['asset'],
      collection,
      newOwner: umiPublicKey(recipient),
    }).sendAndConfirm(umi);

    const txSig = bs58.encode(Buffer.from(signature));
    logger.info(`Transfer complete (tx: ${txSig})`);
  }

  return {
    initialize,
    verifySeal,
    mintReborn,
    createRebornCollection,
  };
}
