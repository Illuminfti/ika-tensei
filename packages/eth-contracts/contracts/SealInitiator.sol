// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IWormhole} from "./interfaces/IWormhole.sol";

/// @title SealInitiator
/// @notice Permissionless contract to initiate NFT seal for Ika Tensei cross-chain rebirth
/// @dev Part of Ika Tensei v6 architecture - Sui-orchestrated Wormhole
///      Reads NFT state on source chain, emits Wormhole VAA for Sui verification
contract SealInitiator {
    // ============ Constants ============

    /// @notice Payload type ID for Seal Attestation (PRD v6)
    uint8 public constant PAYLOAD_TYPE_SEAL = 1;

    /// @notice Wormhole core bridge address (Ethereum mainnet)
    address public constant WORMHOLE_MAINNET = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;

    /// @notice Wormhole core bridge address (Ethereum Sepolia testnet)
    address public constant WORMHOLE_SEPOLIA = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;

    /// @notice Consistency level 1 = finalized (production safety)
    uint8 public constant CONSISTENCY_LEVEL = 1;

    /// @notice CryptoPunks contract address (mainnet)
    address public constant CRYPTOPUNKS_MAINNET = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;

    // ============ State Variables ============

    /// @notice Address of the Wormhole core contract
    IWormhole public immutable wormhole;

    /// @notice Sequence counter for Wormhole messages
    uint64 public sequence;

    /// @notice Cache for contract code existence (address => exists)
    mapping(address => bool) private _codeExists;

    // ============ Events ============

    /// @notice Emitted when NFT seal is initiated
    /// @dev Indexed for easy filtering by subgraph
    event SealInitiated(
        address indexed nftContract,
        uint256 indexed tokenId,
        address depositAddress,
        string tokenURI,
        bytes32 solanaReceiver,
        uint64 sequence,
        uint16 sourceChainId
    );

    /// @notice Emitted when tokenURI retrieval fails (no metadata)
    event TokenURIUnavailable(
        address indexed nftContract,
        uint256 indexed tokenId
    );

    // ============ Errors ============

    /// @notice NFT is not owned by the deposit address
    error NotAtDepositAddress();

    /// @notice Contract does not appear to be an NFT (no code)
    error NotAnNFTContract();

    /// @notice Insufficient fee for Wormhole message
    error InsufficientFee();

    // ============ Constructor ============

    /// @notice Deploy SealInitiator
    /// @param _wormhole Address of Wormhole core bridge (mainnet or testnet)
    constructor(address _wormhole) {
        require(_wormhole != address(0), "Invalid wormhole address");
        wormhole = IWormhole(_wormhole);
    }

    // ============ External Functions ============

    /// @notice Initiate seal for an NFT
    /// @dev Permissionless - anyone can call for any deposit address
    ///      Verifies owner on-chain, reads tokenURI, emits Wormhole message
    /// @param nftContract Address of the NFT contract (ERC-721, ERC-1155, or CryptoPunks)
    /// @param tokenId Token ID to seal
    /// @param depositAddress dWallet deposit address on source chain
    /// @param solanaReceiver User's Solana wallet address (32 bytes, left-padded)
    /// @return sequenceNumber The Wormhole sequence number for this message
    function initiateSeal(
        address nftContract,
        uint256 tokenId,
        address depositAddress,
        bytes32 solanaReceiver
    ) external payable returns (uint64 sequenceNumber) {
        // 1. Verify NFT is at deposit address
        _verifyOwnership(nftContract, tokenId, depositAddress);

        // 2. Read tokenURI on-chain (try ERC-721, then ERC-1155, handle CryptoPunks)
        string memory uri = _getTokenURI(nftContract, tokenId);

        // 3. Build payload per PRD v6:
        //    {payloadType=1, chainId, nftContract, tokenId, depositAddress, solanaReceiver, tokenURI}
        bytes memory payload = _buildPayload(
            nftContract,
            tokenId,
            depositAddress,
            solanaReceiver,
            uri
        );

        // 4. Emit Wormhole message
        uint256 fee = wormhole.messageFee();
        if (msg.value < fee) {
            revert InsufficientFee();
        }

        sequenceNumber = wormhole.publishMessage{value: fee}(
            uint32(sequence++),
            payload,
            CONSISTENCY_LEVEL
        );

        // 5. Emit event for indexing
        emit SealInitiated(
            nftContract,
            tokenId,
            depositAddress,
            uri,
            solanaReceiver,
            sequenceNumber,
            wormhole.chainId()
        );

        // 6. Refund excess fee (using call to avoid gas issues)
        if (msg.value > fee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(success, "Refund failed");
        }
    }

    /// @notice Allow receiving ETH
    /// @param nftContracts Array of NFT contract addresses
    /// @param tokenIds Array of token IDs
    /// @param depositAddresses Array of deposit addresses
    /// @param solanaReceivers Array of Solana receiver addresses
    /// @return sequenceNumbers Array of Wormhole sequence numbers
    function initiateSealBatch(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        address[] calldata depositAddresses,
        bytes32[] calldata solanaReceivers
    ) external payable returns (uint64[] memory sequenceNumbers) {
        require(
            nftContracts.length == tokenIds.length &&
            tokenIds.length == depositAddresses.length &&
            depositAddresses.length == solanaReceivers.length,
            "Array length mismatch"
        );

        uint256 fee = wormhole.messageFee();
        uint256 totalFee = fee * nftContracts.length;
        if (msg.value < totalFee) {
            revert InsufficientFee();
        }

        sequenceNumbers = new uint64[](nftContracts.length);

        for (uint256 i = 0; i < nftContracts.length; i++) {
            // Verify ownership
            _verifyOwnership(nftContracts[i], tokenIds[i], depositAddresses[i]);

            // Get URI
            string memory uri = _getTokenURI(nftContracts[i], tokenIds[i]);

            // Build payload
            bytes memory payload = _buildPayload(
                nftContracts[i],
                tokenIds[i],
                depositAddresses[i],
                solanaReceivers[i],
                uri
            );

            // Publish message
            sequenceNumbers[i] = wormhole.publishMessage{value: fee}(
                uint32(sequence++),
                payload,
                CONSISTENCY_LEVEL
            );

            // Emit event
            emit SealInitiated(
                nftContracts[i],
                tokenIds[i],
                depositAddresses[i],
                uri,
                solanaReceivers[i],
                sequenceNumbers[i],
                wormhole.chainId()
            );
        }

        // Refund excess (using call to avoid gas issues)
        if (msg.value > totalFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalFee}("");
            require(success, "Refund failed");
        }
    }

    // ============ Internal Functions ============

    /// @notice Verify NFT ownership matches deposit address
    /// @dev Handles ERC-721, ERC-1155 (balance check), and CryptoPunks
    function _verifyOwnership(
        address nftContract,
        uint256 tokenId,
        address depositAddress
    ) internal view {
        // Check if it's CryptoPunks (has punks token code but different interface)
        if (nftContract == CRYPTOPUNKS_MAINNET) {
            // CryptoPunks uses a different mapping for ownership
            _verifyCryptoPunksOwnership(tokenId, depositAddress);
            return;
        }

        // Try ERC-721 first (most common)
        (bool success, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSelector(IERC721.ownerOf.selector, tokenId)
        );

        if (success && data.length >= 32) {
            address owner = abi.decode(data, (address));
            if (owner == depositAddress) {
                return;
            }
            revert NotAtDepositAddress();
        }

        // Try ERC-1155 balance check
        (success, data) = nftContract.staticcall(
            abi.encodeWithSelector(
                IERC1155.balanceOf.selector,
                depositAddress,
                tokenId
            )
        );

        if (success && data.length >= 32) {
            uint256 balance = abi.decode(data, (uint256));
            if (balance > 0) {
                return;
            }
        }

        // If we get here, contract doesn't match expected interfaces
        // But check if it has code (might be a custom implementation)
        if (nftContract.code.length == 0) {
            revert NotAnNFTContract();
        }

        // Try one more common pattern: ownerOf without selector (some contracts)
        (success, data) = nftContract.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );

        if (success && data.length >= 32) {
            address owner = abi.decode(data, (address));
            if (owner == depositAddress) {
                return;
            }
        }

        revert NotAtDepositAddress();
    }

    /// @notice Verify CryptoPunks ownership
    /// @dev CryptoPunks uses punkIndexToAddress mapping
    function _verifyCryptoPunksOwnership(
        uint256 punkIndex,
        address depositAddress
    ) internal view {
        // CryptoPunks: check punkIndexToAddress mapping
        (bool success, bytes memory data) = CRYPTOPUNKS_MAINNET.staticcall(
            abi.encodeWithSignature("punkIndexToAddress(uint256)", punkIndex)
        );

        if (success && data.length >= 32) {
            address owner = abi.decode(data, (address));
            if (owner != depositAddress) {
                revert NotAtDepositAddress();
            }
            return;
        }

        revert NotAtDepositAddress();
    }

    /// @notice Get tokenURI from NFT contract
    /// @dev Tries ERC-721 tokenURI(uint256), then ERC-1155 uri(uint256), returns "" for no metadata
    function _getTokenURI(
        address nftContract,
        uint256 tokenId
    ) internal returns (string memory) {
        // Try ERC-721 tokenURI(uint256)
        (bool success, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSelector(IERC721Metadata.tokenURI.selector, tokenId)
        );

        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }

        // Try ERC-1155 uri(uint256) - may contain {id} placeholder
        (success, data) = nftContract.staticcall(
            abi.encodeWithSelector(IERC1155URI.uri.selector, tokenId)
        );

        if (success && data.length > 0) {
            string memory uri = abi.decode(data, (string));
            // ERC-1155 URIs often contain {id} placeholder - replace with tokenId
            return _replaceTokenId(uri, tokenId);
        }

        // Try CryptoPunks (no tokenURI)
        if (nftContract == CRYPTOPUNKS_MAINNET) {
            // CryptoPunks don't have metadata - return empty
            emit TokenURIUnavailable(nftContract, tokenId);
            return "";
        }

        // Try tokenURI without selector (some contracts)
        (success, data) = nftContract.staticcall(
            abi.encodeWithSignature("tokenURI(uint256)", tokenId)
        );

        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }

        // No metadata available
        emit TokenURIUnavailable(nftContract, tokenId);
        return "";
    }

    /// @notice Replace {id} placeholder in ERC-1155 URI with padded tokenId
    function _replaceTokenId(
        string memory uri,
        uint256 tokenId
    ) internal pure returns (string memory) {
        bytes memory uriBytes = bytes(uri);
        bytes memory tokenIdBytes = bytes(_uint2str(tokenId));

        // Look for {id} placeholder
        bytes memory placeholder = bytes("{id}");

        for (uint256 i = 0; i <= uriBytes.length - placeholder.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < placeholder.length; j++) {
                if (uriBytes[i + j] != placeholder[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                // Replace {id} with tokenId (hex, zero-padded to 64 chars)
                bytes memory hexTokenId = _toHex(tokenId);
                bytes memory result = new bytes(
                    i + hexTokenId.length + (uriBytes.length - i - placeholder.length)
                );
                for (uint256 k = 0; k < i; k++) {
                    result[k] = uriBytes[k];
                }
                for (uint256 k = 0; k < hexTokenId.length; k++) {
                    result[i + k] = hexTokenId[k];
                }
                for (
                    uint256 k = i + placeholder.length;
                    k < uriBytes.length;
                    k++
                ) {
                    result[k + hexTokenId.length - placeholder.length] = uriBytes[k];
                }
                return string(result);
            }
        }

        return uri;
    }

    /// @notice Build Wormhole payload per PRD v6 format
    /// @dev Payload: {payloadType=1, chainId, nftContract, tokenId, depositAddress, solanaReceiver, tokenURI}
    function _buildPayload(
        address nftContract,
        uint256 tokenId,
        address depositAddress,
        bytes32 solanaReceiver,
        string memory tokenURI
    ) internal view returns (bytes memory) {
        return abi.encode(
            PAYLOAD_TYPE_SEAL,           // uint8: payload type
            wormhole.chainId(),         // uint16: source chain ID
            nftContract,                // address: NFT contract
            tokenId,                    // uint256: token ID
            depositAddress,             // address: dWallet deposit address
            solanaReceiver,             // bytes32: Solana receiver
            tokenURI                    // string: tokenURI
        );
    }

    /// @notice Convert uint to string
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @notice Convert uint256 to hex string (for ERC-1155 {id} replacement)
    function _toHex(uint256 value) internal pure returns (bytes memory) {
        bytes memory buffer = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            uint8 char = uint8(value & 0xf);
            buffer[63 - i] = char < 10 ? bytes1(uint8(char + 48)) : bytes1(uint8(char + 87));
            value >>= 4;
        }
        return buffer;
    }

    // ============ View Functions ============

    /// @notice Get the current message fee
    function getMessageFee() external view returns (uint256) {
        return wormhole.messageFee();
    }

    /// @notice Get the current chain ID
    function getChainId() external view returns (uint16) {
        return wormhole.chainId();
    }

    /// @notice Check if an address has code (is a contract)
    function isContract(address addr) external view returns (bool) {
        return addr.code.length > 0;
    }

    // ============ Receive Function ============

    /// @notice Allow receiving ETH for refunds
    receive() external payable {}

    // ============ ERC165 Support ============

    /// @notice This contract does not support ERC165 (it's not intended to be called as NFT)
}

/// @title IERC721Metadata
/// @notice ERC-721 Metadata interface (subset needed for tokenURI)
interface IERC721Metadata is IERC721 {
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

/// @title IERC1155URI
/// @notice ERC-1155 URI interface for metadata
interface IERC1155URI {
    function uri(uint256 tokenId) external view returns (string memory);
}
