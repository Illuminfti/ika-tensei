import { describe, it, expect } from "vitest";
import { STATUS_ORDER, STATUS_LABELS } from "../../hooks/useSealFlow";
import { SUPPORTED_CHAINS, getChainById, EVM_CHAINS, OTHER_CHAINS } from "../../lib/constants";

describe("Seal Flow Constants", () => {
  it("STATUS_ORDER has correct progression", () => {
    expect(STATUS_ORDER).toEqual([
      "waiting_deposit",
      "detected",
      "fetching_metadata",
      "uploading",
      "minting",
      "complete",
    ]);
  });

  it("STATUS_LABELS has all statuses", () => {
    expect(STATUS_LABELS).toHaveProperty("waiting_deposit");
    expect(STATUS_LABELS).toHaveProperty("detected");
    expect(STATUS_LABELS).toHaveProperty("fetching_metadata");
    expect(STATUS_LABELS).toHaveProperty("uploading");
    expect(STATUS_LABELS).toHaveProperty("minting");
    expect(STATUS_LABELS).toHaveProperty("complete");
    expect(STATUS_LABELS).toHaveProperty("error");
  });
});

describe("Chain Constants", () => {
  it("all chains have unique IDs", () => {
    const ids = SUPPORTED_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all EVM chains have wormhole chain IDs", () => {
    EVM_CHAINS.forEach((c) => {
      expect(c.wormholeChainId).toBeGreaterThan(0);
    });
  });

  it("other chains are sui, aptos, near", () => {
    const ids = OTHER_CHAINS.map((c) => c.id).sort();
    expect(ids).toEqual(["aptos", "near", "sui"]);
  });

  it("Sui chain has correct wormhole ID", () => {
    const sui = getChainById("sui");
    expect(sui?.wormholeChainId).toBe(21);
    expect(sui?.chainType).toBe("sui");
  });

  it("Solana not in supported chains (via deposit flow)", () => {
    const sol = getChainById("solana");
    expect(sol).toBeUndefined();
  });
});
