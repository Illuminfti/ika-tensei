// Unit tests for dwallet_registry.move
module ikatensei::dwallet_registry_tests {
    use ikatensei::dwallet_registry;

    #[test]
    fun test_address_to_bytes() {
        let addr = @0x123456789ABCDEF;
        let bytes = dwallet_registry::address_to_bytes(addr);
        
        // Should be 32 bytes
        assert!(vector::length(&bytes) == 32, 0);
    }

    #[test]
    fun test_sui_address_to_bytes() {
        let addr = @0xDEADBEEF;
        let bytes = dwallet_registry::sui_address_to_bytes(addr);
        
        // Should be 32 bytes
        assert!(vector::length(&bytes) == 32, 0);
    }
}
