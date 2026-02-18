# Master Audit Findings - Deduplicated & Prioritized

## CRITICAL (Must Fix)

### C1: VAA Stub - No Real Wormhole Verification
- **Files:** registry.move:parse_vaa_stub(), register_seal_with_vaa()
- **Issue:** parse_vaa_stub returns hardcoded values. No actual VAA verification.
- **Fix:** Integrate real Wormhole SDK OR add relayer-signed attestation with Ed25519 verification
- **Owner:** sui-contracts team

### C2: SealVault Doesn't Actually Lock DWalletCap Objects
- **Files:** seal_vault.move:seal()
- **Issue:** Only records IDs in a table, doesn't receive actual DWalletCap objects via transfer
- **Fix:** seal() must take DWalletCap objects by value and store/freeze them
- **Owner:** sui-contracts team

### C3: mark_reborn() Fully Permissionless - Fake Solana Addresses
- **Files:** registry.move:mark_reborn()
- **Issue:** Anyone can call with any solana_mint_address. No proof the mint actually happened.
- **Fix:** Require Ed25519 signature from relayer/dWallet proving the Solana mint, OR restrict to authorized relayer
- **Owner:** sui-contracts team

### C4: VAA Parameters User-Controlled, Not Extracted From VAA Payload
- **Files:** registry.move:register_seal_with_vaa()
- **Issue:** source_chain_id, source_contract, token_id passed as params, not parsed from VAA payload
- **Fix:** When real VAA is integrated, extract ALL fields from verified VAA payload
- **Owner:** sui-contracts team

### C5: DWalletCap IDs Not Validated On-Chain
- **Files:** registry.move, seal_vault.move
- **Issue:** dwallet_cap_id and dwallet_id are passed as ID type but never verified to exist
- **Fix:** Take actual DWalletCap objects by value (fixes C2 simultaneously)
- **Owner:** sui-contracts team

### C6: Hardcoded Default Keys in Relayer Config
- **Files:** relayer/src/config.ts
- **Issue:** Default dWallet IDs and pubkeys hardcoded as fallbacks
- **Fix:** Remove all defaults, require explicit env vars, fail on missing
- **Owner:** relayer team

### C7: No Idempotency on Solana Minting
- **Files:** relayer/src/services/solana-minter.ts
- **Issue:** If verify succeeds but mint fails, retry could double-verify or create inconsistent state
- **Fix:** Check PDA existence before each step, make operations idempotent
- **Owner:** relayer team

### C8: Ed25519 Instruction Order Assumption (Solana)
- **Files:** lib.rs verify_seal
- **Issue:** Ed25519 precompile instruction assumed at index 0. Attacker could insert instructions.
- **Fix:** Verify instruction index explicitly from Sysvar Instructions
- **Owner:** solana team

### C9: Admin Rug Pull (ETH)
- **Files:** IkaTenseiDeposit.sol
- **Issue:** Owner has unlimited power: pause, change fees, change recipient, no timelock
- **Fix:** Add timelock, max fee cap, emergency exit for users when paused
- **Owner:** eth team

### C10: max_seals Not Enforced
- **Files:** registry.move register_seal_with_vaa/register_seal_native
- **Issue:** collection max_seals checked in config but never enforced (current_seals vs max_seals)
- **Fix:** Add assert!(current_seals < max_seals) before incrementing
- **Owner:** sui-contracts team

## HIGH (Should Fix)

### H1: No Fee Verification on Sui Registration
- **Fix:** Add SUI coin parameter to seal functions, verify fee amount
- **Owner:** sui-contracts team

### H2: Unauthenticated Health Endpoint
- **Fix:** Add bearer token auth, remove sensitive data from response
- **Owner:** relayer team

### H3: Race Condition in Queue Processing
- **Fix:** Add mutex/lock per seal_hash in queue
- **Owner:** relayer team

### H4: Seal Hash Endianness Mismatch Risk
- **Fix:** Add unit test that computes same hash in Move and TS, verify byte-by-byte
- **Owner:** shared team

### H5: No Emergency Exit When ETH Contract Paused
- **Fix:** Add withdrawNFT() that works even when paused, with timelock
- **Owner:** eth team

### H6: Solana Program Upgrade Authority
- **Fix:** Document upgrade authority, plan to revoke after audit
- **Owner:** solana team

### H7: AdminCap Not Properly Verified in Some Functions
- **Fix:** Use &AdminCap consistently (not just let _ = cap)
- **Owner:** sui-contracts team

### H8: Unverified Metaplex Core Program in CPI
- **Fix:** Hardcode and verify Metaplex Core program ID in account validation
- **Owner:** solana team

### H9: Orphaned Seals - No Recovery Mechanism
- **Fix:** Add admin function to cancel seal after timeout (e.g., 7 days) OR let sealer cancel
- **Owner:** sui-contracts team

## MEDIUM (Nice to Fix)

### M1: No Timelock on Admin Actions (Sui + ETH)
### M2: Collection Not Required for Sealing (spam vector)
### M3: Chain ID Mapping Confusion (internal vs Wormhole)
### M4: Logging Sensitive Data in Relayer
### M5: No Graceful Shutdown for In-Flight Operations
### M6: Missing Input Validation in Sui Listener
### M7: No Payload Size Limits (memory safety)
### M8: Fee Calculation Not Enforced on Solana
### M9: Metadata Manipulation (attacker can seal with fake metadata)
