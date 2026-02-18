/**
 * Realms DAO Creator Service
 * 
 * Handles creation and management of Realms DAOs (Adventurer's Guilds)
 * for Ika Tensei NFT collections.
 * 
 * Flow:
 * 1. Check if Realm exists (cache + on-chain)
 * 2. Create Realm if needed
 * 3. Deposit NFT as governance token
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  withCreateRealm,
  withCreateGovernance,
  withDepositGoverningTokens,
  getRealm,
  GovernanceConfig,
  MintMaxVoteWeightSource,
  VoteThreshold,
  VoteTipping,
} from '@solana/spl-governance';
import type { Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

// SPL Governance Program ID
export const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey(
  'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
);

// Program version
const PROGRAM_VERSION = 3;

// Default Guild Configuration
const DEFAULT_MIN_COMMUNITY_TOKENS_TO_CREATE_GOVERNANCE = 1;
const DEFAULT_COMMUNITY_VOTE_THRESHOLD = 60; // 60%
const DEFAULT_BASE_VOTING_TIME = 259200; // 3 days in seconds

export interface RealmsCreator {
  initialize(): Promise<void>;
  ensureGuildExists(
    collectionName: string,
    communityTokenMint: PublicKey,
  ): Promise<{ realmAddress: PublicKey; governanceAddress: PublicKey }>;
  depositNft(
    realmAddress: PublicKey,
    communityTokenMint: PublicKey,
    nftMint: PublicKey,
  ): Promise<{ tokenOwnerRecord: PublicKey; txSignature: string }>;
}

export interface GuildResult {
  realmAddress: PublicKey;
  governanceAddress: PublicKey;
}

export interface DepositResult {
  tokenOwnerRecord: PublicKey;
  txSignature: string;
}

export function createRealmsCreator(
  config: RelayerConfig,
  logger: Logger,
): RealmsCreator {
  const { solanaRpcUrl, solanaKeypairBytes } = config;

  const connection = new Connection(solanaRpcUrl, 'confirmed');

  // Create keypair from bytes
  const secretKey = new Uint8Array(64);
  secretKey.set(solanaKeypairBytes.slice(0, 64));
  const keypair = Keypair.fromSecretKey(secretKey);

  // Cache of collection name -> realm address
  const realmCache = new Map<string, PublicKey>();

  // Cache of realm -> governance address
  const governanceCache = new Map<string, PublicKey>();

  async function initialize(): Promise<void> {
    logger.info('Initializing Realms Creator service...');
    // Verify connection
    const version = await connection.getVersion();
    logger.debug(`Connected to Solana RPC: ${version['solana-core']}`);
    logger.info('Realms Creator initialized');
  }

  async function ensureGuildExists(
    collectionName: string,
    communityTokenMint: PublicKey,
  ): Promise<GuildResult> {
    logger.info(`Ensuring guild exists for: ${collectionName}`);

    // Check cache first
    const cachedRealm = realmCache.get(collectionName);
    if (cachedRealm) {
      logger.debug(`Realm found in cache: ${cachedRealm.toBase58()}`);
      // Get governance for this realm
      const governanceAddress = await getOrCreateGovernance(
        cachedRealm,
        communityTokenMint,
      );
      return { realmAddress: cachedRealm, governanceAddress };
    }

    // Check on-chain
    try {
      const realmAccount = await getRealm(connection, communityTokenMint);
      if (realmAccount) {
        logger.debug(`Realm found on-chain: ${realmAccount.pubkey.toBase58()}`);
        realmCache.set(collectionName, realmAccount.pubkey);
        const governanceAddress = await getOrCreateGovernance(
          realmAccount.pubkey,
          communityTokenMint,
        );
        return { realmAddress: realmAccount.pubkey, governanceAddress };
      }
    } catch (err) {
      logger.debug(`No existing realm found, will create new one`);
    }

    // Create new Realm
    logger.info(`Creating new Realm for: ${collectionName}`);
    const realmAddress = await createRealm(collectionName, communityTokenMint);
    realmCache.set(collectionName, realmAddress);

    // Create governance for the community token
    const governanceAddress = await getOrCreateGovernance(
      realmAddress,
      communityTokenMint,
    );

    logger.info(`Guild created: ${realmAddress.toBase58()}`);
    return { realmAddress, governanceAddress };
  }

  async function createRealm(
    collectionName: string,
    communityTokenMint: PublicKey,
  ): Promise<PublicKey> {
    const instructions: TransactionInstruction[] = [];

    // Create realm instruction - use type assertions to handle BN version conflict
    const realmAddress = await withCreateRealm(
      instructions,
      SPL_GOVERNANCE_PROGRAM_ID,
      PROGRAM_VERSION,
      collectionName.slice(0, 32), // name
      keypair.publicKey, // realmAuthority
      communityTokenMint, // communityMint
      keypair.publicKey, // payer
      undefined, // councilMint (none)
      new MintMaxVoteWeightSource({
        type: 1, // Fraction
        value: 100 as any,
      }),
      1 as any,
    );

    // Execute transaction
    const transaction = new Transaction().add(...instructions);
    const sig = await sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);
    logger.debug(`Realm creation tx: ${sig}`);

    return realmAddress;
  }

  async function getOrCreateGovernance(
    realmAddress: PublicKey,
    communityTokenMint: PublicKey,
  ): Promise<PublicKey> {
    const cacheKey = realmAddress.toBase58();
    const cached = governanceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const instructions: TransactionInstruction[] = [];

    // Governance config - use any to bypass complex type requirements
    const config: any = {
      // Voting time (3 days)
      baseVotingTime: DEFAULT_BASE_VOTING_TIME,
      // Vote threshold (60%)
      communityVoteThreshold: new VoteThreshold({
        type: 1, // Percentage
        value: DEFAULT_COMMUNITY_VOTE_THRESHOLD,
      }),
      // Vote tipping (Early)
      communityVoteTipping: VoteTipping.Early,
      // Min tokens to create governance
      minTokensToCreateGovernance: 1,
      // Min instruction hold up time
      minInstructionHoldUpTime: 0,
      // Proposal cool off time
      votingCoolOffTime: 0,
      // Min community tokens to create proposal
      minCommunityTokensToCreateProposal: 1,
    };

    // Create governance for the community token
    // Note: The governedAccount will be the token mint itself (the NFT collection)
    const governanceAddress = await withCreateGovernance(
      instructions,
      SPL_GOVERNANCE_PROGRAM_ID,
      PROGRAM_VERSION,
      realmAddress,
      communityTokenMint, // governedAccount - the mint
      config,
      keypair.publicKey, // tokenOwnerRecord
      keypair.publicKey, // payer
      keypair.publicKey, // createAuthority
    );

    // Execute transaction
    const transaction = new Transaction().add(...instructions);
    const sig = await sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);
    logger.debug(`Governance creation tx: ${sig}`);

    governanceCache.set(cacheKey, governanceAddress);
    return governanceAddress;
  }

  async function depositNft(
    realmAddress: PublicKey,
    communityTokenMint: PublicKey,
    nftMint: PublicKey,
  ): Promise<DepositResult> {
    logger.info(`Depositing NFT as governance token: ${nftMint.toBase58()}`);

    const instructions: TransactionInstruction[] = [];

    // For NFT deposits, we need to deposit the NFT mint itself as governing token
    // The governing token source would be the NFT mint (not a token account since NFTs are singular)
    // Actually for SPL governance, we need a source - for NFTs, this is typically the mint itself
    // and the amount is 1
    
    // Deposit the NFT mint as governing token
    // governingTokenSource: The source of the tokens (for NFTs, this is the mint itself)
    const tokenOwnerRecord = await withDepositGoverningTokens(
      instructions,
      SPL_GOVERNANCE_PROGRAM_ID,
      PROGRAM_VERSION,
      realmAddress,
      nftMint, // governingTokenSource (the NFT mint)
      nftMint, // governingTokenMint
      keypair.publicKey, // governingTokenOwner
      keypair.publicKey, // governingTokenSourceAuthority
      keypair.publicKey, // payer
      1 as any, // amount (1 NFT = 1 vote)
      true, // governingTokenOwnerIsSigner
    );

    // Execute transaction
    const transaction = new Transaction().add(...instructions);
    const sig = await sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);

    logger.info(`NFT deposited as governance token: ${sig}`);
    logger.debug(`Token owner record: ${tokenOwnerRecord.toBase58()}`);

    return {
      tokenOwnerRecord,
      txSignature: sig,
    };
  }

  return {
    initialize,
    ensureGuildExists,
    depositNft,
  };
}
