import { ethers } from "ethers";
import { CONTRACTS, QUIZ_TOKEN_ABI, PODIUM_NFT_ABI } from "../config";
import { podiumTokensFromEvents } from "./podium";

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

  // Filter out any invalid addresses
  const validScores = Object.entries(scores).filter(([address]) => {
    const isValid = address &&
      address !== "undefined" &&
      ethers.isAddress(address);
    if (!isValid) console.warn("Skipping invalid address:", address);
    return isValid;
  });

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

// Una sola transacción para todo el podio. Los IDs salen de los eventos del
// recibo: el contrato numera en orden y no hay otra forma de saber cuál tocó.
export async function mintPodiumNfts({ recipients, inputs }) {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACTS.PODIUM_NFT, PODIUM_NFT_ABI, signer);

  const tx = await contract.mintPodiumBatch(recipients, inputs);
  const receipt = await tx.wait();

  const events = receipt.logs
    .filter((log) => log.address.toLowerCase() === CONTRACTS.PODIUM_NFT.toLowerCase())
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .filter((parsed) => parsed && parsed.name === "PodiumMinted")
    .map((parsed) => parsed.args);

  return { hash: tx.hash, tokens: podiumTokensFromEvents(events) };
}

// MetaMask pregunta al alumno y la agrega a la pestaña NFTs. En Sepolia no la
// detecta sola, así que sin esto había que importarla a mano.
export async function addPodiumNftToWallet(tokenId) {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return window.ethereum.request({
    method: "wallet_watchAsset",
    params: {
      type: "ERC721",
      options: { address: CONTRACTS.PODIUM_NFT, tokenId: String(tokenId) },
    },
  });
}
