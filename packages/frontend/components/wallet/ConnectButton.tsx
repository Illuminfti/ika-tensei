"use client";

import { useWalletStore } from "@/stores/wallet";
import { PixelButton } from "@/components/ui/PixelButton";
import { DYNAMIC_ENV_ID } from "@/lib/constants";

export function ConnectButton() {
  const { isConnected, ethAddress, solAddress, setConnected, setEthAddress, setSolAddress } = useWalletStore();

  // If Dynamic is configured, it handles connection via its own UI
  // This is the fallback/demo mode
  const handleConnect = () => {
    if (DYNAMIC_ENV_ID) {
      // Dynamic handles this
      return;
    }
    // Demo mode: fake connection
    setConnected(true);
    setEthAddress("0x1234567890abcdef1234567890abcdef12345678");
    setSolAddress("FKab3XhBz7c9oVn8pHQH3YkMUmP9ZjJwvGxMFSzotPcV");
  };

  const handleDisconnect = () => {
    setConnected(false);
    setEthAddress(null);
    setSolAddress(null);
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-silk text-[10px] text-spectral-green">●</span>
        <span className="font-mono text-[10px] text-faded-spirit">
          {ethAddress ? `${ethAddress.slice(0, 6)}...${ethAddress.slice(-4)}` : ""}
          {ethAddress && solAddress ? " | " : ""}
          {solAddress ? `${solAddress.slice(0, 4)}...${solAddress.slice(-4)}` : ""}
        </span>
        <PixelButton variant="dark" size="sm" onClick={handleDisconnect}>
          ✕
        </PixelButton>
      </div>
    );
  }

  return (
    <PixelButton variant="primary" size="sm" onClick={handleConnect}>
      Connect
    </PixelButton>
  );
}
