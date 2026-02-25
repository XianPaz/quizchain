const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Token = await ethers.getContractFactory("QuizToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  console.log("QuizToken deployed to:", token.target);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});