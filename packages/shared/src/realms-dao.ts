/**
 * Realms (SPL Governance) DAO Integration for Ika Tensei
 *
 * Provides functional SDK for creating and managing Adventurer's Guild DAOs
 * using Solana's SPL Governance program (Realms).
 *
 * SPL Governance Program: GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw
 * SDK: @solana/spl-governance v3
 *
 * 1 reborn NFT = 1 vote in the Adventurer's Guild
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  withCreateRealm,
  withCreateGovernance,
  withDepositGoverningTokens,
  withCreateProposal,
  withCastVote,
  MintMaxVoteWeightSource,
  VoteType,
  Vote,
  VoteKind,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  GovernanceConfig,
  getGovernanceAccount,
  Realm,
  Governance,
  TokenOwnerRecord,
} from '@solana/spl-governance';

// BN.js for big numbers - use require to bypass type conflicts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BN = require('bn.js') as unknown as { new (value: number | string | Uint8Array | number[]): any;prototype: any };

// ============================================================================
// Constants
// ============================================================================

/** SPL Governance Program ID (mainnet, devnet, testnet) */
export const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey(
  'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
);

/** Program version for SPL Governance */
export const PROGRAM_VERSION = 3;

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for creating an Adventurer's Guild (Realms DAO)
 */
export interface GuildConfig {
  /** Human-readable name for the realm (max 32 chars) */
  name: string;
  /** The Metaplex Core collection mint used as community token */
  communityTokenMint: PublicKey;
  /** Min tokens to create governance (default: 1 = any NFT holder) */
  minCommunityTokensToCreateGovernance?: number;
  /** Council token mint (optional, for team multisig) */
  councilTokenMint?: PublicKey;
  /** Voting cooloff time in seconds (default: 43200 = 12h) */
  votingCoolOffTime?: number;
  /** Max voting time in seconds (default: 259200 = 3 days) */
  maxVotingTime?: number;
  /** Vote threshold percentage (default: 60) */
  voteThresholdPercentage?: number;
  /** Community vote tipping mode (default: Early) */
  communityVoteTipping?: VoteTipping;
}

/**
 * Result from creating an Adventurer's Guild
 */
export interface CreateGuildResult {
  /** The Realm address */
  realmAddress: PublicKey;
  /** The Governance address */
  governanceAddress: PublicKey;
  /** Transaction signature */
  txSignature: string;
}

/**
 * Result from depositing an NFT to the Guild
 */
export interface DepositNftResult {
  /** The Token Owner Record address */
  tokenOwnerRecord: PublicKey;
  /** Transaction signature */
  txSignature: string;
}

/**
 * Result from creating a proposal
 */
export interface CreateProposalResult {
  /** The Proposal address */
  proposalAddress: PublicKey;
  /** Transaction signature */
  txSignature: string;
}

/**
 * Result from casting a vote
 */
export interface CastVoteResult {
  /** Transaction signature */
  txSignature: string;
}

/**
 * Guild information from on-chain state
 */
export interface GuildInfo {
  /** Realm address */
  realmAddress: PublicKey;
  /** Realm name */
  name: string;
  /** Realm authority (creator) */
  authority: PublicKey | undefined;
  /** Community token mint */
  communityTokenMint: PublicKey;
  /** Council token mint (if exists) */
  councilTokenMint?: PublicKey;
  /** Voting proposal count */
  votingProposalCount: number;
  /** Program version */
  programVersion: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Returns the default voting configuration for Ika Tensei Adventurer's Guild.
 *
 * - minCommunityTokensToCreateGovernance: 1 (any NFT holder can create governance)
 * - communityVoteThreshold: 60% YesVotePercentage
 * - minInstructionHoldUpTime: 0 (execute immediately after vote)
 * - baseVotingTime: 259200 (3 days in seconds)
 * - communityVoteTipping: Early (proposal passes early if threshold met)
 * - councilVoteThreshold: Disabled (no council)
 */
export function defaultGuildConfig(
  name: string,
  communityTokenMint: PublicKey,
  options?: Partial<GuildConfig>
): GuildConfig {
  return {
    name,
    communityTokenMint,
    minCommunityTokensToCreateGovernance: 1,
    votingCoolOffTime: 43200, // 12 hours
    maxVotingTime: 259200, // 3 days
    voteThresholdPercentage: 60,
    communityVoteTipping: VoteTipping.Early,
    ...options,
  };
}

/**
 * Creates the default GovernanceConfig for Ika Tensei Adventurer's Guild
 */
export function createDefaultGovernanceConfig(config: GuildConfig): GovernanceConfig {
  // Use disabled threshold for council (not used in Ika Tensei)
  const disabledThreshold = new VoteThreshold({
    type: VoteThresholdType.Disabled,
    value: undefined,
  });

  return {
    communityVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: config.voteThresholdPercentage ?? 60,
    }),
    minCommunityTokensToCreateProposal: new BN(config.minCommunityTokensToCreateGovernance ?? 1),
    minInstructionHoldUpTime: 0, // Execute immediately after vote passes
    baseVotingTime: config.maxVotingTime ?? 259200, // 3 days
    votingCoolOffTime: config.votingCoolOffTime ?? 43200, // 12 hours
    communityVoteTipping: config.communityVoteTipping ?? VoteTipping.Early,
    minCouncilTokensToCreateProposal: new BN(0),
    councilVoteThreshold: disabledThreshold,
    councilVetoVoteThreshold: disabledThreshold,
    communityVetoVoteThreshold: disabledThreshold,
    councilVoteTipping: VoteTipping.Disabled,
    depositExemptProposalCount: 0,
  };
}

// ============================================================================
// PDA Derivation Helpers
// ============================================================================

/**
 * Derives the Realm address from a name.
 *
 * @param name - The realm name
 * @returns The Realm PDA address
 */
export function deriveRealmAddress(name: string): PublicKey {
  const [realm] = PublicKey.findProgramAddressSync(
    [Buffer.from('governance'), Buffer.from(name)],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return realm;
}

/**
 * Derives the Governance address for a realm.
 *
 * @param realmAddress - The Realm address
 * @param governingTokenMint - The governing token mint
 * @returns The Governance PDA address
 */
export function deriveGovernanceAddress(
  realmAddress: PublicKey,
  governingTokenMint: PublicKey
): PublicKey {
  const [governance] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('governance'),
      realmAddress.toBuffer(),
      governingTokenMint.toBuffer(),
    ],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return governance;
}

/**
 * Derives the Token Owner Record address.
 *
 * @param realmAddress - The Realm address
 * @param governingTokenMint - The governing token mint
 * @param owner - The token owner wallet
 * @returns The Token Owner Record PDA address
 */
export function deriveTokenOwnerRecord(
  realmAddress: PublicKey,
  governingTokenMint: PublicKey,
  owner: PublicKey
): PublicKey {
  const [tokenOwnerRecord] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('governance'),
      realmAddress.toBuffer(),
      governingTokenMint.toBuffer(),
      owner.toBuffer(),
    ],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return tokenOwnerRecord;
}

/**
 * Derives the Proposal address.
 *
 * @param governanceAddress - The Governance address
 * @param tokenOwnerRecord - The Token Owner Record address
 * @param proposalIndex - The proposal index
 * @returns The Proposal PDA address
 */
export function deriveProposalAddress(
  governanceAddress: PublicKey,
  tokenOwnerRecord: PublicKey,
  proposalIndex: number
): PublicKey {
  const [proposal] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('governance'),
      governanceAddress.toBuffer(),
      tokenOwnerRecord.toBuffer(),
      new BN(proposalIndex).toArrayLike(Buffer, 'le', 4),
    ],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return proposal;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Creates an Adventurer's Guild (Realm + Governance) for a collection.
 *
 * After a reborn NFT collection is created, call this to initialize the DAO
 * where NFT holders can create proposals and vote.
 *
 * @param connection - Solana connection
 * @param payer - Payer keypair (pays for transaction fees)
 * @param config - Guild configuration
 * @returns Result with realmAddress, governanceAddress, and txSignature
 *
 * @example
 * ```typescript
 * const result = await createAdventurersGuild(
 *   connection,
 *   payer,
 *   {
 *     name: "Ika Tensei Adventurers",
 *     communityTokenMint: collectionMint,
 *   }
 * );
 * console.log(`Realm: ${result.realmAddress.toBase58()}`);
 * console.log(`Governance: ${result.governanceAddress.toBase58()}`);
 * ```
 */
export async function createAdventurersGuild(
  connection: Connection,
  payer: Keypair,
  config: GuildConfig
): Promise<CreateGuildResult> {
  const instructions: TransactionInstruction[] = [];

  // Derive realm address
  const realmAddress = deriveRealmAddress(config.name);

  // Create the Realm
  withCreateRealm(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    config.name,
    payer.publicKey, // realm authority
    config.communityTokenMint,
    payer.publicKey, // payer
    config.councilTokenMint, // council mint (optional)
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION, // Use full supply as max
    new BN(config.minCommunityTokensToCreateGovernance ?? 1),
    undefined, // communityTokenConfig
    undefined // councilTokenConfig
  );

  // Create Governance under the realm
  // withCreateGovernance takes: instructions, programId, programVersion, realm, 
  // governedAccount, config, tokenOwnerRecord, payer, createAuthority, voterWeightRecord
  const governanceAddress = await withCreateGovernance(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    realmAddress,
    config.communityTokenMint, // governedAccount - the community mint
    createDefaultGovernanceConfig(config),
    payer.publicKey, // tokenOwnerRecord - create for the payer
    payer.publicKey, // payer
    payer.publicKey, // createAuthority
    undefined // voterWeightRecord
  );

  // Send the transaction
  const transaction = new Transaction().add(...instructions);
  const txSignature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  return {
    realmAddress,
    governanceAddress,
    txSignature,
  };
}

/**
 * Deposits an NFT as a governance token into the Guild.
 *
 * This registers the NFT holder's voting power in the DAO.
 * Must be called before the holder can create proposals or vote.
 *
 * @param connection - Solana connection
 * @param payer - Payer keypair (pays for transaction fees)
 * @param realmAddress - The Realm address
 * @param governingTokenMint - The governing token mint (community token)
 * @param nftMint - The NFT mint being deposited
 * @param tokenOwner - The wallet owning the NFT
 * @returns Result with tokenOwnerRecord and txSignature
 *
 * @example
 * ```typescript
 * const result = await depositNftToGuild(
 *   connection,
 *   payer,
 *   realmAddress,
 *   communityTokenMint,
 *   nftMint,
 *   tokenOwner // NFT holder's wallet
 * );
 * console.log(`Token Owner Record: ${result.tokenOwnerRecord.toBase58()}`);
 * ```
 */
export async function depositNftToGuild(
  connection: Connection,
  payer: Keypair,
  realmAddress: PublicKey,
  governingTokenMint: PublicKey,
  nftMint: PublicKey,
  tokenOwner: PublicKey
): Promise<DepositNftResult> {
  const instructions: TransactionInstruction[] = [];

  // For NFTs, we deposit 1 token - the governingTokenSource is the NFT mint itself
  const tokenOwnerRecord = await withDepositGoverningTokens(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    realmAddress,
    nftMint, // governingTokenSource - the NFT mint being deposited
    governingTokenMint, // governingTokenMint - the community mint
    tokenOwner, // governingTokenOwner - the NFT owner
    tokenOwner, // governingTokenSourceAuthority - the NFT owner signs
    payer.publicKey, // payer
    new BN(1), // amount - 1 NFT = 1 vote
    true // governingTokenOwnerIsSigner
  );

  // Send the transaction
  const transaction = new Transaction().add(...instructions);
  const txSignature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  return {
    tokenOwnerRecord,
    txSignature,
  };
}

/**
 * Creates a governance proposal in the Adventurer's Guild.
 *
 * @param connection - Solana connection
 * @param payer - Payer keypair (pays for transaction fees)
 * @param realmAddress - The Realm address
 * @param governanceAddress - The Governance address
 * @param governingTokenMint - The governing token mint
 * @param name - Proposal name
 * @param descriptionLink - Link to proposal description (IPFS, etc.)
 * @param proposalIndex - Proposal index (must be unique per governance)
 * @returns Result with proposalAddress and txSignature
 *
 * @example
 * ```typescript
 * const result = await createProposal(
 *   connection,
 *   payer,
 *   realmAddress,
 *   governanceAddress,
 *   communityTokenMint,
 *   "Treasury Grant Request",
 *   "https://ipfs.io/Qm...",
 *   0
 * );
 * console.log(`Proposal: ${result.proposalAddress.toBase58()}`);
 * ```
 */
export async function createProposal(
  connection: Connection,
  payer: Keypair,
  realmAddress: PublicKey,
  governanceAddress: PublicKey,
  governingTokenMint: PublicKey,
  name: string,
  descriptionLink: string,
  proposalIndex: number
): Promise<CreateProposalResult> {
  const instructions: TransactionInstruction[] = [];

  // Get token owner record for the proposer
  const tokenOwnerRecord = deriveTokenOwnerRecord(
    realmAddress,
    governingTokenMint,
    payer.publicKey
  );

  // withCreateProposal takes 16 arguments
  const proposalAddress = await withCreateProposal(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    realmAddress,
    governanceAddress,
    tokenOwnerRecord,
    name,
    descriptionLink,
    governingTokenMint,
    payer.publicKey, // governanceAuthority - the proposer
    new BN(proposalIndex),
    VoteType.SINGLE_CHOICE, // voteType
    [], // options - empty array for no additional instructions
    true, // useDenyOption
    payer.publicKey, // payer
    undefined // voterWeightRecord
  );

  // Send the transaction
  const transaction = new Transaction().add(...instructions);
  const txSignature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  return {
    proposalAddress,
    txSignature,
  };
}

/**
 * Casts a vote on a governance proposal.
 *
 * @param connection - Solana connection
 * @param payer - Payer keypair (pays for transaction fees)
 * @param realmAddress - The Realm address
 * @param governanceAddress - The Governance address
 * @param proposalAddress - The Proposal address
 * @param governingTokenMint - The governing token mint
 * @param approve - Vote choice: true = yes/approve, false = no/deny
 * @returns Result with txSignature
 *
 * @example
 * ```typescript
 * const result = await castVote(
 *   connection,
 *   payer,
 *   realmAddress,
 *   governanceAddress,
 *   proposalAddress,
 *   communityTokenMint,
 *   true // vote yes
 * );
 * console.log(`Vote cast: ${result.txSignature}`);
 * ```
 */
export async function castVote(
  connection: Connection,
  payer: Keypair,
  realmAddress: PublicKey,
  governanceAddress: PublicKey,
  proposalAddress: PublicKey,
  governingTokenMint: PublicKey,
  approve: boolean
): Promise<CastVoteResult> {
  const instructions: TransactionInstruction[] = [];

  // Get token owner record for the voter
  const tokenOwnerRecord = deriveTokenOwnerRecord(
    realmAddress,
    governingTokenMint,
    payer.publicKey
  );

  // Create Vote object based on choice
  const vote = new Vote({
    voteType: approve ? VoteKind.Approve : VoteKind.Deny,
    approveChoices: approve ? [] : undefined,
    deny: !approve ? true : undefined,
    veto: undefined,
  });

  // withCastVote takes: instructions, programId, programVersion, realm, governance,
  // proposal, proposalOwnerRecord, tokenOwnerRecord, governanceAuthority,
  // voteGoverningTokenMint, vote, payer, voterWeightRecord, maxVoterWeightRecord
  await withCastVote(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    realmAddress,
    governanceAddress,
    proposalAddress,
    tokenOwnerRecord, // proposalOwnerRecord
    tokenOwnerRecord,
    payer.publicKey, // governanceAuthority
    governingTokenMint,
    vote,
    payer.publicKey // payer
  );

  // Send the transaction
  const transaction = new Transaction().add(...instructions);
  const txSignature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  return {
    txSignature,
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetches guild (realm) information from the blockchain.
 *
 * @param connection - Solana connection
 * @param realmAddress - The Realm address
 * @returns Guild information including name, authority, token counts, etc.
 *
 * @example
 * ```typescript
 * const info = await getGuildInfo(connection, realmAddress);
 * console.log(`Guild: ${info.name}`);
 * console.log(`Authority: ${info.authority.toBase58()}`);
 * console.log(`Proposals: ${info.votingProposalCount}`);
 * ```
 */
export async function getGuildInfo(
  connection: Connection,
  realmAddress: PublicKey
): Promise<GuildInfo> {
  const realmAccount = await getGovernanceAccount<Realm>(
    connection,
    realmAddress,
    Realm
  );

  return {
    realmAddress,
    name: realmAccount.account.name,
    authority: realmAccount.account.authority,
    communityTokenMint: realmAccount.account.communityMint,
    councilTokenMint: realmAccount.account.config.councilMint,
    votingProposalCount: realmAccount.account.votingProposalCount,
    programVersion: PROGRAM_VERSION,
  };
}

/**
 * Fetches governance information for a realm.
 *
 * @param connection - Solana connection
 * @param governanceAddress - The Governance address
 * @returns Governance details
 */
export async function getGovernanceInfo(
  connection: Connection,
  governanceAddress: PublicKey
): Promise<Governance | null> {
  try {
    const govAccount = await getGovernanceAccount<Governance>(
      connection,
      governanceAddress,
      Governance
    );
    return govAccount.account;
  } catch {
    return null;
  }
}

/**
 * Fetches the token owner record for a wallet.
 *
 * @param connection - Solana connection
 * @param realmAddress - The Realm address
 * @param governingTokenMint - The governing token mint
 * @param owner - The token owner wallet
 * @returns Token owner record or null if not found
 */
export async function getTokenOwnerRecordInfo(
  connection: Connection,
  realmAddress: PublicKey,
  governingTokenMint: PublicKey,
  owner: PublicKey
): Promise<TokenOwnerRecord | null> {
  const tokenOwnerRecord = deriveTokenOwnerRecord(
    realmAddress,
    governingTokenMint,
    owner
  );

  try {
    const recordAccount = await getGovernanceAccount<TokenOwnerRecord>(
      connection,
      tokenOwnerRecord,
      TokenOwnerRecord
    );
    return recordAccount.account;
  } catch {
    return null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a Realm exists for the given name.
 *
 * @param connection - Solana connection
 * @param name - The realm name
 * @returns True if realm exists
 */
export async function guildExists(
  connection: Connection,
  name: string
): Promise<boolean> {
  try {
    const realmAddress = deriveRealmAddress(name);
    await getGuildInfo(connection, realmAddress);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a wallet has voting power in a guild.
 *
 * @param connection - Solana connection
 * @param realmAddress - The Realm address
 * @param governingTokenMint - The governing token mint
 * @param owner - The wallet to check
 * @returns True if wallet has deposited tokens
 */
export async function hasVotingPower(
  connection: Connection,
  realmAddress: PublicKey,
  governingTokenMint: PublicKey,
  owner: PublicKey
): Promise<boolean> {
  const record = await getTokenOwnerRecordInfo(
    connection,
    realmAddress,
    governingTokenMint,
    owner
  );
  return record !== null && record.governingTokenDepositAmount.cmpn(0) > 0;
}

// ============================================================================
// Export Helper
// ============================================================================

/**
 * Creates a transaction instruction array for creating a guild.
 * Useful when you want to bundle with other instructions.
 *
 * @param config - Guild configuration
 * @param payer - Payer public key
 * @returns Object with instructions and derived addresses
 */
export function createGuildInstructions(
  config: GuildConfig,
  payer: PublicKey
): {
  instructions: TransactionInstruction[];
  realmAddress: PublicKey;
  governanceAddress: PublicKey;
} {
  const instructions: TransactionInstruction[] = [];
  const realmAddress = deriveRealmAddress(config.name);

  withCreateRealm(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    PROGRAM_VERSION,
    config.name,
    payer,
    config.communityTokenMint,
    payer,
    config.councilTokenMint,
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
    new BN(config.minCommunityTokensToCreateGovernance ?? 1),
    undefined,
    undefined
  );

  // Note: This is async so can't be used in a sync context
  // Use createAdventurersGuild for full transaction building
  const governanceAddress = deriveGovernanceAddress(
    realmAddress,
    config.communityTokenMint
  );

  return {
    instructions,
    realmAddress,
    governanceAddress,
  };
}
