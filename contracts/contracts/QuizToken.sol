// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QuizToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18;

    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event RewardMinted(address indexed minter, address indexed student, uint256 amount);

    modifier onlyMinter() {
        require(minters[msg.sender], "Not an approved minter");
        _;
    }

    constructor() ERC20("QuizToken", "QTKN") Ownable(msg.sender) {
        // Deployer is automatically a minter
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }

    // Owner adds a professor as minter
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    // Owner removes a minter
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // Mint rewards to a single student
    function mintReward(address student, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(student, amount);
        emit RewardMinted(msg.sender, student, amount);
    }

    // Mint rewards to multiple students in one transaction (gas efficient)
    function mintRewardBatch(
        address[] calldata students,
        uint256[] calldata amounts
    ) external onlyMinter {
        require(students.length == amounts.length, "Length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        require(totalSupply() + total <= MAX_SUPPLY, "Exceeds max supply");
        for (uint256 i = 0; i < students.length; i++) {
            _mint(students[i], amounts[i]);
            emit RewardMinted(msg.sender, students[i], amounts[i]);
        }
    }
}