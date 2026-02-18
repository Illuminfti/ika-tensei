/**
 * Chain definitions for Ika Tensei v3
 * Maps our chain IDs to Wormhole chain IDs and defines metadata
 */

export enum ChainId {
  ETHEREUM = 1,
  SUI = 2,
  SOLANA = 3,
  NEAR = 4,
  BITCOIN = 5,
}

/** Wormhole chain IDs */
export enum WormholeChainId {
  ETHEREUM = 2,
  SOLANA = 1,
  SUI = 21,
  NEAR = 15,
  // Bitcoin not supported by Wormhole
}

/** Cryptographic curve types for dWallets */
export enum CurveType {
  ED25519 = 'ed25519',
  SECP256K1 = 'secp256k1',
}

/** Chain curve mapping - which curve each chain uses for dWallets */
export const CHAIN_CURVE_MAP: Record<ChainId, CurveType> = {
  [ChainId.ETHEREUM]: CurveType.SECP256K1,
  [ChainId.SUI]: CurveType.ED25519,
  [ChainId.SOLANA]: CurveType.ED25519,
  [ChainId.NEAR]: CurveType.ED25519,
  [ChainId.BITCOIN]: CurveType.SECP256K1,
};

/** NFT standards per chain */
export enum NFTStandard {
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155',
  SPL = 'SPL',
  SUI_OBJECT = 'Sui Object',
  ORDINALS = 'Ordinals',
  NEP171 = 'NEP-171',
}

/** Chain metadata */
export interface ChainMetadata {
  name: string;
  nftStandard: NFTStandard;
  addressFormat: 'hex' | 'base58' | 'base64' | 'bech32';
  nativeToken: string;
  decimals: number;
}

/** Full chain metadata map */
export const CHAIN_METADATA: Record<ChainId, ChainMetadata> = {
  [ChainId.ETHEREUM]: {
    name: 'Ethereum',
    nftStandard: NFTStandard.ERC721,
    addressFormat: 'hex',
    nativeToken: 'ETH',
    decimals: 18,
  },
  [ChainId.SUI]: {
    name: 'Sui',
    nftStandard: NFTStandard.SUI_OBJECT,
    addressFormat: 'hex', // Object ID in hex
    nativeToken: 'SUI',
    decimals: 9,
  },
  [ChainId.SOLANA]: {
    name: 'Solana',
    nftStandard: NFTStandard.SPL,
    addressFormat: 'base58',
    nativeToken: 'SOL',
    decimals: 9,
  },
  [ChainId.NEAR]: {
    name: 'Near',
    nftStandard: NFTStandard.NEP171,
    addressFormat: 'base58',
    nativeToken: 'NEAR',
    decimals: 24,
  },
  [ChainId.BITCOIN]: {
    name: 'Bitcoin',
    nftStandard: NFTStandard.ORDINALS,
    addressFormat: 'bech32',
    nativeToken: 'BTC',
    decimals: 8,
  },
};

/** Map our chain ID to Wormhole chain ID */
export function toWormholeChainId(chainId: ChainId): WormholeChainId | null {
  switch (chainId) {
    case ChainId.ETHEREUM:
      return WormholeChainId.ETHEREUM;
    case ChainId.SOLANA:
      return WormholeChainId.SOLANA;
    case ChainId.SUI:
      return WormholeChainId.SUI;
    case ChainId.NEAR:
      return WormholeChainId.NEAR;
    case ChainId.BITCOIN:
      // Bitcoin not supported by Wormhole
      return null;
    default:
      return null;
  }
}

/** Map Wormhole chain ID to our chain ID */
export function fromWormholeChainId(wormholeId: WormholeChainId): ChainId | null {
  switch (wormholeId) {
    case WormholeChainId.ETHEREUM:
      return ChainId.ETHEREUM;
    case WormholeChainId.SOLANA:
      return ChainId.SOLANA;
    case WormholeChainId.SUI:
      return ChainId.SUI;
    case WormholeChainId.NEAR:
      return ChainId.NEAR;
    default:
      return null;
  }
}

/** Destination chain is always Solana (3) */
export const DESTINATION_CHAIN_ID = ChainId.SOLANA;
