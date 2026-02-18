# Solana Anchor Program Re-Audit - Ika Tensei v3

**Date:** 2026-02-18  
**Program:** `/home/ubuntu/clawd/ika-tensei/packages/solana-program/ika_tensei/programs/ika_tensei/src/lib.rs`  
**Version:** v3 (post-security-fixes)

---

## Executive Summary

| Finding ID | Description | Status |
|------------|-------------|--------|
| C8 | Ed25519 instruction index verification | **FIXED** |
| H6 | Upgrade authority documented | **FIXED** |
| H8 | Metaplex Core program ID constraint | **FIXED** |
| M8 | Fee enforcement via CPI transfer | **FIXED** |

---

## Previous Findings - Verification

### C8: Ed25519 Instruction Index Verification

**Previous Issue:** Ed25519 signature verification may not properly validate instruction index.

**Current Implementation:**
```rust
// Line 304
let ed25519_ix = ix_sysvar::load_instruction_at_checked(0, instructions_sysvar)
    .map_err(|_| ErrorCode::InvalidEd25519Instruction)?;

require!(
    ed25519_ix.program_id == anchor_lang::solana_program::ed25519_program::ID,
    ErrorCode::InvalidEd25519Instruction
);
```

**Analysis:**
- Uses `load_instruction_at_checked(0, ...)` - explicitly loads index 0
- Verifies `program_id` is the Ed25519 program
- Additional signature data validation (pubkey offset, message offset, sizes)

**Status:** ✅ **FIXED**

---

### H6: Upgrade Authority Documented

**Previous Issue:** Upgrade authority security requirement not documented.

**Current Implementation:**
```rust
//! Ika Tensei v3 - NFT Reincarnation Protocol on Solana
//!
//! SECURITY: After final audit, the upgrade authority for this program should be
//! set to a multisig or revoked entirely. The current deployer keypair MUST NOT
//! remain as sole upgrade authority in production.
```

**Analysis:**
- SECURITY comment added at file header
- Documents that upgrade authority should be multisig or revoked
- Warns against leaving deployer as sole authority

**Status:** ✅ **FIXED**

---

### H8: Metaplex Core Program ID Constraint

**Previous Issue:** Metaplex Core program ID not validated.

**Current Implementation:**
```rust
// MintReborn (line 68)
#[account(address = mpl_core::ID)]
pub mpl_core_program: AccountInfo<'info>,

// CreateOnchainCollection (line 91)
#[account(address = mpl_core::ID)]
pub mpl_core_program: AccountInfo<'info>,
```

**Analysis:**
- Both CPI instructions use `#[account(address = mpl_core::ID)]` constraint
- Anchor will reject transactions with incorrect Metaplex Core program ID

**Status:** ✅ **FIXED**

---

### M8: Fee Enforcement via CPI Transfer

**Previous Issue:** Mint fee not properly enforced.

**Current Implementation:**
```rust
// Lines 218-240
let mint_fee = config.mint_fee;

// Verify fee_recipient is not zero address
let fee_recipient_key = ctx.accounts.fee_recipient.key();
require!(fee_recipient_key != Pubkey::default(), ErrorCode::InvalidFeeRecipient);

// Transfer fee from payer to fee_recipient
if mint_fee > 0 {
    let fee_transfer = anchor_lang::system_program::Transfer {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.fee_recipient.to_account_info(),
    };
    anchor_lang::system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(), fee_transfer),
        mint_fee,
    )?;
    msg!("Fee paid: {} lamports to {}", mint_fee, fee_recipient_key);
}
```

**Analysis:**
- Fee transferred BEFORE minting NFT
- Uses direct system_program::transfer (not CPI to another program)
- Validates fee_recipient is not zero address
- Fee amount from config, ensuring consistency

**Status:** ✅ **FIXED**

---

## New Findings

### NEW-1: Fee Recipient Not Constrained to Trusted Address

**Severity:** Medium

**Location:** `MintReborn` struct (line 64)

**Issue:**
```rust
/// CHECK: Fee recipient (treasury)
pub fee_recipient: UncheckedAccount<'info>,
```

The `fee_recipient` account is not constrained to a trusted address. While the code checks that it's not the zero address, a malicious caller could set `fee_recipient` to any arbitrary address, causing the mint fee to be paid to an attacker-controlled account instead of the protocol's treasury.

**Recommendation:**
Add an address constraint to bind `fee_recipient` to a trusted treasury:
```rust
#[account(address = config.team_treasury)]  // or config.guild_treasury
pub fee_recipient: UncheckedAccount<'info>,
```

Or if multiple recipients are intended, validate against an allowed list in the instruction logic.

---

## Summary

| Category | Count |
|----------|-------|
| Fixed | 4 |
| New Issues | 1 (Medium) |

**Overall Assessment:** The previous security findings have been properly addressed. One new medium-severity issue was identified regarding fee recipient validation.
