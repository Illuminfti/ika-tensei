"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  startSeal,
  confirmPayment as apiConfirmPayment,
  confirmDeposit as apiConfirmDeposit,
  getSealStatus,
  type SealStatusValue,
} from "@/lib/api";
import { DYNAMIC_ENV_ID } from "@/lib/constants";

const POLL_INTERVAL_MS = 5000;

// ─── State Shape ──────────────────────────────────────────────────────────────

export type SealFlowStep =
  | "connect"
  | "select_chain"
  | "payment"
  | "deposit"
  | "confirm_deposit"
  | "waiting"
  | "complete";

export interface SealFlowState {
  step: SealFlowStep;
  sourceChain: string | null;
  sessionId: string | null;
  paymentAddress: string | null;
  feeAmountLamports: number | null;
  depositAddress: string | null;
  dwalletId: string | null;
  sealStatus: SealStatusValue | null;
  rebornNFT: { mint: string; name: string; image: string } | null;
  error: string | null;
  isLoading: boolean;
}

// Status label map (for UI display)
export const STATUS_LABELS: Record<SealStatusValue, string> = {
  awaiting_payment: "Awaiting SOL payment...",
  payment_confirmed: "Payment confirmed!",
  creating_dwallet: "Creating deposit wallet...",
  waiting_deposit: "Awaiting NFT deposit...",
  verifying_deposit: "Verifying NFT on source chain...",
  uploading_metadata: "Uploading metadata to Arweave...",
  creating_seal: "Creating seal on Sui...",
  signing: "IKA dWallet signing ceremony...",
  minting: "Minting reborn NFT on Solana...",
  complete: "Ritual complete!",
  error: "Something went wrong",
};

// Ordered status progression for the waiting step display
export const STATUS_ORDER: SealStatusValue[] = [
  "verifying_deposit",
  "uploading_metadata",
  "creating_seal",
  "signing",
  "minting",
  "complete",
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: SealFlowState = {
  step: "connect",
  sourceChain: null,
  sessionId: null,
  paymentAddress: null,
  feeAmountLamports: null,
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

  // ── Chain selected → call API to create session → move to payment ───────────
  const selectChain = useCallback(
    async (chainId: string, solanaWallet: string) => {
      setState((s) => ({
        ...s,
        sourceChain: chainId,
        isLoading: true,
        error: null,
      }));

      try {
        const { sessionId, paymentAddress, feeAmountLamports } =
          await startSeal(solanaWallet, chainId);
        setState((s) => ({
          ...s,
          sessionId,
          paymentAddress,
          feeAmountLamports,
          step: "payment",
          isLoading: false,
        }));
      } catch (err) {
        // Only use demo mode when Dynamic.xyz is not configured (local dev)
        if (!DYNAMIC_ENV_ID) {
          const mockSessionId = "demo-" + Date.now().toString(36);
          setState((s) => ({
            ...s,
            sessionId: mockSessionId,
            paymentAddress: "DemoPaymentAddress1111111111111111111111111",
            feeAmountLamports: 10_000_000, // 0.01 SOL
            step: "payment",
            isLoading: false,
          }));
        } else {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : "Failed to start seal session",
            isLoading: false,
          }));
        }
      }
    },
    []
  );

  // ── Payment confirmed → create dWallet → move to deposit ───────────────────
  const confirmPayment = useCallback(
    async (paymentTxSignature: string) => {
      if (!state.sessionId) return;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const { dwalletId, depositAddress } = await apiConfirmPayment(
          state.sessionId,
          paymentTxSignature
        );
        setState((s) => ({
          ...s,
          dwalletId,
          depositAddress,
          step: "deposit",
          isLoading: false,
        }));
      } catch (err) {
        // Demo mode fallback
        if (state.sessionId?.startsWith("demo-")) {
          const evmChains = [
            "ethereum", "polygon", "arbitrum", "base", "optimism", "bsc",
            "avalanche", "base-sepolia", "ethereum-sepolia",
          ];
          const isEvm = evmChains.includes(state.sourceChain ?? "");
          const mockAddress = isEvm
            ? "0x" + Array.from({ length: 40 }, () =>
                Math.floor(Math.random() * 16).toString(16)
              ).join("")
            : Array.from({ length: 44 }, () =>
                "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[
                  Math.floor(Math.random() * 58)
                ]
              ).join("");
          setState((s) => ({
            ...s,
            dwalletId: "demo-dwallet-" + Date.now(),
            depositAddress: mockAddress,
            step: "deposit",
            isLoading: false,
          }));
        } else {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : "Payment confirmation failed",
            isLoading: false,
          }));
        }
      }
    },
    [state.sessionId, state.sourceChain]
  );

  // ── User sent NFT → move to confirm_deposit form ──────────────────────────
  const goToConfirmDeposit = useCallback(() => {
    setState((s) => ({ ...s, step: "confirm_deposit", error: null }));
  }, []);

  // ── Confirm deposit → start polling ─────────────────────────────────────────
  const confirmDeposit = useCallback(
    async (nftContract: string, tokenId: string, txHash?: string) => {
      if (!state.sessionId) return;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        await apiConfirmDeposit(state.sessionId, nftContract, tokenId, txHash);
        setState((s) => ({
          ...s,
          step: "waiting",
          sealStatus: "verifying_deposit",
          isLoading: false,
        }));
      } catch (err) {
        // Demo mode fallback
        if (state.sessionId?.startsWith("demo-")) {
          setState((s) => ({
            ...s,
            step: "waiting",
            sealStatus: "verifying_deposit",
            isLoading: false,
          }));
        } else {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : "Deposit confirmation failed",
            isLoading: false,
          }));
        }
      }
    },
    [state.sessionId]
  );

  // ── Polling loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.step !== "waiting" || !state.sessionId) return;
    // Don't poll for demo sessions
    if (state.sessionId.startsWith("demo-")) return;

    const poll = async () => {
      try {
        const result = await getSealStatus(state.sessionId!);
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

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.step, state.sessionId]);

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
        case "payment":
          return {
            ...s,
            step: "select_chain" as SealFlowStep,
            sessionId: null,
            paymentAddress: null,
            feeAmountLamports: null,
            error: null,
          };
        case "deposit":
          return { ...s, step: "payment" as SealFlowStep, depositAddress: null, dwalletId: null, error: null };
        case "confirm_deposit":
          return { ...s, step: "deposit" as SealFlowStep, error: null };
        default:
          return s;
      }
    });
  }, []);

  // ── Demo/Simulation: advance through all states for testing ──────────────────
  const simulateProgress = useCallback(() => {
    if (!state.sessionId) return;

    const statuses: SealStatusValue[] = [
      "uploading_metadata",
      "creating_seal",
      "signing",
      "minting",
      "complete",
    ];

    let i = 0;
    const advance = () => {
      if (i >= statuses.length) {
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
      setTimeout(advance, 1500);
    };

    setState((s) => ({
      ...s,
      sealStatus: "verifying_deposit",
      step: "waiting",
    }));
    setTimeout(advance, 1500);
  }, [state.sessionId]);

  return {
    ...state,
    onWalletConnected,
    selectChain,
    confirmPayment,
    goToConfirmDeposit,
    confirmDeposit,
    reset,
    goBack,
    simulateProgress,
  };
}
