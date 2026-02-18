/**
 * Realms (SPL Governance) Integration for Ika Tensei
 *
 * Instead of custom DAO logic on-chain, we use Solana's battle-tested
 * SPL Governance program (Realms) for the Adventurer's Guild.
 *
 * Flow:
 * 1. After first reborn NFT minted for a collection → create Realm
 * 2. Reborn NFT = community token = governance power (1 NFT = 1 vote)
 * 3. NFT holders create proposals & vote via Realms UI (realms.today)
 *
 * SPL Governance Program: GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw
 * SDK: @solana/spl-governance
 */

import { PublicKey } from '@solana/web3.js';

// SPL Governance program ID (mainnet & devnet)
export const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey(
  'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
);

/**
 * Configuration for creating an Adventurer's Guild (Realms DAO)
 */
export interface GuildConfig {
  /** Human-readable name for the realm */
  name: string;
  /** The Metaplex Core collection mint used as community token */
  communityTokenMint: PublicKey;
  /** Min tokens to create governance (default: 1 = any NFT holder) */
  minCommunityTokensToCreateGovernance: number;
  /** Council token mint (optional, for team multisig) */
  councilTokenMint?: PublicKey;
  /** Voting cooloff time in seconds (default: 43200 = 12h) */
  votingCoolOffTime?: number;
  /** Max voting time in seconds (default: 259200 = 3 days) */
  maxVotingTime?: number;
  /** Vote threshold percentage (default: 60) */
  voteThresholdPercentage?: number;
}

/**
 * Derive the Realm address from name
 */
export function deriveRealmAddress(name: string): PublicKey {
  const [realm] = PublicKey.findProgramAddressSync(
    [Buffer.from('governance'), Buffer.from(name)],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return realm;
}

/**
 * Derive the token owner record for a wallet in a realm
 */
export function deriveTokenOwnerRecord(
  realm: PublicKey,
  governingTokenMint: PublicKey,
  owner: PublicKey
): PublicKey {
  const [tokenOwnerRecord] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('governance'),
      realm.toBuffer(),
      governingTokenMint.toBuffer(),
      owner.toBuffer(),
    ],
    SPL_GOVERNANCE_PROGRAM_ID
  );
  return tokenOwnerRecord;
}

/**
 * Create an Adventurer's Guild using SPL Governance (Realms).
 *
 * This creates a Realm where the community token is the Metaplex Core
 * collection from our reborn NFTs. 1 NFT = 1 vote.
 *
 * Usage with @solana/spl-governance SDK:
 *
 * ```ts
 * import { withCreateRealm, MintMaxVoteWeightSource } from '@solana/spl-governance';
 *
 * const instructions: TransactionInstruction[] = [];
 * const realmAddress = await withCreateRealm(
 *   instructions,
 *   SPL_GOVERNANCE_PROGRAM_ID,
 *   2, // program version
 *   config.name,
 *   payer.publicKey, // realm authority
 *   config.communityTokenMint,
 *   payer.publicKey, // payer
 *   config.councilTokenMint ?? undefined,
 *   MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
 *   new BN(config.minCommunityTokensToCreateGovernance),
 *   undefined, // community voter weight addin
 *   undefined, // max community voter weight addin
 *   undefined, // council voter weight addin
 *   undefined, // max council voter weight addin
 * );
 * ```
 *
 * After realm creation, NFT holders interact via:
 * - realms.today UI (automatic discovery)
 * - @solana/spl-governance SDK (programmatic)
 *
 * Key operations available to NFT holders:
 * - Deposit NFT as governing token
 * - Create proposals (treasury management, parameter changes)
 * - Vote on active proposals
 * - Execute passed proposals
 */
export function getGuildCreationGuide(config: GuildConfig): {
  realmAddress: PublicKey;
  sdkImports: string;
  steps: string[];
} {
  const realmAddress = deriveRealmAddress(config.name);

  return {
    realmAddress,
    sdkImports: `import { withCreateRealm, withCreateGovernance, withDepositGoverningTokens, MintMaxVoteWeightSource } from '@solana/spl-governance';`,
    steps: [
      `1. Install: npm install @solana/spl-governance`,
      `2. Create Realm with communityTokenMint = ${config.communityTokenMint.toBase58()}`,
      `3. Create Governance under the realm (sets voting rules)`,
      `4. NFT holders deposit tokens via withDepositGoverningTokens`,
      `5. Proposals created via withCreateProposal, voted via withCastVote`,
      `6. Realm auto-appears on realms.today`,
    ],
  };
}

/**
 * Default guild configuration for Ika Tensei collections
 */
export function defaultGuildConfig(
  collectionName: string,
  communityTokenMint: PublicKey
): GuildConfig {
  return {
    name: `Adventurer's Guild: ${collectionName}`,
    communityTokenMint,
    minCommunityTokensToCreateGovernance: 1,
    votingCoolOffTime: 43200, // 12 hours
    maxVotingTime: 259200, // 3 days
    voteThresholdPercentage: 60,
  };
}
