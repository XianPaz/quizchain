// contracts/scripts/addMinters.js
const { ethers } = require("hardhat");

async function main() {
  const token = await ethers.getContractAt(
    "QuizToken",
    "0xb85dFAE246f0e9BF96B47aD9Bf4a21261785e09f"
  );

  await token.addMinter("0xProfessor2WalletAddress");
  console.log("Professor 2 added as minter");

  await token.addMinter("0xProfessor3WalletAddress");
  console.log("Professor 3 added as minter");
}

main().catch(console.error);