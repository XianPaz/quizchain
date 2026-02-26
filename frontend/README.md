# QuizChain ⚡

A real-time quiz competition platform where students earn ERC-20 tokens based on speed and accuracy. Built for professors and students — host a quiz, compete live, and receive **QTKN tokens** directly to your wallet on Sepolia Testnet.

---

## How it works

1. **Professor** uploads a quiz CSV, connects MetaMask, and launches a session — a room code is generated
2. **Students** open the app, connect MetaMask, enter a nickname and the room code
3. Questions appear in real time with a countdown timer controlled by the professor
4. The faster a student answers correctly, the more **QTKN** they earn
5. After each question the professor shows statistics and the leaderboard before moving on
6. At the end the professor distributes tokens — one on-chain transaction mints QTKN directly to every student's wallet on Sepolia

---

## Reward formula

```
reward = (correctAnswers × 10 QTKN)
       + speedBonus (up to 2× for instant answer)
       × accuracyPercentage
       + 5 QTKN participation bonus
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Real-time | Socket.io |
| Backend | Node.js + Express |
| Blockchain | Solidity + Hardhat |
| Network | Sepolia Testnet |
| Wallet | MetaMask |
| Token standard | ERC-20 |
| Token library | OpenZeppelin |

---

## Project structure

```
quizchain/
├── frontend/                  # React app
│   ├── src/
│   │   ├── views/
│   │   │   ├── LandingView.jsx      # Home screen
│   │   │   ├── HostDashboard.jsx    # CSV upload + quiz preview
│   │   │   ├── JoinView.jsx         # Room code + nickname entry
│   │   │   ├── HostGame.jsx         # Professor game console
│   │   │   └── StudentGame.jsx      # Student quiz experience
│   │   ├── components/
│   │   │   ├── WalletBar.jsx
│   │   │   ├── TimerCircle.jsx
│   │   │   ├── SpeedIndicator.jsx
│   │   │   └── TokenRain.jsx
│   │   ├── hooks/
│   │   │   ├── useWallet.js         # MetaMask connect/disconnect
│   │   │   └── useQuizSocket.js     # Socket.io event management
│   │   ├── utils/
│   │   │   ├── helpers.js           # formatAddress, calcTokenReward, etc.
│   │   │   ├── parseQuizCSV.js      # CSV parser and validator
│   │   │   └── blockchain.js        # Contract interaction via ethers.js
│   │   ├── constants/
│   │   │   └── sampleData.js
│   │   ├── styles/
│   │   │   ├── colors.js
│   │   │   └── styles.js
│   │   ├── api.js                   # REST calls to backend
│   │   ├── socket.js                # Socket.io client instance
│   │   ├── config.js                # Contract address, ABI, reward constants
│   │   └── App.jsx
│   └── package.json
│
├── backend/                   # Node.js server
│   ├── routes/
│   │   └── sessions.js        # REST endpoints
│   ├── server.js              # Express + Socket.io
│   ├── sessionStore.js        # In-memory session registry
│   ├── .env                   # Environment variables (never commit)
│   └── package.json
│
├── contracts/                 # Solidity smart contracts
│   ├── contracts/
│   │   └── QuizToken.sol      # ERC-20 QTKN with multi-minter support
│   ├── scripts/
│   │   ├── deploy.js          # Deploy QuizToken to Sepolia
│   │   └── addMinters.js      # Add professor wallets as minters
│   ├── hardhat.config.js
│   ├── .env                   # Deployer private key (never commit)
│   └── package.json
│
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- Sepolia testnet ETH — get it free at [sepoliafaucet.com](https://sepoliafaucet.com)
- Infura account for Sepolia RPC URL — [infura.io](https://infura.io)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/quizchain.git
cd quizchain
```

### 2. Start the backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
node server.js
```

Backend runs on `http://localhost:3001`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Deploy smart contracts

```bash
cd contracts
npm install --save-dev hardhat@2.28.0 @nomicfoundation/hardhat-toolbox --legacy-peer-deps
npm install @openzeppelin/contracts
cp .env.example .env   # fill in your values
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the deployed contract address into `frontend/src/config.js`.

### 5. Add professors as minters

Edit `contracts/scripts/addMinters.js` with the wallet addresses of the other professors, then run:

```bash
npx hardhat run scripts/addMinters.js --network sepolia
```

---

## Environment variables

### `backend/.env`

```
PORT=3001
CLIENT_URL=http://localhost:5173
```

### `contracts/.env`

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_deployer_wallet_private_key
```

---

## Quiz CSV format

Create a Google Sheet following this structure and export as **File → Download → CSV**:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| quiz_name | My Quiz Title | | | | | | | |
| | | | | | | | | |
| question | option_a | option_b | option_c | option_d | option_e | option_f | correct | time_limit |
| What is Ethereum? | A blockchain | A database | A coin | A protocol | | | A | 20 |
| True or false? | True | False | | | | | B | 10 |

**Rules:**
- Row 1: `quiz_name` in A1, quiz title in B1
- Row 2: leave empty
- Row 3: column headers (required, not imported)
- Row 4+: one question per row
- `option_a` and `option_b` are required — minimum 2 options
- `option_c` through `option_f` are optional — maximum 6 options
- `correct` must be `A`, `B`, `C`, `D`, `E`, or `F` matching the number of options provided
- `time_limit` must be a number between 5 and 120 seconds

---

## Smart contract

### QuizToken.sol
- ERC-20 token with symbol **QTKN**
- Maximum supply: 10,000,000 QTKN
- Deployed on **Sepolia Testnet**
- Multi-minter support — owner adds approved professor wallets
- `mintReward(address, amount)` — mint to a single student
- `mintRewardBatch(address[], amounts[])` — mint to all students in one transaction
- `addMinter(address)` — owner adds a professor as minter
- `removeMinter(address)` — owner removes a minter

### Deployment order

```bash
# 1. Deploy QuizToken
npx hardhat run scripts/deploy.js --network sepolia

# 2. Add other professors as minters
npx hardhat run scripts/addMinters.js --network sepolia
```

---

## Game flow

```
PROFESSOR                               STUDENTS
─────────────────────────────────       ──────────────────────────────
Upload CSV quiz file
Preview questions
Connect MetaMask (must be minter)
Launch session → room code shown
                                        Connect MetaMask
                                        Enter nickname + room code
                                        Join → "Waiting for host..."
See students joining in lobby
Click "Start Quiz"               ──→   First question appears with timer
                                        Answer or timeout
                                        "Waiting for others..."
See X/Y answered progress bar
Click "Show Results"             ──→   Stats + leaderboard shown
Click "Next Question"            ──→   Next question appears
[cycle repeats for each question]
Click "End Quiz"                 ──→   "Waiting for distribution..."
See final scores + leaderboard
Click "Distribute Rewards"
MetaMask confirmation popup
mintRewardBatch() on-chain       ──→   Tokens received screen
Etherscan link shown                   Balance + Etherscan link shown
Back to Dashboard                      Play Again
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/create` | Host creates a new quiz session |
| GET | `/sessions/:roomCode` | Validate a room code before joining |
| DELETE | `/sessions/:roomCode` | Delete session after quiz ends |

---

## Socket.io events

| Event | Direction | Description |
|---|---|---|
| `join_room` | client → server | Host or student joins a socket room |
| `player_joined` | server → all | Broadcast when a new student joins |
| `host_start_quiz` | host → server | Host starts the quiz |
| `quiz_started` | server → all | Students notified quiz has begun |
| `host_open_question` | host → server | Host opens a specific question |
| `question_opened` | server → all | Everyone receives question index |
| `student_answer` | student → server | Student submits answer + speed score |
| `student_timeout` | student → server | Student ran out of time |
| `answer_ack` | server → student | Confirm answer was received |
| `answer_count` | server → all | Updated answered count broadcast |
| `all_answered` | server → host | All students answered or timed out |
| `host_show_stats` | host → server | Host requests stats for current question |
| `question_stats` | server → all | Answer distribution + leaderboard |
| `host_end_quiz` | host → server | Host ends the quiz |
| `quiz_ended` | server → all | Final scores for everyone |
| `host_distribute` | host → server | Rewards distributed on-chain |
| `rewards_distributed` | server → all | Students notified tokens were sent |
| `host_end_without_distribute` | host → server | Host leaves without distributing |
| `session_cancelled` | server → all | Students notified session was cancelled |

---

## Notes

- **Nicknames** are session-only and never stored. The same wallet can use a different nickname each session.
- **Token distribution** is a single on-chain transaction using `mintRewardBatch` — supports up to ~500 students safely within Sepolia's block gas limit.
- **Session state** is in-memory on the backend — restarting the server clears all active sessions.
- **Minter check** — only wallets added via `addMinter()` can distribute rewards. The deploying professor is automatically a minter.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: your feature description"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

MIT
