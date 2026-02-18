# Cross-Chain Protocol Security Audit — Ika Tensei v3

**Audit Date:** 2026-02-18  
**Protocol Version:** v3 (PRD-v3.md)  
**Classification:** CONFIDENTIAL — Protocol-Level Findings  
**Auditor:** Security Analysis  
**Threat Model:** Nation-state attacker with unlimited resources targeting protocol holding millions in NFTs

---

## 1. Protocol Trust Assumptions

The protocol makes the following trust assumptions:

| # | Trust Assumption | Implication if Violated |
|---|-----------------|------------------------|
| 1 | **Wormhole Guardians (13/19)** — Trustless deposit verification via VAA signatures | Fake deposits could be forged, enabling worthless NFT rebirth |
| 2 | **IKA Network Validators (2PC-MPC)** — dWallet signing is honest | Colluding validators could sign to extract sealed NFTs |
| 3 | **Relayer Liveness** — Relayer processes all NFTSealed events | Orphaned seals, NFTs permanently locked with no reborn |
| 4 | **Admin Key Security** — AdminCap not compromised | Protocol pause, treasury hijacking possible |
| 5 | **Solana Program Authority** — Upgrade authority trusted | Program could be upgraded to mint unauthorized NFTs |
| 6 | **Source Chain Deposit Contracts** — Emit correct VAAs | Fake deposit proofs, double-mint attacks |
| 7 | **No Chain ID Confusion** — Chain ID mapping correct across systems | Cross-chain confusion, wrong destination |
| 8 | **Attestation Pubkey Authenticity** — Caller provides real dWallet pubkey | Phantom reborn with fake seal |
| 9 | **Metadata Truthfulness** — Sealers provide accurate metadata | Fake metadata stored, misleading buyers |
| 10 | **Nonce Uniqueness** — Callers provide unique nonces | Hash collisions, double-seal attacks |
| 11 | **Fee Payment** — Source chain fees are paid | Economic attack, resource exhaustion |
| 12 | **Cross-Chain Consistency** — Sui ↔ Solana state stays synchronized | Double-mint, phantom reborn |

---

## 2. Cross-Chain Attack Surface

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ATTACK SURFACE DIAGRAM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────────┐  │
│  │ Ethereum │────▶│ Wormhole │────▶│    Sui   │────▶│    Solana            │  │
│  │  Chain   │     │ Guardians│     │ Registry │     │    Program           │  │
│  └──────────┘     └──────────┘     └──────────┘     └──────────────────────┘  │
│       │                │                │                     │                  │
│       ▼                ▼                ▼                     ▼                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────────┐  │
│  │Deposit   │     │  VAA     │     │SealVault│     │ReincarnationRecord   │  │
│  │Contract  │     │Forgery   │     │  Lock   │     │    PDA               │  │
│  │(Fee Bypass)   │(13/19)   │     │(Race)   │     │(Double-Mint)         │  │
│  └──────────┘     └──────────┘     └──────────┘     └──────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          RELAYER (SINGLE POINT)                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │   │
│  │  │  Listen    │  │  Sign      │  │  Verify   │  │  Mark Reborn   │   │   │
│  │  │(Orphaned) │  │(Fee-free) │  │(Bypass)   │  │(Phantom)       │   │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                              IKA NETWORK                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────────────────┐ │   │
│  │  │    DKG    │  │   Signing  │  │  2PC-MPC Key Extraction           │ │   │
│  │  │(Honest)   │  │(Collusion)│  │  (Validator compromise)            │ │   │
│  │  └────────────┘  └────────────┘  └────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Legend:
[CRITICAL] - Red border
[HIGH]     - Orange border  
[MEDIUM]   - Yellow border
```

---

## 3. Findings

### CRITICAL FINDINGS

#### C-001: Phantom Reborn — mark_reborn() Is Fully Permissionless Without Ownership Verification

**Location:** `registry.move` — `mark_reborn()` function (lines ~380-400)

**Description:**
The `mark_reborn()` function on Sui is completely permissionless:

```move
public fun mark_reborn(
    registry: &mut SealRegistry,
    seal_hash: vector<u8>,
    solana_mint_address: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&registry.seals, seal_hash), E_SEAL_NOT_FOUND);
    let record = table::borrow_mut(&mut registry.seals, seal_hash);
    assert!(!record.reborn, E_ALREADY_REBORN);

    record.reborn = true;
    record.solana_mint_address = solana_mint_address;
    // NO verification that caller actually minted on Solana
    // NO verification that the mint address is valid
    // NO verification that caller owns the sealed NFT
}
```

**Attack:**
1. Attacker calls `register_seal_with_vaa()` legitimately, sealing a worthless NFT
2. Attacker (or anyone) calls `mark_reborn()` with a fake Solana mint address that they control
3. The Sui registry shows "reborn" but the actual NFT was never minted on Solana
4. Attacker can demonstrate "ownership" via Sui record while actually holding nothing on Solana

**Impact:** Protocol integrity completely compromised. Seals can be marked reborn without any actual mint on Solana. Users could be tricked into believing they own reborn NFTs.

**Recommendation:**
- **Option A (Recommended):** Remove `mark_reborn()` from Sui entirely. Rely solely on Solana's `ReincarnationRecord.minted` flag as the source of truth.
- **Option B:** Add verification that the provided `solana_mint_address` actually holds the NFT by querying Solana via CPI or RPC within the transaction.

---

#### C-002: Relayer Fee Bypass — No Fee Verification on Sui Registration

**Location:** `registry.move` — `register_seal_with_vaa()` has no fee parameter

**Description:**
The Sui `register_seal_with_vaa()` function accepts no fee parameter and performs no fee verification:

```move
public fun register_seal_with_vaa(
    registry: &mut SealRegistry,
    vault: &mut SealVault,
    vaa_bytes: vector<u8>,
    // ... no fee parameter
    ctx: &mut TxContext,
): vector<u8> {
    // No fee check!
    // Fee is only enforced on source chain (ETH contract)
    // But anyone can call register_seal_with_vaa directly, bypassing source chain
}
```

The fee is only enforced on the source chain (e.g., `IkaTenseiDeposit.sol` checks `msg.value >= depositFee`), but the Sui registration can be called directly via relayer with no fee verification.

**Attack:**
1. Attacker runs their own relayer (or calls contracts directly)
2. Skip fee payment entirely
3. Seal many NFTs without paying anything

**Impact:** Complete economic bypass. Protocol cannot collect fees. Attackers can flood the protocol.

**Recommendation:**
- Add a `fee: u64` parameter to `register_seal_with_vaa()`
- Verify the fee matches the configured amount in `ProtocolConfig`
- Require the caller (relayer) proves fee was paid on source chain (e.g., include fee payment receipt in VAA payload)

---

#### C-003: Wormhole VAA Stub — No Actual Verification

**Location:** `registry.move` — `parse_vaa_stub()` (lines ~520-530)

**Description:**
The VAA verification is stubbed out:

```move
fun parse_vaa_stub(vaa: &vector<u8>): (u16, vector<u8>, vector<u8>) {
    // TODO: Replace with real Wormhole verification for production.
    // Stub returns: Wormhole chain 21 (Sui), empty emitter, SHA2-256(vaa) as hash.
    (21u16, vector[], std::hash::sha2_256(*vaa))
}
```

**Attack:**
- **In current implementation:** Anyone can submit any VAA and it will be accepted
- Fake deposit VAAs can be constructed trivially
- No guardian signature verification whatsoever

**Impact:** CRITICAL in current state. Protocol is completely insecure until real Wormhole integration.

**Recommendation:**
- Replace stub with actual `wormhole::vaa::parse_and_verify()` per PRD §8.4
- Test with mainnet Wormhole guardians

---

#### C-004: SealVault Does NOT Actually Lock DWalletCap — Only Records IDs

**Location:** `seal_vault.move` — `seal()` function

**Description:**
The `seal()` function only stores the DWalletCap IDs in a table but never actually transfers the capability to the vault:

```move
public fun seal(
    vault: &mut SealVault,
    dwallet_id: ID,
    cap_id: ID,
    // ...
) {
    let key = object::id_to_bytes(&dwallet_id);
    assert!(!table::contains(&vault.sealed_caps, key), E_ALREADY_SEALED);
    table::add(&mut vault.sealed_caps, key, SealedCap { dwallet_id, cap_id });
    // NO transfer::public_transfer(dwallet_cap, ...)
    // The DWalletCap remains in the original owner's wallet!
}
```

And in `register_seal_with_vaa()`:
```move
seal_vault::seal(vault, dwallet_id, dwallet_cap_id, ...);
// dwallet_cap_id is just an ID, not the actual object
```

**Attack:**
1. User creates dWallet, gets DWalletCap
2. Calls register_seal, which "seals" the ID in SealVault
3. **But user still has the DWalletCap in their wallet!**
4. User can continue signing with the dWallet
5. NFT can be transferred OUT of the dWallet address

**Impact:** The fundamental security assumption is broken. NFTs are NOT permanently locked.

**Recommendation:**
- Modify `register_seal_with_vaa()` to accept `DWalletCap` objects as parameters
- Actually transfer them: `transfer::public_transfer(dwallet_cap, object::id_to_address(&object::id(vault)))`
- Verify the transferred objects match the IDs

---

### HIGH FINDINGS

#### H-001: Race Condition — Seal Registration Before Capability Lock

**Location:** `registry.move` — `register_seal_with_vaa()` execution order

**Description:**
The PRD specifies this critical ordering:
> Step 4 and 5 are the critical ordering: sign THEN lock. Once DWalletCap is in SealVault, no more signing is possible.

But the implementation has a window where:
1. Seal is registered (record created)
2. DWalletCap "sealed" (ID recorded in table)
3. But the capability is never actually transferred

Even if the transfer were added, there's a theoretical race:
- Between `seal_vault::seal()` completing and the transaction finalizing
- An attacker could potentially initiate a signing operation

**Attack:**
1. User initiates seal registration
2. Between seal() and tx finalization, user calls IKA sign with dWallet
3. If tx reverts, user still has cap and can sign again

**Impact:** Temporary window where dWallet could sign after "sealing"

**Recommendation:**
- Use Sui's programmable transaction blocks (PTB) to make seal + cap transfer atomic
- The signature request MUST happen in a SEPARATE transaction BEFORE seal registration (as PRD specifies)

---

#### H-002: Orphaned Seals — No Recovery Mechanism

**Location:** `relayer/src/index.ts` — processing logic

**Description:**
If the relayer fails after Sui seal registration but before Solana mint:
- NFT is sealed (transferred to dWallet address on source chain)
- Sui registry shows `reborn: false`
- No reborn NFT on Solana
- No way for user to recover their NFT

**Attack:**
1. Relayer goes down / gets stuck
2. User's NFT is locked forever
3. No timeout, no rescue function, no emergency withdrawal

**Impact:** User funds permanently lost. Protocol becomes unusable during relayer downtime.

**Recommendation:**
- Add a timeout (e.g., 24 hours) after seal registration
- If not reborn within timeout, allow "rescue" via:
  - Multi-sig governance approval, OR
  - IKA validators sign a recovery message, OR
  - Implement a "forced mark_reborn" with cryptographic proof of Solana mint

---

#### H-003: Double Mint — No Cross-Chain State Verification

**Location:** `lib.rs` — `mint_reborn()` and Sui `mark_reborn()` independently

**Description:**
Solana's `mint_reborn` only checks its own `record.minted` flag:

```rust
pub fn mint_reborn(ctx: Context<MintReborn>, ...) -> Result<()> {
    require!(!ctx.accounts.record.minted, ErrorCode::AlreadyMinted);
    // No check: has Sui marked this as reborn?
    // No check: does the caller actually own the seal?
}
```

The two chains operate independently with no cross-verification.

**Attack:**
1. Attacker calls `verify_seal()` on Solana legitimately
2. Attacker mints NFT via `mint_reborn()`
3. Attacker also calls `mark_reborn()` on Sui with a DIFFERENT mint address
4. Sui shows one mint address, Solana shows another
5. Confusion, potential double-claims

**Impact:** Inconsistent state between chains

**Recommendation:**
- Option A: Remove Sui `mark_reborn()` entirely (per C-001)
- Option B: Require cross-verification — mark_reborn() should verify the mint exists on Solana via CPI or anchor rpc

---

#### H-004: Admin Key Compromise — Full Protocol Control

**Location:** `registry.move` — AdminCap functions

**Description:**
AdminCap holder can:
- Pause/unpause protocol (`pause_protocol`, `unpause_protocol`)
- Update treasury addresses (`update_treasuries`)
- Update fee shares (`update_shares`)
- Register/deactivate collections
- Register trusted emitters

**Attack:**
1. Admin key compromised (or malicious admin)
2. Update treasury to attacker-controlled address
3. All future fees go to attacker
4. Unregister current collections to break protocol
5. Register fake emitters to enable fake VAA attacks

**Impact:** Complete protocol compromise

**Recommendation:**
- Implement multi-sig for admin actions (e.g., 3-of-5)
- Time-locks on critical changes (e.g., 24-hour delay before treasury change takes effect)
- Separate admin capabilities (pause only vs. treasury control)

---

#### H-005: Solana Program Upgrade Authority

**Location:** `lib.rs` — Program upgrade

**Description:**
The Solana program can be upgraded by whoever holds the upgrade authority. If compromised:

```rust
// Anyone with upgrade authority can:
// 1. Replace the program with malicious code
// 2. Bypass all signature verification
// 3. Mint NFTs at will
// 4. Drain fees
```

**Attack:**
1. Upgrade authority key compromised
2. Deploy malicious program that mints NFTs without seal verification
3. Steal royalties, create fake NFTs

**Impact:** Complete Solana-side compromise

**Recommendation:**
- Use a multisig for upgrade authority
- Implement a timelock (24-48 hours) before upgrades take effect
- Consider making the program immutable after initial setup

---

### MEDIUM FINDINGS

#### M-001: Nonce Exhaustion / Prediction Attack

**Location:** `register_seal_with_vaa()` — nonce parameter

**Description:**
The nonce is provided by the caller with no validation:

```move
let seal_hash = compute_seal_hash(
    source_chain_id, source_contract, token_id, &attestation_pubkey, nonce,
);
```

If an attacker can predict or control nonces:
1. Predict next nonce, pre-compute seal hash
2. Flood the namespace with low-nonce seals
3. Legitimate users can't get unique hashes

**Attack:**
1. Attacker monitors mempool for pending seal transactions
2. Predicts nonces, front-runs with duplicate nonces
3. Legitimate seals fail due to hash collision

**Impact:** DoS on legitimate users

**Recommendation:**
- Use a nonce counter in `ProtocolConfig` instead of caller-provided nonce
- Increment automatically on each seal
- Revert if nonce doesn't match expected value

---

#### M-002: Metadata Manipulation

**Location:** `register_seal_with_vaa()` — metadata parameters

**Description:**
Metadata fields are passed as parameters with no verification:

```move
metadata_name: vector<u8>,
metadata_description: vector<u8>,
metadata_uri: vector<u8>,
```

**Attack:**
1. Seal an NFT with fake metadata (e.g., "Punk #9999" when sealing a worthless JPEG)
2. The reborn NFT carries fake metadata
3. Buyers are deceived

**Impact:** Fraud, misrepresentation

**Recommendation:**
- For source chain NFTs with existing metadata (like OpenSea), fetch and verify from source
- For metadata on-chain (Solana), store a reference rather than full data
- Add an optional "metadata oracle" that verifies against known collection metadata

---

#### M-003: Chain ID Confusion — Internal vs. Wormhole IDs

**Location:** Multiple files — Chain ID definitions

**Description:**
Ika protocol uses different chain IDs than Wormhole:

| Chain | Ika ID | Wormhole ID |
|-------|--------|-------------|
| Ethereum | 1 | 2 |
| Solana | 3 | 1 |
| Sui | 2 | 21 |
| Near | 4 | 15 |

The code attempts to handle this via `emitters.move` which stores Wormhole chain IDs, but there's risk of confusion:

**Attack:**
1. Register emitter for chain ID 2 (Wormhole Ethereum)
2. But code mistakenly uses Ika ID 2 (Sui)
3. Wrong chain verification

**Impact:** Wrong chain verification, potential cross-chain confusion

**Recommendation:**
- Use explicit Wormhole chain ID types throughout
- Add compile-time constants that map clearly
- Add integration tests that verify chain ID handling

---

#### M-004: Economic Attack — Flood with Worthless NFTs

**Location:** Fee structure — no Sui-side fee enforcement

**Description:**
Sui-native NFT sealing (`register_seal_native`) has no fee:

```move
public fun register_seal_native<T: key + store>(...) {
    // No fee check
    // Anyone can seal Sui NFTs for free
}
```

**Attack:**
1. Create 1000 worthless Sui NFTs (cost: ~0.01 SUI each = ~$0.001)
2. Seal all of them for free
3. Relayer must process 1000 "seals" (costing Sui gas)
4. Protocol gets flooded with garbage

**Impact:** Resource exhaustion, griefing

**Recommendation:**
- Add fee collection to `register_seal_native()`
- Implement rate limiting per user/collection
- Add a "minimum value" threshold for sealable NFTs

---

### LOW / INFO FINDINGS

#### L-001: Relayer Centralization

**Description:**
Protocol depends on single relayer for:
- Listening to Sui events
- Signing with IKA dWallet
- Calling mark_reborn on Sui

If relayer is down, no new reborn NFTs can be created.

**Recommendation:**
- Implement multiple relayers (anyone can run one)
- Add relayer competition/selection mechanism
- Document emergency procedures

---

#### L-002: IKA Network Trust Model Not Documented

**Description:**
PRD states: "Trustless: Doesn't rely on IKA validators behaving honestly" but doesn't explain what happens if IKA validators collude.

**Recommendation:**
- Document exact IKA validator set and trust assumptions
- Implement slashing mechanism for malicious validators
- Consider threshold decryption audit logs

---

#### L-003: No On-Chain Dispute Resolution

**Description:**
If a user believes their NFT was incorrectly sealed or reborn, there's no on-chain dispute mechanism.

**Recommendation:**
- Add a governance-based dispute resolution
- Implement an appeal mechanism with time locks

---

## 4. Economic Model Analysis

### 4.1 Fee Structure

| Component | Amount | Enforcement |
|-----------|--------|-------------|
| ETH Deposit Fee | `depositFee` (configurable) | ETH Contract (checked) |
| SOL Deposit Fee | Implicit via program | Solana program |
| Sui Seal Fee | NONE | ❌ NOT ENFORCED |
| Solana Mint Fee | `mint_fee` (configurable) | Program (checked) |

### 4.2 Incentive Misalignment

**Attacker Economics:**

| Attack | Cost | Potential Gain |
|--------|------|----------------|
| Fee bypass via direct Sui call | 0 (Sui gas only) | Unlimited NFTs |
| Flood with worthless Sui NFTs | ~0.001 SUI/NFT | Protocol disruption |
| Fake VAA (if stub not fixed) | 0 | Unlimited fake seals |
| Phantom reborn | 0 | Misleading ownership records |

**Relayer Economics:**
- Pays Sui gas for every seal
- Pays Solana fees for verify + mint
- No mechanism to recover costs if user abandons seal

### 4.3 Griefing Cost Analysis

| Attack Vector | Attack Cost | Protocol Cost | Recommendation |
|---------------|-------------|---------------|-----------------|
| Orphaned seal (user) | ~$0.01 (Sui gas) | Lost NFT | Timeout + rescue |
| Flood with seals | ~$0.001/NFT | Sui gas per seal | Rate limiting |
| Fake metadata | 0 | Misleading buyers | Metadata oracle |

---

## 5. IKA Network Trust Model

### What Happens if IKA Validators Collude?

**Current Trust Model:**
- IKA uses 2PC-MPC (2-Party Computation Multi-Party Computation)
- Threshold signatures require participation from both user share and validator share
- PRD claims: "Without DWalletCap, nobody can call approve_message"

**If Validators Collude:**

| Scenario | Impact | Mitigation |
|----------|--------|-------------|
| Validators sign without user share | Can sign arbitrary messages | User must provide their share for every sign |
| Validators steal user share | Could impersonate user | Shares are encrypted, distributed |
| Validators refuse to sign | DoS only | User can't move funds (by design) |
| Full validator compromise + user share theft | Can sign ANY message | **NO MITIGATION** |

### Critical Vulnerability:

The SealVault only prevents signing via DWalletCap. But if IKA validators are fully compromised:
1. They can produce signatures for ANY dWallet without the cap
2. The cap only exists in the contract, not in IKA's signing protocol
3. IKA could sign a transaction to transfer the NFT out of the dWallet address

**Recommendation:**
- Document this limitation clearly
- Consider "observer" mode where external parties can challenge suspicious signatures
- Accept that IKA Network security is a fundamental trust assumption

---

## 6. Recommendations (Prioritized)

### Immediate (Must Fix Before Launch)

| Priority | Finding | Fix | Effort |
|----------|---------|-----|--------|
| P0 | C-003 (VAA Stub) | Implement real Wormhole verification | High |
| P0 | C-004 (No Cap Transfer) | Transfer DWalletCap to SealVault | Medium |
| P0 | C-002 (Fee Bypass) | Add fee check to Sui registration | Low |
| P0 | C-001 (Phantom Reborn) | Remove permissionless mark_reborn or add verification | Medium |

### Before Mainnet

| Priority | Finding | Fix | Effort |
|----------|---------|-----|--------|
| P1 | H-004 (Admin Key) | Multi-sig + timelocks | Medium |
| P1 | H-005 (Solana Upgrade) | Multi-sig + timelocks | Medium |
| P1 | H-002 (Orphaned Seals) | Add timeout + rescue mechanism | High |
| P1 | H-001 (Race Condition) | Make seal+lock atomic via PTB | Low |

### Post-Launch

| Priority | Finding | Fix | Effort |
|----------|---------|-----|--------|
| P2 | M-001 (Nonce) | Use protocol-managed nonce | Medium |
| P2 | M-002 (Metadata) | Add metadata oracle verification | High |
| P2 | M-004 (Flood Attack) | Add Sui-side fees + rate limiting | Low |
| P2 | L-001 (Relayer) | Add permissionless relayer model | High |

---

## 7. Summary

### Critical Issues: 4
- VAA verification stubbed out (fake deposits possible)
- DWalletCap not actually transferred (NFTs not locked)
- No fee enforcement on Sui (economic bypass)
- Phantom reborn without ownership proof

### High Issues: 5  
- Race condition in seal workflow
- No recovery for orphaned seals
- Double-mint without cross-chain verification
- Single-point-of-failure admin key
- Solana upgrade authority risk

### Medium Issues: 4
- Nonce prediction/exhaustion
- Metadata manipulation
- Chain ID confusion
- Flood/griefing attack

### Overall Assessment:

**The protocol CANNOT launch in its current state.** The C-003 (VAA stub) and C-004 (cap not transferred) findings fundamentally break the security model. After fixing these, the economic model (C-002) and integrity model (C-001) must be addressed before mainnet.

**Trust Assumptions to Communicate:**
1. Wormhole 13/19 guardian threshold is trusted
2. IKA validator set is trusted for signing
3. Relayer liveness is critical
4. Admin keys are secured via multi-sig

---

*End of Audit Report*
