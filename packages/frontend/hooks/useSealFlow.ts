"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { startSeal, getSealStatus, SealStatusValue } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

// ─── State Shape ──────────────────────────────────────────────────────────────

export type SealFlowStep =
  | "connect"
  | "select_chain"
  | "deposit"
  | "waiting"
  | "complete";

export interface SealFlowState {
  step: SealFlowStep;
  sourceChain: string | null;
  depositAddress: string | null;
  dwalletId: string | null;
  sealStatus: SealStatusValue | null;
  rebornNFT: { mint: string; name: string; image: string } | null;
  error: string | null;
  isLoading: boolean;
}

// Status label map (for UI display)
export const STATUS_LABELS: Record<SealStatusValue, string> = {
  waiting_deposit: "Awaiting deposit...",
  detected: "NFT detected! Verifying...",
  fetching_metadata: "Fetching NFT metadata...",
  uploading: "Uploading to Arweave...",
  minting: "Minting reborn NFT on Solana...",
  complete: "Ritual complete!",
  error: "Something went wrong",
};

// Ordered status progression for step display
export const STATUS_ORDER: SealStatusValue[] = [
  "waiting_deposit",
  "detected",
  "fetching_metadata",
  "uploading",
  "minting",
  "complete",
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: SealFlowState = {
  step: "connect",
  sourceChain: null,
  depositAddress: null,
  dwalletId: null,
  sealStatus: null,
  rebornNFT: null,
  error: null,
  isLoading: false,
};

export function useSealFlow() {
  const [state, setState] = useState<SealFlowState>(INITIAL_STATE);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Wallet connected → move to chain selection ──────────────────────────────
  const onWalletConnected = useCallback(() => {
    setState((s) => ({ ...s, step: "select_chain", error: null }));
  }, []);

  // ── Chain selected → call API to get deposit address ───────────────────────
  const selectChain = useCallback(
    async (chainId: string, solanaWallet: string) => {
      setState((s) => ({
        ...s,
        sourceChain: chainId,
        isLoading: true,
        error: null,
      }));

      try {
        const { dwalletId, depositAddress } = await startSeal(
          solanaWallet,
          chainId
        );
        setState((s) => ({
          ...s,
          dwalletId,
          depositAddress,
          step: "deposit",
          isLoading: false,
        }));
      } catch {
        // Backend not available — use demo mode with mock deposit address
        const evmChains = ["ethereum", "polygon", "arbitrum", "base", "optimism", "bsc", "avalanche", "fantom", "moonbeam", "celo", "scroll", "blast", "linea", "gnosis"];
        const isEvm = evmChains.includes(chainId);
        const mockAddress = isEvm
          ? "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
          : Array.from({ length: 44 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("");
        const mockId = "demo-" + Date.now().toString(36);
        setState((s) => ({
          ...s,
          dwalletId: mockId,
          depositAddress: mockAddress,
          step: "deposit",
          isLoading: false,
        }));
      }
    },
    []
  );

  // ── User confirms they sent the NFT → start polling ─────────────────────────
  const startWaiting = useCallback(() => {
    setState((s) => ({
      ...s,
      step: "waiting",
      sealStatus: "waiting_deposit",
      error: null,
    }));
  }, []);

  // ── Polling loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.step !== "waiting" || !state.dwalletId) return;

    const poll = async () => {
      try {
        const result = await getSealStatus(state.dwalletId!);
        setState((s) => ({ ...s, sealStatus: result.status }));

        if (result.status === "complete") {
          setState((s) => ({
            ...s,
            step: "complete",
            rebornNFT: result.rebornNFT ?? null,
          }));
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (result.status === "error") {
          setState((s) => ({
            ...s,
            error: result.error ?? "An error occurred during sealing",
          }));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Network error — keep polling silently
      }
    };

    // Kick off immediately, then every POLL_INTERVAL_MS
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.step, state.dwalletId]);

  // ── Reset everything ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState(INITIAL_STATE);
  }, []);

  // ── Go back one step ─────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState((s) => {
      switch (s.step) {
        case "select_chain":
          return { ...INITIAL_STATE, step: "connect" };
        case "deposit":
          return { ...s, step: "select_chain", depositAddress: null, dwalletId: null, error: null };
        default:
          return s;
      }
    });
  }, []);

  // ── Demo/Simulation: advance through all states for testing ──────────────────
  const simulateProgress = useCallback(() => {
    if (!state.depositAddress || !state.dwalletId) return;
    
    const statuses: SealStatusValue[] = [
      "detected",
      "fetching_metadata", 
      "uploading",
      "minting",
      "complete",
    ];

    let i = 0;
    const advance = () => {
      if (i >= statuses.length) {
        // Complete!
        setState((s) => ({
          ...s,
          step: "complete",
          sealStatus: "complete",
          rebornNFT: {
            mint: "7x9Y2Zk...demo123",
            name: "My NFT ✦ Reborn",
            image: "https://placehold.co/400x400/ff3366/ffd700?text=REBORN",
          },
        }));
        return;
      }

      setState((s) => ({ ...s, sealStatus: statuses[i] }));
      i++;
      setTimeout(advance, 1500); // 1.5s per stage
    };

    // Start at detected
    setState((s) => ({ ...s, sealStatus: "detected", step: "waiting" }));
    i = 1;
    setTimeout(advance, 1500);
  }, [state.depositAddress, state.dwalletId]);

  return {
    ...state,
    onWalletConnected,
    selectChain,
    startWaiting,
    reset,
    goBack,
    simulateProgress,
  };
}
