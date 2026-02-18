// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IWormhole.sol";

/// @title IkaTenseiDeposit
/// @notice Contract for depositing NFTs and emitting Wormhole deposit attestations
/// @dev Part of Ika Tensei v3 architecture - NFT transferred to dWallet address
contract IkaTenseiDeposit is Ownable, ReentrancyGuard, Pausable, IERC1155Receiver {
    // ============ Constants ============
    
    /// @notice Wormhole core bridge address (Ethereum mainnet)
    address public constant WORMHOLE_MAINNET = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;
    
    /// @notice Wormhole core bridge address (Ethereum Sepolia testnet)
    address public constant WORMHOLE_SEPOLIA = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;
    
    /// @notice Payload type ID for NFT deposit attestation
    uint8 public constant PAYLOAD_ID_NFT_DEPOSIT = 1;
    
    /// @notice Wormhole chain ID for Ethereum
    uint16 public constant SOURCE_CHAIN_ID = 2;
    
    /// @notice Consistency level 1 = finalized (production safety)
    uint8 public constant CONSISTENCY_LEVEL = 1;

    /// @notice Maximum deposit fee (0.1 ETH)
    uint256 public constant MAX_DEPOSIT_FEE = 0.1 ether;

    /// @notice Timelock duration for admin changes (2 days)
    uint256 public constant TIMELOCK_DURATION = 2 days;

    // ============ State Variables ============
    
    /// @notice Address of the Wormhole core contract
    address public wormholeCore;
    
    /// @notice Protocol fee for deposits (in native token)
    uint256 public depositFee;
    
    /// @notice Address that receives collected fees
    address public feeRecipient;
    
    /// @notice Mapping of used nonces (for replay protection)
    mapping(bytes32 => bool) public usedNonces;
    
    /// @notice Sequence counter for Wormhole messages
    uint64 public sequence;

    /// @notice Timestamp when contract was paused (for emergency withdrawal)
    uint256 public pausedAt;

    /// @notice Pending change for timelocked admin operations
    struct PendingChange {
        address newValue;
        uint256 executeAfter;
        bool exists;
    }

    /// @notice Mapping of pending changes (keyed by change type)
    mapping(bytes32 => PendingChange) public pendingChanges;

    /// @notice Mapping of NFT deposits: token => depositor (for emergency withdrawal)
    mapping(bytes32 => address) public depositers;

    // ============ Events ============

    /// @notice Event emitted when an NFT is deposited
    event NftDeposited(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed depositor,
        bytes32 dwalletAddress,
        bytes32 sealNonce,
        uint64 wormholeSequence
    );

    /// @notice Event emitted when fee is updated
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Event emitted when fee recipient is updated
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    /// @notice Event emitted when Wormhole core is updated
    event WormholeCoreUpdated(address newWormholeCore);

    // ============ Constructor ============

    /// @notice Initialize the deposit contract
    /// @param _initialFee Initial deposit fee in wei
    /// @param _feeRecipient Address that receives collected fees
    /// @param _useMainnet Whether to use mainnet (true) or Sepolia (false) Wormhole
    constructor(
        uint256 _initialFee,
        address _feeRecipient,
        bool _useMainnet
    ) Ownable(msg.sender) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        depositFee = _initialFee;
        feeRecipient = _feeRecipient;
        wormholeCore = _useMainnet ? WORMHOLE_MAINNET : WORMHOLE_SEPOLIA;
    }

    // ============ External Functions - Deposits ============

    /// @notice Deposit an ERC-721 NFT and emit Wormhole attestation
    /// @param nftContract Address of the ERC-721 contract
    /// @param tokenId ID of the token to deposit
    /// @param dwalletAddress Address of the dWallet (destination for NFT) as bytes32
    /// @param sealNonce Unique nonce to prevent replay attacks
    /// @return wormholeSequence The Wormhole sequence number for this message
    function depositERC721(
        address nftContract,
        uint256 tokenId,
        bytes32 dwalletAddress,
        bytes32 sealNonce
    ) external payable nonReentrant whenNotPaused returns (uint64 wormholeSequence) {
        // Validate inputs
        require(nftContract != address(0), "Invalid NFT contract");
        require(dwalletAddress != bytes32(0), "Invalid dWallet address");
        
        // Check fee (must cover deposit fee + wormhole message fee)
        uint256 wormholeFee = IWormhole(wormholeCore).messageFee();
        require(msg.value >= depositFee + wormholeFee, "Insufficient fee");
        
        // Check nonce for replay protection
        require(!usedNonces[sealNonce], "Nonce already used");
        usedNonces[sealNonce] = true;

        // Transfer NFT from depositor to dWallet address
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
        
        // Transfer NFT to dWallet address (this is the "vault")
        // Convert bytes32 dwalletAddress to address for transfer
        address dwalletAddr = address(uint160(uint256(dwalletAddress)));
        nft.transferFrom(msg.sender, dwalletAddr, tokenId);

        // Track depositor for emergency withdrawal
        bytes32 depositKey = keccak256(abi.encodePacked(nftContract, tokenId));
        depositers[depositKey] = msg.sender;

        // Build payload (171 bytes)
        bytes memory payload = _encodeDepositPayload(
            nftContract,
            tokenId,
            msg.sender,
            dwalletAddress,
            sealNonce
        );

        // Publish to Wormhole
        wormholeSequence = IWormhole(wormholeCore).publishMessage{value: wormholeFee}(
            0,                      // nonce (batch ID)
            payload,
            CONSISTENCY_LEVEL       // finalized
        );

        // Emit event
        emit NftDeposited(
            nftContract,
            tokenId,
            msg.sender,
            dwalletAddress,
            sealNonce,
            wormholeSequence
        );

        // Refund excess fee
        uint256 totalFee = depositFee + wormholeFee;
        if (msg.value > totalFee) {
            payable(msg.sender).transfer(msg.value - totalFee);
        }

        // Transfer protocol fee to feeRecipient
        payable(feeRecipient).transfer(depositFee);

        return wormholeSequence;
    }

    /// @notice Deposit an ERC-1155 NFT and emit Wormhole attestation
    /// @param nftContract Address of the ERC-1155 contract
    /// @param tokenId ID of the token to deposit
    /// @param amount Amount of tokens to deposit
    /// @param dwalletAddress Address of the dWallet (destination for NFT) as bytes32
    /// @param sealNonce Unique nonce to prevent replay attacks
    /// @return wormholeSequence The Wormhole sequence number for this message
    function depositERC1155(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        bytes32 dwalletAddress,
        bytes32 sealNonce
    ) external payable nonReentrant whenNotPaused returns (uint64 wormholeSequence) {
        // Validate inputs
        require(nftContract != address(0), "Invalid NFT contract");
        require(dwalletAddress != bytes32(0), "Invalid dWallet address");
        require(amount > 0, "Amount must be > 0");
        
        // Check fee (must cover deposit fee + wormhole message fee)
        uint256 wormholeFee = IWormhole(wormholeCore).messageFee();
        require(msg.value >= depositFee + wormholeFee, "Insufficient fee");
        
        // Check nonce for replay protection
        require(!usedNonces[sealNonce], "Nonce already used");
        usedNonces[sealNonce] = true;

        // Transfer NFT from depositor to dWallet address
        IERC1155 nft = IERC1155(nftContract);
        require(nft.balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        // Transfer NFT to dWallet address
        // Convert bytes32 dwalletAddress to address for transfer
        address dwalletAddr = address(uint160(uint256(dwalletAddress)));
        nft.safeTransferFrom(msg.sender, dwalletAddr, tokenId, amount, "");

        // Build payload (171 bytes)
        bytes memory payload = _encodeDepositPayload(
            nftContract,
            tokenId,
            msg.sender,
            dwalletAddress,
            sealNonce
        );

        // Publish to Wormhole
        wormholeSequence = IWormhole(wormholeCore).publishMessage{value: wormholeFee}(
            0,                      // nonce (batch ID)
            payload,
            CONSISTENCY_LEVEL       // finalized
        );

        // Emit event
        emit NftDeposited(
            nftContract,
            tokenId,
            msg.sender,
            dwalletAddress,
            sealNonce,
            wormholeSequence
        );

        // Refund excess fee
        uint256 totalFee = depositFee + wormholeFee;
        if (msg.value > totalFee) {
            payable(msg.sender).transfer(msg.value - totalFee);
        }

        // Transfer protocol fee to feeRecipient
        payable(feeRecipient).transfer(depositFee);

        return wormholeSequence;
    }

    // ============ Admin Functions ============

    /// @notice Update the deposit fee
    /// @param newFee New fee amount in wei
    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_DEPOSIT_FEE, "Fee too high");
        uint256 oldFee = depositFee;
        depositFee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    /// @notice Update the fee recipient address
    /// @param newFeeRecipient New fee recipient address
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(oldRecipient, newFeeRecipient);
    }

    /// @notice Update the Wormhole core contract address
    /// @param newWormholeCore New Wormhole core address
    function setWormholeCore(address newWormholeCore) external onlyOwner {
        require(newWormholeCore != address(0), "Invalid Wormhole core");
        wormholeCore = newWormholeCore;
        emit WormholeCoreUpdated(newWormholeCore);
    }

    /// @notice Propose a new owner (starts timelock)
    /// @param newOwner The proposed new owner address
    function proposeChangeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        pendingChanges[keccak256("owner")] = PendingChange(
            newOwner,
            block.timestamp + TIMELOCK_DURATION,
            true
        );
    }

    /// @notice Execute the pending owner change after timelock expires
    function executeChangeOwner() external onlyOwner {
        PendingChange storage change = pendingChanges[keccak256("owner")];
        require(change.exists && block.timestamp >= change.executeAfter, "Timelock not expired");
        transferOwnership(change.newValue);
        delete pendingChanges[keccak256("owner")];
    }

    /// @notice Pause deposits (emergency function)
    function pause() external onlyOwner {
        _pause();
        pausedAt = block.timestamp;
    }

    /// @notice Unpause deposits
    function unpause() external onlyOwner {
        _unpause();
        pausedAt = 0;
    }

    /// @notice Emergency withdrawal of NFT after 7 days of pause
    /// @param nftContract Address of the ERC-721 contract
    /// @param tokenId ID of the token to withdraw
    /// @param to Address to send the NFT to
    function emergencyWithdrawERC721(
        address nftContract,
        uint256 tokenId,
        address to
    ) external {
        require(paused(), "Not paused");
        require(block.timestamp >= pausedAt + 7 days, "Emergency window not open");
        
        // Verify the caller is the original depositor
        bytes32 depositKey = keccak256(abi.encodePacked(nftContract, tokenId));
        require(depositers[depositKey] == msg.sender, "Not depositor");
        
        // Clear the depositor record
        delete depositers[depositKey];
        
        // Transfer the NFT
        IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
    }

    // ============ View Functions ============

    /// @notice Get the current Wormhole message fee
    /// @return fee The fee in wei required to publish a message
    function getWormholeFee() external view returns (uint256) {
        return IWormhole(wormholeCore).messageFee();
    }

    /// @notice Check if a nonce has been used
    /// @param nonce The nonce to check
    /// @return Whether the nonce has been used
    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    // ============ IERC1155Receiver ============

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    // ============ Internal Functions ============

    /// @notice Encode the deposit payload for Wormhole (171 bytes)
    /// @dev Layout: payloadId(1) + sourceChainId(u16) + nftContract(32) + tokenId(32) + 
    ///      depositor(32) + dwalletAddress(32) + depositBlock(8) + sealNonce(32)
    function _encodeDepositPayload(
        address nftContract,
        uint256 tokenId,
        address depositor,
        bytes32 dwalletAddress,
        bytes32 sealNonce
    ) internal view returns (bytes memory) {
        // Using abi.encode for simplicity - produces tightly packed bytes
        return abi.encodePacked(
            PAYLOAD_ID_NFT_DEPOSIT,                           // 1 byte  (offset 0)
            SOURCE_CHAIN_ID,                                 // 2 bytes (offset 1)
            bytes32(uint256(uint160(nftContract))),         // 32 bytes (offset 3)
            bytes32(tokenId),                                // 32 bytes (offset 35)
            bytes32(uint256(uint160(depositor))),           // 32 bytes (offset 67)
            dwalletAddress,                                  // 32 bytes (offset 99) - already bytes32
            uint64(block.number),                            // 8 bytes  (offset 131)
            sealNonce                                        // 32 bytes (offset 139)
        );
    }

    // ============ Fallback ============

    /// @notice Allow receiving native tokens
    receive() external payable {}
}
