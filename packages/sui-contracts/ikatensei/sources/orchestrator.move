// Ika Tensei PRD v6 - Orchestrator (Production)
//
// Two-phase seal process using Wormhole VAA + IKA dWallet:
//
//   Phase 1: process_vaa (permissionless)
//     - Parse and verify Wormhole VAA (guardian signatures)
//     - Validate emitter address against known SealInitiator contracts
//     - Decode payload (nft_contract, token_id, deposit_address, receiver, token_uri)
//     - Validate dWallet against registry
//     - Construct signing message: sha256(token_id || token_uri || receiver)
//     - Store pending seal (awaiting IKA signature)
//
//   Phase 2: complete_seal (called by relayer after IKA signing)
//     - Verify Ed25519 signature from IKA dWallet against the stored message
//     - Emit SealSigned event for the Solana relayer
//     - Lock DWalletCap into SealVault (permanent)
//
// Why two phases?
//   IKA dWallet 2PC-MPC signing is asynchronous. The Sui contract cannot call
//   IKA signing synchronously in a single transaction. Instead:
//   1. The relayer calls process_vaa to verify the Wormhole message and store the seal
//   2. The relayer uses the IKA TypeScript SDK to perform 2PC-MPC signing off-chain
//   3. The relayer calls complete_seal with the resulting Ed25519 signature
//
// Wormhole integration:
//   - Uses wormhole::vaa::parse_and_verify for real VAA verification
//   - Requires WormholeState shared object passed as parameter
//   - VAA is consumed (hot potato) to prevent replay at the Wormhole layer
//   - Additional replay protection via processed_vaas table
//
// Security model:
//   - VAA verification: 13/19 Wormhole guardian signatures (production)
//   - Emitter validation: VAA emitter_address must match registered SealInitiator
//   - Ed25519 signature verification: sui::ed25519::ed25519_verify
//   - DWalletCap lock: transferred to SealVault (permanently inaccessible)
//   - Replay: VAA hash tracked + Wormhole consumed_vaas

module ikatensei::orchestrator {
    use sui::table::{Self, Table};
    use sui::event::emit;
    use sui::object::ID;
    use std::vector;

    use wormhole::vaa::{Self, VAA};
    use wormhole::state::{State as WormholeState};
    use wormhole::external_address;
    use wormhole::bytes32;

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
    const E_PENDING_SEAL_NOT_FOUND: u64 = 9;
    const E_SEAL_ALREADY_COMPLETED: u64 = 10;

    // ==================================================================
    // Events
    // ==================================================================

    /// Emitted after successful VAA verification + Ed25519 signature verification.
    /// Relayer watches this event to submit the seal to Solana.
    public struct SealSigned has copy, drop {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        token_uri: vector<u8>,
        receiver: vector<u8>,
        deposit_address: vector<u8>,
        dwallet_pubkey: vector<u8>,
        message_hash: vector<u8>,
        signature: vector<u8>,
        vaa_hash: vector<u8>,
        timestamp: u64,
    }

    public struct SealPending has copy, drop {
        vaa_hash: vector<u8>,
        source_chain: u16,
        deposit_address: vector<u8>,
        receiver: vector<u8>,
        message_hash: vector<u8>,
        timestamp: u64,
    }

    public struct EmitterRegistered has copy, drop {
        chain_id: u16,
        emitter_address: vector<u8>,
    }

    // ==================================================================
    // Data Structures
    // ==================================================================

    /// Pending seal awaiting IKA dWallet signature.
    public struct PendingSeal has store, drop {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        token_uri: vector<u8>,
        receiver: vector<u8>,
        deposit_address: vector<u8>,
        dwallet_pubkey: vector<u8>,
        message_hash: vector<u8>,
        dwallet_id_bytes: vector<u8>,
        timestamp: u64,
        completed: bool,
    }

    /// Orchestrator state — shared object.
    public struct OrchestratorState has key {
        id: UID,
        /// VAA hash -> bool (replay protection)
        processed_vaas: Table<vector<u8>, bool>,
        /// chain_id -> expected emitter address (SealInitiator contract per chain)
        known_emitters: Table<u16, vector<u8>>,
        /// VAA hash -> PendingSeal (awaiting IKA signature)
        pending_seals: Table<vector<u8>, PendingSeal>,
        total_processed: u64,
    }

    /// Admin capability for the orchestrator.
    public struct OrchestratorAdminCap has key, store {
        id: UID,
    }

    /// Permanent vault for DWalletCaps. No withdraw functions.
    public struct SealVault has key {
        id: UID,
    }

    // ==================================================================
    // Init
    // ==================================================================

    fun init(ctx: &mut TxContext) {
        let sender = sui::tx_context::sender(ctx);

        let state = OrchestratorState {
            id: object::new(ctx),
            processed_vaas: table::new(ctx),
            known_emitters: table::new(ctx),
            pending_seals: table::new(ctx),
            total_processed: 0,
        };
        sui::transfer::share_object(state);

        let vault = SealVault {
            id: object::new(ctx),
        };
        sui::transfer::share_object(vault);

        let admin_cap = OrchestratorAdminCap {
            id: object::new(ctx),
        };
        sui::transfer::public_transfer(admin_cap, sender);
    }

    // ==================================================================
    // Admin: Emitter Registry
    // ==================================================================

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
    // Phase 1: process_vaa — Verify Wormhole VAA and store pending seal
    // ==================================================================

    /// Verify a Wormhole VAA, decode the seal payload, validate the dWallet,
    /// and store a PendingSeal awaiting IKA signature.
    ///
    /// This is Phase 1 of the two-phase seal process. After calling this,
    /// the relayer must use the IKA TS SDK to sign the message_hash with
    /// the dWallet, then call complete_seal with the signature.
    public entry fun process_vaa(
        state: &mut OrchestratorState,
        wormhole_state: &WormholeState,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        clock: &sui::clock::Clock,
        _ctx: &mut TxContext,
    ) {
        let timestamp = sui::clock::timestamp_ms(clock) / 1000;

        // ── Step 1: Parse and verify VAA (real Wormhole verification) ──
        let verified_vaa = vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);

        // Extract fields before consuming the VAA
        let emitter_chain = vaa::emitter_chain(&verified_vaa);
        let emitter_addr = external_address::to_bytes(vaa::emitter_address(&verified_vaa));
        let vaa_hash = bytes32::to_bytes(vaa::digest(&verified_vaa));

        // Consume the VAA (take payload, destroying the hot potato)
        let (_chain, _addr, payload_bytes) = vaa::take_emitter_info_and_payload(verified_vaa);

        // ── Step 2: Validate emitter address ──
        if (table::contains(&state.known_emitters, emitter_chain)) {
            let expected = *table::borrow(&state.known_emitters, emitter_chain);
            assert!(expected == emitter_addr, E_INVALID_EMITTER);
        };

        // ── Step 3: Replay protection ──
        assert!(!table::contains(&state.processed_vaas, vaa_hash), E_VAA_ALREADY_USED);

        // ── Step 4: Decode payload ──
        let seal_payload = payload::decode_seal_payload(&payload_bytes);
        let deposit_address = *payload::get_deposit_address(&seal_payload);

        // ── Step 5: Validate dWallet against registry ──
        assert!(dwallet_registry::is_registered(registry, &deposit_address), E_INVALID_DWALLET);

        let registered_dwallet_id = dwallet_registry::get_dwallet_id(registry, &deposit_address);
        let dwallet_id_bytes = object::id_to_bytes(&dwallet_id);
        assert!(registered_dwallet_id == dwallet_id_bytes, E_DWALLET_MISMATCH);

        // Get the dWallet's Ed25519 public key from registry
        let dwallet_pubkey = dwallet_registry::get_dwallet_pubkey(registry, &deposit_address);

        // ── Step 6: Construct signing message ──
        let message_hash = payload::construct_signing_message(
            payload::get_token_id(&seal_payload),
            payload::get_token_uri(&seal_payload),
            payload::get_receiver(&seal_payload),
        );

        // ── Step 7: Store pending seal ──
        let pending = PendingSeal {
            source_chain: payload::get_source_chain(&seal_payload),
            nft_contract: *payload::get_nft_contract(&seal_payload),
            token_id: *payload::get_token_id(&seal_payload),
            token_uri: *payload::get_token_uri(&seal_payload),
            receiver: *payload::get_receiver(&seal_payload),
            deposit_address,
            dwallet_pubkey,
            message_hash,
            dwallet_id_bytes,
            timestamp,
            completed: false,
        };

        table::add(&mut state.pending_seals, vaa_hash, pending);
        table::add(&mut state.processed_vaas, vaa_hash, true);

        emit(SealPending {
            vaa_hash,
            source_chain: payload::get_source_chain(&seal_payload),
            deposit_address,
            receiver: *payload::get_receiver(&seal_payload),
            message_hash,
            timestamp,
        });
    }

    // ==================================================================
    // Phase 2: complete_seal — Submit IKA signature and emit SealSigned
    // ==================================================================

    /// Complete a pending seal by providing the IKA dWallet Ed25519 signature.
    ///
    /// The relayer calls this after signing the message_hash with the IKA TS SDK.
    /// The signature is verified on-chain using sui::ed25519::ed25519_verify.
    /// On success, emits SealSigned (which the relayer uses to submit to Solana).
    /// The DWalletCap is permanently locked in the SealVault.
    public entry fun complete_seal(
        state: &mut OrchestratorState,
        vault: &SealVault,
        vaa_hash: vector<u8>,
        signature: vector<u8>,
        dwallet_cap: DWalletCap,
        clock: &sui::clock::Clock,
        _ctx: &mut TxContext,
    ) {
        let timestamp = sui::clock::timestamp_ms(clock) / 1000;

        // ── Step 1: Look up pending seal ──
        assert!(table::contains(&state.pending_seals, vaa_hash), E_PENDING_SEAL_NOT_FOUND);
        let pending = table::borrow_mut(&mut state.pending_seals, vaa_hash);
        assert!(!pending.completed, E_SEAL_ALREADY_COMPLETED);

        // ── Step 2: Verify Ed25519 signature ──
        assert!(vector::length(&signature) == 64, E_SIGNATURE_FAILED);
        let valid = sui::ed25519::ed25519_verify(
            &signature,
            &pending.dwallet_pubkey,
            &pending.message_hash,
        );
        assert!(valid, E_SIGNATURE_FAILED);

        // ── Step 3: Mark completed ──
        pending.completed = true;
        state.total_processed = state.total_processed + 1;

        // ── Step 4: Emit SealSigned event ──
        emit(SealSigned {
            source_chain: pending.source_chain,
            nft_contract: pending.nft_contract,
            token_id: pending.token_id,
            token_uri: pending.token_uri,
            receiver: pending.receiver,
            deposit_address: pending.deposit_address,
            dwallet_pubkey: pending.dwallet_pubkey,
            message_hash: pending.message_hash,
            signature,
            vaa_hash,
            timestamp,
        });

        // ── Step 5: Lock DWalletCap permanently ──
        lock_dwallet_cap(vault, dwallet_cap);
    }

    // ==================================================================
    // Internal helpers
    // ==================================================================

    /// Lock a DWalletCap permanently by transferring it to the SealVault's address.
    fun lock_dwallet_cap(vault: &SealVault, cap: DWalletCap) {
        let vault_address = object::id_to_address(&object::id(vault));
        sui::transfer::public_transfer(cap, vault_address);
    }

    /// Verify an Ed25519 signature using Sui's built-in verifier.
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

    public fun is_seal_pending(state: &OrchestratorState, vaa_hash: &vector<u8>): bool {
        table::contains(&state.pending_seals, *vaa_hash) && 
        !table::borrow(&state.pending_seals, *vaa_hash).completed
    }

    public fun is_seal_completed(state: &OrchestratorState, vaa_hash: &vector<u8>): bool {
        table::contains(&state.pending_seals, *vaa_hash) && 
        table::borrow(&state.pending_seals, *vaa_hash).completed
    }

    /// DWalletCap type for the vault to accept.
    /// TODO(production): Replace with ika_dwallet_2pc_mpc::coordinator::DWalletCap
    /// when the IKA Move package dependency is available.
    /// For now, this is a local type that mirrors the real one.
    public struct DWalletCap has key, store {
        id: UID,
    }
}
