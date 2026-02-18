// Ika Tensei v3 - Trusted Wormhole Emitter Registry
// Embedded in SealRegistry as a field (not a standalone object).
// Tracks trusted emitters per Wormhole chain ID + consumed VAA hashes (anti-replay).
module ikatensei::emitters {
    use sui::table::{Self, Table};

    const E_EMITTER_NOT_REGISTERED: u64 = 1;
    const E_INVALID_CHAIN_ID: u64 = 2;

    /// Embedded in SealRegistry. No key/id - this is a storage struct only.
    public struct EmitterRegistry has store {
        /// Wormhole chain ID -> 32-byte emitter address
        trusted_emitters: Table<u16, vector<u8>>,
        /// SHA2-256 hash of full VAA bytes -> consumed flag (anti-replay)
        consumed_vaas: Table<vector<u8>, bool>,
    }

    public fun new_registry(ctx: &mut TxContext): EmitterRegistry {
        EmitterRegistry {
            trusted_emitters: table::new(ctx),
            consumed_vaas: table::new(ctx),
        }
    }

    /// Register or update a trusted emitter. Admin-gated at caller level.
    public fun register_emitter(
        registry: &mut EmitterRegistry,
        chain_id: u16,
        emitter_address: vector<u8>,
    ) {
        assert!(is_valid_chain(chain_id), E_INVALID_CHAIN_ID);
        if (table::contains(&registry.trusted_emitters, chain_id)) {
            table::remove(&mut registry.trusted_emitters, chain_id);
        };
        table::add(&mut registry.trusted_emitters, chain_id, emitter_address);
    }

    public fun remove_emitter(registry: &mut EmitterRegistry, chain_id: u16) {
        assert!(table::contains(&registry.trusted_emitters, chain_id), E_EMITTER_NOT_REGISTERED);
        table::remove(&mut registry.trusted_emitters, chain_id);
    }

    public fun is_trusted_emitter(
        registry: &EmitterRegistry,
        chain_id: u16,
        emitter_address: &vector<u8>,
    ): bool {
        if (!table::contains(&registry.trusted_emitters, chain_id)) return false;
        table::borrow(&registry.trusted_emitters, chain_id) == emitter_address
    }

    public fun is_vaa_consumed(registry: &EmitterRegistry, vaa_hash: vector<u8>): bool {
        table::contains(&registry.consumed_vaas, vaa_hash)
    }

    /// Mark VAA consumed. Returns true if newly consumed, false if already done.
    public fun mark_vaa_consumed(registry: &mut EmitterRegistry, vaa_hash: vector<u8>): bool {
        if (table::contains(&registry.consumed_vaas, vaa_hash)) return false;
        table::add(&mut registry.consumed_vaas, vaa_hash, true);
        true
    }

    public fun emitter_count(registry: &EmitterRegistry): u64 {
        table::length(&registry.trusted_emitters)
    }

    public fun consumed_vaa_count(registry: &EmitterRegistry): u64 {
        table::length(&registry.consumed_vaas)
    }

    /// Wormhole chain IDs for supported chains:
    /// SOL=1, ETH=2, NEAR=15, SUI=21
    fun is_valid_chain(chain_id: u16): bool {
        chain_id == 1 || chain_id == 2 || chain_id == 15 || chain_id == 21
    }

    /// Map: our internal ID -> Wormhole chain ID
    public fun to_wormhole_chain(our: u16): u16 {
        if (our == 1) return 2;   // ETH -> WH:2
        if (our == 2) return 21;  // SUI -> WH:21
        if (our == 3) return 1;   // SOL -> WH:1
        if (our == 4) return 15;  // NEAR -> WH:15
        0
    }

    /// Map: Wormhole chain ID -> our internal ID
    public fun from_wormhole_chain(wh: u16): u16 {
        if (wh == 2) return 1;
        if (wh == 21) return 2;
        if (wh == 1) return 3;
        if (wh == 15) return 4;
        0
    }
}
