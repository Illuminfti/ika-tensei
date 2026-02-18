// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../src/IkaTenseiDeposit.sol";

// =============================================================
//                      MOCK CONTRACTS
// =============================================================

/// @notice Minimal ERC-721 mock for testing
contract MockERC721 is IERC721 {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to, uint256 tokenId) external {
        _owners[tokenId] = to;
        _balances[to]++;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _tokenApprovals[tokenId];
    }

    function approve(address to, uint256 tokenId) external {
        _tokenApprovals[tokenId] = to;
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "Not owner");
        require(
            from == msg.sender ||
            _operatorApprovals[from][msg.sender] ||
            _tokenApprovals[tokenId] == msg.sender,
            "Not authorized"
        );
        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;
        delete _tokenApprovals[tokenId];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        this.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        this.transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC721).interfaceId;
    }
}

/// @notice Minimal ERC-1155 mock for testing
contract MockERC1155 is IERC1155 {
    mapping(address => mapping(uint256 => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to, uint256 id, uint256 amount) external {
        _balances[to][id] += amount;
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return _balances[account][id];
    }

    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata ids
    ) external view returns (uint256[] memory batchBalances) {
        batchBalances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            batchBalances[i] = _balances[accounts[i]][ids[i]];
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external {
        require(
            from == msg.sender || _operatorApprovals[from][msg.sender],
            "Not authorized"
        );
        require(_balances[from][id] >= amount, "Insufficient balance");
        _balances[from][id] -= amount;
        _balances[to][id] += amount;
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata
    ) external {
        for (uint256 i = 0; i < ids.length; i++) {
            require(_balances[from][ids[i]] >= amounts[i], "Insufficient balance");
            _balances[from][ids[i]] -= amounts[i];
            _balances[to][ids[i]] += amounts[i];
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155).interfaceId;
    }
}

/// @notice Mock Wormhole core contract for testing
contract MockWormhole {
    uint256 private _messageFee = 0.001 ether;
    uint64 private _seqCounter = 1;

    function setMessageFee(uint256 newFee) external {
        _messageFee = newFee;
    }

    function messageFee() external view returns (uint256) {
        return _messageFee;
    }

    function chainId() external pure returns (uint16) {
        return 2; // Ethereum Wormhole chain ID
    }

    function publishMessage(
        uint32, /* nonce */
        bytes memory, /* payload */
        uint8 /* consistencyLevel */
    ) external payable returns (uint64 sequence) {
        sequence = _seqCounter++;
    }

    function parseAndVerifyVM(
        bytes calldata
    ) external pure returns (bytes32, bool, string memory) {
        return (bytes32(0), true, "");
    }
}

// =============================================================
//                         TESTS
// =============================================================

contract IkaTenseiDepositTest is Test {
    // Mirror the contract event for vm.expectEmit
    event NftDeposited(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed depositor,
        bytes32 dwalletAddress,
        bytes32 sealNonce,
        uint64 wormholeSequence
    );

    IkaTenseiDeposit public dep;
    MockERC721   public nft721;
    MockERC1155  public nft1155;
    MockWormhole public wormhole;

    address public owner        = makeAddr("owner");
    address public feeRecipient = makeAddr("feeRecipient");
    address public user         = makeAddr("user");
    address public dWallet      = makeAddr("dWallet");

    uint256 constant DEPOSIT_FEE = 0.01 ether;

    function setUp() public {
        wormhole = new MockWormhole();
        nft721   = new MockERC721();
        nft1155  = new MockERC1155();

        vm.prank(owner);
        dep = new IkaTenseiDeposit(DEPOSIT_FEE, feeRecipient, false);

        // Point to our local mock instead of the real Sepolia address
        vm.prank(owner);
        dep.setWormholeCore(address(wormhole));

        vm.deal(user, 10 ether);
        nft721.mint(user, 1);
        nft1155.mint(user, 42, 100);
    }

    // ── Initialisation ──────────────────────────────────────
    function test_Initialization() public {
        assertEq(dep.depositFee(), DEPOSIT_FEE);
        assertEq(dep.feeRecipient(), feeRecipient);
        assertEq(dep.owner(), owner);
        assertEq(dep.wormholeCore(), address(wormhole));
    }

    // ── ERC-721 deposit ─────────────────────────────────────
    function test_DepositERC721_transfersNftAndEmitsEvent() public {
        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        uint256 wfee      = wormhole.messageFee();
        uint256 totalFee  = DEPOSIT_FEE + wfee;
        bytes32 sealNonce = bytes32(uint256(0xBEEF));

        vm.expectEmit(true, true, true, true);
        emit NftDeposited(
            address(nft721),
            1,
            user,
            bytes32(uint256(uint160(dWallet))),
            sealNonce,
            1 // first wormhole sequence from mock
        );

        vm.prank(user);
        uint64 seq = dep.depositERC721{value: totalFee}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), sealNonce
        );

        assertEq(seq, 1,         "wrong wormhole sequence");
        assertEq(nft721.ownerOf(1), dWallet, "NFT not transferred");
        assertTrue(dep.isNonceUsed(sealNonce), "nonce not marked used");
    }

    function test_DepositERC721_feeForwarded() public {
        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        uint256 before = feeRecipient.balance;
        uint256 wfee   = wormhole.messageFee();

        vm.prank(user);
        dep.depositERC721{value: DEPOSIT_FEE + wfee}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), bytes32(uint256(1))
        );

        assertEq(feeRecipient.balance - before, DEPOSIT_FEE, "fee not forwarded");
    }

    function test_DepositERC721_refundsExcess() public {
        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        uint256 wfee   = wormhole.messageFee();
        uint256 excess = 0.5 ether;
        uint256 sent   = DEPOSIT_FEE + wfee + excess;
        uint256 before = user.balance;

        vm.prank(user);
        dep.depositERC721{value: sent}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), bytes32(uint256(2))
        );

        assertApproxEqAbs(user.balance, before - DEPOSIT_FEE - wfee, 1e15, "excess not refunded");
    }

    // ── ERC-1155 deposit ────────────────────────────────────
    function test_DepositERC1155_transfersTokens() public {
        vm.prank(user);
        nft1155.setApprovalForAll(address(dep), true);

        uint256 wfee  = wormhole.messageFee();
        bytes32 nonce = bytes32(uint256(0xCAFE));

        vm.prank(user);
        uint64 seq = dep.depositERC1155{value: DEPOSIT_FEE + wfee}(
            address(nft1155), 42, 50, bytes32(uint256(uint160(dWallet))), nonce
        );

        assertEq(seq, 1);
        assertEq(nft1155.balanceOf(dWallet, 42), 50, "tokens not transferred");
        assertEq(nft1155.balanceOf(user, 42),    50, "wrong remainder");
        assertTrue(dep.isNonceUsed(nonce));
    }

    // ── Anti-replay ──────────────────────────────────────────
    function test_RevertOn_UsedNonce() public {
        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        uint256 wfee  = wormhole.messageFee();
        bytes32 nonce = bytes32(uint256(0xDEAD));

        vm.prank(user);
        dep.depositERC721{value: DEPOSIT_FEE + wfee}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), nonce
        );

        nft721.mint(user, 2);

        vm.expectRevert("Nonce already used");
        vm.prank(user);
        dep.depositERC721{value: DEPOSIT_FEE + wfee}(
            address(nft721), 2, bytes32(uint256(uint160(dWallet))), nonce // same nonce
        );
    }

    // ── Insufficient fee ────────────────────────────────────
    function test_RevertOn_InsufficientFee() public {
        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        vm.expectRevert("Insufficient fee");
        vm.prank(user);
        dep.depositERC721{value: 0}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), bytes32(uint256(1))
        );
    }

    // ── Admin: setFee ────────────────────────────────────────
    function test_SetFee_onlyOwner() public {
        vm.prank(owner);
        dep.setFee(0.05 ether);
        assertEq(dep.depositFee(), 0.05 ether);

        vm.expectRevert();
        vm.prank(user);
        dep.setFee(0);
    }

    // ── Admin: setFeeRecipient ───────────────────────────────
    function test_SetFeeRecipient_onlyOwner() public {
        address newRecipient = makeAddr("newRecipient");
        vm.prank(owner);
        dep.setFeeRecipient(newRecipient);
        assertEq(dep.feeRecipient(), newRecipient);

        vm.expectRevert();
        vm.prank(user);
        dep.setFeeRecipient(address(0x5));
    }

    // ── Admin: pause / unpause ───────────────────────────────
    function test_Pause_blocksDeposits() public {
        vm.prank(owner);
        dep.pause();

        vm.prank(user);
        nft721.setApprovalForAll(address(dep), true);

        uint256 wfee = wormhole.messageFee();

        vm.expectRevert();
        vm.prank(user);
        dep.depositERC721{value: DEPOSIT_FEE + wfee}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), bytes32(uint256(1))
        );

        vm.prank(owner);
        dep.unpause();

        // Should succeed after unpause
        vm.prank(user);
        dep.depositERC721{value: DEPOSIT_FEE + wfee}(
            address(nft721), 1, bytes32(uint256(uint160(dWallet))), bytes32(uint256(1))
        );
        assertEq(nft721.ownerOf(1), dWallet);
    }

    function test_Pause_onlyOwner() public {
        vm.expectRevert();
        vm.prank(user);
        dep.pause();
    }

    // ── getWormholeFee ───────────────────────────────────────
    function test_GetWormholeFee() public {
        assertEq(dep.getWormholeFee(), wormhole.messageFee());
    }
}
