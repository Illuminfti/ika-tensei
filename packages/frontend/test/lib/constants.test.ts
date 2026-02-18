import { describe, it, expect } from "vitest";
import { SUPPORTED_CHAINS, EVM_CHAINS, OTHER_CHAINS, getChainById } from "../../lib/constants";

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
    });
  });

  it("getChainById returns correct chain", () => {
    const eth = getChainById("ethereum");
    expect(eth?.name).toBe("Ethereum");
  });

  it("getChainById returns undefined for unknown", () => {
    expect(getChainById("bitcoin")).toBeUndefined();
  });
});
