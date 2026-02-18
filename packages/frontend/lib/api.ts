import { API_BASE } from "./constants";

export interface SealRequest {
  sourceChain: "ethereum" | "sui";
  contractAddress: string;
  tokenId: string;
  depositorAddress: string;
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

// Initiate a seal
export async function initiateSeal(request: SealRequest): Promise<SealResponse> {
  return fetchApi<SealResponse>("/api/seal", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// Poll seal status
export async function getSealStatus(sealHash: string): Promise<SealResponse> {
  return fetchApi<SealResponse>(`/api/seal/${sealHash}`);
}

// Get user's NFTs from a chain
export async function getUserNfts(chain: string, address: string) {
  return fetchApi<{ nfts: Array<{ id: string; name: string; image: string; contractAddress: string; tokenId: string }> }>(
    `/api/nfts?chain=${chain}&address=${address}`
  );
}

// Get reborn NFTs for a user
export async function getRebornNfts(solanaAddress: string) {
  return fetchApi<{ nfts: Array<{ mint: string; name: string; image: string; originalChain: string; originalContract: string; originalTokenId: string; sealHash: string; rebornDate: string }> }>(
    `/api/reborn?address=${solanaAddress}`
  );
}

// DAO endpoints
export async function getProposals() {
  return fetchApi<{ proposals: Array<{ id: string; title: string; description: string; votesFor: number; votesAgainst: number; totalVotes: number; status: string; endsAt: string }> }>(
    "/api/guild/proposals"
  );
}

export async function castVote(proposalId: string, vote: "for" | "against" | "abstain", signature: string) {
  return fetchApi<{ success: boolean }>("/api/guild/vote", {
    method: "POST",
    body: JSON.stringify({ proposalId, vote, signature }),
  });
}

// Stats
export async function getStats() {
  return fetchApi<{ sealed: number; reborn: number; chains: number }>(
    "/api/stats"
  );
}
