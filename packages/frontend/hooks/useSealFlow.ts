"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { initiateSeal, getSealStatus, SealRequest, SealResponse } from "@/lib/api";

const POLL_INTERVAL = 3000;

const STEP_LABELS = [
  "Preparing the summoning circle...",
  "Depositing your NFT into the sacred vault...",
  "Sealing your NFT in the blockchain...",
  "Generating your reborn identity via dWallet...",
  "Minting your reborn NFT on Solana...",
  "The ritual is complete! Welcome to your new life!",
];

export function useSealFlow() {
  const [step, setStep] = useState(-1); // -1 = not started
  const [status, setStatus] = useState<SealResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const startSeal = useCallback(async (request: SealRequest) => {
    setIsLoading(true);
    setError(null);
    setStep(0);

    try {
      const response = await initiateSeal(request);
      setStatus(response);
      setStep(response.step);

      // Start polling
      if (response.status !== "complete" && response.status !== "error") {
        pollRef.current = setInterval(async () => {
          try {
            const updated = await getSealStatus(response.sealHash);
            setStatus(updated);
            setStep(updated.step);

            if (updated.status === "complete" || updated.status === "error") {
              if (pollRef.current) clearInterval(pollRef.current);
              if (updated.status === "error") setError(updated.error || "Unknown error");
            }
          } catch (e) {
            // Keep polling on network errors
          }
        }, POLL_INTERVAL);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to initiate seal");
      setStep(-1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep(-1);
    setStatus(null);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return {
    step,
    stepLabel: step >= 0 ? STEP_LABELS[Math.min(step, STEP_LABELS.length - 1)] : "",
    totalSteps: STEP_LABELS.length - 1,
    status,
    error,
    isLoading,
    isComplete: status?.status === "complete",
    startSeal,
    reset,
  };
}
