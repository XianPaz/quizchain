export const CONTRACTS = {
  QUIZ_TOKEN: import.meta.env.VITE_QUIZ_TOKEN_ADDRESS,
  // Sin esta variable la app funciona igual, solo que sin medallas NFT.
  PODIUM_NFT: import.meta.env.VITE_PODIUM_NFT_ADDRESS || "",
  NETWORK: "sepolia",
  CHAIN_ID: 11155111,
  CHAIN_HEX: "0xaa36a7",
};

export const QUIZ_TOKEN_ABI = [
  "function mintRewardBatch(address[] calldata students, uint256[] calldata amounts) external",
  "function mintReward(address student, uint256 amount) external",
  "function minters(address) view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function addMinter(address minter) external",
  "function removeMinter(address minter) external",
];

const PODIUM_INPUT =
  "tuple(string sessionId, string quizName, string className, string date, uint8 rank, uint256 qtkn, uint256 correct, uint256 totalQuestions, string nickname)";

export const PODIUM_NFT_ABI = [
  `function mintPodiumBatch(address[] recipients, ${PODIUM_INPUT}[] inputs) external returns (uint256[])`,
  "function minters(address) view returns (bool)",
  "function hasPodium(string sessionId, address student) view returns (bool)",
  "event PodiumMinted(address indexed minter, address indexed student, uint256 indexed tokenId, string sessionId, uint8 rank)",
];

// La tabla de QTKN vive en shared/gameContract.js. Se lee desde ./game/contract.