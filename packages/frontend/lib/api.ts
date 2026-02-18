import { API_BASE } from "./constants";

// ─── Legacy Types (kept for compatibility) ─────────────────────────────────────

export interface SealRequest {
  sourceChain: string;
  contractAddress?: string;
  tokenId?: string;
  depositorAddress?: string;
  solanaRecipient: string;
}

export interface SealResponse {
  sealHash: string;
  status: "pending" | "sealing" | "signing" | "minting" | "complete" | "error";
  step: number;
  txHashes: {
    deposit?: string;
    seal?: string;
    sign?: string;
    mint?: string;
  };
  rebornMint?: string;
  error?: string;
}

// ─── v4 Deposit-Address Flow Types ────────────────────────────────────────────

export interface StartSealRequest {
  solanaWallet: string;
  sourceChain: string;
}

export interface StartSealResponse {
  dwalletId: string;
  depositAddress: string;
}

export type SealStatusValue =
  | "waiting_deposit"
  | "detected"
  | "fetching_metadata"
  | "uploading"
  | "minting"
  | "complete"
  | "error";

export interface SealStatusResponse {
  dwalletId: string;
  status: SealStatusValue;
  rebornNFT?: {
    mint: string;
    name: string;
    image: string;
  };
  error?: string;
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── v4 API: Deposit-Address Flow ─────────────────────────────────────────────

/**
 * Create a new seal session — returns a dWallet-derived deposit address
 * for the selected source chain.
 */
export async function startSeal(
  solanaWallet: string,
  sourceChain: string
): Promise<StartSealResponse> {
  return fetchApi<StartSealResponse>("/api/seal/start", {
    method: "POST",
    body: JSON.stringify({ solanaWallet, sourceChain } satisfies StartSealRequest),
  });
}

/**
 * Poll the status of a seal in progress.
 */
export async function getSealStatus(dwalletId: string): Promise<SealStatusResponse> {
  return fetchApi<SealStatusResponse>(`/api/seal/${dwalletId}/status`);
}

// ─── Legacy / v3 API ──────────────────────────────────────────────────────────

/** @deprecated Use startSeal + getSealStatus */
export async function initiateSeal(request: SealRequest): Promise<SealResponse> {
  return fetchApi<SealResponse>("/api/seal", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** @deprecated Use getSealStatus(dwalletId) */
export async function getSealStatusLegacy(sealHash: string): Promise<SealResponse> {
  return fetchApi<SealResponse>(`/api/seal/${sealHash}`);
}

// ─── Other endpoints ──────────────────────────────────────────────────────────

export async function getUserNfts(chain: string, address: string) {
  return fetchApi<{
    nfts: Array<{
      id: string;
      name: string;
      image: string;
      contractAddress: string;
      tokenId: string;
    }>;
  }>(`/api/nfts?chain=${chain}&address=${address}`);
}

export async function getRebornNfts(solanaAddress: string) {
  return fetchApi<{
    nfts: Array<{
      mint: string;
      name: string;
      image: string;
      originalChain: string;
      originalContract: string;
      originalTokenId: string;
      sealHash: string;
      rebornDate: string;
    }>;
  }>(`/api/reborn?address=${solanaAddress}`);
}

export async function getProposals() {
  return fetchApi<{
    proposals: Array<{
      id: string;
      title: string;
      description: string;
      votesFor: number;
      votesAgainst: number;
      totalVotes: number;
      status: string;
      endsAt: string;
    }>;
  }>("/api/guild/proposals");
}

export async function castVote(
  proposalId: string,
  vote: "for" | "against" | "abstain",
  signature: string
) {
  return fetchApi<{ success: boolean }>("/api/guild/vote", {
    method: "POST",
    body: JSON.stringify({ proposalId, vote, signature }),
  });
}

export async function getStats() {
  return fetchApi<{ sealed: number; reborn: number; chains: number }>("/api/stats");
}
