import { ethers } from "ethers";
import { CONTRACTS, QUIZ_TOKEN_ABI } from "../config";

function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getContract(signer) {
  return new ethers.Contract(CONTRACTS.QUIZ_TOKEN, QUIZ_TOKEN_ABI, signer);
}

export async function isMinter(address) {
  const provider = getProvider();
  const contract = new ethers.Contract(CONTRACTS.QUIZ_TOKEN, QUIZ_TOKEN_ABI, provider);
  return await contract.minters(address);
}

export async function getTokenBalance(address) {
  const provider = getProvider();
  const contract = new ethers.Contract(CONTRACTS.QUIZ_TOKEN, QUIZ_TOKEN_ABI, provider);
  const balance = await contract.balanceOf(address);
  return ethers.formatUnits(balance, 18);
}

export async function distributeRewards(scores) {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const contract = await getContract(signer);

  const students = Object.keys(scores);
  const amounts = students.map(address =>
    ethers.parseUnits(scores[address].totalTokens.toString(), 18)
  );

  console.log("Distributing to:", students);
  console.log("Amounts:", amounts.map(a => ethers.formatUnits(a, 18)));

  const tx = await contract.mintRewardBatch(students, amounts);
  console.log("Transaction sent:", tx.hash);

  await tx.wait();
  console.log("Transaction confirmed:", tx.hash);

  return tx.hash;
}