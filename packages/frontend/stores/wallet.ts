import { create } from "zustand";

export interface NFT {
  id: string;
  name: string;
  image: string;
  chain: "ethereum" | "sui" | "solana";
  contractAddress: string;
  tokenId: string;
}

export interface SealStatus {
  nft: NFT;
  step: number; // 0-5
  status: "pending" | "sealing" | "signing" | "minting" | "complete" | "error";
  txHash?: string;
  rebornMint?: string;
  error?: string;
}

interface WalletState {
  // Connection
  isConnected: boolean;
  ethAddress: string | null;
  solAddress: string | null;
  suiAddress: string | null;

  // NFTs
  nfts: NFT[];
  selectedNft: NFT | null;
  isLoadingNfts: boolean;

  // Seal flow
  sealStatus: SealStatus | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setEthAddress: (address: string | null) => void;
  setSolAddress: (address: string | null) => void;
  setSuiAddress: (address: string | null) => void;
  setNfts: (nfts: NFT[]) => void;
  selectNft: (nft: NFT | null) => void;
  setSealStatus: (status: SealStatus | null) => void;
  updateSealStep: (step: number, status: SealStatus["status"]) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnected: false,
  ethAddress: null,
  solAddress: null,
  suiAddress: null,
  nfts: [],
  selectedNft: null,
  isLoadingNfts: false,
  sealStatus: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setEthAddress: (address) => set({ ethAddress: address }),
  setSolAddress: (address) => set({ solAddress: address }),
  setSuiAddress: (address) => set({ suiAddress: address }),
  setNfts: (nfts) => set({ nfts }),
  selectNft: (nft) => set({ selectedNft: nft }),
  setSealStatus: (status) => set({ sealStatus: status }),
  updateSealStep: (step, status) =>
    set((state) => ({
      sealStatus: state.sealStatus
        ? { ...state.sealStatus, step, status }
        : null,
    })),
  reset: () =>
    set({
      isConnected: false,
      ethAddress: null,
      solAddress: null,
      suiAddress: null,
      nfts: [],
      selectedNft: null,
      sealStatus: null,
    }),
}));
