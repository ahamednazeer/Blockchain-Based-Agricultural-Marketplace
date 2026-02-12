import fs from "fs";
import path from "path";
import hre from "hardhat";
const { ethers } = hre;

const DEPLOY_PATH = path.resolve("deployments", "ganache.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  const AgriChain = await ethers.getContractFactory("AgriChain");
  const contract = await AgriChain.deploy(deployer.address);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const abi = contract.interface.formatJson();

  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }

  fs.writeFileSync(
    DEPLOY_PATH,
    JSON.stringify({ address, abi: JSON.parse(abi) }, null, 2)
  );

  console.log(`AgriChain deployed to ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
