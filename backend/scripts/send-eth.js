#!/usr/bin/env node
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

function arg(name) {
  const key = `--${name}`;
  const index = process.argv.indexOf(key);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const to = arg("to");
const amountEth = arg("eth") || "1";
const rpcUrl = arg("rpc") || process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
const fromArg = arg("from");
const privateKey = arg("pk") || process.env.TOPUP_PRIVATE_KEY || "";

if (!to) {
  fail("Usage: npm run send:eth -- --to <0xAddress> [--eth 1] [--rpc http://127.0.0.1:7545] [--from 0xFrom] [--pk 0xPrivateKey]");
}

if (!ethers.isAddress(to)) {
  fail(`Invalid --to address: ${to}`);
}

let valueWei;
try {
  valueWei = ethers.parseEther(amountEth);
} catch {
  fail(`Invalid --eth amount: ${amountEth}`);
}

if (valueWei <= 0n) {
  fail("--eth must be greater than 0");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);

async function main() {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  let txHash = "";
  let from = "";

  if (privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider);
    from = wallet.address;
    const tx = await wallet.sendTransaction({ to, value: valueWei });
    txHash = tx.hash;
  } else {
    const accounts = await provider.send("eth_accounts", []);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      fail("No unlocked accounts available on RPC. Provide --pk or unlock accounts in Ganache.");
    }

    from = fromArg || accounts[0];
    if (!ethers.isAddress(from)) {
      fail(`Invalid --from address: ${from}`);
    }

    txHash = await provider.send("eth_sendTransaction", [
      {
        from,
        to,
        value: ethers.toBeHex(valueWei),
      },
    ]);
  }

  console.log(`Sent transaction on chain ${chainId}`);
  console.log(`From: ${from}`);
  console.log(`To:   ${to}`);
  console.log(`ETH:  ${amountEth}`);
  console.log(`Tx:   ${txHash}`);

  const receipt = await provider.waitForTransaction(txHash);
  const status = receipt?.status;
  if (!receipt || (status !== 1 && status !== 1n)) {
    fail("Transaction failed");
  }

  const toBalance = await provider.getBalance(to);
  console.log(`New balance for ${to}: ${ethers.formatEther(toBalance)} ETH`);
}

main().catch((error) => {
  fail(error?.message || String(error));
});
