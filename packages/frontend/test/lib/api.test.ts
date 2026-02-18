import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startSeal, getSealStatus, getUserNfts, getRebornNfts, getStats } from "@/lib/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("startSeal", () => {
    it("posts correct payload and returns response", async () => {
      const response = { dwalletId: "dw-1", depositAddress: "0xabc" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const result = await startSeal("SolPk123", "ethereum");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/seal/start"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ solanaWallet: "SolPk123", sourceChain: "ethereum" }),
        })
      );
      expect(result).toEqual(response);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ message: "Pool exhausted" }),
      });

      await expect(startSeal("SolPk123", "ethereum")).rejects.toThrow("Pool exhausted");
    });

    it("handles json parse failure on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("bad json")),
      });

      await expect(startSeal("SolPk123", "ethereum")).rejects.toThrow("Internal Server Error");
    });
  });

  describe("getSealStatus", () => {
    it("fetches status by dwallet ID", async () => {
      const response = { dwalletId: "dw-1", status: "detected" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const result = await getSealStatus("dw-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/seal/dw-1/status"),
        expect.any(Object)
      );
      expect(result.status).toBe("detected");
    });
  });

  describe("getUserNfts", () => {
    it("passes chain and address as query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nfts: [] }),
      });

      await getUserNfts("ethereum", "0xabc");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/nfts?chain=ethereum&address=0xabc"),
        expect.any(Object)
      );
    });
  });

  describe("getRebornNfts", () => {
    it("fetches reborn NFTs for solana address", async () => {
      const nfts = [{ mint: "abc", name: "Test", image: "img", originalChain: "eth", originalContract: "0x", originalTokenId: "1", sealHash: "h", rebornDate: "2025-01-01" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nfts }),
      });

      const result = await getRebornNfts("SolAddr");
      expect(result.nfts).toHaveLength(1);
      expect(result.nfts[0].mint).toBe("abc");
    });
  });

  describe("getStats", () => {
    it("returns stats", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sealed: 10, reborn: 8, chains: 5 }),
      });

      const stats = await getStats();
      expect(stats.sealed).toBe(10);
      expect(stats.reborn).toBe(8);
      expect(stats.chains).toBe(5);
    });
  });
});
