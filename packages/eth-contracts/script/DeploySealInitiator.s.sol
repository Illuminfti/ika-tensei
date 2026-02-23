// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {SealInitiator} from "../contracts/SealInitiator.sol";

/// @title DeploySealInitiator
/// @notice Deploy script for SealInitiator to Ethereum testnet/mainnet
/// @dev Usage: forge script script/DeploySealInitiator.s.sol --rpc-url sepolia --broadcast --verify
contract DeploySealInitiator is Script {
    /// @notice Wormhole Core Bridge addresses
    address constant WORMHOLE_SEPOLIA = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;
    address constant WORMHOLE_MAINNET = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;

    function run() external {
        // Get deployment configuration
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        // Determine network - default to sepolia if not set
        string memory network;
        if (!vm.envExists("NETWORK")) {
            network = "sepolia";
        } else {
            network = vm.envString("NETWORK");
        }

        // Determine Wormhole address based on network
        address wormholeAddress;
        if (compareStrings(network, "mainnet")) {
            wormholeAddress = WORMHOLE_MAINNET;
        } else {
            // Default to Sepolia for testnet
            wormholeAddress = WORMHOLE_SEPOLIA;
        }

        console.log("Deploying SealInitiator to network:", network);
        console.log("Using Wormhole address:", wormholeAddress);

        // Start broadcast
        vm.startBroadcast(deployerPrivateKey);

        // Deploy SealInitiator
        SealInitiator initiator = new SealInitiator(wormholeAddress);

        console.log("SealInitiator deployed at:", address(initiator));

        vm.stopBroadcast();
    }

    /// @notice Helper to compare strings (since Solidity 0.8 doesn't have built-in string comparison)
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}

/// @title VerifySealInitiator
/// @notice Verification script - verify contract on Etherscan/Blockscout
/// @dev Usage: forge script script/VerifySealInitiator.s.sol --rpc-url sepolia --verify
contract VerifySealInitiator is Script {
    function run() external {
        address deployedAddress = vm.envAddress("DEPLOYED_ADDRESS");
        address wormholeAddress = vm.envAddress("WORMHOLE_ADDRESS");

        console.log("Verifying SealInitiator at:", deployedAddress);

        // Note: In production, you'd use etherscan verification
        // This is a placeholder for the verification process
    }
}
