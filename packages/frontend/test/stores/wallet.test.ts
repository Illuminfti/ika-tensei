import { describe, it, expect, beforeEach } from "vitest";
import { useWalletStore } from "@/stores/wallet";

describe("useWalletStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useWalletStore.setState({ connected: false, publicKey: null });
  });

  it("starts disconnected", () => {
    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.publicKey).toBeNull();
  });

  it("connects with public key", () => {
    useWalletStore.getState().connect("SoLaNaPuBkEy123456789");
    const state = useWalletStore.getState();
    expect(state.connected).toBe(true);
    expect(state.publicKey).toBe("SoLaNaPuBkEy123456789");
  });

  it("disconnects", () => {
    useWalletStore.getState().connect("SoLaNaPuBkEy123456789");
    useWalletStore.getState().disconnect();
    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.publicKey).toBeNull();
  });

  it("overwrites previous connection", () => {
    useWalletStore.getState().connect("key1");
    useWalletStore.getState().connect("key2");
    expect(useWalletStore.getState().publicKey).toBe("key2");
  });
});
