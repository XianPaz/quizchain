// ─── MOCK DATA ────────────────────────────────────────────────────────────────
export const SAMPLE_QUESTIONS = [
  {
    id: 1,
    question: "What is the consensus mechanism used by Ethereum after The Merge?",
    options: ["Proof of Work", "Proof of Stake", "Proof of Authority", "Delegated PoS"],
    correct: 1,
    timeLimit: 20,
  },
  {
    id: 2,
    question: "What does ERC stand for in ERC-20?",
    options: ["Ethereum Request for Comments", "Ethereum Resource Contract", "Ethereum Runtime Code", "Ethereum Registry Certificate"],
    correct: 0,
    timeLimit: 15,
  },
  {
    id: 3,
    question: "Which testnet are we deploying our token on?",
    options: ["Goerli", "Mumbai", "Sepolia", "Rinkeby"],
    correct: 2,
    timeLimit: 10,
  },
  {
    id: 4,
    question: "What is the maximum supply cap in our QuizToken contract?",
    options: ["1,000,000 QTKN", "10,000,000 QTKN", "100,000,000 QTKN", "Unlimited"],
    correct: 1,
    timeLimit: 15,
  },
  {
    id: 5,
    question: "Which Solidity version pragma is recommended for security?",
    options: ["^0.6.0", "^0.7.0", "^0.8.0", ">=0.5.0"],
    correct: 2,
    timeLimit: 12,
  },
];

// ─── SMART CONTRACT CODE ──────────────────────────────────────────────────────
export const QUIZ_TOKEN_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QuizToken (QTKN)
 * @notice ERC-20 token distributed as rewards in QuizChain games
 * @dev Deployed on Sepolia Testnet
 */
contract QuizToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18; // 10M QTKN
    address public quizGameContract;

    event QuizGameContractSet(address indexed quizGame);
    event RewardsMinted(address indexed recipient, uint256 amount);

    modifier onlyQuizGame() {
        require(msg.sender == quizGameContract, "Only QuizGame can call");
        _;
    }

    constructor() ERC20("QuizToken", "QTKN") Ownable(msg.sender) {
        // Mint initial supply to deployer for liquidity
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    function setQuizGameContract(address _quizGame) external onlyOwner {
        quizGameContract = _quizGame;
        emit QuizGameContractSet(_quizGame);
    }

    function mintReward(address recipient, uint256 amount) external onlyQuizGame {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(recipient, amount);
        emit RewardsMinted(recipient, amount);
    }
}`;

export const QUIZ_GAME_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQuizToken {
    function mintReward(address recipient, uint256 amount) external;
}

/**
 * @title QuizGame
 * @notice Manages quiz sessions and distributes speed-based QTKN rewards
 * @dev Speed score = BASE_REWARD * (timeRemaining / timeLimit) * SPEED_MULTIPLIER
 */
contract QuizGame is Ownable, ReentrancyGuard {
    IQuizToken public quizToken;

    uint256 public constant BASE_REWARD_PER_QUESTION = 10 * 10**18;  // 10 QTKN
    uint256 public constant SPEED_MULTIPLIER = 2;    // Up to 2x for instant answer
    uint256 public constant PARTICIPATION_BONUS = 5 * 10**18; // 5 QTKN for finishing

    struct Session {
        bytes32 quizId;
        address host;
        bool active;
        bool finalized;
        uint256 questionCount;
        uint256 timeLimit;   // seconds per question
        uint256 createdAt;
        address[] players;
    }

    struct PlayerScore {
        uint256 correctAnswers;
        uint256 totalSpeedScore; // accumulated (0-100) per question
        bool registered;
        bool rewarded;
    }

    mapping(bytes32 => Session) public sessions;
    mapping(bytes32 => mapping(address => PlayerScore)) public playerScores;

    event SessionCreated(bytes32 indexed sessionId, address host, uint256 questionCount);
    event PlayerJoined(bytes32 indexed sessionId, address player);
    event ScoreSubmitted(bytes32 indexed sessionId, address player, uint256 speedScore);
    event RewardsDistributed(bytes32 indexed sessionId, uint256 playerCount);

    constructor(address _quizToken) Ownable(msg.sender) {
        quizToken = IQuizToken(_quizToken);
    }

    function createSession(
        bytes32 sessionId,
        uint256 questionCount,
        uint256 timeLimit
    ) external {
        require(sessions[sessionId].host == address(0), "Session exists");
        sessions[sessionId] = Session({
            quizId: sessionId,
            host: msg.sender,
            active: false,
            finalized: false,
            questionCount: questionCount,
            timeLimit: timeLimit,
            createdAt: block.timestamp,
            players: new address[](0)
        });
        emit SessionCreated(sessionId, msg.sender, questionCount);
    }

    function joinSession(bytes32 sessionId) external {
        Session storage s = sessions[sessionId];
        require(s.host != address(0), "Session not found");
        require(!s.active, "Session already started");
        require(!playerScores[sessionId][msg.sender].registered, "Already joined");

        s.players.push(msg.sender);
        playerScores[sessionId][msg.sender].registered = true;
        emit PlayerJoined(sessionId, msg.sender);
    }

    /**
     * @notice Host submits answer results after each question
     * @param speedPercent 0-100, where 100 = answered instantly
     */
    function submitAnswerResult(
        bytes32 sessionId,
        address player,
        bool correct,
        uint256 speedPercent
    ) external {
        Session storage s = sessions[sessionId];
        require(msg.sender == s.host, "Only host");
        require(s.active, "Session not active");

        PlayerScore storage ps = playerScores[sessionId][player];
        if (correct) {
            ps.correctAnswers++;
            ps.totalSpeedScore += speedPercent; // 0-100
        }
        emit ScoreSubmitted(sessionId, player, correct ? speedPercent : 0);
    }

    function startSession(bytes32 sessionId) external {
        require(sessions[sessionId].host == msg.sender, "Not host");
        sessions[sessionId].active = true;
    }

    /**
     * @notice Finalize quiz and mint QTKN rewards to all players
     * @dev reward = (correctAnswers * BASE_REWARD * avgSpeed / 100 * SPEED_MULTIPLIER) + PARTICIPATION_BONUS
     */
    function finalizeAndDistribute(bytes32 sessionId) external nonReentrant {
        Session storage s = sessions[sessionId];
        require(msg.sender == s.host, "Only host");
        require(s.active, "Not active");
        require(!s.finalized, "Already finalized");

        s.active = false;
        s.finalized = true;

        for (uint256 i = 0; i < s.players.length; i++) {
            address player = s.players[i];
            PlayerScore storage ps = playerScores[sessionId][player];
            if (!ps.rewarded) {
                ps.rewarded = true;
                uint256 reward = _calculateReward(ps, s.questionCount);
                quizToken.mintReward(player, reward);
            }
        }
        emit RewardsDistributed(sessionId, s.players.length);
    }

    function _calculateReward(
        PlayerScore memory ps,
        uint256 totalQuestions
    ) internal pure returns (uint256) {
        if (ps.correctAnswers == 0) return PARTICIPATION_BONUS;

        uint256 avgSpeed = ps.totalSpeedScore / ps.correctAnswers;
        uint256 speedBonus = (BASE_REWARD_PER_QUESTION * avgSpeed * SPEED_MULTIPLIER) / 100;
        uint256 accuracyReward = (BASE_REWARD_PER_QUESTION * ps.correctAnswers);
        uint256 accuracyMultiplier = (ps.correctAnswers * 100) / totalQuestions;

        return PARTICIPATION_BONUS + (accuracyReward + speedBonus) * accuracyMultiplier / 100;
    }

    function getPlayers(bytes32 sessionId) external view returns (address[] memory) {
        return sessions[sessionId].players;
    }
}`;


