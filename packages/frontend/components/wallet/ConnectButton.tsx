"use client";

import { useWalletStore } from "@/stores/wallet";
import { PixelButton } from "@/components/ui/PixelButton";
import { DYNAMIC_ENV_ID } from "@/lib/constants";

// v4: Solana-only connect button
export function ConnectButton() {
  const { connected, publicKey, connect, disconnect } = useWalletStore();

  const handleConnect = () => {
    if (DYNAMIC_ENV_ID) {
      // Dynamic handles this via its own UI flow on the seal page
      return;
    }
    // Dev mode: fake connection
    connect("DevWallet11111111111111111111111111111111111");
  };

  const handleDisconnect = () => {
    disconnect();
  };

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-silk text-[10px] text-spectral-green">●</span>
        <span className="font-mono text-[10px] text-faded-spirit">
          {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
        </span>
        <PixelButton variant="dark" size="sm" onClick={handleDisconnect}>
          ✕
        </PixelButton>
      </div>
    );
  }

  return (
    <PixelButton variant="primary" size="sm" onClick={handleConnect}>
      Connect Wallet
    </PixelButton>
  );
}
