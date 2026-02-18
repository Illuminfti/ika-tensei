import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSealFlow } from "@/hooks/useSealFlow";
import { mockStartSealResponse, mockSealStatusResponses } from "../mocks/api";

// Mock the API module
vi.mock("@/lib/api", () => ({
  startSeal: vi.fn(),
  getSealStatus: vi.fn(),
}));

import { startSeal, getSealStatus } from "@/lib/api";

const mockStartSeal = vi.mocked(startSeal);
const mockGetSealStatus = vi.mocked(getSealStatus);

describe("useSealFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStartSeal.mockResolvedValue(mockStartSealResponse);
    mockGetSealStatus.mockResolvedValue(mockSealStatusResponses.waiting);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts at connect step", () => {
    const { result } = renderHook(() => useSealFlow());
    expect(result.current.step).toBe("connect");
    expect(result.current.sourceChain).toBeNull();
    expect(result.current.depositAddress).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("advances to select_chain on wallet connect", () => {
    const { result } = renderHook(() => useSealFlow());
    act(() => result.current.onWalletConnected());
    expect(result.current.step).toBe("select_chain");
  });

  it("calls API and advances to deposit on chain select", async () => {
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());

    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });

    expect(mockStartSeal).toHaveBeenCalledWith("SoLaNaPk123", "ethereum");
    expect(result.current.step).toBe("deposit");
    expect(result.current.depositAddress).toBe(mockStartSealResponse.depositAddress);
    expect(result.current.dwalletId).toBe(mockStartSealResponse.dwalletId);
    expect(result.current.sourceChain).toBe("ethereum");
  });

  it("falls back to mock address on API error", async () => {
    mockStartSeal.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());

    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });

    expect(result.current.step).toBe("deposit");
    expect(result.current.depositAddress).toBeTruthy();
    expect(result.current.dwalletId).toMatch(/^demo-/);
  });

  it("transitions to waiting on startWaiting", async () => {
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });
    act(() => result.current.startWaiting());

    expect(result.current.step).toBe("waiting");
    expect(result.current.sealStatus).toBe("waiting_deposit");
  });

  it("polls status and completes", async () => {
    mockGetSealStatus
      .mockResolvedValueOnce(mockSealStatusResponses.detected)
      .mockResolvedValueOnce(mockSealStatusResponses.complete);

    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });
    act(() => result.current.startWaiting());

    // First poll fires immediately in useEffect
    await waitFor(() => {
      expect(result.current.sealStatus).toBe("detected");
    });

    // Advance to next poll
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.step).toBe("complete");
      expect(result.current.rebornNFT).toEqual(mockSealStatusResponses.complete.rebornNFT);
    });
  });

  it("handles error status from polling", async () => {
    mockGetSealStatus.mockResolvedValueOnce(mockSealStatusResponses.error);

    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });
    act(() => result.current.startWaiting());

    await waitFor(() => {
      expect(result.current.error).toBe("Deposit verification failed");
    });
  });

  it("goBack from deposit returns to select_chain", async () => {
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });

    expect(result.current.step).toBe("deposit");
    act(() => result.current.goBack());
    expect(result.current.step).toBe("select_chain");
    expect(result.current.depositAddress).toBeNull();
  });

  it("goBack from select_chain returns to connect", () => {
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    act(() => result.current.goBack());
    expect(result.current.step).toBe("connect");
  });

  it("reset clears everything", async () => {
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("ethereum", "SoLaNaPk123");
    });

    act(() => result.current.reset());
    expect(result.current.step).toBe("connect");
    expect(result.current.sourceChain).toBeNull();
    expect(result.current.depositAddress).toBeNull();
    expect(result.current.dwalletId).toBeNull();
  });

  it("generates EVM-style address for EVM chains", async () => {
    mockStartSeal.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("polygon", "SoLaNaPk123");
    });

    expect(result.current.depositAddress).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("generates non-EVM address for Sui", async () => {
    mockStartSeal.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useSealFlow());

    act(() => result.current.onWalletConnected());
    await act(async () => {
      await result.current.selectChain("sui", "SoLaNaPk123");
    });

    // Non-EVM generates base58-like string, not 0x prefixed
    expect(result.current.depositAddress).not.toMatch(/^0x/);
    expect(result.current.depositAddress!.length).toBe(44);
  });
});
