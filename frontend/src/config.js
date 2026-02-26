export const CONTRACTS = {
  QUIZ_TOKEN: import.meta.env.VITE_QUIZ_TOKEN_ADDRESS,
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

export const REWARDS = {
  BASE_PER_QUESTION: 10,
  SPEED_MULTIPLIER: 2,
  PARTICIPATION: 5,
};