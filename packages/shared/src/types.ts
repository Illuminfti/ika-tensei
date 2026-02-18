/**
 * Shared types for Ika Tensei v3
 * Used by frontend, tests, and potentially relayer
 */

import { ChainId, CurveType } from './chains';

/**
 * Seal record stored on Sui
 * Corresponds to SealRecord in registry.move
 */
export interface SealRecord {
  sourceChainId: ChainId;
  sourceContract: string;
  tokenId: string;
  dwalletId: string;
  dwalletPubkey: Uint8Array;
  attestationDwalletId: string;
  attestationPubkey: Uint8Array;
  sealer: string;
  sealedAt: number;
  reborn: boolean;
  solanaMintAddress?: string;
  nonce: bigint;
  sealHash: string;
}

/**
 * Collection configuration
 * Corresponds to CollectionConfig in registry.move
 */
export interface CollectionConfig {
  collectionId: string;
  sourceChainId: ChainId;
  name: string;
  sealFee: bigint;
  maxSeals: bigint;
  currentSeals: bigint;
  active: boolean;
}

/**
 * Reincarnation record on Solana
 * Stored in ReincarnationRecord PDA
 */
export interface ReincarnationRecord {
  sealHash: Uint8Array;
  sourceChain: ChainId;
  sourceTokenId: Uint8Array;
  originalName: string;
  metadataUri: string;
  attestationPubkey: Uint8Array;
  recipient: Uint8Array;
  mint?: Uint8Array;
  minted: boolean;
  verifiedAt: number;
}

/**
 * Protocol configuration on Solana
 */
export interface ProtocolConfig {
  authority: Uint8Array;
  guildTreasury: Uint8Array;
  teamTreasury: Uint8Array;
  guildShareBps: number;
  mintFee: bigint;
  paused: boolean;
}

/**
 * dWallet information
 */
export interface DWalletInfo {
  id: string;
  pubkey: Uint8Array;
  curve: CurveType;
  createdAt: number;
}

/**
 * Seal status for UI
 */
export type SealStatus = 'pending' | 'sealed' | 'reborn' | 'failed';

/**
 * Seal progress steps
 */
export interface SealProgress {
  step: number;
  totalSteps: number;
  description: string;
  completed: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Full seal flow state
 */
export interface SealState {
  status: SealStatus;
  progress: SealProgress[];
  sourceChain: ChainId;
  collection?: CollectionConfig;
  tokenId: string;
  nftContract: string;
  dwallet?: DWalletInfo;
  attestationDwallet?: DWalletInfo;
  sealHash?: Uint8Array;
  signature?: Uint8Array;
  vaaBytes?: Uint8Array;
  solanaMintAddress?: string;
  solanaTxHash?: string;
  error?: string;
}

/**
 * Fee breakdown for sealing
 */
export interface SealFee {
  sourceChainFee: bigint;
  suiRelayerFee: bigint;
  ikaSigningFee: bigint;
  solanaMintFee: bigint;
  totalUsd: number;
  guildShare: bigint;
  teamShare: bigint;
}

/**
 * Wormhole VAA info
 */
export interface VAAInfo {
  chainId: ChainId;
  emitterAddress: string;
  sequence: bigint;
  timestamp: number;
  payload: Uint8Array;
  vaaBytes: Uint8Array;
}

/**
 * Cross-chain address derivation
 */
export interface CrossChainAddress {
  chainId: ChainId;
  address: string;
  pubkey: Uint8Array;
}

/**
 * Event types from Sui contracts
 */
export interface NFTSealedEvent {
  sealHash: string;
  sourceChain: number;
  sourceContract: string;
  tokenId: string;
  dwalletPubkey: Uint8Array;
  attestationPubkey: Uint8Array;
  sealer: string;
  vaaHash: string;
}

export interface NFTRebornEvent {
  sealHash: string;
  solanaMintAddress: string;
  caller: string;
}

export interface CollectionRegisteredEvent {
  collectionId: string;
  sourceChain: number;
  name: string;
}

/**
 * Solana program account types
 */
export interface CollectionConfigPDA {
  sourceChain: number;
  sourceContract: Uint8Array;
  name: string;
  maxSupply: bigint;
  totalMinted: bigint;
  active: boolean;
  bump: number;
}

export interface ReincarnationMintPDA {
  bump: number;
}

/**
 * Metadata for reborn NFT (immutable)
 */
export interface RebornMetadata {
  sealHash: string;
  sourceChainId: ChainId;
  sourceContract: string;
  originalTokenId: string;
  dwalletPubkey: Uint8Array;
  attestationSignature: Uint8Array;
  wormholeVaaHash: string;
}

/**
 * Transaction submission result
 */
export interface TxResult {
  success: boolean;
  txHash?: string;
  error?: string;
  blockNumber?: number;
}

/**
 * API response types for relayer
 */
export interface RelayResponse {
  success: boolean;
  txHash?: string;
  sealHash?: string;
  error?: string;
}

export interface CollectionRegistrationRequest {
  sourceChainId: ChainId;
  sourceContract: string;
  name: string;
  maxSeals: number;
  sealFee: bigint;
}

export interface SealRegistrationRequest {
  vaaBytes: Uint8Array;
  sealSignature: Uint8Array;
  attestationDwalletId: string;
}
