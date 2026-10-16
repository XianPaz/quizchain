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
  QTKN_BY_PLACE: [21, 18, 16, 15, 14, 13, 12, 11, 10],
  QTKN_FIRST: 21,
  QTKN_FLOOR_CORRECT: 10,
  QTKN_INCORRECT: 0,
};