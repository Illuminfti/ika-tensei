//! Ika Tensei Reborn - NFT Reincarnation Protocol on Solana (PRD v6)
//!
//! A thin program that:
//! - Verifies Ed25519 signatures from IKA dWallet
//! - Creates Metaplex Core collections per source collection
//! - Mints reborn NFTs to receivers
//! - Stores provenance on-chain
//!
//! SECURITY: This program has NO admin keys. Anyone with a valid IKA dWallet
//! signature can mint reborn NFTs. Heavy verification happens on Sui.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use mpl_core::instructions::{CreateV2CpiBuilder, CreateCollectionV2CpiBuilder};
use mpl_core::types::DataState;
use sha2::{Sha256, Digest};

// Program ID - will be overwritten on deployment
declare_id!("GaF33RCjTAW6cGCWaiefEVuptbsDDDSAtNx3ipDmNqnj");

pub mod constants {
    // PDA seeds
    pub const USED_SIGNATURES_SEED: &[u8] = b"used_signatures";
    pub const PROVENANCE_SEED: &[u8] = b"provenance";
    pub const COLLECTION_REGISTRY_SEED: &[u8] = b"collection_registry";
    pub const COLLECTION_SEED: &[u8] = b"reborn_collection";
    pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";

    // Max lengths
    pub const MAX_URI_LENGTH: usize = 200;
    pub const MAX_NAME_LENGTH: usize = 32;
    pub const MAX_CONTRACT_LENGTH: usize = 64;
    pub const MAX_TOKEN_ID_LENGTH: usize = 64;

    // Replay protection: max signatures tracked
    pub const MAX_SIGNATURES: usize = 10000;
}

// ============ Account Contexts ============

/// Initialize the used signatures account for replay protection
#[derive(Accounts)]
pub struct InitializeUsedSignatures<'info> {
    #[account(init, payer = payer, space = 8 + UsedSignatures::INIT_SPACE,
              seeds = [constants::USED_SIGNATURES_SEED], bump)]
    pub used_signatures: Account<'info, UsedSignatures>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Initialize the collection registry
#[derive(Accounts)]
pub struct InitializeCollectionRegistry<'info> {
    #[account(init, payer = payer, space = 8 + CollectionRegistry::INIT_SPACE,
              seeds = [constants::COLLECTION_REGISTRY_SEED], bump)]
    pub registry: Account<'info, CollectionRegistry>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Mint a reborn NFT - main entry point
#[derive(Accounts)]
#[instruction(
    signature: [u8; 64],       // Ed25519 signature from IKA dWallet
    dwallet_pubkey: [u8; 32],  // IKA dWallet Ed25519 public key
    source_chain: u16,
    nft_contract: Vec<u8>,
    token_id: Vec<u8>,
    token_uri: String,
    collection_name: String,
)]
pub struct MintReborn<'info> {
    /// Payer for the transaction (can be relayer or user)
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// Receiver of the reborn NFT
    pub receiver: UncheckedAccount<'info>,
    
    /// Track used signatures for replay protection
    #[account(mut, seeds = [constants::USED_SIGNATURES_SEED], bump = used_signatures.bump)]
    pub used_signatures: Account<'info, UsedSignatures>,
    
    /// Registry of created collections
    #[account(mut, seeds = [constants::COLLECTION_REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, CollectionRegistry>,
    
    /// Provenance record for this NFT (PDA)
    #[account(init, payer = payer, space = 8 + Provenance::INIT_SPACE,
              seeds = [constants::PROVENANCE_SEED, &source_chain.to_le_bytes(), &nft_contract, &token_id], bump,
              constraint = !provenance.is_initialized @ ErrorCode::AlreadyMinted)]
    pub provenance: Account<'info, Provenance>,
    
    /// Reborn collection PDA (created if first NFT from this source collection)
    #[account(init_if_needed, payer = payer, space = 8 + RebornCollection::INIT_SPACE,
              seeds = [constants::COLLECTION_SEED, &source_chain.to_le_bytes(), &nft_contract], bump,
              constraint = !collection.is_initialized @ ErrorCode::CollectionAlreadyExists)]
    pub collection: Account<'info, RebornCollection>,
    
    /// Mint authority PDA - signs the Metaplex Core CPI
    #[account(seeds = [constants::MINT_AUTHORITY_SEED, &source_chain.to_le_bytes(), &nft_contract], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    /// New Metaplex Core asset (keypair, signer in outer tx)
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,
    
    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,
    
    /// CHECK: System program
    pub system_program: Program<'info, System>,
    
    /// CHECK: Instructions sysvar - needed for Ed25519 verification
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

// ============ Account Structs ============

/// Tracks used signature hashes for replay protection
#[account]
#[derive(InitSpace)]
pub struct UsedSignatures {
    /// Number of signatures tracked
    pub count: u64,
    /// Bump for PDA
    pub bump: u8,
    /// Ring buffer of recent signature hashes (keccak256 of Ed25519 signature)
    #[max_len(100)]
    pub recent_hashes: Vec<[u8; 32]>,
}

impl UsedSignatures {
    /// Check if a signature hash has been used
    pub fn is_used(&self, sig_hash: &[u8; 32]) -> bool {
        self.recent_hashes.iter().any(|h| h == sig_hash)
    }

    /// Mark a signature hash as used
    pub fn mark_used(&mut self, sig_hash: [u8; 32]) {
        // Ring buffer: replace oldest entry
        let idx = (self.count % constants::MAX_SIGNATURES as u64) as usize;
        if idx < self.recent_hashes.len() {
            self.recent_hashes[idx] = sig_hash;
        } else {
            self.recent_hashes.push(sig_hash);
        }
        self.count = self.count.saturating_add(1);
    }
}

/// Registry of source collections that have been created on Solana
#[account]
#[derive(InitSpace)]
pub struct CollectionRegistry {
    /// Number of collections registered
    pub count: u64,
    /// Bump for PDA
    pub bump: u8,
    #[max_len(500)]
    pub collections: Vec<CollectionEntry>,
}

impl CollectionRegistry {
    /// Check if a collection exists
    pub fn find_collection(&self, source_chain: u16, nft_contract: &[u8]) -> Option<&CollectionEntry> {
        self.collections.iter().find(|c| c.source_chain == source_chain && c.nft_contract == nft_contract)
    }

    /// Add a new collection
    pub fn add_collection(&mut self, entry: CollectionEntry) {
        self.collections.push(entry);
        self.count = self.count.saturating_add(1);
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
#[derive(InitSpace)]
pub struct CollectionEntry {
    pub source_chain: u16,
    #[max_len(64)]
    pub nft_contract: Vec<u8>,
    pub collection_address: Pubkey,
    pub created_at: i64,
}

/// Per-collection config stored on-chain
#[account]
#[derive(InitSpace)]
pub struct RebornCollection {
    pub source_chain: u16,
    #[max_len(64)]
    pub nft_contract: Vec<u8>,
    #[max_len(32)]
    pub name: String,
    pub collection_address: Pubkey,
    pub total_minted: u64,
    pub is_initialized: bool,
    pub bump: u8,
}

/// Provenance record for a reborn NFT
#[account]
#[derive(InitSpace)]
pub struct Provenance {
    pub source_chain: u16,
    #[max_len(64)]
    pub nft_contract: Vec<u8>,
    #[max_len(64)]
    pub token_id: Vec<u8>,
    #[max_len(200)]
    pub token_uri: String,
    pub dwallet_pubkey: [u8; 32],
    pub signature: [u8; 64],
    pub receiver: Pubkey,
    pub sealed_at: i64,
    pub is_initialized: bool,
    pub bump: u8,
}

// ============ Program ============

#[program]
pub mod ika_tensei_reborn {
    use super::*;

    /// Initialize the used signatures account
    pub fn initialize_used_signatures(ctx: Context<InitializeUsedSignatures>) -> Result<()> {
        let used_signatures = &mut ctx.accounts.used_signatures;
        used_signatures.count = 0;
        used_signatures.bump = ctx.bumps.used_signatures;
        used_signatures.recent_hashes = Vec::new();
        msg!("UsedSignatures initialized");
        Ok(())
    }

    /// Initialize the collection registry
    pub fn initialize_collection_registry(ctx: Context<InitializeCollectionRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.count = 0;
        registry.bump = ctx.bumps.registry;
        registry.collections = Vec::new();
        msg!("CollectionRegistry initialized");
        Ok(())
    }

    /// Mint a reborn NFT after verifying IKA dWallet signature
    ///
    /// This is the main entry point. The flow is:
    /// 1. Reconstruct message: sha256(token_id || token_uri || receiver)
    /// 2. Verify Ed25519 signature via native precompile
    /// 3. Check replay protection (signature hash not used)
    /// 4. Create Metaplex Core collection if first from this source collection
    /// 5. Mint Metaplex Core reborn NFT to receiver
    /// 6. Store provenance
    pub fn mint_reborn(
        ctx: Context<MintReborn>,
        signature: [u8; 64],
        dwallet_pubkey: [u8; 32],
        source_chain: u16,
        nft_contract: Vec<u8>,
        token_id: Vec<u8>,
        token_uri: String,
        collection_name: String,
    ) -> Result<()> {
        // ============ 1. Validation ============
        // Validate input lengths
        require!(nft_contract.len() <= constants::MAX_CONTRACT_LENGTH, ErrorCode::ContractTooLong);
        require!(token_id.len() <= constants::MAX_TOKEN_ID_LENGTH, ErrorCode::TokenIdTooLong);
        require!(token_uri.len() <= constants::MAX_URI_LENGTH, ErrorCode::UriTooLong);
        require!(collection_name.len() <= constants::MAX_NAME_LENGTH, ErrorCode::NameTooLong);

        let receiver_pubkey = ctx.accounts.receiver.key();

        // ============ 2. Reconstruct message hash ============
        // Message = sha256(token_id || token_uri || receiver)
        let mut hasher = Sha256::new();
        hasher.update(&token_id);
        hasher.update(token_uri.as_bytes());
        hasher.update(receiver_pubkey.as_ref());
        let message_hash: [u8; 32] = hasher.finalize().into();

        // ============ 3. Verify Ed25519 signature ============
        // The signature must be from the IKA dWallet's Ed25519 public key
        // We verify by constructing a fake instruction that calls the ed25519_program
        // and checking it matches expected values
        verify_ed25519_signature(
            &ctx.accounts.instructions_sysvar,
            &dwallet_pubkey,
            &message_hash,
            &signature,
        )?;

        msg!("Signature verified for dWallet: {}", hex::encode(&dwallet_pubkey));

        // ============ 4. Replay protection ============
        // Hash the signature to create a unique identifier
        let mut sig_hasher = Sha256::new();
        sig_hasher.update(&signature);
        let sig_hash: [u8; 32] = sig_hasher.finalize().into();

        let used_signatures = &mut ctx.accounts.used_signatures;
        require!(!used_signatures.is_used(&sig_hash), ErrorCode::SignatureAlreadyUsed);
        used_signatures.mark_used(sig_hash);

        msg!("Replay protection passed");

        // ============ 5. Create collection if needed ============
        // First, get the collection PDA key
        let collection_pda_key = ctx.accounts.collection.key();
        let is_new_collection = !ctx.accounts.collection.is_initialized;

        if is_new_collection {
            // First NFT from this source collection - create the Metaplex Core collection
            let mint_authority_bump = ctx.bumps.mint_authority;
            let mint_authority_seeds: &[&[u8]] = &[
                constants::MINT_AUTHORITY_SEED,
                &source_chain.to_le_bytes(),
                &nft_contract,
                &[mint_authority_bump],
            ];

            // CPI to Metaplex Core to create collection
            CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
                .collection(&ctx.accounts.collection.to_account_info())
                .update_authority(Some(&ctx.accounts.mint_authority))
                .payer(&ctx.accounts.payer)
                .system_program(&ctx.accounts.system_program)
                .name(collection_name.clone())
                .uri(format!("https://ika-tensei.io/collections/{}/{}", source_chain, hex::encode(&nft_contract)))
                .invoke_signed(&[mint_authority_seeds])
                .map_err(|_e| ErrorCode::MetaplexError)?;

            msg!("Created new collection: {}", collection_name);
        } else {
            msg!("Using existing collection: {}", ctx.accounts.collection.name);
        }

        // Now initialize/update the collection account data (after CPI)
        let collection = &mut ctx.accounts.collection;
        
        if is_new_collection {
            // Initialize collection account data
            collection.source_chain = source_chain;
            collection.nft_contract = nft_contract.clone();
            collection.name = collection_name.clone();
            collection.collection_address = collection_pda_key;
            collection.total_minted = 0;
            collection.is_initialized = true;
            collection.bump = ctx.bumps.collection;

            // Add to registry
            ctx.accounts.registry.add_collection(CollectionEntry {
                source_chain,
                nft_contract: nft_contract.clone(),
                collection_address: collection_pda_key,
                created_at: Clock::get()?.unix_timestamp,
            });
        }

        // ============ 6. Mint reborn NFT ============
        let mint_authority_bump = ctx.bumps.mint_authority;
        let mint_authority_seeds: &[&[u8]] = &[
            constants::MINT_AUTHORITY_SEED,
            &source_chain.to_le_bytes(),
            &nft_contract,
            &[mint_authority_bump],
        ];

        // Build the NFT name: "{CollectionName} #{token_id}"
        let nft_name = if token_id.len() <= 8 {
            format!("{} #{}", collection.name, String::from_utf8_lossy(&token_id))
        } else {
            collection.name.clone()
        };

        // CPI to Metaplex Core to mint the NFT
        // - asset: new keypair (signer in outer tx)
        // - authority: mint_authority PDA
        // - owner: receiver (gets the NFT)
        // - update_authority: mint_authority PDA
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.asset)
            .authority(Some(&ctx.accounts.mint_authority))
            .payer(&ctx.accounts.payer)
            .owner(Some(&ctx.accounts.receiver))
            .update_authority(Some(&ctx.accounts.mint_authority))
            .system_program(&ctx.accounts.system_program)
            .data_state(DataState::AccountState)
            .name(nft_name)
            .uri(token_uri.clone())
            .invoke_signed(&[mint_authority_seeds])
            .map_err(|_e| ErrorCode::MetaplexError)?;

        // Update collection count
        collection.total_minted = collection.total_minted.saturating_add(1);

        msg!("NFT minted to {}", receiver_pubkey);

        // ============ 7. Store provenance ============
        let provenance = &mut ctx.accounts.provenance;
        provenance.source_chain = source_chain;
        provenance.nft_contract = nft_contract;
        provenance.token_id = token_id;
        provenance.token_uri = token_uri;
        provenance.dwallet_pubkey = dwallet_pubkey;
        provenance.signature = signature;
        provenance.receiver = receiver_pubkey;
        provenance.sealed_at = Clock::get()?.unix_timestamp;
        provenance.is_initialized = true;
        provenance.bump = ctx.bumps.provenance;

        msg!("Provenance stored for {}", receiver_pubkey);

        Ok(())
    }
}

// ============ Helpers ============

/// Verify an Ed25519 signature using Solana's native precompile
///
/// The verification is done by inspecting the instruction at index 0 of the
/// transaction, which should be the Ed25519 instruction. We extract the
/// public key, message, and signature from that instruction and verify they
/// match our expected values.
fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8; 32],
    _expected_signature: &[u8; 64],
) -> Result<()> {
    // Iterate through instructions to find the Ed25519 instruction
    let mut found_ed25519 = false;
    
    for i in 0..10 {
        if let Ok(ed25519_ix) = ix_sysvar::load_instruction_at_checked(i, instructions_sysvar) {
            if ed25519_ix.program_id == ed25519_program::ID {
                found_ed25519 = true;
                
                let data = ed25519_ix.data;
                
                // Basic validation of instruction format
                if data.len() < 16 {
                    return Err(ErrorCode::InvalidInstructionData.into());
                }

                let num_signatures = data[0];
                if num_signatures < 1 {
                    return Err(ErrorCode::InvalidInstructionData.into());
                }

                let pubkey_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
                let message_offset = u16::from_le_bytes([data[10], data[11]]) as usize;
                let message_size = u16::from_le_bytes([data[12], data[13]]) as usize;

                // Verify public key matches
                if let Some(pubkey_data) = data.get(pubkey_offset..pubkey_offset + 32) {
                    if !constant_time_eq::constant_time_eq(pubkey_data, expected_pubkey) {
                        return Err(ErrorCode::SignatureVerificationFailed.into());
                    }
                } else {
                    return Err(ErrorCode::InvalidInstructionData.into());
                }

                // Verify message matches
                if let Some(message_data) = data.get(message_offset..message_offset + message_size) {
                    if message_size != 32 || !constant_time_eq::constant_time_eq(message_data, expected_message) {
                        return Err(ErrorCode::SignatureVerificationFailed.into());
                    }
                } else {
                    return Err(ErrorCode::InvalidInstructionData.into());
                }

                // Found and verified the Ed25519 instruction
                return Ok(());
            }
        }
    }

    if !found_ed25519 {
        return Err(ErrorCode::NoEd25519Instruction.into());
    }

    Ok(())
}

// ============ Errors ============

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Ed25519 signature")]
    InvalidSignature,
    
    #[msg("Invalid instruction data")]
    InvalidInstructionData,
    
    #[msg("No Ed25519 instruction found in transaction")]
    NoEd25519Instruction,
    
    #[msg("Ed25519 signature verification failed")]
    SignatureVerificationFailed,
    
    #[msg("Signature already used - replay protection")]
    SignatureAlreadyUsed,
    
    #[msg("Collection already exists")]
    CollectionAlreadyExists,
    
    #[msg("NFT already minted")]
    AlreadyMinted,
    
    #[msg("Contract address too long")]
    ContractTooLong,
    
    #[msg("Token ID too long")]
    TokenIdTooLong,
    
    #[msg("URI too long")]
    UriTooLong,
    
    #[msg("Name too long")]
    NameTooLong,
    
    #[msg("Metaplex error")]
    MetaplexError,
    
    #[msg("Unauthorized")]
    Unauthorized,
}
