import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;
const DEPLOY_PATH = path.resolve("deployments", "ganache.json");

function parseTargetOwner() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--owner") {
      return args[index + 1] || "";
    }
  }
  return process.env.NEW_OWNER || "";
}

async function main() {
  const targetOwner = parseTargetOwner();
  if (!ethers.isAddress(targetOwner)) {
    throw new Error("Provide a valid owner wallet via --owner 0x... or NEW_OWNER env.");
  }

  if (!fs.existsSync(DEPLOY_PATH)) {
    throw new Error("Missing deployments/ganache.json. Deploy contract first.");
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOY_PATH, "utf8"));
  if (!deployment?.address) {
    throw new Error("Deployment address not found in deployments/ganache.json.");
  }

  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("AgriChain", deployment.address, signer);
  const currentOwner = await contract.owner();
  if (currentOwner.toLowerCase() === targetOwner.toLowerCase()) {
    console.log(`Owner already set to ${targetOwner}`);
    return;
  }

  const tx = await contract.transferOwnership(targetOwner);
  await tx.wait();
  console.log(`Ownership transferred: ${currentOwner} -> ${targetOwner}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
