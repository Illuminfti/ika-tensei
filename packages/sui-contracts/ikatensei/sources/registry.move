// Ika Tensei v3 - Seal Registry (Main Contract)
//
// Shared object tracking all seals, collections, and protocol state.
// init() creates: SealRegistry + SealVault (both shared) + AdminCap (transferred to deployer).
//
// Key functions:
//   register_seal_with_vaa()  - cross-chain seals (ETH/SOL/NEAR) via Wormhole VAA
//   register_seal_native<T>() - Sui-native NFT seals (no VAA)
//   mark_reborn()             - PERMISSIONLESS, anyone can call
//
// Protocol constants (PRD v3):
//   PROTOCOL_VERSION  = 3
//   GUILD_SHARE_BPS   = 500  (5%)
//   TEAM_SHARE_BPS    = 190  (1.9%)
module ikatensei::registry {
    use sui::table::{Self, Table};
    use sui::event::emit;
    use sui::transfer;
    use ikatensei::emitters::{Self, EmitterRegistry};
    use ikatensei::seal_vault::{Self, SealVault};
    use ikatensei::admin::{Self, AdminCap, ProtocolConfig};

    // ==================================================================
    // Event structs - MUST be defined here (Sui requires emit from defining module)
    // ==================================================================

    public struct NFTSealed has copy, drop {
        seal_hash: vector<u8>,
        source_chain_id: u16,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        dwallet_pubkey: vector<u8>,
        attestation_pubkey: vector<u8>,
        sealer: address,
        /// Hash of the Wormhole VAA that proved the deposit. Empty for Sui-native seals.
        vaa_hash: vector<u8>,
        timestamp: u64,
        /// Original NFT name (UTF-8 bytes)
        metadata_name: vector<u8>,
        /// Walrus blob ID for mirrored metadata JSON
        walrus_metadata_blob_id: vector<u8>,
    }

    public struct NFTReborn has copy, drop {
        seal_hash: vector<u8>,
        solana_mint_address: vector<u8>,
        caller: address,
        timestamp: u64,
    }

    public struct CollectionRegistered has copy, drop {
        collection_id: vector<u8>,
        source_chain_id: u16,
        name: vector<u8>,
        seal_fee: u64,
        max_seals: u64,
        timestamp: u64,
    }

    public struct CollectionDeactivated has copy, drop {
        collection_id: vector<u8>,
        timestamp: u64,
    }

    public struct EmitterRegisteredEvent has copy, drop {
        chain_id: u16,
        emitter_address: vector<u8>,
        timestamp: u64,
    }

    public struct EmitterRemovedEvent has copy, drop {
        chain_id: u16,
        timestamp: u64,
    }

    public struct DepositVerified has copy, drop {
        vaa_hash: vector<u8>,
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        dwallet_address: vector<u8>,
        timestamp: u64,
    }

    public struct ProtocolPauseChanged has copy, drop {
        paused: bool,
        timestamp: u64,
    }

    public struct TreasuryUpdated has copy, drop {
        guild_treasury: address,
        team_treasury: address,
        timestamp: u64,
    }

    public struct FeeSharesUpdated has copy, drop {
        guild_share_bps: u16,
        team_share_bps: u16,
        timestamp: u64,
    }

    // ==================================================================
    // Error codes
    // ==================================================================

    const E_COLLECTION_NOT_REGISTERED: u64 = 1;
    const E_COLLECTION_ALREADY_REGISTERED: u64 = 2;
    const E_SEAL_ALREADY_EXISTS: u64 = 3;
    const E_SEAL_NOT_FOUND: u64 = 4;
    const E_ALREADY_REBORN: u64 = 5;
    const E_PROTOCOL_PAUSED: u64 = 6;
    const E_INVALID_CHAIN: u64 = 7;
    const E_UNTRUSTED_EMITTER: u64 = 8;
    const E_VAA_ALREADY_CONSUMED: u64 = 9;

    // ==================================================================
    // Chain IDs (our internal IDs matching PRD §12)
    // ==================================================================

    const CHAIN_ETHEREUM: u16 = 1;
    const CHAIN_SUI: u16 = 2;
    const CHAIN_SOLANA: u16 = 3;
    const CHAIN_NEAR: u16 = 4;
    // CHAIN_BITCOIN = 5 is NOT supported via Wormhole (Phase 2+)

    // ==================================================================
    // Data structures
    // ==================================================================

    /// Permanent record of a sealed NFT
    public struct SealRecord has store, copy {
        seal_hash: vector<u8>,
        source_chain_id: u16,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        /// ID of the dWallet that holds the NFT on source chain (as bytes)
        dwallet_id: vector<u8>,
        dwallet_pubkey: vector<u8>,
        /// Ed25519 dWallet for Solana attestation (same as dwallet for Ed25519 chains)
        attestation_dwallet_id: vector<u8>,
        attestation_pubkey: vector<u8>,
        sealer: address,
        sealed_at: u64,
        reborn: bool,
        /// Populated by mark_reborn(). 32-byte Solana mint pubkey.
        solana_mint_address: vector<u8>,
        nonce: u64,
        /// Original NFT name (UTF-8 bytes)
        metadata_name: vector<u8>,
        /// Original NFT description (UTF-8 bytes, first 256 chars)
        metadata_description: vector<u8>,
        /// Original metadata URI (e.g., IPFS/HTTP link to full metadata JSON)
        metadata_uri: vector<u8>,
        /// Walrus blob ID for mirrored metadata JSON
        walrus_metadata_blob_id: vector<u8>,
        /// Walrus blob ID for mirrored image
        walrus_image_blob_id: vector<u8>,
        /// Collection name (UTF-8 bytes)
        collection_name: vector<u8>,
    }

    /// Collection configuration (optional - collections don't need to be pre-registered)
    public struct CollectionConfig has store, copy {
        collection_id: vector<u8>,
        source_chain_id: u16,
        name: vector<u8>,
        seal_fee: u64,
        max_seals: u64,
        current_seals: u64,
        active: bool,
    }

    /// Main registry - shared object, one per deployment
    public struct SealRegistry has key {
        id: UID,
        config: ProtocolConfig,
        emitters: EmitterRegistry,
        /// collection_id -> CollectionConfig
        collections: Table<vector<u8>, CollectionConfig>,
        /// seal_hash -> SealRecord
        seals: Table<vector<u8>, SealRecord>,
    }

    // ==================================================================
    // Init - called once at package publish
    // Creates: SealRegistry (shared), SealVault (shared), AdminCap (owned by deployer)
    // ==================================================================

    fun init(ctx: &mut TxContext) {
        let deployer = tx_context::sender(ctx);
        let admin_cap = admin::create_admin_cap(ctx);

        let registry = SealRegistry {
            id: object::new(ctx),
            config: admin::create_initial_config(deployer, deployer),
            emitters: emitters::new_registry(ctx),
            collections: table::new(ctx),
            seals: table::new(ctx),
        };

        let vault = seal_vault::new_vault(ctx);

        // SealRegistry has key-only (no store), use regular share_object
        transfer::share_object(registry);
        // SealVault has key+store, use public_share_object
        transfer::public_share_object(vault);
        // AdminCap has key+store, use public_transfer
        transfer::public_transfer(admin_cap, deployer);
    }

    /// Test-only entry point that mirrors init().
    /// Sui enforces that real `init` is private; tests call this instead.
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    // ==================================================================
    // Collection Management (Admin)
    // ==================================================================

    public fun register_collection(
        registry: &mut SealRegistry,
        cap: &AdminCap,
        collection_id: vector<u8>,
        source_chain_id: u16,
        name: vector<u8>,
        seal_fee: u64,
        max_seals: u64,
        ctx: &mut TxContext,
    ) {
        let _ = cap; // Validates admin owns cap
        assert!(is_supported_chain(source_chain_id), E_INVALID_CHAIN);
        assert!(
            !table::contains(&registry.collections, collection_id),
            E_COLLECTION_ALREADY_REGISTERED
        );

        table::add(&mut registry.collections, collection_id, CollectionConfig {
            collection_id,
            source_chain_id,
            name,
            seal_fee,
            max_seals,
            current_seals: 0,
            active: true,
        });

        emit(CollectionRegistered {
            collection_id,
            source_chain_id,
            name,
            seal_fee,
            max_seals,
            timestamp: tx_context::epoch(ctx),
        });
    }

    public fun deactivate_collection(
        registry: &mut SealRegistry,
        _cap: &AdminCap,
        collection_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&registry.collections, collection_id), E_COLLECTION_NOT_REGISTERED);
        table::borrow_mut(&mut registry.collections, collection_id).active = false;
        emit(CollectionDeactivated {
            collection_id,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================================================================
    // Emitter Management (Admin)
    // ==================================================================

    public fun register_trusted_emitter(
        registry: &mut SealRegistry,
        _cap: &AdminCap,
        wh_chain_id: u16,
        emitter_address: vector<u8>,
        ctx: &mut TxContext,
    ) {
        emitters::register_emitter(&mut registry.emitters, wh_chain_id, emitter_address);
        emit(EmitterRegisteredEvent {
            chain_id: wh_chain_id,
            emitter_address,
            timestamp: tx_context::epoch(ctx),
        });
    }

    public fun remove_trusted_emitter(
        registry: &mut SealRegistry,
        _cap: &AdminCap,
        wh_chain_id: u16,
        ctx: &mut TxContext,
    ) {
        emitters::remove_emitter(&mut registry.emitters, wh_chain_id);
        emit(EmitterRemovedEvent {
            chain_id: wh_chain_id,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================================================================
    // Protocol Config (Admin)
    // ==================================================================

    public fun pause_protocol(registry: &mut SealRegistry, cap: &AdminCap, ctx: &mut TxContext) {
        admin::pause_protocol(&mut registry.config, cap);
        emit(ProtocolPauseChanged { paused: true, timestamp: tx_context::epoch(ctx) });
    }

    public fun unpause_protocol(registry: &mut SealRegistry, cap: &AdminCap, ctx: &mut TxContext) {
        admin::unpause_protocol(&mut registry.config, cap);
        emit(ProtocolPauseChanged { paused: false, timestamp: tx_context::epoch(ctx) });
    }

    public fun update_treasuries(
        registry: &mut SealRegistry,
        cap: &AdminCap,
        guild_treasury: address,
        team_treasury: address,
        ctx: &mut TxContext,
    ) {
        admin::update_treasuries(&mut registry.config, cap, guild_treasury, team_treasury);
        emit(TreasuryUpdated { guild_treasury, team_treasury, timestamp: tx_context::epoch(ctx) });
    }

    public fun update_shares(
        registry: &mut SealRegistry,
        cap: &AdminCap,
        guild_share_bps: u16,
        team_share_bps: u16,
        ctx: &mut TxContext,
    ) {
        admin::update_shares(&mut registry.config, cap, guild_share_bps, team_share_bps);
        emit(FeeSharesUpdated { guild_share_bps, team_share_bps, timestamp: tx_context::epoch(ctx) });
    }

    // ==================================================================
    // Seal Registration - Cross-chain via Wormhole VAA
    //
    // PRD §8: Before sealing, must verify that the NFT was actually deposited
    // into the dWallet address on the source chain via Wormhole guardian signatures.
    //
    // Wormhole VAA verification is STUBBED here for compilation without the
    // Wormhole package dependency. Integration instructions:
    //
    // 1. Add to Move.toml:
    //    Wormhole = { git = "https://github.com/wormhole-foundation/wormhole.git",
    //                 subdir = "sui/wormhole", rev = "main" }
    //    Testnet state object ID: 0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790
    //    Mainnet state object ID: 0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c
    //
    // 2. Add to function signature:
    //    wormhole_state: &wormhole::state::WormholeState,
    //    clock: &sui::clock::Clock,
    //
    // 3. Replace parse_vaa_stub() with:
    //    let verified = wormhole::vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);
    //    let emitter_chain = wormhole::vaa::emitter_chain(&verified);
    //    let emitter_addr  = wormhole::vaa::emitter_address_bytes(&verified);
    //    let payload       = wormhole::vaa::payload(&verified);
    //    let vaa_hash      = sui::hash::sha2_256(vaa_bytes);
    //    Then parse payload per PRD §8.2 (171 bytes):
    //      [0]     payload_id (must = 1)
    //      [1-2]   source_chain_id (u16 BE)
    //      [3-34]  nft_contract (32 bytes)
    //      [35-66] token_id (32 bytes)
    //      [67-98] depositor (32 bytes)
    //      [99-130] dwallet_address (32 bytes)
    //      [131-138] deposit_block (u64 BE)
    //      [139-170] seal_nonce (32 bytes)
    //
    // 4. IKA DWalletCap integration (PRD §5.1 / v3-01 research):
    //    The DWalletCap objects must actually be TRANSFERRED to the SealVault contract.
    //    Add parameters: dwallet_cap: DWalletCap, attestation_cap: DWalletCap
    //    Then: transfer::public_transfer(dwallet_cap, object::id_to_address(&object::id(vault)));
    //    IKA package: 0x6573a6c13daf26a64eb8a37d3c7a4391b353031e223072ca45b1ff9366f59293
    //    DWalletCap type: ika_dwallet_2pc_mpc::coordinator::DWalletCap
    // ==================================================================

    public fun register_seal_with_vaa(
        registry: &mut SealRegistry,
        vault: &mut SealVault,
        // Raw Wormhole VAA bytes. In production, verified by wormhole::vaa::parse_and_verify.
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        dwallet_cap_id: ID,
        // For secp256k1 chains: separate Ed25519 dWallet for Solana attestation.
        // For Ed25519 chains: set equal to dwallet_id.
        attestation_dwallet_id: ID,
        attestation_dwallet_cap_id: ID,
        dwallet_pubkey: vector<u8>,
        attestation_pubkey: vector<u8>,
        source_chain_id: u16,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        nonce: u64,
        // NFT metadata fields
        metadata_name: vector<u8>,
        metadata_description: vector<u8>,
        metadata_uri: vector<u8>,
        walrus_metadata_blob_id: vector<u8>,
        walrus_image_blob_id: vector<u8>,
        collection_name: vector<u8>,
        ctx: &mut TxContext,
    ): vector<u8> {
        assert!(!admin::is_paused(&registry.config), E_PROTOCOL_PAUSED);

        // Step 1: Parse and verify Wormhole VAA
        // NOTE: parse_vaa_stub is a placeholder. Replace with real Wormhole verification.
        let (emitter_chain, emitter_addr, vaa_hash) = parse_vaa_stub(&vaa_bytes);

        // Step 2: Verify emitter is our registered deposit contract
        assert!(
            emitters::is_trusted_emitter(&registry.emitters, emitter_chain, &emitter_addr),
            E_UNTRUSTED_EMITTER
        );

        // Step 3: Anti-replay - mark VAA as consumed
        assert!(
            emitters::mark_vaa_consumed(&mut registry.emitters, vaa_hash),
            E_VAA_ALREADY_CONSUMED
        );

        // Step 4: Compute canonical seal hash (§6.1)
        let seal_hash = compute_seal_hash(
            source_chain_id, source_contract, token_id, &attestation_pubkey, nonce,
        );

        assert!(!table::contains(&registry.seals, seal_hash), E_SEAL_ALREADY_EXISTS);

        // Step 5: PERMANENTLY lock DWalletCap IDs in SealVault
        // The dWallet(s) can never sign again after this.
        seal_vault::seal(vault, dwallet_id, dwallet_cap_id, attestation_dwallet_id,
            attestation_dwallet_cap_id, seal_hash, ctx);

        // Step 6: Store seal record
        let sealer = tx_context::sender(ctx);
        let ts = tx_context::epoch(ctx);

        table::add(&mut registry.seals, seal_hash, SealRecord {
            seal_hash,
            source_chain_id,
            source_contract,
            token_id,
            dwallet_id: object::id_to_bytes(&dwallet_id),
            dwallet_pubkey,
            attestation_dwallet_id: object::id_to_bytes(&attestation_dwallet_id),
            attestation_pubkey,
            sealer,
            sealed_at: ts,
            reborn: false,
            solana_mint_address: vector[],
            nonce,
            metadata_name,
            metadata_description,
            metadata_uri,
            walrus_metadata_blob_id,
            walrus_image_blob_id,
            collection_name,
        });

        // Step 7: Update collection counter
        if (table::contains(&registry.collections, source_contract)) {
            table::borrow_mut(&mut registry.collections, source_contract).current_seals =
                table::borrow(&registry.collections, source_contract).current_seals + 1;
        };

        emit(NFTSealed {
            seal_hash,
            source_chain_id,
            source_contract,
            token_id,
            dwallet_pubkey,
            attestation_pubkey,
            sealer,
            vaa_hash,
            timestamp: ts,
            metadata_name,
            walrus_metadata_blob_id,
        });

        seal_hash
    }

    /// Seal a Sui-native NFT without Wormhole VAA.
    /// Ownership is proven by possessing the NFT object in the same transaction.
    /// The caller is responsible for transferring the NFT to the dWallet's Sui address
    /// in the same PTB (Programmable Transaction Block).
    public fun register_seal_native<T: key + store>(
        registry: &mut SealRegistry,
        vault: &mut SealVault,
        // The NFT object - transferred to the dWallet's Sui address as proof of ownership.
        nft: T,
        dwallet_id: ID,
        dwallet_cap_id: ID,
        attestation_dwallet_id: ID,
        attestation_dwallet_cap_id: ID,
        dwallet_pubkey: vector<u8>,
        attestation_pubkey: vector<u8>,
        // The Sui address of the dWallet (derived from dwallet_pubkey).
        // The NFT is transferred here, permanently locking it.
        dwallet_sui_address: address,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        nonce: u64,
        // NFT metadata fields
        metadata_name: vector<u8>,
        metadata_description: vector<u8>,
        metadata_uri: vector<u8>,
        walrus_metadata_blob_id: vector<u8>,
        walrus_image_blob_id: vector<u8>,
        collection_name: vector<u8>,
        ctx: &mut TxContext,
    ): vector<u8> {
        assert!(!admin::is_paused(&registry.config), E_PROTOCOL_PAUSED);

        let source_chain_id = CHAIN_SUI;
        let seal_hash = compute_seal_hash(
            source_chain_id, source_contract, token_id, &attestation_pubkey, nonce,
        );
        assert!(!table::contains(&registry.seals, seal_hash), E_SEAL_ALREADY_EXISTS);

        // Transfer the NFT permanently to the dWallet's Sui address.
        // The dWallet cap is sealed next, so the dWallet can never sign it out.
        transfer::public_transfer(nft, dwallet_sui_address);

        seal_vault::seal(vault, dwallet_id, dwallet_cap_id, attestation_dwallet_id,
            attestation_dwallet_cap_id, seal_hash, ctx);

        let sealer = tx_context::sender(ctx);
        let ts = tx_context::epoch(ctx);

        table::add(&mut registry.seals, seal_hash, SealRecord {
            seal_hash,
            source_chain_id,
            source_contract,
            token_id,
            dwallet_id: object::id_to_bytes(&dwallet_id),
            dwallet_pubkey,
            attestation_dwallet_id: object::id_to_bytes(&attestation_dwallet_id),
            attestation_pubkey,
            sealer,
            sealed_at: ts,
            reborn: false,
            solana_mint_address: vector[],
            nonce,
            metadata_name,
            metadata_description,
            metadata_uri,
            walrus_metadata_blob_id,
            walrus_image_blob_id,
            collection_name,
        });

        if (table::contains(&registry.collections, source_contract)) {
            table::borrow_mut(&mut registry.collections, source_contract).current_seals =
                table::borrow(&registry.collections, source_contract).current_seals + 1;
        };

        emit(NFTSealed {
            seal_hash,
            source_chain_id,
            source_contract,
            token_id,
            dwallet_pubkey,
            attestation_pubkey,
            sealer,
            vaa_hash: vector[],
            timestamp: ts,
            metadata_name,
            walrus_metadata_blob_id,
        });

        seal_hash
    }

    // ==================================================================
    // Mark Reborn - PERMISSIONLESS
    // Anyone can call this. No auth required.
    // Enforces: seal must exist + not already reborn.
    // ==================================================================

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

        emit(NFTReborn {
            seal_hash,
            solana_mint_address,
            caller: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================================================================
    // View Functions
    // ==================================================================

    public fun get_seal(registry: &SealRegistry, seal_hash: vector<u8>): &SealRecord {
        assert!(table::contains(&registry.seals, seal_hash), E_SEAL_NOT_FOUND);
        table::borrow(&registry.seals, seal_hash)
    }

    public fun seal_exists(registry: &SealRegistry, seal_hash: vector<u8>): bool {
        table::contains(&registry.seals, seal_hash)
    }

    public fun is_reborn(registry: &SealRegistry, seal_hash: vector<u8>): bool {
        if (!table::contains(&registry.seals, seal_hash)) return false;
        table::borrow(&registry.seals, seal_hash).reborn
    }

    public fun total_seals(registry: &SealRegistry): u64 {
        table::length(&registry.seals)
    }

    public fun total_collections(registry: &SealRegistry): u64 {
        table::length(&registry.collections)
    }

    public fun get_collection(registry: &SealRegistry, id: vector<u8>): &CollectionConfig {
        assert!(table::contains(&registry.collections, id), E_COLLECTION_NOT_REGISTERED);
        table::borrow(&registry.collections, id)
    }

    public fun collection_active(registry: &SealRegistry, id: vector<u8>): bool {
        if (!table::contains(&registry.collections, id)) return false;
        table::borrow(&registry.collections, id).active
    }

    // SealRecord accessors
    public fun seal_record_hash(r: &SealRecord): vector<u8>        { r.seal_hash }
    public fun seal_record_chain(r: &SealRecord): u16              { r.source_chain_id }
    public fun seal_record_contract(r: &SealRecord): vector<u8>    { r.source_contract }
    public fun seal_record_token(r: &SealRecord): vector<u8>       { r.token_id }
    public fun seal_record_attest_pubkey(r: &SealRecord): vector<u8> { r.attestation_pubkey }
    public fun seal_record_solana_mint(r: &SealRecord): vector<u8> { r.solana_mint_address }
    public fun seal_record_reborn(r: &SealRecord): bool            { r.reborn }
    public fun seal_record_sealer(r: &SealRecord): address         { r.sealer }
    public fun seal_record_metadata_name(r: &SealRecord): vector<u8> { r.metadata_name }
    public fun seal_record_metadata_uri(r: &SealRecord): vector<u8> { r.metadata_uri }
    public fun seal_record_walrus_metadata(r: &SealRecord): vector<u8> { r.walrus_metadata_blob_id }
    public fun seal_record_walrus_image(r: &SealRecord): vector<u8> { r.walrus_image_blob_id }
    public fun seal_record_collection_name(r: &SealRecord): vector<u8> { r.collection_name }

    // CollectionConfig accessors
    public fun collection_config_chain(c: &CollectionConfig): u16    { c.source_chain_id }
    public fun collection_config_seal_fee(c: &CollectionConfig): u64 { c.seal_fee }
    public fun collection_config_max_seals(c: &CollectionConfig): u64 { c.max_seals }
    public fun collection_config_current_seals(c: &CollectionConfig): u64 { c.current_seals }
    public fun collection_config_is_active(c: &CollectionConfig): bool { c.active }

    // Registry config accessors (delegate to admin module)
    public fun is_paused(registry: &SealRegistry): bool {
        admin::is_paused(&registry.config)
    }

    public fun registry_version(registry: &SealRegistry): u64 {
        admin::version(&registry.config)
    }

    public fun registry_guild_treasury(registry: &SealRegistry): address {
        admin::guild_treasury(&registry.config)
    }

    public fun registry_team_treasury(registry: &SealRegistry): address {
        admin::team_treasury(&registry.config)
    }

    public fun registry_guild_share_bps(registry: &SealRegistry): u16 {
        admin::guild_share_bps(&registry.config)
    }

    public fun registry_team_share_bps(registry: &SealRegistry): u16 {
        admin::team_share_bps(&registry.config)
    }

    // Emitter registry accessors
    public fun emitter_count(registry: &SealRegistry): u64 {
        emitters::emitter_count(&registry.emitters)
    }

    public fun consumed_vaa_count(registry: &SealRegistry): u64 {
        emitters::consumed_vaa_count(&registry.emitters)
    }

    public fun is_trusted_emitter(registry: &SealRegistry, chain_id: u16, emitter_address: &vector<u8>): bool {
        emitters::is_trusted_emitter(&registry.emitters, chain_id, emitter_address)
    }

    public fun is_vaa_consumed(registry: &SealRegistry, vaa_hash: vector<u8>): bool {
        emitters::is_vaa_consumed(&registry.emitters, vaa_hash)
    }

    /// Mark VAA consumed - exposed for testing
    public fun mark_vaa_consumed(registry: &mut SealRegistry, vaa_hash: vector<u8>): bool {
        emitters::mark_vaa_consumed(&mut registry.emitters, vaa_hash)
    }

    // ==================================================================
    // Internal Helpers
    // ==================================================================

    /// Canonical seal hash per PRD §6.1
    /// Layout: [2 src_chain][2 dst_chain=3][1 contract_len][N contract]
    ///         [1 token_len][M token][32 attest_pubkey][8 nonce_BE]
    /// Hashed with SHA2-256.
    fun compute_seal_hash(
        source_chain_id: u16,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        attestation_pubkey: &vector<u8>,
        nonce: u64,
    ): vector<u8> {
        let mut data = vector[];
        // source chain (2 bytes BE)
        vector::push_back(&mut data, ((source_chain_id >> 8) & 0xFF) as u8);
        vector::push_back(&mut data, (source_chain_id & 0xFF) as u8);
        // dest chain = 3 = Solana (2 bytes BE)
        vector::push_back(&mut data, 0u8);
        vector::push_back(&mut data, 3u8);
        // source contract
        vector::push_back(&mut data, vector::length(&source_contract) as u8);
        vector::append(&mut data, source_contract);
        // token id
        vector::push_back(&mut data, vector::length(&token_id) as u8);
        vector::append(&mut data, token_id);
        // attestation pubkey (32 bytes Ed25519)
        vector::append(&mut data, *attestation_pubkey);
        // nonce (8 bytes BE) - serialize manually
        vector::push_back(&mut data, ((nonce >> 56) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 48) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 40) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 32) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 24) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 16) & 0xFF) as u8);
        vector::push_back(&mut data, ((nonce >> 8) & 0xFF) as u8);
        vector::push_back(&mut data, (nonce & 0xFF) as u8);
        std::hash::sha2_256(data)
    }

    /// Stub VAA parser. Returns (emitter_chain, emitter_address, vaa_hash).
    /// Replace with Wormhole integration for production - see comments above register_seal_with_vaa.
    fun parse_vaa_stub(vaa: &vector<u8>): (u16, vector<u8>, vector<u8>) {
        // TODO: Replace with real Wormhole verification for production.
        // Stub returns: Wormhole chain 21 (Sui), empty emitter, SHA2-256(vaa) as hash.
        // This allows demo/testing without Wormhole dependency.
        (21u16, vector[], std::hash::sha2_256(*vaa))
    }

    fun is_supported_chain(chain_id: u16): bool {
        chain_id == CHAIN_ETHEREUM
            || chain_id == CHAIN_SUI
            || chain_id == CHAIN_SOLANA
            || chain_id == CHAIN_NEAR
    }
}
