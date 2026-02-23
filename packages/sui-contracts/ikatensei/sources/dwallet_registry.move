// Ika Tensei PRD v6 - DWallet Registry
//
// Registry of valid IKA dWallet deposit addresses.
// This module tracks which dWallet addresses are authorised to receive
// sealed NFTs on behalf of users.
//
// The registry validates that a dWallet address is registered before
// the orchestrator signs a seal message. This prevents invalid deposits
// from being processed.
//
// Admin controls:
//   - Initial setup by deployer (RegistryOwnerCap)
//   - Ownership can be transferred to a DAO later
//
// Counters:
//   - total_registered: monotonically increasing historical count (never decremented)
//   - total_active: current active dWallet count (decrements on deactivation,
//                   increments on registration or re-activation)
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
    const E_ALREADY_ACTIVE: u64 = 5;

    // ==================================================================
    // Events
    // ==================================================================

    public struct DWalletRegistered has copy, drop {
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        owner: address,
        timestamp: u64,
    }

    public struct DWalletUnregistered has copy, drop {
        deposit_address: vector<u8>,
        timestamp: u64,
    }

    public struct DWalletReactivated has copy, drop {
        deposit_address: vector<u8>,
        timestamp: u64,
    }

    public struct OwnershipTransferred has copy, drop {
        old_owner: address,
        new_owner: address,
        timestamp: u64,
    }

    // ==================================================================
    // Data Structures
    // ==================================================================

    /// Per-dWallet registration record.
    public struct DWalletRecord has store, copy, drop {
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        owner: address,
        registered_at: u64,
        active: bool,
    }

    /// Admin capability — controls who can mutate the registry.
    public struct RegistryOwnerCap has key, store {
        id: UID,
    }

    /// Main registry — shared object.
    /// Maps deposit_address (32-byte vector) -> DWalletRecord.
    public struct DWalletRegistry has key {
        id: UID,
        owner: address,
        /// deposit_address (32 bytes) -> DWalletRecord
        wallets: Table<vector<u8>, DWalletRecord>,
        /// dwallet_id bytes -> deposit_address (for reverse lookup)
        dwallet_ids: Table<vector<u8>, vector<u8>>,
        /// Historical count of all registrations ever made (never decremented)
        total_registered: u64,
        /// Current count of active dWallets (increments on register/reactivate,
        /// decrements on deactivate)
        total_active: u64,
    }

    // ==================================================================
    // Init
    // ==================================================================

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
            total_active: 0,
        };

        sui::transfer::share_object(registry);
        sui::transfer::public_transfer(cap, owner);
    }

    // ==================================================================
    // Mutating functions (require RegistryOwnerCap)
    // ==================================================================

    /// Register a new dWallet deposit address.
    /// deposit_address must be exactly 32 bytes (Wormhole-normalised).
    /// dwallet_id must be the BCS-serialised ObjectID bytes.
    public fun register_dwallet(
        registry: &mut DWalletRegistry,
        _cap: &RegistryOwnerCap,
        deposit_address: vector<u8>,
        dwallet_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&deposit_address) == 32, E_ZERO_ADDRESS);
        assert!(vector::length(&dwallet_id) >= 1, E_ZERO_ADDRESS);
        assert!(
            !table::contains(&registry.wallets, deposit_address),
            E_ALREADY_REGISTERED
        );

        let owner = sui::tx_context::sender(ctx);
        let timestamp = sui::tx_context::epoch(ctx);

        let record = DWalletRecord {
            deposit_address,
            dwallet_id,
            owner,
            registered_at: timestamp,
            active: true,
        };

        table::add(&mut registry.wallets, deposit_address, record);
        table::add(&mut registry.dwallet_ids, dwallet_id, deposit_address);

        // total_registered is a historical counter — always increments
        registry.total_registered = registry.total_registered + 1;
        // total_active tracks currently live dWallets
        registry.total_active = registry.total_active + 1;

        emit(DWalletRegistered {
            deposit_address,
            dwallet_id,
            owner,
            timestamp,
        });
    }

    /// Batch register multiple dWallets (for initial setup).
    /// Skips entries that are already registered.
    public fun register_dwallets_batch(
        registry: &mut DWalletRegistry,
        cap: &RegistryOwnerCap,
        deposit_addresses: vector<vector<u8>>,
        dwallet_ids: vector<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        let len = vector::length(&deposit_addresses);
        assert!(len == vector::length(&dwallet_ids), E_ZERO_ADDRESS);

        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&deposit_addresses, i);
            let id   = *vector::borrow(&dwallet_ids, i);
            if (!table::contains(&registry.wallets, addr)) {
                register_dwallet(registry, cap, addr, id, ctx);
            };
            i = i + 1;
        };
    }

    /// Deactivate (soft-delete) a dWallet registration.
    /// The record is preserved for audit history.
    /// total_registered is NOT decremented — it is a historical count.
    /// total_active IS decremented.
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
        // Only decrement total_active if the record was previously active
        if (record.active) {
            registry.total_active = registry.total_active - 1;
        };
        record.active = false;

        emit(DWalletUnregistered {
            deposit_address,
            timestamp: sui::tx_context::epoch(ctx),
        });
    }

    /// Re-activate a previously deactivated dWallet registration.
    /// Useful when a dWallet was temporarily disabled and needs restoring.
    /// total_registered is NOT changed (already counted).
    /// total_active IS incremented.
    public fun reactivate_dwallet(
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
        assert!(!record.active, E_ALREADY_ACTIVE);
        record.active = true;
        registry.total_active = registry.total_active + 1;

        emit(DWalletReactivated {
            deposit_address,
            timestamp: sui::tx_context::epoch(ctx),
        });
    }

    /// Transfer ownership of the registry to a new address.
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

    // ==================================================================
    // View functions
    // ==================================================================

    /// Returns true iff the deposit_address is registered AND currently active.
    public fun is_registered(registry: &DWalletRegistry, deposit_address: &vector<u8>): bool {
        if (!table::contains(&registry.wallets, *deposit_address)) {
            return false
        };
        table::borrow(&registry.wallets, *deposit_address).active
    }

    /// Returns true iff the dwallet_id has a registration entry (active or inactive).
    public fun is_dwallet_registered(registry: &DWalletRegistry, dwallet_id: &vector<u8>): bool {
        table::contains(&registry.dwallet_ids, *dwallet_id)
    }

    /// Get the deposit address associated with a dwallet_id.
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

    /// Get the full DWalletRecord for a deposit address.
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

    /// Get the owner address recorded for a deposit address.
    public fun get_owner(registry: &DWalletRegistry, deposit_address: &vector<u8>): address {
        table::borrow(&registry.wallets, *deposit_address).owner
    }

    /// Get the dwallet_id bytes for a deposit address.
    public fun get_dwallet_id(registry: &DWalletRegistry, deposit_address: &vector<u8>): vector<u8> {
        table::borrow(&registry.wallets, *deposit_address).dwallet_id
    }

    /// Historical total: number of registrations ever made. Never decrements.
    public fun total_registered(registry: &DWalletRegistry): u64 {
        registry.total_registered
    }

    /// Current total: number of currently active registrations.
    public fun total_active(registry: &DWalletRegistry): u64 {
        registry.total_active
    }

    public fun get_owner_address(registry: &DWalletRegistry): address {
        registry.owner
    }

    public fun is_owner(registry: &DWalletRegistry, addr: address): bool {
        addr == registry.owner
    }

    // ==================================================================
    // DWalletRecord accessors
    // ==================================================================

    public fun record_deposit_address(r: &DWalletRecord): &vector<u8> { &r.deposit_address }
    public fun record_dwallet_id(r: &DWalletRecord): &vector<u8> { &r.dwallet_id }
    public fun record_owner(r: &DWalletRecord): address { r.owner }
    public fun record_registered_at(r: &DWalletRecord): u64 { r.registered_at }
    public fun record_active(r: &DWalletRecord): bool { r.active }

    // ==================================================================
    // Utility helpers
    // ==================================================================

    /// Serialise a Sui address to its canonical 32-byte representation.
    ///
    /// Sui addresses are 32 bytes. BCS serialisation of an address produces
    /// exactly 32 bytes with no length prefix — no padding is needed.
    public fun address_to_bytes(addr: address): vector<u8> {
        bcs::to_bytes(&addr)
    }

    /// Alias for address_to_bytes, retained for call-site compatibility.
    public fun sui_address_to_bytes(addr: address): vector<u8> {
        address_to_bytes(addr)
    }
}
