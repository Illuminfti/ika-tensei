# Audit Report: Relayer v6 (TypeScript)

**Package**: `packages/relayer-v6/src/`
**Files**: 19 TypeScript source files (~5944 lines)
**Runtime**: Node.js with Express, SQLite (better-sqlite3), Pino logging
**Purpose**: Central orchestrator for cross-chain NFT bridging — manages sessions, dWallet operations, IKA signing, Solana minting, Arweave uploads, and DAO creation

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 1054 | Main entry point, Express API, orchestration |
| `solana-submitter.ts` | ~560 | Solana transaction building, Ed25519 precompile, retry |
| `realm-creator.ts` | 463 | SPL Governance realm creation + voter plugin config |
| `chain-verifier.ts` | ~380 | Cross-chain NFT ownership verification |
| `metadata-handler.ts` | ~330 | Arweave metadata upload via Irys |
| `vaa-ingester.ts` | ~330 | Wormhole VAA polling and Sui submission |
| `db.ts` | ~280 | SQLite database layer |
| `seal-signer.ts` | ~350 | IKA 2PC-MPC signing orchestration |
| `dwallet-creator.ts` | ~410 | dWallet creation via IKA |
| `config.ts` | 119 | Configuration loading from env |
| `types.ts` | 437 | Type definitions |
| `sui-listener.ts` | ~200 | Sui event polling with cursor persistence |
| `sui-tx-queue.ts` | ~80 | Sui transaction serialization queue |
| `presign-pool.ts` | ~130 | Presign FIFO pool management |
| `treasury-manager.ts` | ~80 | Treasury balance monitoring and top-up |
| `rate-limited-sui-client.ts` | ~70 | Rate limiting wrapper for SuiClient |
| `health.ts` | ~70 | Health check HTTP server |
| `logger.ts` | ~20 | Pino logger configuration |
| `setup-minting-dwallet.ts` | ~170 | One-time minting dWallet setup script |

**Overall Assessment**: Well-structured with clean module separation, structured logging, and thoughtful patterns (Sui tx queue, presign pool, cursor-based event replay). Several critical security gaps need attention before production deployment.

---

## Findings

### CRITICAL-01: No API Authentication

**Severity**: CRITICAL
**Location**: `index.ts`, lines 107-331

All API endpoints are completely unauthenticated. Any client can initiate seal sessions, query treasury balances, and view presign pool stats. `/api/seal/start` creates DB records and allocates resources.

**Impact**: Attacker can enumerate sessions, monitor internal state, and abuse the system by creating sessions that consume presigns and dWallets.

**Recommendation**: Add API key authentication or JWT. At minimum, gate admin endpoints behind an API key. Add rate limiting on `/api/seal/start`.

---

### CRITICAL-02: Payment Transaction Replay Attack

**Severity**: CRITICAL
**Location**: `index.ts`, lines 153-222

`/api/seal/confirm-payment` verifies a Solana payment transaction but doesn't check if the `paymentTxSignature` was already used for a previous session. Attacker pays once, reuses the signature for unlimited dWallet creations.

**Impact**: Financial drain — each dWallet costs IKA/SUI to create.

**Recommendation**: Store verified `paymentTxSignature` in database with unique constraint. Reject duplicates.

---

### CRITICAL-03: Minting Key Material in Environment Variables

**Severity**: CRITICAL
**Location**: `config.ts` line 78, `index.ts` lines 443-444

`MINTING_DWALLET_SECRET_KEY_SHARE`, `MINTING_DWALLET_PUBLIC_OUTPUT`, and `IRYS_PRIVATE_KEY` are stored in environment variables. Env vars are visible in `/proc/PID/environ`, cloud dashboards, logging systems, and crash reports.

**Impact**: Key material leakage enables unauthorized signing and Arweave uploads.

**Recommendation**: Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) or encrypted files with restricted permissions.

---

### HIGH-01: Single EVM RPC for All Chains

**Severity**: HIGH
**Location**: `chain-verifier.ts`, lines 82-84

`verifyEvm` uses `config.baseRpcUrl` for ALL EVM chains (Base, Ethereum, Polygon, Arbitrum, Optimism). Verifying an Ethereum NFT against Base RPC will succeed if the contract exists on Base (different chain, different NFT) or fail misleadingly.

**Impact**: Users could claim NFTs on the wrong chain, or verification fails for all non-Base EVM chains.

**Recommendation**: Map each chain to its corresponding RPC URL. Add `ethereumRpcUrl`, `polygonRpcUrl`, etc. to config.

---

### HIGH-02: No Rate Limiting on API Endpoints

**Severity**: HIGH
**Location**: `index.ts`, lines 107-331

No rate limiting on any endpoint. `/api/seal/start` creates DB records. `/api/seal/confirm-deposit` triggers chain verification, Arweave uploads, and Sui transactions.

**Impact**: DoS via rapid session creation, resource exhaustion, financial drain (Sui gas, Arweave upload costs).

**Recommendation**: Add `express-rate-limit` middleware.

---

### HIGH-03: Unrestricted CORS

**Severity**: HIGH
**Location**: `index.ts`, line 108

`cors()` with no options allows requests from any origin. Any website can make API calls to the relayer.

**Impact**: Cross-origin abuse, session creation from malicious sites.

**Recommendation**: Configure CORS with explicit allowlist of trusted origins.

---

### HIGH-04: VAA Sequence Precision Loss

**Severity**: HIGH
**Location**: `vaa-ingester.ts`, line 156

`BigInt(Math.trunc(Number(lastSeq)))` — converts string to Number then to BigInt. For sequences > `Number.MAX_SAFE_INTEGER`, precision is lost.

**Impact**: VAA skipping or duplicate processing at very high sequence numbers.

**Recommendation**: Use `BigInt(lastSeq)` directly.

---

### HIGH-05: Config Eagerly Evaluated at Module Level

**Severity**: HIGH
**Location**: `config.ts`, line 119

`export const config = getConfig()` evaluated on import. Importing any module for testing requires full env setup.

**Impact**: Cannot import individual modules without full environment; breaks testability.

**Recommendation**: Remove eager export; use `getConfig()` function only.

---

### MEDIUM-01: SSRF via User-Controlled URI

**Severity**: MEDIUM
**Location**: `metadata-handler.ts`, lines 163-188, 286-323

`fetchMetadataFromUri` and `uploadImageToArweave` fetch arbitrary URLs from user-controlled `tokenURI` values. Could target internal services (`http://169.254.169.254/`, `http://localhost/`).

**Impact**: Server-Side Request Forgery — read cloud metadata, probe internal services.

**Recommendation**: Validate URLs against blocklist of private/internal IP ranges. Only allow `https://` and IPFS/Arweave schemes.

---

### MEDIUM-02: No Maximum Image Size Limit

**Severity**: MEDIUM
**Location**: `metadata-handler.ts`, lines 290-314

Image fetch has no size limit. Malicious tokenURI → extremely large file → OOM crash or excessive Arweave costs.

**Recommendation**: Add max image size check (e.g., 10 MB). Read Content-Length first, use streaming with size limiter.

---

### MEDIUM-03: Stale Session Race Condition in processDeposit

**Severity**: MEDIUM
**Location**: `index.ts`, lines 265-269

`processDeposit` called asynchronously after responding. Two concurrent requests for same session could both pass `waiting_deposit` status check and proceed.

**Impact**: Duplicate deposit processing, duplicate signing, potential double-minting.

**Recommendation**: Atomic DB status transition: `UPDATE ... WHERE status = 'waiting_deposit' RETURNING ...`.

---

### MEDIUM-04: Presign Allocation Race Condition

**Severity**: MEDIUM
**Location**: `db.ts`, lines 242-266

`allocatePresign` reads then updates in two statements. Could allocate same presign twice within same event loop tick.

**Recommendation**: Single atomic SQL: `UPDATE presigns SET status = 'ALLOCATED' WHERE object_id = (SELECT object_id FROM presigns WHERE status = 'AVAILABLE' ORDER BY created_at ASC LIMIT 1) RETURNING *`.

---

### MEDIUM-05: Hardcoded Anchor Discriminators in realm-creator.ts

**Severity**: MEDIUM
**Location**: `realm-creator.ts`, lines 375, 393, 412

Hardcoded byte arrays instead of computed `SHA256("global:<name>")[..8]`. Silent breakage if program is upgraded.

**Recommendation**: Compute discriminators dynamically.

---

### MEDIUM-06: `isVAAProcessedOnChain` Always Returns False

**Severity**: MEDIUM
**Location**: `vaa-ingester.ts`, lines 318-324

Stubbed to always return `false`. Every poll cycle re-submits all previously seen VAAs — wasted Sui gas.

**Recommendation**: Implement the check or maintain local Set of submitted VAA hashes.

---

### MEDIUM-07: Presign Return-to-Pool Ineffective

**Severity**: MEDIUM
**Location**: `seal-signer.ts`, lines 104-109

On errors, code mutates local presign object but doesn't update DB. Presign stays `ALLOCATED` until 5-minute expiry.

**Recommendation**: Add `releasePresign(objectId)` DB function.

---

### MEDIUM-08: `registerInRegistry` Bypasses SuiTxQueue

**Severity**: MEDIUM
**Location**: `dwallet-creator.ts`, lines 381-407

Uses `this.sui.signAndExecuteTransaction` directly, bypassing queue. Concurrent Sui transactions could conflict on shared objects.

**Recommendation**: Route through SuiTxQueue.

---

### MEDIUM-09: Hardcoded IKA/SUI Amounts in dWallet Creator

**Severity**: MEDIUM
**Location**: `dwallet-creator.ts`, lines 234, 238

`10_000_000_000` IKA and `1_000_000_000` SUI hardcoded. If IKA pricing changes, code must be redeployed.

**Recommendation**: Make configurable via env vars.

---

### MEDIUM-10: Only Two SuiClient Methods Rate-Limited

**Severity**: MEDIUM
**Location**: `rate-limited-sui-client.ts`, lines 43-63

Only `getObject` and `getDynamicFields` are rate-limited. Other methods bypass the limiter.

**Impact**: 429 errors from unlimited RPC methods.

**Recommendation**: Patch all methods via Proxy.

---

### MEDIUM-11: Poisonous Event Blocks Listener

**Severity**: MEDIUM
**Location**: `sui-listener.ts`, lines 188-198

If `handler()` throws, cursor isn't advanced. A permanently unprocessable event blocks all subsequent events forever.

**Recommendation**: Add retry counter. After N failures, log error, advance cursor. Dead-letter queue.

---

### MEDIUM-12: No Input Sanitization at API Boundary

**Severity**: MEDIUM
**Location**: Multiple files

`solanaWallet`, `sourceChain`, `nftContract`, `tokenId` used with minimal validation. Errors occur deep in processing rather than at boundary.

**Recommendation**: Validate all inputs at API boundary: base58 for Solana, allowed chain set, chain-specific contract format.

---

### MEDIUM-13: No Graceful Express Shutdown

**Severity**: MEDIUM
**Location**: `index.ts`, lines 362, 493-501

Express server reference not stored. `stop()` doesn't close the HTTP server. In-flight requests terminated abruptly.

**Recommendation**: Store server reference, call `server.close()` in `stop()`.

---

### MEDIUM-14: No Config Format Validation

**Severity**: MEDIUM
**Location**: `config.ts`, lines 43-94

Required env vars checked for presence but not format. `SUI_PACKAGE_ID` not validated as hex, `SOLANA_PROGRAM_ID` not validated as base58, `API_PORT=hello` → `NaN`.

**Recommendation**: Add format validation for critical fields.

---

### LOW-01: `toBytes` Base64/Hex Ambiguity

**Severity**: LOW
**Location**: `index.ts` lines 982-1012, `seal-signer.ts` lines 301-343

Tries base64 first, then hex fallback. Many hex strings are valid base64, causing silent wrong decoding.

---

### LOW-02: Non-Retriable Error Detection Fragile

**Severity**: LOW
**Location**: `index.ts`, lines 531-536

String matching on "already" could match unrelated errors.

---

### LOW-03: Double `getLatestBlockhash` Pattern

**Severity**: LOW
**Location**: `solana-submitter.ts` lines 532-560, `realm-creator.ts` (3 occurrences)

Second blockhash could differ from first, causing confirmation issues.

---

### LOW-04: Retry on All Errors in Solana Submitter

**Severity**: LOW
**Location**: `solana-submitter.ts`, lines 317-362

Retries non-transient errors (program rejections), wasting retries.

---

### LOW-05: Duplicate Utility Functions

**Severity**: LOW
**Location**: `index.ts`, `seal-signer.ts`, `vaa-ingester.ts`

`hexToBytes`, `bytesToHex`, `toBytes` duplicated three times.

**Recommendation**: Extract to shared `utils.ts`.

---

### LOW-06: Health Server on All Interfaces

**Severity**: LOW
**Location**: `health.ts`, line 61

Listens on `0.0.0.0` — exposes internal state to network.

---

### LOW-07: Setup Script Prints Secrets to Console

**Severity**: LOW
**Location**: `setup-minting-dwallet.ts`, lines 157-164

Prints `MINTING_DWALLET_SECRET_KEY_SHARE` to console — could leak in CI/CD logs.

---

### LOW-08: Encryption Seed Reuse Across All dWallets

**Severity**: LOW
**Location**: `dwallet-creator.ts`, lines 91-102

Same `IKA_ENCRYPTION_SEED` for every dWallet. Seed leakage compromises all dWallet encryption keys.

---

### LOW-09: Realm Creation Fire-and-Forget

**Severity**: LOW
**Location**: `index.ts`, lines 604-639

No retry mechanism. If `configureRealmForCollection` fails, collection permanently lacks DAO voting.

---

### LOW-10: Solana Lamport Overflow Risk

**Severity**: LOW
**Location**: `solana-submitter.ts`, lines 261-309

`info.lamports` compared as JS number. Above `Number.MAX_SAFE_INTEGER`, comparisons inaccurate.

---

### LOW-11: `SealSession.status` Type Looseness

**Severity**: LOW
**Location**: `types.ts` line 195, `db.ts` line 208

Status cast from `string` via `as SealSession['status']` — invalid values could propagate silently.

---

---

## Positive Observations

1. **Sui Transaction Queue** — clean FIFO serialization preventing shared object version conflicts
2. **Cursor-based Event Replay** — SuiListener persists cursors to SQLite, replays missed events on restart
3. **Structured Logging** — consistent Pino with structured context throughout
4. **SQLite with WAL Mode** — good choice for single-process relayer, parameterized queries everywhere (no SQL injection)
5. **EVM Address Derivation** — correctly uses `@noble/hashes/sha3` keccak256 (not Node.js NIST SHA3)
6. **Presign Pool with Expiry** — 5-minute TTL prevents permanent lock-up
7. **Manual Borsh Encoding** — well-documented with upfront length assertions
8. **Deterministic Treasury PDA** — pre-computed so royalties can reference before realm exists

---

## Summary Table

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 3 | No API auth, payment replay, secrets in env vars |
| HIGH | 5 | Single EVM RPC, no rate limiting, unrestricted CORS, sequence precision, config eval |
| MEDIUM | 14 | SSRF, race conditions, presign allocation, hardcoded values, input validation, etc. |
| LOW | 11 | Duplicate code, type looseness, fire-and-forget, etc. |

## Priority Recommendations

1. **Immediate**: API authentication + rate limiting, payment replay protection, secrets manager
2. **Short-term**: Fix EVM chain RPC routing, input validation at API boundary, SSRF URL validation
3. **Medium-term**: Graceful shutdown, atomic presign allocation, image size limits, configurable amounts
4. **Long-term**: Extract duplicate utils, dead-letter queue for poisonous events, per-dWallet encryption seeds
