# QuizChain ⚡

A real-time quiz competition platform where players earn ERC-20 tokens based on speed and accuracy. Built for professors and students — host a quiz, compete live, and receive **QTKN tokens** directly to your wallet on Sepolia Testnet.

---

## How it works

1. **Professor** creates a quiz and launches a session — a room code is generated
2. **Students** open the app, connect MetaMask, and enter the room code
3. Questions appear in real time with a countdown timer
4. The faster a student answers correctly, the more **QTKN** they earn
5. At the end of the quiz, tokens are distributed to every player's wallet on Sepolia

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

---

## Project structure

```
quizchain/
├── frontend/                  # React app
│   ├── src/
│   │   ├── views/             # LandingView, HostDashboard, JoinView, LiveGame
│   │   ├── components/        # WalletBar, TimerCircle, SpeedIndicator, TokenRain
│   │   ├── hooks/             # useWallet.js
│   │   ├── utils/             # helpers.js
│   │   ├── constants/         # sampleData.js
│   │   ├── styles/            # colors.js, styles.js
│   │   ├── api.js             # REST calls to backend
│   │   ├── socket.js          # Socket.io client
│   │   ├── config.js          # Contract addresses, reward constants
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
│   │   ├── QuizToken.sol      # ERC-20 QTKN token
│   │   └── QuizGame.sol       # Session management + reward distribution
│   ├── scripts/
│   │   └── deploy.js          # Hardhat deploy script
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

### 4. Deploy smart contracts (optional for full token flow)

```bash
cd contracts
npm install
cp .env.example .env   # fill in your values
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the deployed addresses into `frontend/src/config.js`.

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

## Smart contracts

### QuizToken.sol
- ERC-20 token with symbol **QTKN**
- Maximum supply: 10,000,000 QTKN
- Only the `QuizGame` contract can mint rewards
- Initial 1,000,000 QTKN minted to deployer for liquidity

### QuizGame.sol
- Hosts create sessions with a question count and time limit
- Players register their wallet address to join
- Host submits answer results after each question
- `finalizeAndDistribute()` calculates and mints rewards to all players

### Deployment order

```bash
# 1. Deploy QuizToken
# 2. Deploy QuizGame, passing QuizToken address as constructor argument
# 3. Call setQuizGameContract(quizGameAddress) on QuizToken
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/create` | Host creates a new quiz session |
| GET | `/sessions/:roomCode` | Validate a room code before joining |
| DELETE | `/sessions/:roomCode` | Delete session after quiz ends |

### Socket.io events

| Event | Direction | Description |
|---|---|---|
| `join_room` | client → server | Host or player joins a socket room |
| `player_joined` | server → client | Broadcast when a new player joins |
| `start_quiz` | client → server | Host starts the quiz |
| `quiz_started` | server → client | Notify all players quiz has begun |
| `next_question` | client → server | Host pushes next question index |
| `question` | server → client | Broadcast question to all players |
| `submit_answer` | client → server | Player submits an answer |
| `answer_received` | server → client | Broadcast answer to host |
| `end_quiz` | client → server | Host ends the quiz |
| `quiz_ended` | server → client | Notify all players with final results |

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
