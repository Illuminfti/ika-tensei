// Ika Tensei PRD v6 - DWallet Registry
//
// Registry of valid IKA dWallet deposit addresses.
// This module tracks which dWallet addresses are authorized to receive
// sealed NFTs on behalf of users.
//
// The registry validates that a dWallet address is registered before
// the orchestrator signs a seal message. This prevents invalid deposits
// from being processed.
//
// Admin controls:
//   - Initial setup by deployer
//   - Can be transferred to DAO later (upgrade path)
module ikatensei::dwallet_registry {
    use sui::table::{Self, Table};
    use sui::event::emit;
    use sui::object::UID;
    use sui::tx_context::TxContext;
    use std::vector;
    use std::bcs;

    // Error codes
    const E_NOT_REGISTERED: u64 = 1;
    const E_ALREADY_REGISTERED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_ZERO_ADDRESS: u64 = 4;

    /// Event emitted when a dWallet is registered
    public struct DWalletRegistered has copy, drop {
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        owner: address,
        timestamp: u64,
    }

    /// Event emitted when a dWallet is unregistered
    public struct DWalletUnregistered has copy, drop {
        deposit_address: vector<u8>,
        timestamp: u64,
    }

    /// Event emitted when ownership is transferred
    public struct OwnershipTransferred has copy, drop {
        old_owner: address,
        new_owner: address,
        timestamp: u64,
    }

    /// DWallet record - stores registration info
    public struct DWalletRecord has store, copy, drop {
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        owner: address,
        registered_at: u64,
        active: bool,
    }

    /// Admin capability - controls registry ownership
    public struct RegistryOwnerCap has key, store {
        id: UID,
    }

    /// Main registry - shared object
    /// Maps deposit_address (bytes) -> DWalletRecord
    public struct DWalletRegistry has key {
        id: UID,
        owner: address,
        /// Maps deposit_address (32 bytes) -> DWalletRecord
        wallets: Table<vector<u8>, DWalletRecord>,
        /// Maps dwallet_id (bytes) -> deposit_address (for fast lookup)
        dwallet_ids: Table<vector<u8>, vector<u8>>,
        total_registered: u64,
    }

    /// Initialize the registry with the deployer as owner
    fun init(ctx: &mut TxContext) {
        let owner = sui::tx_context::sender(ctx);
        
        let cap = RegistryOwnerCap {
            id: object::new(ctx),
        };
        
        let registry = DWalletRegistry {
            id: object::new(ctx),
            owner,
            wallets: table::new(ctx),
            dwallet_ids: table::new(ctx),
            total_registered: 0,
        };
        
        // Share the registry
        sui::transfer::share_object(registry);
        
        // Transfer owner cap to deployer
        sui::transfer::public_transfer(cap, owner);
    }

    /// Register a new dWallet deposit address
    /// Only the registry owner can call this
    public fun register_dwallet(
        registry: &mut DWalletRegistry,
        _cap: &RegistryOwnerCap,
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        // Validate inputs
        assert!(vector::length(&deposit_address) == 32, E_ZERO_ADDRESS);
        assert!(vector::length(&dwallet_id) >= 1, E_ZERO_ADDRESS);
        
        // Check not already registered
        assert!(
            !table::contains(&registry.wallets, deposit_address),
            E_ALREADY_REGISTERED
        );
        
        let owner = sui::tx_context::sender(ctx);
        let timestamp = sui::tx_context::epoch(ctx);
        
        // Create record
        let record = DWalletRecord {
            deposit_address,
            dwallet_id,
            owner,
            registered_at: timestamp,
            active: true,
        };
        
        // Store in both tables
        table::add(&mut registry.wallets, deposit_address, record);
        table::add(&mut registry.dwallet_ids, dwallet_id, deposit_address);
        
        registry.total_registered = registry.total_registered + 1;
        
        emit(DWalletRegistered {
            deposit_address,
            dwallet_id,
            owner,
            timestamp,
        });
    }

    /// Batch register multiple dWallets (for initial setup)
    public fun register_dwallets_batch(
        registry: &mut DWalletRegistry,
        _cap: &RegistryOwnerCap,
        deposit_addresses: vector<vector<u8>>,
        dwallet_ids: vector<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        let len = vector::length(&deposit_addresses);
        assert!(len == vector::length(&dwallet_ids), E_ZERO_ADDRESS);
        
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&deposit_addresses, i);
            let id = *vector::borrow(&dwallet_ids, i);
            
            // Skip if already registered
            if (!table::contains(&registry.wallets, addr)) {
                register_dwallet(registry, _cap, addr, id, ctx);
            };
            
            i = i + 1;
        };
    }

    /// Unregister a dWallet (deactivate)
    /// Does NOT delete the record - maintains history
    public fun unregister_dwallet(
        registry: &mut DWalletRegistry,
        _cap: &RegistryOwnerCap,
        deposit_address: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(
            table::contains(&registry.wallets, deposit_address),
            E_NOT_REGISTERED
        );
        
        let record = table::borrow_mut(&mut registry.wallets, deposit_address);
        record.active = false;
        
        emit(DWalletUnregistered {
            deposit_address,
            timestamp: sui::tx_context::epoch(ctx),
        });
    }

    /// Transfer ownership of the registry
    public fun transfer_ownership(
        registry: &mut DWalletRegistry,
        _cap: &RegistryOwnerCap,
        new_owner: address,
        ctx: &mut TxContext,
    ) {
        let old_owner = registry.owner;
        registry.owner = new_owner;
        
        emit(OwnershipTransferred {
            old_owner,
            new_owner,
            timestamp: sui::tx_context::epoch(ctx),
        });
    }

    /// Check if a deposit address is registered and active
    public fun is_registered(registry: &DWalletRegistry, deposit_address: &vector<u8>): bool {
        if (!table::contains(&registry.wallets, *deposit_address)) {
            return false
        };
        let record = table::borrow(&registry.wallets, *deposit_address);
        record.active
    }

    /// Check if a dwallet_id is registered
    public fun is_dwallet_registered(registry: &DWalletRegistry, dwallet_id: &vector<u8>): bool {
        table::contains(&registry.dwallet_ids, *dwallet_id)
    }

    /// Get the deposit address for a dwallet_id
    public fun get_deposit_address(
        registry: &DWalletRegistry,
        dwallet_id: &vector<u8>,
    ): vector<u8> {
        assert!(
            table::contains(&registry.dwallet_ids, *dwallet_id),
            E_NOT_REGISTERED
        );
        *table::borrow(&registry.dwallet_ids, *dwallet_id)
    }

    /// Get the full record for a deposit address
    public fun get_record(
        registry: &DWalletRegistry,
        deposit_address: &vector<u8>,
    ): DWalletRecord {
        assert!(
            table::contains(&registry.wallets, *deposit_address),
            E_NOT_REGISTERED
        );
        *table::borrow(&registry.wallets, *deposit_address)
    }

    /// Get the owner of a deposit address
    public fun get_owner(registry: &DWalletRegistry, deposit_address: &vector<u8>): address {
        let record = table::borrow(&registry.wallets, *deposit_address);
        record.owner
    }

    /// Get the dwallet_id for a deposit address
    public fun get_dwallet_id(registry: &DWalletRegistry, deposit_address: &vector<u8>): vector<u8> {
        let record = table::borrow(&registry.wallets, *deposit_address);
        record.dwallet_id
    }

    /// Get total registered count
    public fun total_registered(registry: &DWalletRegistry): u64 {
        registry.total_registered
    }

    /// Get registry owner
    public fun get_owner_address(registry: &DWalletRegistry): address {
        registry.owner
    }

    /// Check if an address is the registry owner
    public fun is_owner(registry: &DWalletRegistry, addr: address): bool {
        addr == registry.owner
    }

    // Record field accessors
    public fun record_deposit_address(r: &DWalletRecord): &vector<u8> { &r.deposit_address }
    public fun record_dwallet_id(r: &DWalletRecord): &vector<u8> { &r.dwallet_id }
    public fun record_owner(r: &DWalletRecord): address { r.owner }
    public fun record_registered_at(r: &DWalletRecord): u64 { r.registered_at }
    public fun record_active(r: &DWalletRecord): bool { r.active }

    /// Helper to convert address to bytes (32 bytes, big-endian)
    /// Uses BCS serialization for address
    public fun address_to_bytes(addr: address): vector<u8> {
        // Use BCS to serialize address to bytes
        let bytes = bcs::to_bytes(&addr);
        
        // Pad to 32 bytes with zeros (Sui addresses are 20 bytes, Wormhole expects 32)
        let mut result = bytes;
        let mut i = vector::length(&bytes);
        while (i < 32) {
            vector::push_back(&mut result, 0u8);
            i = i + 1;
        };
        
        result
    }

    /// Helper to convert Sui address to 32-byte vector (for Wormhole compatibility)
    public fun sui_address_to_bytes(addr: address): vector<u8> {
        address_to_bytes(addr)
    }
}
