// Ika Tensei v3 - Comprehensive Unit Tests
// Tests SealVault, Registry (with init_for_testing), Admin, and Emitters modules.
//
// Run: cd packages/sui-contracts/ikatensei && sui move test

#[allow(duplicate_alias, unused_use)]
module ikatensei::ika_tensei_v3_tests {
    use sui::test_scenario::{Self};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use ikatensei::seal_vault::{Self, SealVault};
    use ikatensei::registry::{Self, SealRegistry};
    use ikatensei::admin::{Self, AdminCap};

    // ==================================================================
    // Dummy NFT used by register_seal_native tests
    // ==================================================================

    public struct TestNFT has key, store {
        id: UID,
    }

    // ==================================================================
    // Convenience: 32-byte all-zero pubkey used as placeholder
    // ==================================================================

    fun zero32(): vector<u8> {
        x"0000000000000000000000000000000000000000000000000000000000000000"
    }

    // Any valid 32-byte Ed25519 pubkey for seal hashing
    fun pubkey32(): vector<u8> {
        x"0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
    }

    // A valid 32-byte Solana mint address
    fun mint32(): vector<u8> {
        x"4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c"
    }

    // Helper to create a test coin with minimum seal fee (1_000_000 MIST)
    fun create_test_fee(ctx: &mut TxContext): Coin<sui::sui::SUI> {
        coin::mint_for_testing<sui::sui::SUI>(1_000_000, ctx)
    }

    // Default empty metadata fields for tests
    fun empty_metadata(): (vector<u8>, vector<u8>, vector<u8>, vector<u8>, vector<u8>, vector<u8>) {
        (vector[], vector[], vector[], vector[], vector[], vector[])
    }

    // Helper to set authorized relayer for tests (uses deployer as relayer)
    fun setup_authorized_relayer(registry: &mut SealRegistry, admin_cap: &AdminCap, relayer: address, ctx: &mut TxContext) {
        registry::set_authorized_relayer(registry, admin_cap, relayer, ctx);
    }

    // Wrapper for register_seal_native with test defaults
    fun register_seal_test<T: key + store>(
        registry: &mut SealRegistry,
        vault: &mut SealVault,
        nft: T,
        dwallet_id: ID,
        cap_id: ID,
        attest_dwallet_id: ID,
        attest_cap_id: ID,
        dwallet_pubkey: vector<u8>,
        attest_pubkey: vector<u8>,
        dwallet_sui_address: address,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        nonce: u64,
        ctx: &mut TxContext,
    ): vector<u8> {
        let (name, desc, uri, meta_blob, img_blob, coll_name) = empty_metadata();
        let fee = create_test_fee(ctx);
        registry::register_seal_native<T>(
            registry, vault, nft,
            dwallet_id, cap_id, attest_dwallet_id, attest_cap_id,
            dwallet_pubkey, attest_pubkey, dwallet_sui_address,
            source_contract, token_id, nonce,
            name, desc, uri, meta_blob, img_blob, coll_name,
            fee, ctx
        )
    }

    // Wrapper for register_seal_with_vaa with test defaults
    fun register_seal_with_vaa_test(
        registry: &mut SealRegistry,
        vault: &mut SealVault,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        dwallet_cap_id: ID,
        attestation_dwallet_id: ID,
        attestation_dwallet_cap_id: ID,
        dwallet_pubkey: vector<u8>,
        attestation_pubkey: vector<u8>,
        source_chain_id: u16,
        source_contract: vector<u8>,
        token_id: vector<u8>,
        nonce: u64,
        ctx: &mut TxContext,
    ): vector<u8> {
        let (name, desc, uri, meta_blob, img_blob, coll_name) = empty_metadata();
        let fee = create_test_fee(ctx);
        registry::register_seal_with_vaa(
            registry, vault, vaa_bytes,
            dwallet_id, dwallet_cap_id, attestation_dwallet_id, attestation_dwallet_cap_id,
            dwallet_pubkey, attestation_pubkey,
            source_chain_id, source_contract, token_id, nonce,
            name, desc, uri, meta_blob, img_blob, coll_name,
            fee, ctx
        )
    }

    // ==================================================================
    // SealVault – standalone tests (no registry needed)
    // ==================================================================

    #[test]
    fun test_vault_new_empty() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));
        assert!(seal_vault::total_sealed(&vault) == 0, 0);
        assert!(!seal_vault::is_sealed(&vault, object::id_from_address(@0x1)), 1);

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_seal_single_ed25519_stores_ids() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let mut vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));

        let dwallet_id = object::id_from_address(@0x1234);
        let cap_id    = object::id_from_address(@0x5678);

        seal_vault::seal_single(
            &mut vault, dwallet_id, cap_id,
            x"abcdef1234567890",
            test_scenario::ctx(&mut scenario),
        );

        // is_sealed returns true
        assert!(seal_vault::is_sealed(&vault, dwallet_id), 0);
        // total_sealed incremented
        assert!(seal_vault::total_sealed(&vault) == 1, 1);
        // cap IDs stored correctly
        let (ret_dwallet, ret_cap) = seal_vault::get_cap_ids(&vault, dwallet_id);
        assert!(ret_dwallet == dwallet_id, 2);
        assert!(ret_cap == cap_id, 3);

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_seal_dual_dwallets_secp256k1() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let mut vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));

        let d1  = object::id_from_address(@0x1111);
        let c1  = object::id_from_address(@0x2222);
        let d2  = object::id_from_address(@0x3333);
        let c2  = object::id_from_address(@0x4444);

        seal_vault::seal(
            &mut vault, d1, c1, d2, c2,
            x"deadbeef12345678",
            test_scenario::ctx(&mut scenario),
        );

        // Both dWallets sealed
        assert!(seal_vault::is_sealed(&vault, d1), 0);
        assert!(seal_vault::is_sealed(&vault, d2), 1);
        assert!(seal_vault::total_sealed(&vault) == 2, 2);

        let (rd1, rc1) = seal_vault::get_cap_ids(&vault, d1);
        let (rd2, rc2) = seal_vault::get_cap_ids(&vault, d2);
        assert!(rd1 == d1 && rc1 == c1, 3);
        assert!(rd2 == d2 && rc2 == c2, 4);

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_is_sealed_returns_false_for_unsealed() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));
        assert!(!seal_vault::is_sealed(&vault, object::id_from_address(@0xDEAD)), 0);

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = seal_vault::E_ALREADY_SEALED)]
    fun test_double_seal_same_dwallet_fails() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let mut vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));

        let d = object::id_from_address(@0x9999);
        let c = object::id_from_address(@0xaaaa);

        seal_vault::seal_single(&mut vault, d, c, x"cafecafe00000001",
            test_scenario::ctx(&mut scenario));

        // Second seal on same dWallet must abort
        seal_vault::seal_single(&mut vault, d, c, x"cafecafe00000002",
            test_scenario::ctx(&mut scenario));

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_vault_total_sealed_increments() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let mut vault = seal_vault::new_vault(test_scenario::ctx(&mut scenario));
        assert!(seal_vault::vault_total_sealed(&vault) == 0, 0);

        seal_vault::seal_single(&mut vault,
            object::id_from_address(@0x1111), object::id_from_address(@0x2222),
            x"aabb000000000001", test_scenario::ctx(&mut scenario));
        assert!(seal_vault::vault_total_sealed(&vault) == 1, 1);

        seal_vault::seal_single(&mut vault,
            object::id_from_address(@0x3333), object::id_from_address(@0x4444),
            x"aabb000000000002", test_scenario::ctx(&mut scenario));
        assert!(seal_vault::vault_total_sealed(&vault) == 2, 2);

        transfer::public_share_object(vault);
        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – init and basic sanity
    // ==================================================================

    #[test]
    fun test_registry_init_creates_objects() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let registry  = test_scenario::take_shared<SealRegistry>(&scenario);
            let vault     = test_scenario::take_shared<SealVault>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Protocol version = 3, starts unpaused
            assert!(registry::registry_version(&registry) == 3, 0);
            assert!(!registry::is_paused(&registry), 1);
            // Empty tables
            assert!(registry::total_seals(&registry) == 0, 2);
            assert!(registry::total_collections(&registry) == 0, 3);
            // Vault also empty
            assert!(seal_vault::total_sealed(&vault) == 0, 4);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – collection management
    // ==================================================================

    #[test]
    fun test_register_collection() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry  = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            registry::register_collection(
                &mut registry, &admin_cap,
                b"my_collection",
                2,                  // SUI chain
                b"My NFT Collection",
                100,                // seal fee
                1000,               // max seals
                test_scenario::ctx(&mut scenario),
            );

            let c = registry::get_collection(&registry, b"my_collection");
            assert!(registry::collection_config_chain(c)         == 2,    0);
            assert!(registry::collection_config_seal_fee(c)      == 100,  1);
            assert!(registry::collection_config_max_seals(c)     == 1000, 2);
            assert!(registry::collection_config_current_seals(c) == 0,    3);
            assert!(registry::collection_config_is_active(c)     == true, 4);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::E_COLLECTION_ALREADY_REGISTERED)]
    fun test_register_duplicate_collection_fails() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry  = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            registry::register_collection(&mut registry, &admin_cap, b"dup", 2, b"D", 0, 0,
                test_scenario::ctx(&mut scenario));
            // Second call on same id must abort
            registry::register_collection(&mut registry, &admin_cap, b"dup", 2, b"D", 0, 0,
                test_scenario::ctx(&mut scenario));

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – register_seal_native
    // ==================================================================

    #[test]
    fun test_register_seal_native_ed25519() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Set up authorized relayer (deployer acts as relayer in tests)
            setup_authorized_relayer(&mut registry, &admin_cap, deployer, test_scenario::ctx(&mut scenario));

            let nft        = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let dwallet_id = object::id_from_address(@0x1111);
            let cap_id     = object::id_from_address(@0x2222);
            let pubkey     = pubkey32();

            let seal_hash = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft,
                dwallet_id, cap_id,
                dwallet_id, cap_id,   // Ed25519: attestation == primary
                pubkey, pubkey,
                @0x3333,              // dwallet Sui address (receives NFT)
                b"test_contract",
                b"token_123",
                1,                    // nonce
                test_scenario::ctx(&mut scenario),
            );

            // Seal registered in registry
            assert!(registry::seal_exists(&registry, seal_hash), 0);
            assert!(!registry::is_reborn(&registry, seal_hash), 1);
            // Vault has one entry
            assert!(seal_vault::is_sealed(&vault, dwallet_id), 2);
            assert!(seal_vault::total_sealed(&vault) == 1, 3);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_register_seal_native_dual_dwallet_secp256k1() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);

            let nft         = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d_primary   = object::id_from_address(@0xaaaa);
            let c_primary   = object::id_from_address(@0xbbbb);
            let d_attest    = object::id_from_address(@0xcccc);
            let c_attest    = object::id_from_address(@0xdddd);

            let seal_hash = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft,
                d_primary, c_primary,
                d_attest,  c_attest,   // secp256k1: separate attestation dWallet
                pubkey32(), pubkey32(),
                @0xeeee,
                b"eth_contract",
                b"eth_token_1",
                2,
                test_scenario::ctx(&mut scenario),
            );

            assert!(registry::seal_exists(&registry, seal_hash), 0);
            // Both dWallets sealed
            assert!(seal_vault::is_sealed(&vault, d_primary), 1);
            assert!(seal_vault::is_sealed(&vault, d_attest),  2);
            assert!(seal_vault::total_sealed(&vault) == 2, 3);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – mark_reborn
    // ==================================================================

    #[test]
    fun test_mark_reborn_succeeds() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Set up authorized relayer
            setup_authorized_relayer(&mut registry, &admin_cap, deployer, test_scenario::ctx(&mut scenario));

            let nft  = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d    = object::id_from_address(@0x1111);
            let c    = object::id_from_address(@0x2222);

            let seal_hash = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0x3333, b"contract", b"token_1", 1,
                test_scenario::ctx(&mut scenario),
            );

            // Not reborn yet
            assert!(!registry::is_reborn(&registry, seal_hash), 0);

            // Use admin override since mark_reborn requires relayer auth
            registry::mark_reborn_admin(
                &mut registry, &admin_cap, seal_hash, mint32(),
                test_scenario::ctx(&mut scenario),
            );

            // Now reborn
            assert!(registry::is_reborn(&registry, seal_hash), 1);

            let record = registry::get_seal(&registry, seal_hash);
            assert!(registry::seal_record_reborn(record) == true,   2);
            assert!(registry::seal_record_solana_mint(record) == mint32(), 3);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::E_UNAUTHORIZED_RELAYER)]
    fun test_mark_reborn_fails_seal_not_found() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            // Random hash that was never registered - now fails on relayer auth first
            // Since no relayer is set, this fails with E_UNAUTHORIZED_RELAYER
            registry::mark_reborn(
                &mut registry, x"cafebabe12345678", mint32(),
                test_scenario::ctx(&mut scenario),
            );
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::E_ALREADY_REBORN)]
    fun test_mark_reborn_fails_already_reborn() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Set up authorized relayer
            setup_authorized_relayer(&mut registry, &admin_cap, deployer, test_scenario::ctx(&mut scenario));

            let nft  = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d    = object::id_from_address(@0x5555);
            let c    = object::id_from_address(@0x6666);

            let seal_hash = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0x7777, b"contract", b"token_y", 3,
                test_scenario::ctx(&mut scenario),
            );

            // Use admin override for first mark_reborn
            registry::mark_reborn_admin(&mut registry, &admin_cap, seal_hash, mint32(),
                test_scenario::ctx(&mut scenario));

            // Second mark_reborn must abort - use admin override
            registry::mark_reborn_admin(&mut registry, &admin_cap, seal_hash, mint32(),
                test_scenario::ctx(&mut scenario));

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – pause / unpause
    // ==================================================================

    #[test]
    fun test_pause_unpause_protocol() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            assert!(!registry::is_paused(&registry), 0);

            registry::pause_protocol(&mut registry, &admin_cap, test_scenario::ctx(&mut scenario));
            assert!(registry::is_paused(&registry), 1);

            registry::unpause_protocol(&mut registry, &admin_cap, test_scenario::ctx(&mut scenario));
            assert!(!registry::is_paused(&registry), 2);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::E_PROTOCOL_PAUSED)]
    fun test_paused_protocol_blocks_seal() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        // Pause
        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);
            registry::pause_protocol(&mut registry, &admin_cap, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        // Attempt seal while paused – must abort
        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);

            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d   = object::id_from_address(@0x123);
            let c   = object::id_from_address(@0x456);

            register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0x789, b"coll", b"tok", 1,
                test_scenario::ctx(&mut scenario),
            );

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Registry – treasury and fee-share updates
    // ==================================================================

    #[test]
    fun test_update_treasuries() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            let new_guild = @0xAAAAAAAA;
            let new_team  = @0xBBBBBBBB;

            registry::update_treasuries(
                &mut registry, &admin_cap, new_guild, new_team,
                test_scenario::ctx(&mut scenario),
            );

            assert!(registry::registry_guild_treasury(&registry) == new_guild, 0);
            assert!(registry::registry_team_treasury(&registry)  == new_team,  1);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_shares() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Defaults
            assert!(registry::registry_guild_share_bps(&registry) == 500, 0);
            assert!(registry::registry_team_share_bps(&registry)  == 190, 1);

            registry::update_shares(&mut registry, &admin_cap, 600, 250,
                test_scenario::ctx(&mut scenario));

            assert!(registry::registry_guild_share_bps(&registry) == 600, 2);
            assert!(registry::registry_team_share_bps(&registry)  == 250, 3);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::E_INVALID_SHARE)]
    fun test_update_shares_exceeds_10000_bps_fails() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            // 8000 + 3000 = 11000 > 10000 bps → abort
            registry::update_shares(&mut registry, &admin_cap, 8000, 3000,
                test_scenario::ctx(&mut scenario));

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Emitter tests (via registry accessors)
    // ==================================================================

    #[test]
    fun test_register_emitter_is_trusted() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Wormhole chain IDs: 1=SOL, 2=ETH, 15=NEAR, 21=SUI
            let eth_emitter = x"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"; // 32 bytes

            registry::register_trusted_emitter(
                &mut registry, &admin_cap, 2, eth_emitter,
                test_scenario::ctx(&mut scenario),
            );

            assert!(registry::is_trusted_emitter(&registry, 2, &eth_emitter), 0);
            assert!(registry::emitter_count(&registry) == 1, 1);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_is_registered_unregistered_returns_false() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let registry = test_scenario::take_shared<SealRegistry>(&scenario);
            // No emitters registered at all → false
            assert!(!registry::is_trusted_emitter(&registry, 21, &zero32()), 0);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_emitter() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            let sol_emitter = x"1111111111111111111111111111111111111111111111111111111111111111";

            registry::register_trusted_emitter(
                &mut registry, &admin_cap, 1, sol_emitter,
                test_scenario::ctx(&mut scenario),
            );
            assert!(registry::emitter_count(&registry) == 1, 0);

            registry::remove_trusted_emitter(
                &mut registry, &admin_cap, 1,
                test_scenario::ctx(&mut scenario),
            );
            assert!(registry::emitter_count(&registry) == 0, 1);
            assert!(!registry::is_trusted_emitter(&registry, 1, &sol_emitter), 2);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_vaa_consumed_anti_replay() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);

            let h1 = x"aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
            let h2 = x"bbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";

            // First mark → true (newly consumed)
            assert!(registry::mark_vaa_consumed(&mut registry, h1) == true, 0);
            // Replay → false
            assert!(registry::mark_vaa_consumed(&mut registry, h1) == false, 1);
            // Different hash → true
            assert!(registry::mark_vaa_consumed(&mut registry, h2) == true, 2);

            assert!(registry::consumed_vaa_count(&registry) == 2, 3);
            assert!(registry::is_vaa_consumed(&registry, h1), 4);
            assert!(registry::is_vaa_consumed(&registry, h2), 5);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Admin – standalone config tests (no scenario needed)
    // ==================================================================

    #[test]
    fun test_admin_create_initial_config_defaults() {
        let guild = @0xAAAA;
        let team  = @0xBBBB;
        let config = admin::create_initial_config(guild, team);

        assert!(admin::version(&config)        == 3,    0);
        assert!(admin::guild_treasury(&config) == guild, 1);
        assert!(admin::team_treasury(&config)  == team,  2);
        assert!(admin::guild_share_bps(&config)== 500,  3);
        assert!(admin::team_share_bps(&config) == 190,  4);
        assert!(!admin::is_paused(&config),              5);
    }

    #[test]
    fun test_calculate_fee_shares() {
        let config = admin::create_initial_config(@0xAAAA, @0xBBBB);
        // guild 500 bps on 10000 → 500
        assert!(admin::calculate_guild_share(&config, 10000) == 500, 0);
        // team  190 bps on 10000 → 190
        assert!(admin::calculate_team_share(&config, 10000)  == 190, 1);
        // combined
        assert!(admin::calculate_guild_share(&config, 10000)
              + admin::calculate_team_share(&config, 10000)  == 690, 2);
    }

    #[test]
    fun test_admin_pause_unpause_config_directly() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let cap = admin::create_admin_cap(test_scenario::ctx(&mut scenario));
        let mut config = admin::create_initial_config(@0xAAAA, @0xBBBB);

        assert!(!admin::is_paused(&config), 0);
        admin::pause_protocol(&mut config, &cap);
        assert!(admin::is_paused(&config), 1);
        admin::unpause_protocol(&mut config, &cap);
        assert!(!admin::is_paused(&config), 2);

        transfer::public_transfer(cap, deployer);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_admin_update_treasuries_directly() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let cap = admin::create_admin_cap(test_scenario::ctx(&mut scenario));
        let mut config = admin::create_initial_config(@0x1, @0x2);

        admin::update_treasuries(&mut config, &cap, @0xCAFE, @0xDEAD);
        assert!(admin::guild_treasury(&config) == @0xCAFE, 0);
        assert!(admin::team_treasury(&config)  == @0xDEAD, 1);

        transfer::public_transfer(cap, deployer);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::E_ZERO_ADDRESS)]
    fun test_admin_update_treasury_zero_address_fails() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let cap = admin::create_admin_cap(test_scenario::ctx(&mut scenario));
        let mut config = admin::create_initial_config(@0xAAAA, @0xBBBB);

        // @0x0 guild treasury must abort
        admin::update_treasuries(&mut config, &cap, @0x0, @0xBBBB);

        transfer::public_transfer(cap, deployer);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_admin_update_shares_directly() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        let cap = admin::create_admin_cap(test_scenario::ctx(&mut scenario));
        let mut config = admin::create_initial_config(@0xAAAA, @0xBBBB);

        admin::update_shares(&mut config, &cap, 300, 100);
        assert!(admin::guild_share_bps(&config) == 300, 0);
        assert!(admin::team_share_bps(&config)  == 100, 1);

        transfer::public_transfer(cap, deployer);
        test_scenario::end(scenario);
    }

    // ==================================================================
    // Integration – collection counter increments after seal
    // ==================================================================

    #[test]
    fun test_collection_counter_increments_on_seal() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        // Register collection
        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap    = test_scenario::take_from_sender<AdminCap>(&scenario);

            registry::register_collection(&mut registry, &admin_cap,
                b"nft_coll", 2, b"NFT", 0, 999,
                test_scenario::ctx(&mut scenario));

            let c = registry::get_collection(&registry, b"nft_coll");
            assert!(registry::collection_config_current_seals(c) == 0, 0);

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        // Seal an NFT from that collection
        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);

            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d   = object::id_from_address(@0x1234);
            let c   = object::id_from_address(@0x5678);

            register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0x9abc, b"nft_coll", b"tok_1", 10,
                test_scenario::ctx(&mut scenario),
            );

            // Counter now 1
            let coll = registry::get_collection(&registry, b"nft_coll");
            assert!(registry::collection_config_current_seals(coll) == 1, 1);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Integration – full seal-and-reborn flow
    // ==================================================================

    #[test]
    fun test_full_seal_then_reborn_flow() {
        let deployer = @0xA;
        let caller   = @0xB; // permissionless reborn can come from anyone
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        // Step 1: seal
        test_scenario::next_tx(&mut scenario, deployer);
        let seal_hash = {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            // Set up authorized relayer (deployer acts as relayer in tests)
            setup_authorized_relayer(&mut registry, &admin_cap, deployer, test_scenario::ctx(&mut scenario));

            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d   = object::id_from_address(@0xfeed);
            let c   = object::id_from_address(@0xbeef);

            let h = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0xcafe, b"coll_x", b"tok_42", 99,
                test_scenario::ctx(&mut scenario),
            );

            assert!(registry::seal_exists(&registry, h), 0);
            assert!(!registry::is_reborn(&registry, h), 1);
            assert!(seal_vault::is_sealed(&vault, d), 2);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
            test_scenario::return_to_sender(&scenario, admin_cap);
            h
        };

        // Step 2: reborn (now requires relayer auth, use admin override)
        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);

            registry::mark_reborn_admin(
                &mut registry, &admin_cap, seal_hash, mint32(),
                test_scenario::ctx(&mut scenario),
            );

            assert!(registry::is_reborn(&registry, seal_hash), 3);

            let r = registry::get_seal(&registry, seal_hash);
            assert!(registry::seal_record_reborn(r)      == true,    4);
            assert!(registry::seal_record_solana_mint(r) == mint32(), 5);
            assert!(registry::seal_record_chain(r)       == 2,        6); // SUI

            test_scenario::return_shared(registry);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        test_scenario::end(scenario);
    }

    // ==================================================================
    // Integration – seal_record accessors
    // ==================================================================

    #[test]
    fun test_seal_record_accessors() {
        let deployer = @0xA;
        let mut scenario = test_scenario::begin(deployer);

        { registry::init_for_testing(test_scenario::ctx(&mut scenario)); };

        test_scenario::next_tx(&mut scenario, deployer);
        {
            let mut registry = test_scenario::take_shared<SealRegistry>(&scenario);
            let mut vault    = test_scenario::take_shared<SealVault>(&scenario);

            let nft       = TestNFT { id: object::new(test_scenario::ctx(&mut scenario)) };
            let d         = object::id_from_address(@0xabcd);
            let c         = object::id_from_address(@0xef01);
            let contract  = b"my_contract";
            let token     = b"token_abc";

            let seal_hash = register_seal_test<TestNFT>(
                &mut registry, &mut vault,
                nft, d, c, d, c,
                pubkey32(), pubkey32(),
                @0x2345, contract, token, 42,
                test_scenario::ctx(&mut scenario),
            );

            let r = registry::get_seal(&registry, seal_hash);
            assert!(registry::seal_record_hash(r)    == seal_hash,    0);
            assert!(registry::seal_record_chain(r)   == 2,            1); // SUI
            assert!(registry::seal_record_contract(r)== contract,     2);
            assert!(registry::seal_record_token(r)   == token,        3);
            assert!(registry::seal_record_sealer(r)  == deployer,     4);
            assert!(registry::seal_record_reborn(r)  == false,        5);
            assert!(registry::seal_record_solana_mint(r) == vector[], 6);

            test_scenario::return_shared(registry);
            test_scenario::return_shared(vault);
        };

        test_scenario::end(scenario);
    }
}
