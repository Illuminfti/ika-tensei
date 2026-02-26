# Audit Report: Sui Move Contracts (ikatensei)

**Package**: `packages/sui-contracts/ikatensei/sources/`
**Files**: 7 Move source files (~1776 lines)
**Package Version**: 6 (testnet deployment)
**Purpose**: Cross-chain NFT bridging orchestration on Sui, integrating Wormhole VAA verification and IKA dWallet distributed signing

---

## Module Summary

| Module | Lines | Purpose |
|--------|-------|---------|
| `orchestrator.move` | 633 | Central coordination — seal lifecycle, VAA processing, signing, completion |
| `dwallet_registry.move` | 367 | Deposit dWallet metadata, registration, lifecycle management |
| `signing.move` | 269 | Minting dWallet lifecycle and signing operations |
| `payload.move` | 288 | Wormhole VAA payload encoding/decoding (stateless utility) |
| `dwallet_factory.move` | 124 | Thin wrapper around IKA DKG coordinator calls |
| `treasury.move` | 61 | On-chain balance pool for IKA/SUI coordinator fees |
| `kiosk_helper.move` | 34 | Utility for extracting NFTs from Sui Kiosks |

**Overall Assessment**: Well-structured with clear separation of concerns and good use of `public(package)` visibility for internal APIs. However, two critical access control gaps on public entry points need immediate attention.

---

## Findings

### CRITICAL-01: `complete_seal` Has No Access Control

**Severity**: CRITICAL
**Location**: `orchestrator.move`, line 523-575

`complete_seal` is `public fun` with no `OrchestratorAdminCap` requirement. While it verifies the Ed25519 signature against `MintingAuthority`, once a valid signature exists (e.g., in IKA signing completion events), anyone who observes it can race to call `complete_seal`.

**Impact**: Front-running/griefing — an attacker monitoring IKA signing events could call `complete_seal` before the relayer, mutating `OrchestratorState` (marks seals completed, increments counters) and `DWalletRegistry` (marks dWallets used).

**Recommendation**: Add `_cap: &OrchestratorAdminCap` parameter. Only the relayer should finalize seals.

---

### CRITICAL-02: `request_sign_seal` Has No Access Control

**Severity**: CRITICAL
**Location**: `orchestrator.move`, lines 381-416

`request_sign_seal` is `public fun` with no capability requirement. It withdraws coins from the treasury for IKA coordinator fees. Anyone with a valid `UnverifiedPresignCap` and a `vaa_hash` in `pending_seals` can trigger signing.

**Impact**: Treasury drain — each signing request consumes IKA and SUI from the treasury. An attacker who obtains an `UnverifiedPresignCap` could trigger unauthorized signing requests.

**Recommendation**: Add `_cap: &OrchestratorAdminCap` parameter.

---

### HIGH-01: Centralized Seal Allows Duplicate Bridging of Same NFT

**Severity**: HIGH
**Location**: `orchestrator.move`, lines 455-515, `create_centralized_seal`

The centralized seal's replay protection key is `sha256(source_chain || nft_contract || token_id || receiver)`. If the same NFT is bridged to different receivers, the hash differs and a new seal is created. No `(source_chain, nft_contract, token_id)` uniqueness check exists — only the composite hash is checked. A compromised or buggy relayer could seal the same NFT multiple times to different receivers.

**Impact**: Duplicate Solana mints for the same source-chain NFT — violates the protocol's core invariant that one source NFT = one reborn NFT.

**Recommendation**: Add a `sealed_nfts` table keyed by `(source_chain, nft_contract, token_id)` to prevent duplicate bridging regardless of receiver.

---

### HIGH-02: `create_shared_dwallet` Is Publicly Callable

**Severity**: HIGH
**Location**: `dwallet_factory.move`, lines 48-83

`create_shared_dwallet` is `public fun` with no capability requirement. Anyone can call it to create dWallets through the ikatensei package.

**Impact**: Abuse of package identity. External callers can create dWallets through your package, causing confusion in auditing/attribution.

**Recommendation**: Change to `public(package) fun` since it's only used internally.

---

### HIGH-03: `transfer_ownership` Does Not Transfer the `RegistryOwnerCap`

**Severity**: HIGH
**Location**: `dwallet_registry.move`, lines 258-271

Updates `registry.owner` field but does NOT transfer `RegistryOwnerCap`. The registry has a dual authorization model where `RegistryOwnerCap` is required for mutations but `owner` is a separate field. After `transfer_ownership`, the `owner` field is misleading — the original cap holder retains full control.

**Impact**: Misleading ownership state. Downstream code/UIs relying on `registry.owner` will show wrong admin.

**Recommendation**: Either remove the `owner` field entirely (rely solely on `RegistryOwnerCap`) or have `transfer_ownership` actually transfer the cap (take by value, not reference).

---

### MEDIUM-01: `MintingAuthority` Initialized with Empty Public Key

**Severity**: MEDIUM
**Location**: `orchestrator.move`, lines 162-167

`MintingAuthority.minting_pubkey` starts as `vector::empty()`. While `complete_seal` validates length == 32, `create_centralized_seal` reads `minting_authority.minting_pubkey` and stores it without any length check. If called before `set_minting_pubkey`, the seal gets an empty pubkey.

**Recommendation**: Add `assert!(vector::length(&minting_authority.minting_pubkey) == 32, E_SIGNATURE_FAILED)` in `create_centralized_seal`.

---

### MEDIUM-02: `mark_dwallet_used` Emits `timestamp: 0`

**Severity**: MEDIUM
**Location**: `dwallet_registry.move`, lines 251-254

`DWalletUsed` event always emits `timestamp: 0` because the function doesn't take a `Clock` parameter. Off-chain systems see meaningless timestamps.

**Recommendation**: Pass `clock: &sui::clock::Clock` and use `clock::timestamp_ms(clock) / 1000`.

---

### MEDIUM-03: `encode_seal_payload` Panics on Overlong Input

**Severity**: MEDIUM
**Location**: `payload.move`, lines 146-223

`contract_pad = 32 - contract_len` will underflow and abort if `contract_len > 32`. No explicit validation or error message.

**Recommendation**: Add `assert!(vector::length(&nft_contract) <= 32, E_INVALID_PAYLOAD)` before arithmetic.

---

### MEDIUM-04: No `deposit_address` Validation in Centralized Seal

**Severity**: MEDIUM
**Location**: `orchestrator.move`, lines 455-515

`create_centralized_seal` accepts `deposit_address` without length or format validation. Empty or malformed addresses could be stored and used as keys in `used_dwallets` table.

**Recommendation**: Add `assert!(addr_len == 20 || addr_len == 32, E_INVALID_DWALLET)`.

---

### MEDIUM-05: Used dWallets Can Be Reactivated

**Severity**: MEDIUM
**Location**: `dwallet_registry.move`, lines 207-227

`reactivate_dwallet` doesn't check the `used` flag. A used dWallet (`active=false, used=true`) can be reactivated to `active=true, used=true` — an invalid state. The orchestrator's `used_dwallets` table provides defense-in-depth, but the state is confusing.

**Recommendation**: Add `assert!(!record.used, E_ALREADY_USED)` in `reactivate_dwallet`.

---

### MEDIUM-06: Presign Hardcodes Curve/Algorithm Values

**Severity**: MEDIUM
**Location**: `signing.move`, lines 185-211

`request_presign` hardcodes `2` (Ed25519) and `0` (EdDSA) instead of reading from `SigningState.curve` and `SigningState.signature_algorithm`. If `update_params` changes these values, presign requests use stale hardcoded values.

**Recommendation**: Pass `state: &SigningState` to `request_presign` and use stored values.

---

### LOW-01: Error Code Gaps and Collisions Across Modules

**Severity**: LOW

Error codes skip numbers in `orchestrator.move` and different modules share the same numeric codes. Makes debugging harder.

**Recommendation**: Use distinct ranges per module (e.g., orchestrator 200+, registry 300+, payload 400+).

---

### LOW-02: Unused Public `verify_signature` Utility

**Severity**: LOW
**Location**: `orchestrator.move`, lines 581-590

`verify_signature` is public but not used anywhere in the contract. Minor code bloat.

---

### LOW-03: `DWalletRecord` Has `copy` Ability

**Severity**: LOW
**Location**: `dwallet_registry.move`, line 65

`copy` on records stored in `Table` could lead to stale data bugs if the package grows. Records are always read from the table, so `copy` may be unnecessary.

---

### LOW-04: `chain_name` Missing Testnet Chain IDs

**Severity**: LOW
**Location**: `payload.move`, lines 263-276

Returns `"unknown"` for testnet chain IDs (10002-10005) even though `is_supported_chain` explicitly supports them.

---

### LOW-05: Unused `_ctx` Parameters

**Severity**: LOW
**Location**: `orchestrator.move`, lines 302, 530

Both `process_vaa` and `complete_seal` take `_ctx: &mut TxContext` but never use it.

---

## Positive Observations

1. **Excellent `public(package)` encapsulation** — `signing.move`, `treasury.move`, and `dwallet_registry.mark_dwallet_used` are all properly gated.
2. **Correct Wormhole VAA integration** — verifies emitter chain/address against allowlist, replay protection via `processed_vaas` table, `vaa::take_emitter_info_and_payload` consumes VAA object preventing reuse.
3. **Correct Ed25519 verification** — uses `sui::ed25519::ed25519_verify` with proper 64-byte signature and 32-byte pubkey length checks.
4. **Clean kiosk helper** — list-at-zero-and-purchase pattern correctly returns `TransferRequest` for caller to resolve policies.
5. **Treasury withdraw-use-return pattern** — clean resource management.
6. **Proper AdminCap gating** on admin functions (`create_centralized_seal`, `set_minting_pubkey`, `register_emitter`, etc.).

---

## Priority Recommendations

1. **Immediate (CRITICAL)**: Add `OrchestratorAdminCap` gating to `complete_seal` and `request_sign_seal`
2. **High**: Add `sealed_nfts` table keyed by `(source_chain, nft_contract, token_id)` for duplicate prevention
3. **High**: Restrict `dwallet_factory::create_shared_dwallet` to `public(package)`
4. **High**: Resolve dual-authority model in `dwallet_registry`
5. **Medium**: Add pubkey length assertion to `create_centralized_seal`, pass `SigningState` to `request_presign`, prevent reactivating used dWallets
