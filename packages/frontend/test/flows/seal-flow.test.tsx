import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the API before importing the page
vi.mock("@/lib/api", () => ({
  startSeal: vi.fn(),
  getSealStatus: vi.fn(),
  initiateSeal: vi.fn(),
  getSealStatusLegacy: vi.fn(),
  getUserNfts: vi.fn(),
  getRebornNfts: vi.fn(),
  getProposals: vi.fn(),
  castVote: vi.fn(),
  getStats: vi.fn(),
}));

// Mock components that use browser APIs
vi.mock("@/components/ui/BackgroundAtmosphere", () => ({
  BackgroundAtmosphere: () => <div data-testid="bg-atmosphere" />,
}));

vi.mock("@/components/ui/SummoningCircle", () => ({
  SummoningCircle: ({ phase }: { phase: string }) => (
    <div data-testid="summoning-circle" data-phase={phase} />
  ),
}));

vi.mock("@/components/ui/BackgroundStars", () => ({
  default: () => <div data-testid="bg-stars" />,
}));

vi.mock("@/components/ui/PixelSprite", () => ({
  IkaSprite: ({ expression }: { expression: string }) => (
    <div data-testid="ika-sprite" data-expression={expression} />
  ),
}));

import { startSeal, getSealStatus } from "@/lib/api";
import { useWalletStore } from "@/stores/wallet";

const mockStartSeal = vi.mocked(startSeal);
const mockGetSealStatus = vi.mocked(getSealStatus);

// We need to test the page component
import SealPage from "@/app/seal/page";

describe("Seal Flow Integration", () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useWalletStore.setState({ connected: false, publicKey: null });
    mockStartSeal.mockResolvedValue({
      dwalletId: "dw-test",
      depositAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    mockGetSealStatus.mockResolvedValue({
      dwalletId: "dw-test",
      status: "waiting_deposit",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the seal page with step indicator", () => {
    render(<SealPage />);
    expect(screen.getByText(/THE SOUL SEAL RITUAL/i)).toBeInTheDocument();
    expect(screen.getByText(/The ritual begins/i)).toBeInTheDocument();
  });

  it("step 1: shows connect wallet prompt", () => {
    render(<SealPage />);
    // Should show Ika dialogue about connecting wallet
    expect(screen.getByText(/Solana wallet/i)).toBeInTheDocument();
  });

  it("step 2: shows chain selection after wallet connect", async () => {
    // Pre-connect wallet
    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    // Should auto-advance to chain selection
    await waitFor(() => {
      expect(screen.getByText(/Which chain holds your NFT/i)).toBeInTheDocument();
    });
  });

  it("step 2-3: selecting a chain calls API and shows deposit address", async () => {
    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    // Wait for chain selection to appear
    await waitFor(() => {
      expect(screen.getByText(/Which chain holds your NFT/i)).toBeInTheDocument();
    });

    // Click on Ethereum chain
    const ethButton = screen.getByText("Ethereum");
    await user.click(ethButton);

    // Click confirm button
    const confirmBtn = screen.getByText(/Get Deposit Address/i);
    await user.click(confirmBtn);

    // Should show deposit address
    await waitFor(() => {
      expect(screen.getByText(/deposit address is ready/i)).toBeInTheDocument();
    });

    expect(mockStartSeal).toHaveBeenCalledWith("SolPk123", "ethereum");
  });

  it("step 4: shows summoning circle during waiting", async () => {
    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    // Advance to chain select
    await waitFor(() => {
      expect(screen.getByText(/Which chain holds your NFT/i)).toBeInTheDocument();
    });

    // Select chain
    await user.click(screen.getByText("Ethereum"));
    await user.click(screen.getByText(/Get Deposit Address/i));

    // Wait for deposit step
    await waitFor(() => {
      expect(screen.getByText(/deposit address is ready/i)).toBeInTheDocument();
    });

    // Confirm sent
    const sentBtn = screen.getByText(/I've Sent/i);
    await user.click(sentBtn);

    // Should show waiting/summoning state
    await waitFor(() => {
      expect(screen.getByText(/Summoning Is In Progress/i)).toBeInTheDocument();
      expect(screen.getByTestId("summoning-circle")).toBeInTheDocument();
    });
  });

  it("step 5: shows completion with reborn NFT", async () => {
    mockGetSealStatus.mockResolvedValue({
      dwalletId: "dw-test",
      status: "complete",
      rebornNFT: {
        mint: "SolMint123",
        name: "Reborn Ape #42",
        image: "https://arweave.net/test",
      },
    });

    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    // Fast-forward through flow
    await waitFor(() => screen.getByText(/Which chain/i));
    await user.click(screen.getByText("Ethereum"));
    await user.click(screen.getByText(/Get Deposit Address/i));
    await waitFor(() => screen.getByText(/deposit address is ready/i));
    await user.click(screen.getByText(/I've Sent/i));

    // Should transition to complete
    await waitFor(() => {
      expect(screen.getByText(/RITUAL COMPLETE/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Reborn Ape #42")).toBeInTheDocument();
    expect(screen.getByText("Solana Explorer")).toBeInTheDocument();
  });

  it("back button works from chain selection", async () => {
    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    await waitFor(() => screen.getByText(/Which chain/i));

    // Go back
    await user.click(screen.getByText(/← Back/));

    // Should show connect step again
    await waitFor(() => {
      expect(screen.getByText(/Solana wallet/i)).toBeInTheDocument();
    });
  });

  it("reset from complete goes back to start", async () => {
    mockGetSealStatus.mockResolvedValue({
      dwalletId: "dw-test",
      status: "complete",
      rebornNFT: { mint: "m", name: "NFT", image: "img" },
    });

    useWalletStore.setState({ connected: true, publicKey: "SolPk123" });

    render(<SealPage />);

    // Rush through flow
    await waitFor(() => screen.getByText(/Which chain/i));
    await user.click(screen.getByText("Ethereum"));
    await user.click(screen.getByText(/Get Deposit Address/i));
    await waitFor(() => screen.getByText(/deposit address is ready/i));
    await user.click(screen.getByText(/I've Sent/i));
    await waitFor(() => screen.getByText(/RITUAL COMPLETE/i));

    // Click seal another
    await user.click(screen.getByText(/Seal Another NFT/i));

    // Should be back at start
    await waitFor(() => {
      expect(screen.getByText(/Solana wallet/i)).toBeInTheDocument();
    });
  });
});
