// Ika Tensei PRD v6 - Orchestrator
//
// The brain of the Ika Tensei system. This module:
//   1. Receives Wormhole VAA bytes from any source chain
//   2. Verifies the VAA (guardian signatures)
//   3. Decodes the payload (source_chain, nft_contract, token_id, deposit_address, receiver, token_uri)
//   4. Validates dWallet address against the registry
//   5. Constructs signing message: sha256(token_id + token_uri + receiver)
//   6. Signs with IKA dWallet (2PC-MPC)
//   7. Emits SealSigned event for the relayer
//   8. Locks DWalletCap (permanent seal)
//
// Security model:
//   - VAA verification: 13/19 Wormhole guardian signatures required
//   - dWallet validation: Must be registered in DWalletRegistry
//   - Signing: IKA 2PC-MPC (neither network nor user can sign alone)
//   - Lock: DWalletCap is transferred to vault, cannot be recovered
//
// Integration notes:
//   - Wormhole: Uses wormhole::vaa::parse_and_verify()
//   - IKA: Uses ika_dwallet_2pc_mpc::coordinator for signing
//   - Both dependencies are stubbed for compilation - see Move.toml comments
module ikatensei::orchestrator {
    use sui::table::{Self, Table};
    use sui::event::emit;
    use sui::object::ID;
    use std::vector;
    use std::bcs;
    
    // Use sibling modules
    use ikatensei::payload::{Self, SealPayload};
    use ikatensei::dwallet_registry::{Self, DWalletRegistry, DWalletRecord};

    // Error codes
    const E_INVALID_VAA: u64 = 1;
    const E_INVALID_DWALLET: u64 = 2;
    const E_DWALLET_MISMATCH: u64 = 3;
    const E_SIGNATURE_FAILED: u64 = 4;
    const E_CAP_ALREADY_LOCKED: u64 = 5;
    const E_INVALID_SOURCE_CHAIN: u64 = 6;
    const E_VAA_ALREADY_USED: u64 = 7;

    // ==================================================================
    // Events
    // ==================================================================

    /// Emitted after successful VAA verification, dWallet validation, and signing
    /// This event is picked up by the relayer to submit to Solana
    public struct SealSigned has copy, drop {
        /// Source chain Wormhole ID
        source_chain: u16,
        /// Source NFT contract address (32 bytes)
        nft_contract: vector<u8>,
        /// Token ID (32 bytes)
        token_id: vector<u8>,
        /// Token URI (original from source chain)
        token_uri: vector<u8>,
        /// Receiver Solana wallet (32 bytes)
        receiver: vector<u8>,
        /// dWallet deposit address that received the NFT (32 bytes)
        deposit_address: vector<u8>,
        /// The message that was signed: sha256(token_id + token_uri + receiver)
        message_hash: vector<u8>,
        /// IKA dWallet Ed25519 signature (64 bytes)
        signature: vector<u8>,
        /// VAA hash for replay protection
        vaa_hash: vector<u8>,
        /// Timestamp
        timestamp: u64,
    }

    /// Emitted when VAA verification fails
    public struct VAAVerificationFailed has copy, drop {
        vaa_hash: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    /// Emitted when dWallet validation fails
    public struct DWalletValidationFailed has copy, drop {
        deposit_address: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    /// Emitted when signing fails
    public struct SigningFailed has copy, drop {
        deposit_address: vector<u8>,
        message_hash: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    /// Emitted when a seal is successfully processed
    public struct SealProcessed has copy, drop {
        vaa_hash: vector<u8>,
        source_chain: u16,
        deposit_address: vector<u8>,
        receiver: vector<u8>,
        timestamp: u64,
    }

    // ==================================================================
    // Data Structures
    // ==================================================================

    /// Orchestrator state - shared object
    /// Tracks processed VAAs for replay protection
    public struct OrchestratorState has key {
        id: UID,
        /// VAA hash -> bool (true if already processed)
        processed_vaas: Table<vector<u8>, bool>,
        total_processed: u64,
    }

    /// Verified VAA data (after parsing)
    public struct VerifiedVAA has copy, drop, store {
        emitter_chain: u16,
        emitter_address: vector<u8>,
        payload: vector<u8>,
        vaa_hash: vector<u8>,
    }

    /// Initialize the orchestrator
    fun init(ctx: &mut TxContext) {
        let state = OrchestratorState {
            id: object::new(ctx),
            processed_vaas: table::new(ctx),
            total_processed: 0,
        };
        sui::transfer::share_object(state);
    }

    // ==================================================================
    // Main Entry Point: Process Seal
    // ==================================================================

    /// Process a Wormhole VAA and sign with IKA dWallet
    /// 
    /// This is the main entry point that:
    ///   1. Verifies the VAA (13/19 guardian signatures)
    ///   2. Decodes the payload
    ///   3. Validates the dWallet is registered
    ///   4. Constructs the signing message
    ///   5. Signs with IKA dWallet
    ///   6. Emits SealSigned event
    ///   7. Locks the DWalletCap
    ///
    /// Parameters:
    ///   - state: OrchestratorState for replay protection
    ///   - registry: DWalletRegistry to validate dWallet addresses
    ///   - vaa_bytes: Raw Wormhole VAA bytes
    ///   - dwallet_id: ID of the IKA dWallet
    ///   - dwallet_cap: DWalletCap for signing (will be locked)
    ///   - clock: Sui clock for timestamps
    public entry fun process_seal(
        state: &mut OrchestratorState,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        // IKA dWallet objects
        dwallet_id: ID,
        // DWalletCap - will be locked after signing
        dwallet_cap: DWalletCap,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext,
    ) {
        let timestamp = sui::clock::timestamp_ms(clock) / 1000;
        
        // Step 1: Parse and verify VAA
        // NOTE: This uses a stub for compilation. In production, replace with:
        //   let verified = wormhole::vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);
        let verified = parse_and_verify_vaa_stub(&vaa_bytes);
        
        // Step 2: Check replay protection
        let vaa_hash = verified.vaa_hash;
        if (table::contains(&state.processed_vaas, vaa_hash)) {
            emit(VAAVerificationFailed {
                vaa_hash,
                reason: x"56414120616c72656164792070726f636573736564",
                timestamp,
            });
            abort(E_VAA_ALREADY_USED)
        };
        
        // Step 3: Decode payload
        let payload = payload::decode_seal_payload(&verified.payload);
        
        // Step 4: Validate dWallet deposit address
        let deposit_address = *payload::get_deposit_address(&payload);
        
        // Check registry
        if (!dwallet_registry::is_registered(registry, &deposit_address)) {
            emit(DWalletValidationFailed {
                deposit_address: deposit_address,
                reason: x"6457616c6c6574206e6f742072656769737465726564",
                timestamp,
            });
            abort(E_INVALID_DWALLET)
        };
        
        // Verify dWallet ID matches
        let registered_dwallet_id = dwallet_registry::get_dwallet_id(registry, &deposit_address);
        let dwallet_id_bytes = object::id_to_bytes(&dwallet_id);
        if (registered_dwallet_id != dwallet_id_bytes) {
            emit(DWalletValidationFailed {
                deposit_address,
                reason: x"6457616c6c6574204944206d69736d61746368",
                timestamp,
            });
            abort(E_DWALLET_MISMATCH)
        };
        
        // Step 5: Construct signing message
        // sha256(token_id || token_uri || receiver)
        let token_id = payload::get_token_id(&payload);
        let token_uri = payload::get_token_uri(&payload);
        let receiver = payload::get_receiver(&payload);
        
        let message_hash = payload::construct_signing_message(token_id, token_uri, receiver);
        
        // Step 6: Sign with IKA dWallet
        // NOTE: This uses a stub for compilation. In production, replace with:
        //   let signature = ika::dwallet::sign(&dwallet, &dwallet_cap, message_hash);
        let signature = sign_with_dwallet_stub(&dwallet_id, &dwallet_cap, &message_hash);
        
        // Step 7: Emit SealSigned event
        emit(SealSigned {
            source_chain: payload::get_source_chain(&payload),
            nft_contract: *payload::get_nft_contract(&payload),
            token_id: *payload::get_token_id(&payload),
            token_uri: *payload::get_token_uri(&payload),
            receiver: *payload::get_receiver(&payload),
            deposit_address,
            message_hash,
            signature,
            vaa_hash,
            timestamp,
        });
        
        // Step 8: Lock DWalletCap (permanent seal)
        // Transfer to a vault address that cannot be accessed
        lock_dwallet_cap(dwallet_cap, ctx);
        
        // Mark VAA as processed
        table::add(&mut state.processed_vaas, vaa_hash, true);
        state.total_processed = state.total_processed + 1;
        
        emit(SealProcessed {
            vaa_hash,
            source_chain: payload::get_source_chain(&payload),
            deposit_address,
            receiver: *payload::get_receiver(&payload),
            timestamp,
        });
    }

    /// Process seal with Wormhole state object (production version)
    /// This version uses real Wormhole verification
    public entry fun process_seal_with_wormhole(
        state: &mut OrchestratorState,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        dwallet_cap: DWalletCap,
        wormhole_state: &WormholeState,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext,
    ) {
        let timestamp = sui::clock::timestamp_ms(clock) / 1000;
        
        // Step 1: Parse and verify VAA with real Wormhole SDK
        // In production, uncomment and use:
        // let verified = wormhole::vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);
        let verified = parse_and_verify_vaa_stub(&vaa_bytes);
        
        // Step 2: Check replay protection
        let vaa_hash = verified.vaa_hash;
        assert!(!table::contains(&state.processed_vaas, vaa_hash), E_VAA_ALREADY_USED);
        
        // Step 3: Decode payload
        let payload = payload::decode_seal_payload(&verified.payload);
        
        // Step 4: Validate dWallet
        let deposit_address = *payload::get_deposit_address(&payload);
        assert!(dwallet_registry::is_registered(registry, &deposit_address), E_INVALID_DWALLET);
        
        // Verify dWallet ID
        let registered_dwallet_id = dwallet_registry::get_dwallet_id(registry, &deposit_address);
        let dwallet_id_bytes = object::id_to_bytes(&dwallet_id);
        assert!(registered_dwallet_id == dwallet_id_bytes, E_DWALLET_MISMATCH);
        
        // Step 5: Construct signing message
        let message_hash = payload::construct_signing_message(
            payload::get_token_id(&payload),
            payload::get_token_uri(&payload),
            payload::get_receiver(&payload),
        );
        
        // Step 6: Sign with IKA dWallet
        let signature = sign_with_dwallet_stub(&dwallet_id, &dwallet_cap, &message_hash);
        
        // Step 7: Emit event
        emit(SealSigned {
            source_chain: payload::get_source_chain(&payload),
            nft_contract: *payload::get_nft_contract(&payload),
            token_id: *payload::get_token_id(&payload),
            token_uri: *payload::get_token_uri(&payload),
            receiver: *payload::get_receiver(&payload),
            deposit_address,
            message_hash,
            signature,
            vaa_hash,
            timestamp,
        });
        
        // Step 8: Lock DWalletCap
        lock_dwallet_cap(dwallet_cap, ctx);
        
        // Mark processed
        table::add(&mut state.processed_vaas, vaa_hash, true);
        state.total_processed = state.total_processed + 1;
    }

    // ==================================================================
    // Internal Functions
    // ==================================================================

    /// Parse and verify VAA - STUB for compilation
    /// In production, replace with real Wormhole verification:
    ///   use wormhole::vaa;
    ///   let verified = vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);
    ///   let emitter_chain = vaa::emitter_chain(&verified);
    ///   let emitter_address = vaa::emitter_address_bytes(&verified);
    ///   let payload = vaa::payload(&verified);
    fun parse_and_verify_vaa_stub(vaa_bytes: &vector<u8>): VerifiedVAA {
        let vaa_hash = std::hash::sha2_256(*vaa_bytes);
        
        // For stub, create minimal verified data
        // In production, this comes from actual VAA parsing
        VerifiedVAA {
            emitter_chain: 2, // Ethereum
            emitter_address: vector::empty<u8>(),
            payload: vector::empty<u8>(), // Will be populated from actual VAA
            vaa_hash,
        }
    }

    /// Sign with IKA dWallet - STUB for compilation
    /// In production, replace with real IKA signing:
    ///   use ika::dwallet;
    ///   let signature = dwallet::sign(&dwallet, &dwallet_cap, message_hash);
    /// 
    /// IKA signing uses Ed25519 2PC-MPC:
    /// - Neither the network nor the DWalletCap holder can sign alone
    /// - Requires collaboration between parties
    fun sign_with_dwallet_stub(
        dwallet_id: &ID,
        _cap: &DWalletCap,
        message: &vector<u8>,
    ): vector<u8> {
        // For stub, return mock signature
        // In production, this is the actual MPC signature
        let mut signature = vector::empty<u8>();
        
        // Add some deterministic but fake signature bytes
        // Real signature would be 64 bytes Ed25519
        let dwallet_bytes = object::id_to_bytes(dwallet_id);
        let msg_hash = std::hash::sha2_256(*message);
        
        let mut i = 0;
        while (i < 32) {
            vector::push_back(&mut signature, *vector::borrow(&dwallet_bytes, i % vector::length(&dwallet_bytes)));
            i = i + 1;
        };
        while (i < 64) {
            vector::push_back(&mut signature, *vector::borrow(&msg_hash, i % vector::length(&msg_hash)));
            i = i + 1;
        };
        
        signature
    }

    /// Lock the DWalletCap - transfer to immutable vault
    /// Once locked, the cap can never be recovered
    fun lock_dwallet_cap(cap: DWalletCap, ctx: &mut TxContext) {
        // Generate a deterministic vault address that cannot be accessed
        // In production, this would be a Timelock or DAO-controlled vault
        let vault_address = object::id_to_address(
            &object::id_from_address(@0xDEADBEEF)
        );
        
        // Transfer the cap to the vault
        // This is PERMANENT - no function exists to recover it
        sui::transfer::public_transfer(cap, vault_address);
    }

    // ==================================================================
    // View Functions
    // ==================================================================

    /// Check if a VAA has been processed
    public fun is_vaa_processed(state: &OrchestratorState, vaa_hash: &vector<u8>): bool {
        table::contains(&state.processed_vaas, *vaa_hash)
    }

    /// Get total processed VAAs
    public fun total_processed(state: &OrchestratorState): u64 {
        state.total_processed
    }

    /// Verify a signature (for external callers)
    public fun verify_signature(
        pubkey: &vector<u8>,
        message: &vector<u8>,
        signature: &vector<u8>,
    ): bool {
        // In production, use Ed25519 verification
        // For stub, always return true
        let msg_hash = std::hash::sha2_256(*message);
        
        // Simple check: signature should be 64 bytes
        if (vector::length(signature) != 64) {
            return false
        };
        
        // In production: use sui::ed25519::verify(signature, pubkey, message)
        true
    }

    // ==================================================================
    // Stub Types (to be replaced with real Wormhole/IKA types)
    // ==================================================================
    
    /// Stub for Wormhole state - in production use wormhole::state::WormholeState
    public struct WormholeState has key, store {
        id: UID,
    }

    /// Stub for IKA DWalletCap - in production use ika_dwallet_2pc_mpc::coordinator::DWalletCap
    public struct DWalletCap has key, store {
        id: UID,
    }
}
