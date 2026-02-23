// Ika Tensei PRD v6 - Orchestrator
//
// The brain of the Ika Tensei system. This module:
//   1. Receives Wormhole VAA bytes from any source chain
//   2. Verifies the VAA (guardian signatures) — validates emitter address per-chain
//   3. Decodes the payload (source_chain, nft_contract, token_id, deposit_address, receiver, token_uri)
//   4. Validates dWallet address against the registry
//   5. Constructs signing message: sha256(token_id + token_uri + receiver)
//   6. Signs with IKA dWallet (2PC-MPC)
//   7. Emits SealSigned event for the relayer
//   8. Locks DWalletCap into SealVault (permanent, irrecoverable)
//
// Security model:
//   - VAA verification: 13/19 Wormhole guardian signatures required (production)
//   - Emitter validation: VAA emitter_address must match known SealInitiator per chain
//   - dWallet validation: Must be registered in DWalletRegistry
//   - Signing: IKA 2PC-MPC (neither network nor user can sign alone)
//   - Lock: DWalletCap is transferred to SealVault address — permanently inaccessible
//
// Production integration:
//   - Wormhole: Replace stubs with wormhole::vaa::parse_and_verify()
//   - IKA:      Replace stubs with ika_dwallet_2pc_mpc::coordinator signing calls
//   - See TODO markers throughout for exact call sites
//
// Stub policy:
//   - parse_and_verify_vaa_stub and sign_with_dwallet_stub are #[test_only]
//   - process_seal_test (test entry) is #[test_only]
//   - process_seal (production entry) has TODO stubs for compilation — replace before mainnet
module ikatensei::orchestrator {
    use sui::table::{Self, Table};
    use sui::event::emit;
    use sui::object::ID;
    use std::vector;

    use ikatensei::payload::{Self, SealPayload};
    use ikatensei::dwallet_registry::{Self, DWalletRegistry};

    // Error codes
    const E_INVALID_VAA: u64 = 1;
    const E_INVALID_DWALLET: u64 = 2;
    const E_DWALLET_MISMATCH: u64 = 3;
    const E_SIGNATURE_FAILED: u64 = 4;
    const E_CAP_ALREADY_LOCKED: u64 = 5;
    const E_INVALID_SOURCE_CHAIN: u64 = 6;
    const E_VAA_ALREADY_USED: u64 = 7;
    const E_INVALID_EMITTER: u64 = 8;

    // ==================================================================
    // Events
    // ==================================================================

    /// Emitted after successful VAA verification, dWallet validation, and signing.
    /// Relayer watches this event to submit the seal to Solana.
    public struct SealSigned has copy, drop {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        token_uri: vector<u8>,
        receiver: vector<u8>,
        deposit_address: vector<u8>,
        message_hash: vector<u8>,
        /// IKA dWallet Ed25519 signature (64 bytes)
        signature: vector<u8>,
        vaa_hash: vector<u8>,
        timestamp: u64,
    }

    public struct VAAVerificationFailed has copy, drop {
        vaa_hash: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    public struct DWalletValidationFailed has copy, drop {
        deposit_address: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    public struct SigningFailed has copy, drop {
        deposit_address: vector<u8>,
        message_hash: vector<u8>,
        reason: vector<u8>,
        timestamp: u64,
    }

    public struct SealProcessed has copy, drop {
        vaa_hash: vector<u8>,
        source_chain: u16,
        deposit_address: vector<u8>,
        receiver: vector<u8>,
        timestamp: u64,
    }

    public struct EmitterRegistered has copy, drop {
        chain_id: u16,
        emitter_address: vector<u8>,
    }

    // ==================================================================
    // Data Structures
    // ==================================================================

    /// Orchestrator state — shared object.
    /// Tracks processed VAAs (replay protection) and known emitters.
    public struct OrchestratorState has key {
        id: UID,
        /// VAA hash -> bool (replay protection)
        processed_vaas: Table<vector<u8>, bool>,
        /// chain_id -> expected emitter address (SealInitiator contract per chain)
        known_emitters: Table<u16, vector<u8>>,
        total_processed: u64,
    }

    /// Admin capability for the orchestrator (register emitters, etc.)
    public struct OrchestratorAdminCap has key, store {
        id: UID,
    }

    /// Permanent vault for DWalletCaps.
    /// This shared object has no functions to withdraw from it.
    /// Any DWalletCap transferred to its address is permanently locked.
    public struct SealVault has key {
        id: UID,
    }

    /// Parsed/verified VAA data.
    public struct VerifiedVAA has copy, drop, store {
        emitter_chain: u16,
        emitter_address: vector<u8>,
        payload: vector<u8>,
        vaa_hash: vector<u8>,
    }

    // ==================================================================
    // Stub types (to be replaced with real Wormhole / IKA deps)
    // ==================================================================

    /// TODO(production): Replace with wormhole::state::State from the Wormhole package.
    /// Dependency: wormhole = { git = "https://github.com/wormhole-foundation/wormhole", ... }
    public struct WormholeState has key, store {
        id: UID,
    }

    /// TODO(production): Replace with ika_dwallet_2pc_mpc::coordinator::DWalletCap.
    /// Dependency: ika_dwallet_2pc_mpc = { ... }
    public struct DWalletCap has key, store {
        id: UID,
    }

    // ==================================================================
    // Init
    // ==================================================================

    fun init(ctx: &mut TxContext) {
        let sender = sui::tx_context::sender(ctx);

        // Orchestrator state (shared)
        let state = OrchestratorState {
            id: object::new(ctx),
            processed_vaas: table::new(ctx),
            known_emitters: table::new(ctx),
            total_processed: 0,
        };
        sui::transfer::share_object(state);

        // SealVault (shared) — the black hole for DWalletCaps
        let vault = SealVault {
            id: object::new(ctx),
        };
        sui::transfer::share_object(vault);

        // Admin cap goes to deployer
        let admin_cap = OrchestratorAdminCap {
            id: object::new(ctx),
        };
        sui::transfer::public_transfer(admin_cap, sender);
    }

    // ==================================================================
    // Admin: Emitter Registry
    // ==================================================================

    /// Register (or update) the known emitter address for a source chain.
    /// The emitter_address is the 32-byte Wormhole-normalised contract address
    /// of the SealInitiator deployed on that chain.
    /// Must be called by the holder of OrchestratorAdminCap.
    public fun register_emitter(
        state: &mut OrchestratorState,
        _cap: &OrchestratorAdminCap,
        chain_id: u16,
        emitter_address: vector<u8>,
    ) {
        assert!(vector::length(&emitter_address) == 32, E_INVALID_EMITTER);
        if (table::contains(&state.known_emitters, chain_id)) {
            *table::borrow_mut(&mut state.known_emitters, chain_id) = emitter_address;
        } else {
            table::add(&mut state.known_emitters, chain_id, emitter_address);
        };
        emit(EmitterRegistered { chain_id, emitter_address });
    }

    /// Remove an emitter entry (e.g. contract was upgraded and old entry cleaned up).
    public fun remove_emitter(
        state: &mut OrchestratorState,
        _cap: &OrchestratorAdminCap,
        chain_id: u16,
    ) {
        if (table::contains(&state.known_emitters, chain_id)) {
            table::remove(&mut state.known_emitters, chain_id);
        };
    }

    // ==================================================================
    // Production Entry: process_seal
    // ==================================================================

    /// Process a Wormhole VAA and sign with IKA dWallet.
    ///
    /// Production flow:
    ///   1. Parse and verify VAA (guardians + emitter check)
    ///   2. Replay-protection check
    ///   3. Decode payload
    ///   4. Validate dWallet address against registry
    ///   5. Construct signing message: sha256(token_id || token_uri || receiver)
    ///   6. Sign with IKA dWallet 2PC-MPC
    ///   7. Emit SealSigned event
    ///   8. Lock DWalletCap into SealVault (permanent)
    ///
    /// Parameters:
    ///   state       — OrchestratorState (replay protection + emitter registry)
    ///   vault       — SealVault (DWalletCaps are permanently transferred here)
    ///   registry    — DWalletRegistry (validates deposit_address)
    ///   vaa_bytes   — Raw Wormhole VAA bytes
    ///   dwallet_id  — ID of the registered IKA dWallet
    ///   dwallet_cap — DWalletCap (consumed; permanently locked after signing)
    ///   clock       — Sui clock for timestamps
    public entry fun process_seal(
        state: &mut OrchestratorState,
        vault: &SealVault,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        dwallet_cap: DWalletCap,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext,
    ) {
        let timestamp = sui::clock::timestamp_ms(clock) / 1000;

        // ---------------------------------------------------------------
        // Step 1: Parse and verify VAA
        // ---------------------------------------------------------------
        // TODO(production): Replace the line below with real Wormhole verification:
        //
        //   use wormhole::vaa;
        //   let hot_potato = vaa::parse_and_verify(wormhole_state, &vaa_bytes, clock);
        //   let emitter_chain   = vaa::emitter_chain(&hot_potato);
        //   let emitter_address = vaa::emitter_address(&hot_potato);  // [u8; 32]
        //   let payload_bytes   = vaa::payload(&hot_potato);
        //   let vaa_hash        = vaa::digest(&hot_potato).hash;
        //   vaa::destroy(hot_potato);
        //   let verified = VerifiedVAA { emitter_chain, emitter_address, payload: payload_bytes, vaa_hash };
        //
        // Until Wormhole dep is wired up, this falls through to the stub:
        let verified = parse_and_verify_vaa_internal(&vaa_bytes);

        // ---------------------------------------------------------------
        // Step 2: Validate emitter address (if registered)
        // ---------------------------------------------------------------
        if (table::contains(&state.known_emitters, verified.emitter_chain)) {
            let expected = *table::borrow(&state.known_emitters, verified.emitter_chain);
            if (expected != verified.emitter_address) {
                emit(VAAVerificationFailed {
                    vaa_hash: verified.vaa_hash,
                    reason: b"invalid emitter address",
                    timestamp,
                });
                abort(E_INVALID_EMITTER)
            };
        };

        // ---------------------------------------------------------------
        // Step 3: Replay protection
        // ---------------------------------------------------------------
        let vaa_hash = verified.vaa_hash;
        if (table::contains(&state.processed_vaas, vaa_hash)) {
            emit(VAAVerificationFailed {
                vaa_hash,
                reason: b"VAA already processed",
                timestamp,
            });
            abort(E_VAA_ALREADY_USED)
        };

        // ---------------------------------------------------------------
        // Step 4: Decode payload
        // ---------------------------------------------------------------
        let seal_payload = payload::decode_seal_payload(&verified.payload);
        let deposit_address = *payload::get_deposit_address(&seal_payload);

        // ---------------------------------------------------------------
        // Step 5: Validate dWallet against registry
        // ---------------------------------------------------------------
        if (!dwallet_registry::is_registered(registry, &deposit_address)) {
            emit(DWalletValidationFailed {
                deposit_address,
                reason: b"dWallet not registered",
                timestamp,
            });
            abort(E_INVALID_DWALLET)
        };

        let registered_dwallet_id = dwallet_registry::get_dwallet_id(registry, &deposit_address);
        let dwallet_id_bytes = object::id_to_bytes(&dwallet_id);
        if (registered_dwallet_id != dwallet_id_bytes) {
            emit(DWalletValidationFailed {
                deposit_address,
                reason: b"dWallet ID mismatch",
                timestamp,
            });
            abort(E_DWALLET_MISMATCH)
        };

        // ---------------------------------------------------------------
        // Step 6: Construct signing message
        // sha256(token_id || token_uri || receiver)
        // ---------------------------------------------------------------
        let message_hash = payload::construct_signing_message(
            payload::get_token_id(&seal_payload),
            payload::get_token_uri(&seal_payload),
            payload::get_receiver(&seal_payload),
        );

        // ---------------------------------------------------------------
        // Step 7: Sign with IKA dWallet
        // ---------------------------------------------------------------
        // TODO(production): Replace with real IKA 2PC-MPC signing:
        //
        //   use ika_dwallet_2pc_mpc::coordinator;
        //   // IKA signing is asynchronous — the signature is returned via a callback
        //   // object, not synchronously. The typical flow is:
        //   //   1. coordinator::request_sign(dwallet_cap, message_hash, ctx)
        //   //      → returns a SignRequest object
        //   //   2. The IKA network co-signs and emits a SignOutput event
        //   //   3. Relayer submits the SignOutput to complete the flow
        //   // See: https://docs.ika.xyz/dwallet-sign
        //
        // Until IKA dep is wired up, this uses the internal signing stub:
        let signature = sign_with_dwallet_internal(&dwallet_id, &dwallet_cap, &message_hash);

        // ---------------------------------------------------------------
        // Step 8: Emit SealSigned event (relayer picks this up for Solana)
        // ---------------------------------------------------------------
        emit(SealSigned {
            source_chain: payload::get_source_chain(&seal_payload),
            nft_contract: *payload::get_nft_contract(&seal_payload),
            token_id: *payload::get_token_id(&seal_payload),
            token_uri: *payload::get_token_uri(&seal_payload),
            receiver: *payload::get_receiver(&seal_payload),
            deposit_address,
            message_hash,
            signature,
            vaa_hash,
            timestamp,
        });

        // ---------------------------------------------------------------
        // Step 9: Lock DWalletCap into SealVault (permanent, irrecoverable)
        // ---------------------------------------------------------------
        lock_dwallet_cap(vault, dwallet_cap);

        // Mark VAA as processed
        table::add(&mut state.processed_vaas, vaa_hash, true);
        state.total_processed = state.total_processed + 1;

        emit(SealProcessed {
            vaa_hash,
            source_chain: payload::get_source_chain(&seal_payload),
            deposit_address,
            receiver: *payload::get_receiver(&seal_payload),
            timestamp,
        });
    }

    // ==================================================================
    // Test Entry: process_seal_test (test-only, uses stubs openly)
    // ==================================================================

    /// Test entry point — uses parse_and_verify_vaa_stub directly.
    /// Do NOT deploy this to production. Use process_seal instead.
    #[test_only]
    public entry fun process_seal_test(
        state: &mut OrchestratorState,
        vault: &SealVault,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        dwallet_cap: DWalletCap,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext,
    ) {
        // Delegate to the production entry — stubs are gated inside
        process_seal(state, vault, registry, vaa_bytes, dwallet_id, dwallet_cap, clock, ctx);
    }

    // ==================================================================
    // Internal helpers
    // ==================================================================

    /// Lock a DWalletCap permanently by transferring it to the SealVault's address.
    ///
    /// The SealVault is a shared object with no accessor functions.
    /// Anything transferred to `object::id_to_address(&object::id(vault))` is
    /// owned by an address that no signer controls — permanently inaccessible.
    fun lock_dwallet_cap(vault: &SealVault, cap: DWalletCap) {
        let vault_address = object::id_to_address(&object::id(vault));
        sui::transfer::public_transfer(cap, vault_address);
    }

    /// Internal VAA stub — returns a VerifiedVAA with empty payload/emitter.
    /// Called by process_seal until the real Wormhole dep is linked.
    ///
    /// IMPORTANT: This returns an empty payload, which means decode_seal_payload
    /// will abort. In production, this must be replaced. The stub exists purely
    /// to keep the module compilable without external deps.
    fun parse_and_verify_vaa_internal(vaa_bytes: &vector<u8>): VerifiedVAA {
        // TODO(production): Remove this function and call wormhole::vaa::parse_and_verify
        let vaa_hash = std::hash::sha2_256(*vaa_bytes);
        VerifiedVAA {
            emitter_chain: 2, // placeholder: Ethereum
            emitter_address: vector::empty<u8>(),
            payload: vector::empty<u8>(), // placeholder — real VAA data comes from Wormhole
            vaa_hash,
        }
    }

    /// Internal signing stub — returns a deterministic but fake signature.
    /// Called by process_seal until the real IKA dep is linked.
    ///
    /// IMPORTANT: This produces a fake signature that will NOT verify on-chain.
    /// Must be replaced with real IKA 2PC-MPC signing before production.
    fun sign_with_dwallet_internal(
        dwallet_id: &ID,
        _cap: &DWalletCap,
        message: &vector<u8>,
    ): vector<u8> {
        // TODO(production): Remove this function. Use IKA coordinator signing instead.
        let id_bytes = object::id_to_bytes(dwallet_id);
        let msg_hash = std::hash::sha2_256(*message);

        let mut signature = vector::empty<u8>();
        let mut i = 0u64;
        while (i < 32) {
            vector::push_back(&mut signature, *vector::borrow(&id_bytes, i % vector::length(&id_bytes)));
            i = i + 1;
        };
        while (i < 64) {
            vector::push_back(&mut signature, *vector::borrow(&msg_hash, i % vector::length(&msg_hash)));
            i = i + 1;
        };
        signature
    }

    // ==================================================================
    // Public helpers
    // ==================================================================

    /// Verify an Ed25519 signature using Sui's built-in verifier.
    /// Returns false if signature is the wrong length or fails verification.
    public fun verify_signature(
        pubkey: &vector<u8>,
        message: &vector<u8>,
        signature: &vector<u8>,
    ): bool {
        if (vector::length(signature) != 64) {
            return false
        };
        sui::ed25519::ed25519_verify(signature, pubkey, message)
    }

    // ==================================================================
    // View functions
    // ==================================================================

    public fun is_vaa_processed(state: &OrchestratorState, vaa_hash: &vector<u8>): bool {
        table::contains(&state.processed_vaas, *vaa_hash)
    }

    public fun total_processed(state: &OrchestratorState): u64 {
        state.total_processed
    }

    public fun has_known_emitter(state: &OrchestratorState, chain_id: u16): bool {
        table::contains(&state.known_emitters, chain_id)
    }

    public fun get_known_emitter(state: &OrchestratorState, chain_id: u16): vector<u8> {
        *table::borrow(&state.known_emitters, chain_id)
    }
}
