# Sui Move Smart Contracts - Security Audit Report

**Project:** Ika Tensei v3 - Cross-chain NFT Sealing Protocol  
**Audit Date:** 2026-02-18  
**Auditor:** Security Audit Subagent  
**Files Reviewed:** registry.move (770 LOC), seal_vault.move (96 LOC), admin.move (97 LOC), emitters.move (94 LOC), events.move (8 LOC)

---

## Summary

This audit identifies **5 Critical**, **4 High**, **4 Medium**, and **3 Low** severity vulnerabilities in the Ika Tensei Sui Move smart contracts. The most severe issues allow attackers to forge cross-chain sealings without legitimate deposits, front-run the rebirth process to steal NFTs, and permanently brick the protocol.

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 4 |
| Medium | 4 |
| Low | 3 |
| **Total** | **16** |

---

## Findings

### [CRITICAL-1] VAA Parser Stub Accepts Arbitrary Data - Complete Bypass of Cross-chain Verification

**Severity:** Critical  
**Component:** registry.move:parse_vaa_stub (lines 574-581)

**Description:**
The `parse_vaa_stub()` function returns HARDCODED values regardless of actual VAA content:

```move
fun parse_vaa_stub(vaa: &vector<u8>): (u16, vector<u8>, vector<u8>) {
    // TODO: Replace with real Wormhole verification for production.
    // Stub returns: Wormhole chain 21 (Sui), empty emitter, SHA2-256(vaa) as hash.
    // This allows demo/testing without Wormhole dependency.
    (21u16, vector[], std::hash::sha2_256(*vaa))
}
```

This returns:
- Chain ID 21 (Sui) - ALWAYS, regardless of actual source chain
- Empty emitter address `vector[]` - NOT the actual emitter
- Only the VAA hash is real (SHA2-256 of input)

**Impact:**
**COMPLETE BYPASS OF CROSS-CHAIN VERIFICATION.** Any attacker can:
1. Submit arbitrary `vaa_bytes` with any content
2. The stub always returns chain 21 with empty emitter
3. The emitter trust check at line 317 passes IF chain 21/Sui emitter is registered (empty address)
4. Attacker claims any NFT was "deposited via Wormhole" without any actual cross-chain transfer

**Proof of Concept:**
```move
// Attacker calls register_seal_with_vaa with fabricated data:
registry.register_seal_with_vaa(
    vaa_bytes = x"deadbeef...",  // Arbitrary bytes, not real VAA
    source_chain_id = 1,  // ETH - but VAA says Sui!
    source_contract = attacker_controlled_contract,
    token_id = x"01...",  // Any token
    // ... all other params attacker-controlled
);
// RESULT: Fake seal created, claiming NFT was deposited from ETH
// when no actual Wormhole message was ever produced
```

**Recommendation:**
**DO NOT DEPLOY THIS CONTRACT WITH THE STUB.** The comments document the required Wormhole integration:
1. Add Wormhole package dependency to Move.toml
2. Replace `parse_vaa_stub` with real `wormhole::vaa::parse_and_verify`
3. EXTRACT source_chain_id, source_contract, token_id FROM the VAA payload, not from function parameters
4. Validate emitter matches registered deposit contract
5. Parse PRD §8.2 payload format (171 bytes) to get actual deposit data

---

### [CRITICAL-2] VAA Parameters Are User-Controlled, Not Extracted From VAA

**Severity:** Critical  
**Component:** registry.move:register_seal_with_vaa (lines 282-364)

**Description:**
The function accepts `source_chain_id`, `source_contract`, `token_id` as DIRECT CALLER PARAMETERS rather than extracting them from the verified VAA:

```move
public fun register_seal_with_vaa(
    registry: &mut SealRegistry,
    vault: &mut SealVault,
    vaa_bytes: vector<u8>,
    // ... dWallet params ...
    source_chain_id: u16,        // ← USER INPUT
    source_contract: vector<u8>, // ← USER INPUT  
    token_id: vector<u8>,        // ← USER INPUT
    // ... other params ...
```

Even if the VAA stub were fixed, an attacker can pass ANY values for these parameters. The VAA is only used for:
1. Generating a hash (line 319) for replay protection
2. Verifying emitter (but emitter comes from stub, not VAA)

**Impact:**
Attacker can create a "seal" claiming any NFT from any chain/contract was deposited, without any actual deposit. The seal_hash computation uses these attacker-controlled values, making the seal record completely fake.

**Proof of Concept:**
```move
// Attacker provides:
// - Valid VAA (or stub passes anything)
// - source_chain_id = 1 (ETH)
// - source_contract = 0x1234... (attacker's contract)  
// - token_id = "1"
//
// Result: SealRecord created claiming attacker's NFT was sealed
// No actual NFT was ever deposited to any dWallet
```

**Recommendation:**
After fixing the VAA parser, EXTRACT all parameters from the verified VAA payload:
```move
// Parse PRD §8.2 payload (171 bytes):
let payload_id = vector::pop_back(&mut payload); // must = 1
let source_chain_id = ...; // from bytes 1-2
let nft_contract = ...;    // from bytes 3-34 (32 bytes)
let token_id = ...;        // from bytes 35-66
// Use ONLY these extracted values, ignore function parameters
```

---

### [CRITICAL-3] mark_reborn() Is Fully Permissionless - Front-Running Attack

**Severity:** Critical  
**Component:** registry.move:mark_reborn (lines 399-416)

**Description:**
The `mark_reborn()` function has NO authentication. Anyone can call it with ANY seal_hash and ANY solana_mint_address:

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
    // ... emit event ...
}
```

No verification that:
- The caller is the legitimate sealer
- The caller actually performed the Solana transaction
- The solana_mint_address is valid or belongs to the caller

**Impact:**
**FRONT-RUNNING THEFT.** Attackers can:
1. Monitor mempool for legitimate `mark_reborn` calls
2. Submit same seal_hash with attacker's Solana mint address FIRST
3. Attacker's transaction wins (higher gas or validator ordering)
4. Legitimate user gets "already reborn" error
5. Attacker controls the Solana NFT

**Proof of Concept:**
```move
// Legitimate user submits:
registry.mark_reborn(seal_hash, " legitimate_solana_mint");

// Attacker frontruns with:
registry.mark_reborn(seal_hash, "attacker_solana_mint");

// Attacker's transaction executes first
// Legitimate user's transaction fails with E_ALREADY_REBORN
// Attacker gets the NFT on Solana
```

**Recommendation:**
Either:
1. **Require sealer signature:** Add `signature: vector<u8>` parameter, verify signature from `sealer` address over `solana_mint_address`
2. **Add timelock + challenge period:** Allow sealer to submit intended mint address, wait N blocks before finalization
3. **Sui-specific:** Require the caller to provide proof they control the Solana mint (e.g., signed message verification)

---

### [CRITICAL-4] No max_seals Collection Limit Enforcement

**Severity:** Critical  
**Component:** registry.move:register_seal_with_vaa (lines 355-358) and register_collection

**Description:**
Collections can be registered with `max_seals`, but this limit is NEVER enforced:

```move
// In register_collection (line 199):
table::add(&mut registry.collections, collection_id, CollectionConfig {
    // ...
    max_seals,  // Stored but never checked!
    current_seals: 0,
    // ...
});

// In register_seal_with_vaa (lines 355-358):
if (table::contains(&registry.collections, source_contract)) {
    table::borrow_mut(&mut registry.collections, source_contract).current_seals =
        table::borrow(&registry.collections, source_contract).current_seals + 1;
    // NO CHECK: current_seals <= max_seals
};
```

**Impact:**
- Collections can accept unlimited seals regardless of `max_seals` setting
- Economic model broken - collection capacity can be exceeded
- Potential DoS if collection has resource limits

**Proof of Concept:**
```move
// Admin registers collection with max_seals = 100
registry.register_collection(collection_id, chain, "MyNFT", 100, 1000000);

// Attacker creates 1,000,001 seals for that collection
// All succeed despite max_seals = 100
```

**Recommendation:**
Add enforcement in both `register_seal_with_vaa` and `register_seal_native`:
```move
if (table::contains(&registry.collections, source_contract)) {
    let coll = table::borrow(&registry.collections, source_contract);
    assert!(coll.current_seals < coll.max_seals, E_COLLECTION_LIMIT_REACHED);
    // then increment
};
```

---

### [CRITICAL-5] DWalletCap IDs Not Validated - Fake IDs Accepted

**Severity:** Critical  
**Component:** registry.move:register_seal_with_vaa (lines 282-364) and seal_vault.move:seal (lines 42-69)

**Description:**
The functions accept `dwallet_id`, `dwallet_cap_id`, `attestation_dwallet_id`, `attestation_dwallet_cap_id` as parameters but NEVER validate these IDs correspond to actual DWalletCap objects:

```move
public fun register_seal_with_vaa(
    // ...
    dwallet_id: ID,
    dwallet_cap_id: ID,
    attestation_dwallet_id: ID,
    attestation_dwallet_cap_id: ID,
    // ...
)

// seal_vault::seal just stores these IDs:
public fun seal(
    vault: &mut SealVault,
    dwallet_id: ID,
    cap_id: ID,
    // ...
) {
    let key = object::id_to_bytes(&dwallet_id);
    assert!(!table::contains(&vault.sealed_caps, key), E_ALREADY_SEALED);
    table::add(&mut vault.sealed_caps, key, SealedCap { dwallet_id, cap_id });
    // NO verification that these IDs exist or are valid DWalletCaps
}
```

**Impact:**
- Attacker can pass fake/non-existent IDs
- SealVault records IDs that don't correspond to real objects
- The "permanent lock" is ineffective - no actual DWalletCaps are locked
- Could pollute state with invalid records

**Proof of Concept:**
```move
// Attacker passes non-existent IDs:
registry.register_seal_with_vaa(
    dwallet_id = object::id_from_address(@0xdeadbeef),
    dwallet_cap_id = object::id_from_address(@0xcafebabe),
    // ... all fake
);
// Seal created, SealVault records fake IDs
// But no real DWalletCap was ever locked!
```

**Recommendation:**
The comments indicate DWalletCaps should be TRANSFERRED to the contract:
```move
// Add parameters for actual DWalletCap objects:
dwallet_cap: DWalletCap,
attestation_cap: DWalletCap,

// Then transfer them to vault:
// transfer::public_transfer(dwallet_cap, object::id_to_address(&object::id(vault)));
```

---

### [HIGH-1] AdminCap Not Verified in Admin Functions

**Severity:** High  
**Component:** registry.move:register_collection (line 178), deactivate_collection, register_trusted_emitter, remove_trusted_emitter, pause_protocol, unpause_protocol, update_treasuries, update_shares

**Description:**
All admin-gated functions accept `cap: &AdminCap` but DO NOT VERIFY the caller owns it:

```move
public fun register_collection(
    registry: &mut SealRegistry,
    cap: &AdminCap,  // ← Parameter accepted but never validated!
    collection_id: vector<u8>,
    // ...
) {
    let _ = cap; // Validates admin owns cap  ← THIS COMMENT IS WRONG
    // No actual verification!
```

The `_ = cap` line does NOTHING - it's just a variable assignment that gets optimized away. The function is actually PUBLICLY CALLABLE by anyone.

**Impact:**
**COMPLETE ADMIN BYPASS.** Anyone can:
- Register fake collections
- Deactivate legitimate collections
- Register malicious emitters to steal funds
- Pause/unpause protocol at will
- Change treasury addresses to steal fees
- Modify fee shares

**Proof of Concept:**
```move
// Anyone can call (no auth check):
registry.register_collection(
    registry,
    cap,  // Can be any AdminCap or even created fake one
    collection_id,
    chain,
    name,
    fee,
    max
);
```

**Recommendation:**
Add proper authorization check using the admin module:
```move
public fun register_collection(
    registry: &mut SealRegistry,
    cap: &AdminCap,
    // ...
) {
    admin::assert_admin(&cap);  // Verify caller owns AdminCap
    // Or: check registry.config.admin == tx_context::sender(ctx)
```

---

### [HIGH-2] Protocol Can Be Permanently Paused - No Unpause Guarantee

**Severity:** High  
**Component:** registry.move:pause_protocol (lines 236-241), admin.move:pause_protocol (lines 54-56)

**Description:**
The admin can pause the protocol with no time limit or automatic unpause:

```move
public fun pause_protocol(registry: &mut SealRegistry, cap: &AdminCap, ctx: &mut TxContext) {
    admin::pause_protocol(&mut registry.config, cap);
    emit(ProtocolPauseChanged { paused: true, timestamp: tx_context::epoch(ctx) });
}

// No timelock, no auto-unpause, no maximum pause duration
```

**Impact:**
- Admin can permanently freeze all sealing operations
- If admin loses AdminCap or becomes unavailable, protocol is bricked forever
- No recourse for users with active seals

**Recommendation:**
Add one of:
1. **Timelock:** Pause takes effect after N blocks/seconds
2. **Maximum duration:** Auto-unpause after N epochs
3. **Multisig:** Require multiple signatures to pause
4. **Emergency:** Allow users to force-unpause after inactivity period

---

### [HIGH-3] Trusted Emitter Overwrite Enables Fund Theft

**Severity:** High  
**Component:** emitters.move:register_emitter (lines 40-51)

**Description:**
The `register_emitter` function allows OVERWRITING existing emitters:

```move
public fun register_emitter(
    registry: &mut EmitterRegistry,
    chain_id: u16,
    emitter_address: vector<u8>,
) {
    // Removes old emitter if exists, then adds new one
    if (table::contains(&registry.trusted_emitters, chain_id)) {
        table::remove(&mut registry.trusted_emitters, chain_id);
    };
    table::add(&mut registry.trusted_emitters, chain_id, emitter_address);
}
```

**Impact:**
**FUND THEFT.** A compromised or malicious admin can:
1. Register their own emitter address for ETH chain
2. Users deposit NFTs expecting them to go to legitimate contract
3. Wormhole messages now point to attacker's contract
4. Attacker steals all deposited NFTs

**Proof of Concept:**
```move
// Malicious admin replaces ETH emitter:
registry.register_trusted_emitter(
    registry, cap,
    wh_chain_id = 2,  // ETH in Wormhole
    emitter_address = attacker's_contract
);

// User deposits NFT expecting to go to legitimate contract
// Wormhole message now goes to attacker
// Attacker extracts NFT from deposit
```

**Recommendation:**
1. Prevent emitter overwrite - require old emitter to be explicitly removed first
2. Emit event when emitter changes
3. Add timelock for emitter changes
4. Require multiple admin signatures

---

### [HIGH-4] Fee Shares Can Be Set to 100% - Steal All User Funds

**Severity:** High  
**Component:** admin.move:update_shares (lines 68-76)

**Description:**
The `update_shares` function allows setting shares that sum to 100%:

```move
public fun update_shares(
    config: &mut ProtocolConfig,
    _cap: &AdminCap,
    guild_share_bps: u16,
    team_share_bps: u16,
) {
    let total = (guild_share_bps as u32) + (team_share_bps as u32);
    assert!((total as u16) <= MAX_BPS, E_INVALID_SHARE);  // Allows exactly 100%
    config.guild_share_bps = guild_share_bps;
    config.team_share_bps = team_share_bps;
}
```

`MAX_BPS = 10000` (100%), so `guild_share_bps = 5000, team_share_bps = 5000` passes the check.

**Impact:**
- Admin can set shares to take 100% of all fees
- Users get 0% of anything
- Economic model completely broken
- But note: current implementation doesn't actually SPLIT fees to treasuries (no fee collection in seal functions)

**Recommendation:**
```move
// Add maximum cap on combined shares:
let total = (guild_share_bps as u32) + (team_share_bps as u32);
assert!((total as u16) <= MAX_BPS - 5000, E_INVALID_SHARE); // Leave at least 50% for users
```

---

### [MEDIUM-1] No Timelock on Admin Actions

**Severity:** Medium  
**Component:** admin.move - all admin functions

**Description:**
All admin actions (pause, treasury changes, emitter changes, share updates) take effect IMMEDIATELY with no timelock.

**Impact:**
- Admin can make malicious changes that users cannot react to
- No window to exit if admin goes rogue
- MEV: validators can see pending admin txns and front-run

**Recommendation:**
Add a timelock queue:
```move
public struct TimelockConfig has store {
    pending_treasury: Option<address>,
    pending_shares: Option<(u16, u16)>,
    execute_after: u64,
}
```

---

### [MEDIUM-2] Chain ID Mismatch Between Internal and Wormhole

**Severity:** Medium  
**Component:** registry.move (lines 89-93) vs emitters.move (lines 73-85)

**Description:**
Inconsistent chain ID systems:

```move
// registry.move - Internal IDs:
const CHAIN_ETHEREUM: u16 = 1;
const CHAIN_SUI: u16 = 2;
const CHAIN_SOLANA: u16 = 3;
const CHAIN_NEAR: u16 = 4;

// emitters.move - Wormhole IDs:
const CHAIN_ETHEREUM: u16 = 2;  // In Wormhole, ETH = 2
const CHAIN_SUI: u16 = 21;       // In Wormhole, SUI = 21
```

The code uses BOTH internally with conversion functions, but:
- `register_seal_with_vaa` takes `source_chain_id` as parameter (internal ID?)
- Emitter registry uses Wormhole IDs
- `parse_vaa_stub` returns Wormhole ID 21 regardless of input

**Impact:**
Confusion leads to bugs. If internal ID 1 is passed but emitter check expects Wormhole ID 2, verification fails silently or passes incorrectly.

**Recommendation:**
Unify on one ID system. Use Wormhole IDs throughout, with clear documentation.

---

### [MEDIUM-3] Collection Not Required for Sealing

**Severity:** Medium  
**Component:** registry.move:register_seal_with_vaa (lines 326-328)

**Description:**
Seals can be created for ANY `source_contract` without pre-registering a collection. The collection counter is optional:

```move
if (table::contains(&registry.collections, source_contract)) {
    table::borrow_mut(&mut registry.collections, source_contract).current_seals =
        table::borrow(&registry.collections, source_contract).current_seals + 1;
};  // Silently skips if collection not registered
```

**Impact:**
- No enforcement that collections are registered before use
- Users might try to seal NFTs from unregistered collections
- Inconsistent protocol usage

**Recommendation:**
Either:
1. Require collection registration before sealing (enforce)
2. Or auto-register collection on first seal

---

### [MEDIUM-4] No Validation of NFT Transfer in register_seal_native

**Severity:** Medium  
**Component:** registry.move:register_seal_native (lines 366-429)

**Description:**
The function calls `transfer::public_transfer(nft, dwallet_sui_address)` to lock the NFT:

```move
// Transfer the NFT permanently to the dWallet's Sui address.
transfer::public_transfer(nft, dwallet_sui_address);
```

While Sui requires the NFT to be in the transaction inputs, there's no explicit validation that:
- The caller actually owns the NFT being transferred
- The `dwallet_sui_address` is derived from the provided `dwallet_pubkey`
- The NFT matches the `source_contract` and `token_id` provided

**Impact:**
Potential for mismatched metadata - seal record claims one NFT but different NFT is transferred.

**Recommendation:**
Add explicit validation:
```move
// Verify NFT type matches source_contract
// Verify token_id matches NFT's internal ID
// Verify dwallet_sui_address matches pubkey
```

---

### [LOW-1] NFT Transfer Not Atomic With Seal Creation

**Severity:** Low  
**Component:** registry.move:register_seal_native (lines 391-393)

**Description:**
The NFT is transferred BEFORE the seal record is created:

```move
transfer::public_transfer(nft, dwallet_sui_address);

seal_vault::seal(vault, ...);  // Called after transfer

table::add(&mut registry.seals, seal_hash, ...);  // Record created last
```

If transaction fails after transfer but before seal record, NFT is lost.

**Impact:**
Small - Sui transactions are atomic, but order is fragile.

**Recommendation:**
Reorder to create seal record first, then transfer.

---

### [LOW-2] Emitter Registry Allows Empty Addresses

**Severity:** Low  
**Component:** emitters.move:register_emitter

**Description:**
No validation that emitter_address is non-empty:

```move
table::add(&mut registry.trusted_emitters, chain_id, emitter_address);
// No assert!(emitter_address.length() > 0, ...)
```

**Impact:**
Can register empty emitter, which would then pass `is_trusted_emitter` checks incorrectly.

---

### [LOW-3] Inconsistent Use of Underscore for Unused Parameters

**Severity:** Low  
**Component:** Multiple files

**Description:**
Sometimes unused parameters are marked with underscore, sometimes not:
- `let _ = cap` in register_collection (does nothing)
- `_cap: &AdminCap` in deactivate_collection (proper)
- `_seal_hash: vector<u8>` in seal() (proper)

**Impact:**
Code confusion; `let _ = cap` doesn't validate ownership despite comment.

---

### [INFO-1] SealVault Has No Emergency Recovery

**Severity:** Info  
**Component:** seal_vault.move

**Description:**
If DWalletCaps are accidentally sealed, there's no recovery function. This is by design (permanent lock), but could be problematic if bugs cause accidental sealing.

**Recommendation:**
Consider a time-delayed recovery mechanism for edge cases.

---

### [INFO-2] Protocol Version Not Enforced on Upgrades

**Severity:** Info  
**Component:** admin.move:ProtocolConfig

**Description:**
`ProtocolConfig.version` exists but is never checked during upgrades. If contract is upgraded, old seals might be incompatible.

---

### [INFO-3] No Event Indexing Support

**Severity:** Info  
**Component:** registry.move events

**Description:**
Events lack indexed fields for efficient querying. For production, consider adding `#[derive(index)]` equivalent if Sui supports it.

---

## Additional Security Considerations

### Positive Security Features

1. **SealVault immutability**: No unseal function - permanent lock is enforced
2. **SHA2-256 seal hash**: Collision-resistant (assuming no quantum attacks)
3. **VAA replay protection**: SHA2-256 hash of full VAA prevents replay
4. **Init is private**: Cannot be re-initialized
5. **Shared object patterns**: Correct use of `share_object` and `public_share_object`

### Deployment Recommendations

1. **DO NOT DEPLOY WITH STUB**: Replace `parse_vaa_stub` with real Wormhole integration
2. **Multi-sig admin**: Consider using a multisig for AdminCap
3. **Timelock**: Add delay between admin changes and execution
4. **Monitoring**: Emit events for all state changes, monitor off-chain
5. **Upgradability**: Consider if upgrade pattern is needed (currently immutable)

---

## Conclusion

The Ika Tensei v3 contracts have **critical vulnerabilities that must be fixed before mainnet deployment**:

1. **CRITICAL**: VAA verification is completely stubbed out - any data can be forged
2. **CRITICAL**: mark_reborn is vulnerable to front-running theft
3. **CRITICAL**: Admin authorization is missing on all admin functions
4. **CRITICAL**: Collection limits are not enforced
5. **CRITICAL**: DWalletCap IDs are not validated

The contract comments indicate awareness of the stub issue and document the required Wormhole integration. However, the AdminCap bypass and mark_reborn front-running are serious design flaws that require architectural changes.

**Recommended Action: DO NOT DEPLOY to mainnet until CRITICAL-1, CRITICAL-2, CRITICAL-3, and HIGH-1 are resolved.**
