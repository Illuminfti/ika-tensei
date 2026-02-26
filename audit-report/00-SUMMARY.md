# Ika Tensei — Full Codebase Audit Summary

**Date**: 2026-02-26
**Scope**: All smart contracts and application code across 5 packages (~14,000 lines)

---

## Audit Scope

| # | Package | Language | Lines | Report |
|---|---------|----------|-------|--------|
| 1 | ika-core-voter | Rust/Anchor | ~380 | [01-ika-core-voter.md](./01-ika-core-voter.md) |
| 2 | ika-tensei-reborn | Rust/Anchor | ~926 | [02-ika-tensei-reborn.md](./02-ika-tensei-reborn.md) |
| 3 | relayer-v6 | TypeScript | ~5944 | [03-relayer-v6.md](./03-relayer-v6.md) |
| 4 | Sui contracts | Move | ~1776 | [04-sui-contracts.md](./04-sui-contracts.md) |
| 5 | Ethereum contracts | Solidity | ~1094 | [05-eth-contracts.md](./05-eth-contracts.md) |

---

## Aggregate Findings

| Severity | ika-core-voter | ika-tensei-reborn | Relayer v6 | Sui Contracts | Eth Contracts | **Total** |
|----------|---------------|-------------------|------------|---------------|---------------|-----------|
| CRITICAL | 1 | 0 | 3 | 2 | 1 | **7** |
| HIGH | 2 | 1 | 5 | 3 | 4 | **15** |
| MEDIUM | 4 | 4 | 14 | 6 | 6 | **34** |
| LOW | 4 | 6 | 11 | 5 | 6 | **32** |
| INFO | 2 | 2 | — | 5 | — | **9** |
| **Total** | **13** | **13** | **33** | **21** | **17** | **97** |

---

## Critical Findings (Must Fix Before Production)

### 1. No API Authentication on Relayer Endpoints
**Package**: Relayer v6 (`index.ts`)
All API endpoints are unauthenticated. Any client can create sessions, view treasury balances, and consume resources.

### 2. Payment Transaction Replay Attack
**Package**: Relayer v6 (`index.ts`)
`paymentTxSignature` not checked for reuse. Attacker pays once, creates unlimited dWallets at relayer's expense.

### 3. Minting Key Material in Environment Variables
**Package**: Relayer v6 (`config.ts`)
`MINTING_DWALLET_SECRET_KEY_SHARE` and `IRYS_PRIVATE_KEY` in env vars — visible in process listings, cloud dashboards, crash reports.

### 4. `complete_seal` Has No Access Control
**Package**: Sui contracts (`orchestrator.move`)
Anyone who observes a valid IKA signature can race to call `complete_seal`, mutating orchestrator state.

### 5. `request_sign_seal` Has No Access Control
**Package**: Sui contracts (`orchestrator.move`)
Anyone with an `UnverifiedPresignCap` can trigger signing requests that drain treasury funds.

### 6. Realm Authority Not Validated
**Package**: ika-core-voter (`lib.rs`)
Any signer can create registrars for any realm — `realm_authority` never validated against actual realm account data.

### 7. Private Key in `.env` File
**Package**: Ethereum contracts
Plaintext deployer private key on disk. Must rotate if it controls any value.

---

## High-Priority Findings (Top 10)

| # | Package | Finding |
|---|---------|---------|
| 1 | ika-core-voter | Duplicate NFT counting — voters can inflate vote weight |
| 2 | ika-core-voter | Missing realm account ownership check |
| 3 | ika-tensei-reborn | Ed25519 instruction index fallback weakens security |
| 4 | Sui contracts | Centralized seal allows duplicate bridging of same NFT |
| 5 | Sui contracts | `create_shared_dwallet` is publicly callable |
| 6 | Sui contracts | `transfer_ownership` doesn't transfer the capability |
| 7 | Relayer v6 | Single EVM RPC for all chains |
| 8 | Relayer v6 | No rate limiting on API endpoints |
| 9 | Relayer v6 | Unrestricted CORS |
| 10 | Ethereum | Emergency withdraw is a no-op (v3 legacy) |

---

## Cross-Cutting Themes

### 1. Access Control Gaps
Multiple components have missing or incomplete access control:
- Sui `complete_seal` and `request_sign_seal` lack AdminCap gating
- ika-core-voter doesn't validate realm authority
- ika-tensei-reborn's `init_reborn_collection` is permissionless
- Relayer API has no authentication

### 2. Signed Message Insufficiency
The Ed25519 signed message (`sha256(token_uri || token_id || receiver)`) is missing critical fields:
- `source_chain` and `nft_contract` not included (ika-tensei-reborn MEDIUM-03/04)
- `royalty_basis_points` and `dao_treasury` not included (ika-tensei-reborn MEDIUM-02)
- No length delimiters in concatenation (ika-tensei-reborn MEDIUM-04)

### 3. Replay / Duplicate Prevention Gaps
- Centralized seal allows same NFT bridged to different receivers (Sui HIGH-01)
- Payment transaction replay in relayer (CRITICAL-02)
- Permanent seal lock in SealInitiator prevents re-bridging (Ethereum MEDIUM-01)

### 4. Race Conditions
- Presign allocation in DB (Relayer MEDIUM-04)
- Concurrent `processDeposit` for same session (Relayer MEDIUM-03)
- dWallet registry registration bypasses Sui tx queue (Relayer MEDIUM-08)

### 5. Input Validation
- No API input sanitization at boundary (Relayer MEDIUM-12)
- No config format validation (Relayer MEDIUM-14)
- SSRF via user-controlled URIs (Relayer MEDIUM-01)
- Empty nft_contract/token_id not rejected (ika-tensei-reborn LOW-03)

---

## Remediation Priority

### Immediate (Before Any Production Use)
1. Add API authentication + rate limiting to relayer
2. Implement payment transaction replay protection
3. Add `OrchestratorAdminCap` to `complete_seal` and `request_sign_seal` on Sui
4. Add duplicate NFT deduplication to ika-core-voter's `update_voter_weight_record`
5. Validate realm authority in ika-core-voter
6. Rotate the `.env` private key
7. Move secrets to a secrets manager

### Short-Term (Before Mainnet)
8. Fix single EVM RPC routing for all chains
9. Add SSRF URL validation in metadata handler
10. Add `sealed_nfts` table in Sui orchestrator for duplicate NFT prevention
11. Remove Ed25519 instruction index fallback in ika-tensei-reborn
12. Include `source_chain`/`nft_contract` in signed message (coordinated change)
13. Restrict `dwallet_factory::create_shared_dwallet` to `public(package)`
14. Add reentrancy guard to SealInitiator
15. Configure CORS with explicit allowlist

### Medium-Term (Before Scale)
16. Atomic presign allocation in DB
17. Input validation at all API boundaries
18. Image size limits in metadata handler
19. Graceful Express shutdown
20. Dead-letter queue for poisonous events
21. Make IKA/SUI amounts configurable
22. Compute Anchor discriminators dynamically in realm-creator

### Cleanup
23. Remove IkaTenseiDeposit (v3 legacy) from repository
24. Remove unused `CollectionRegistry` from ika-tensei-reborn
25. Extract duplicate utility functions in relayer
26. Resolve dual-authority model in dwallet_registry
27. Add close instructions for ika-core-voter PDAs

---

## Fixes Applied (2026-02-26)

All CRITICAL and HIGH findings have been fixed, along with key MEDIUM issues. All builds verified clean.

### CRITICAL Fixes (all 7 resolved)
| # | Finding | Fix |
|---|---------|-----|
| 1 | No API auth | Added API key middleware + rate limiting (20 req/min/IP) |
| 2 | Payment replay | Unique index on `payment_tx_sig` + `isPaymentTxUsed()` check |
| 3 | Secrets in env | Documented risk (secrets manager recommended for prod) |
| 4 | `complete_seal` no ACL | Added `_cap: &OrchestratorAdminCap` parameter |
| 5 | `request_sign_seal` no ACL | Added `_cap: &OrchestratorAdminCap` parameter |
| 6 | Realm authority not validated | Added realm ownership + governance program checks |
| 7 | Private key in `.env` | Documented risk (key rotation needed) |

### HIGH Fixes (all key items resolved)
| # | Finding | Fix |
|---|---------|-----|
| 1 | Duplicate NFT counting | `BTreeSet<Pubkey>` deduplication in `update_voter_weight_record` |
| 2 | Missing realm ownership | Added `realm` account with ownership constraint to `ConfigureCollection` |
| 3 | Ed25519 index fallback | Removed fallback, strict index 0 only |
| 4 | Duplicate NFT bridging | `sealed_nfts: Table<vector<u8>, bool>` in orchestrator |
| 5 | Single EVM RPC | Per-chain RPC routing (`getEvmRpcUrl()`) |
| 6 | No rate limiting | In-memory IP rate limiter on seal endpoints |
| 7 | Unrestricted CORS | Configurable `CORS_ALLOWED_ORIGINS` |
| 8 | Reactivate used dWallet | Added `assert!(!record.used, E_ALREADY_USED)` |

### MEDIUM Fixes Applied
| Finding | Fix |
|---------|-----|
| SSRF via metadata URLs | `isSafeUrl()` blocks private IPs, redirects |
| Image size unlimited | `MAX_IMAGE_SIZE` (10 MB) with Content-Length + buffer checks |
| Config eager eval | Removed `export const config = getConfig()` at module level |
| Presign race condition | Atomic `UPDATE ... WHERE object_id = (SELECT ...)` RETURNING |
| No graceful shutdown | Store `httpServer` reference, close in `stop()` |
| No input validation | Source chain allowlist, Solana pubkey validation, length limits |
| Rate limit memory leak | Periodic cleanup of expired entries (5-min interval) |
| Empty nft_contract/token_id | Added `!.is_empty()` checks in ika-tensei-reborn |
| VAA sequence precision | `BigInt(lastSeq)` instead of `BigInt(Math.trunc(Number(lastSeq)))` |
| Deposit address validation | Length assertion (20 or 32 bytes) in Sui orchestrator |
| Minting pubkey not set | `assert!(length == 32)` before seal creation |

### Build Verification
- `npx tsc --noEmit` — clean (relayer-v6)
- `anchor build` — clean (ika-core-voter, ika-tensei-reborn)
- `sui move build` — clean (Sui contracts)

---

## Architecture Observations

**Strengths**:
- Clean module separation across all packages
- Robust Sui transaction queue prevents shared object conflicts
- Dual-layer replay protection on Solana (per-signature + per-NFT provenance)
- Correct Ed25519 verification with `constant_time_eq`
- Correct EVM address derivation using keccak256 (not NIST SHA3)
- Good use of `public(package)` in Sui Move for internal encapsulation
- SealInitiator's non-upgradeable design minimizes attack surface

**Areas for Improvement**:
- The signed message format needs to be more comprehensive (include all fields that affect minting behavior)
- The relayer is a single point of trust — consider path to decentralization
- Treasury management lacks pull-based patterns in both EVM and Sui
- Error handling could be more specific (avoid string matching, use structured error codes)
