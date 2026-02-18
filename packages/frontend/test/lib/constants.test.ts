import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  OTHER_CHAINS,
  getChainById,
} from "@/lib/constants";

describe("constants", () => {
  it("has 17 supported chains", () => {
    expect(SUPPORTED_CHAINS.length).toBe(17);
  });

  it("EVM + OTHER = all chains", () => {
    expect(EVM_CHAINS.length + OTHER_CHAINS.length).toBe(SUPPORTED_CHAINS.length);
  });

  it("all EVM chains have evm category", () => {
    EVM_CHAINS.forEach((c) => {
      expect(c.category).toBe("evm");
      expect(c.chainType).toBe("evm");
    });
  });

  it("other chains are sui, aptos, near", () => {
    const ids = OTHER_CHAINS.map((c) => c.id).sort();
    expect(ids).toEqual(["aptos", "near", "sui"]);
  });

  it("getChainById returns correct chain", () => {
    const eth = getChainById("ethereum");
    expect(eth?.name).toBe("Ethereum");
    expect(eth?.wormholeChainId).toBe(2);
  });

  it("getChainById returns undefined for unknown", () => {
    expect(getChainById("bitcoin")).toBeUndefined();
  });

  it("all chains have unique IDs", () => {
    const ids = SUPPORTED_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all chains have unique wormhole chain IDs", () => {
    const wids = SUPPORTED_CHAINS.map((c) => c.wormholeChainId);
    expect(new Set(wids).size).toBe(wids.length);
  });

  it("all chains have explorer URLs", () => {
    SUPPORTED_CHAINS.forEach((c) => {
      expect(c.explorerUrl).toMatch(/^https:\/\//);
    });
  });
});
