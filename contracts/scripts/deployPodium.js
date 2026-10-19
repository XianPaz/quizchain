const { ethers } = require("hardhat");

// Deploya QuizPodiumNFT. La cuenta que deploya queda como dueña y como minter.
// Otros profes: PODIUM_MINTERS=0xabc...,0xdef... en contracts/.env.
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Podium = await ethers.getContractFactory("QuizPodiumNFT");
  const podium = await Podium.deploy();
  await podium.waitForDeployment();
  console.log("QuizPodiumNFT deployed to:", podium.target);

  const extra = (process.env.PODIUM_MINTERS || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  for (const minter of extra) {
    const tx = await podium.addMinter(minter);
    await tx.wait();
    console.log("Minter added:", minter);
  }

  console.log("\nEn frontend/.env (y en Netlify): VITE_PODIUM_NFT_ADDRESS=" + podium.target);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
