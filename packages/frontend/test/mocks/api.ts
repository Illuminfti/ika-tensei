import { vi } from "vitest";
import type { StartSealResponse, SealStatusResponse } from "@/lib/api";

// Default mock responses
export const mockStartSealResponse: StartSealResponse = {
  dwalletId: "dwallet-test-123",
  depositAddress: "0x1234567890abcdef1234567890abcdef12345678",
};

export const mockSealStatusResponses: Record<string, SealStatusResponse> = {
  waiting: {
    dwalletId: "dwallet-test-123",
    status: "waiting_deposit",
  },
  detected: {
    dwalletId: "dwallet-test-123",
    status: "detected",
  },
  fetching: {
    dwalletId: "dwallet-test-123",
    status: "fetching_metadata",
  },
  uploading: {
    dwalletId: "dwallet-test-123",
    status: "uploading",
  },
  minting: {
    dwalletId: "dwallet-test-123",
    status: "minting",
  },
  complete: {
    dwalletId: "dwallet-test-123",
    status: "complete",
    rebornNFT: {
      mint: "So1anaMint111111111111111111111111111111",
      name: "Reborn Bored Ape #1234",
      image: "https://arweave.net/abc123",
    },
  },
  error: {
    dwalletId: "dwallet-test-123",
    status: "error",
    error: "Deposit verification failed",
  },
};

// Create mock API module
export function createMockApi() {
  return {
    startSeal: vi.fn().mockResolvedValue(mockStartSealResponse),
    getSealStatus: vi.fn().mockResolvedValue(mockSealStatusResponses.waiting),
    initiateSeal: vi.fn(),
    getSealStatusLegacy: vi.fn(),
    getUserNfts: vi.fn().mockResolvedValue({ nfts: [] }),
    getRebornNfts: vi.fn().mockResolvedValue({ nfts: [] }),
    getProposals: vi.fn().mockResolvedValue({ proposals: [] }),
    castVote: vi.fn().mockResolvedValue({ success: true }),
    getStats: vi.fn().mockResolvedValue({ sealed: 42, reborn: 38, chains: 17 }),
  };
}
