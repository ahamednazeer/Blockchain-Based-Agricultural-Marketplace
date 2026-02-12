import { ethers } from "ethers";
import Crop from "../models/Crop.js";
import Transaction from "../models/Transaction.js";
import LedgerEvent from "../models/LedgerEvent.js";
import { loadContractMeta } from "./contractMeta.js";

function isValidPrivateKey(key) {
  if (typeof key !== "string") {
    return false;
  }
  if (!ethers.isHexString(key, 32)) {
    return false;
  }
  const stripped = key.startsWith("0x") ? key.slice(2) : key;
  if (/^0+$/.test(stripped)) {
    return false;
  }
  return true;
}

function parseQuantity(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 1;
    }
  }
  const match = String(value || "").match(/[\d.]+/);
  if (!match) {
    return 1;
  }
  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 1;
  }
  return Math.floor(numeric);
}

async function handleCropListed({
  cropId,
  farmer,
  pricePerUnit,
  quantity,
  offchainId,
  txHash,
  blockNumber,
  logIndex,
  timestamp,
}) {
  await LedgerEvent.findOneAndUpdate(
    { txHash, logIndex, type: "CropListed" },
    {
      type: "CropListed",
      cropId: Number(cropId),
      offchainId,
      actor: farmer,
      txHash,
      valueEth: ethers.formatEther(pricePerUnit),
      timestamp,
      blockNumber,
      logIndex,
    },
    { upsert: true, new: true }
  );

  if (offchainId) {
    const perBaseEth = ethers.formatEther(pricePerUnit);
    const update = {
      contractCropId: Number(cropId),
      txHash,
      status: "APPROVED",
      pricePerBaseUnitEth: perBaseEth,
    };
    const crop = await Crop.findById(offchainId);
    if (crop) {
      const scale = Number(crop.unitScale);
      if (Number.isFinite(scale) && scale > 0) {
        const perUnitWei = BigInt(pricePerUnit) * BigInt(scale);
        update.pricePerUnitEth = ethers.formatEther(perUnitWei);
      }
    }
    await Crop.findOneAndUpdate({ _id: offchainId }, update);
  }
}

async function handleCropPurchased({
  cropId,
  buyer,
  units,
  value,
  txHash,
  blockNumber,
  logIndex,
  timestamp,
}) {
  const normalizedBuyer = typeof buyer === "string" ? buyer.toLowerCase() : buyer;
  const crop = await Crop.findOne({ contractCropId: Number(cropId) });
  const unitsPurchased = Number(units);
  const valueEth = ethers.formatEther(value);

  await LedgerEvent.findOneAndUpdate(
    { txHash, logIndex, type: "CropPurchased" },
    {
      type: "CropPurchased",
      cropId: Number(cropId),
      actor: normalizedBuyer,
      txHash,
      valueEth,
      units: Number.isFinite(unitsPurchased) ? unitsPurchased : undefined,
      timestamp,
      blockNumber,
      logIndex,
    },
    { upsert: true, new: true }
  );

  const updatePayload = {
    txHash,
    valueEth,
    buyerWallet: normalizedBuyer,
    farmerWallet: crop?.farmerWallet || "unknown",
    cropId: crop?._id,
    cropName: crop?.name,
    units: Number.isFinite(unitsPurchased) ? unitsPurchased : undefined,
    status: "CONFIRMED",
    blockNumber,
    logIndex,
    timestamp,
  };

  let matchedIntentId = null;
  if (crop && normalizedBuyer) {
    const buyerRegex = new RegExp(`^${normalizedBuyer}$`, "i");
    const candidates = await Transaction.find({
      status: "PENDING",
      cropId: crop._id,
      buyerWallet: buyerRegex,
      ...(Number.isFinite(unitsPurchased) ? { units: unitsPurchased } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(5);

    const targetTime = timestamp ? new Date(timestamp).getTime() : Date.now();
    for (const candidate of candidates) {
      if (candidate.txHash && candidate.txHash !== txHash) {
        continue;
      }
      const createdAt = candidate.createdAt ? new Date(candidate.createdAt).getTime() : targetTime;
      if (Math.abs(targetTime - createdAt) > 1000 * 60 * 120) {
        continue;
      }
      let matchesValue = true;
      if (candidate.valueEth) {
        try {
          const candidateWei = ethers.parseEther(String(candidate.valueEth));
          const valueWei = ethers.parseEther(String(valueEth));
          matchesValue = candidateWei === valueWei;
        } catch {
          matchesValue = true;
        }
      }
      if (matchesValue) {
        matchedIntentId = candidate._id;
        break;
      }
    }
  }

  if (matchedIntentId) {
    await Transaction.findByIdAndUpdate(matchedIntentId, updatePayload, { new: true });
  } else {
    const txQuery = crop ? { txHash, cropId: crop._id } : { txHash, logIndex };
    await Transaction.findOneAndUpdate(txQuery, updatePayload, { upsert: true, new: true });
  }

  if (crop && normalizedBuyer) {
    const buyerRegex = new RegExp(`^${normalizedBuyer}$`, "i");
    await Transaction.deleteMany({
      status: "PENDING",
      cropId: crop._id,
      buyerWallet: buyerRegex,
      ...(Number.isFinite(unitsPurchased) ? { units: unitsPurchased } : {}),
      $or: [{ txHash: { $exists: false } }, { txHash: "" }],
    });
  }

  if (crop) {
    if (
      Number.isFinite(unitsPurchased) &&
      Number.isFinite(Number(crop.quantityBaseValue)) &&
      Number.isFinite(Number(crop.unitScale))
    ) {
      const remainingBase = Math.max(0, Number(crop.quantityBaseValue) - unitsPurchased);
      crop.quantityBaseValue = remainingBase;
      const displayValue = remainingBase / Number(crop.unitScale);
      crop.quantityValue = displayValue;
      if (crop.quantityUnit) {
        const formatted = Number.isInteger(displayValue)
          ? String(displayValue)
          : String(Number(displayValue.toFixed(6)));
        crop.quantity = `${formatted} ${crop.quantityUnit}`;
      }
      crop.status = remainingBase === 0 ? "SOLD" : "APPROVED";
    } else {
      crop.status = "SOLD";
    }
    await crop.save();
  }
}

async function reconcilePendingTransactions(provider, contract) {
  const pending = await Transaction.find({ status: "PENDING" })
    .sort({ createdAt: -1 })
    .limit(200);
  if (!pending.length) {
    return;
  }
  const txHashes = Array.from(
    new Set(
      pending
        .map((tx) => tx.txHash)
        .filter((hash) => typeof hash === "string" && hash.length > 0)
    )
  );

  for (const txHash of txHashes) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        continue;
      }
      const block = receipt.blockNumber ? await provider.getBlock(receipt.blockNumber) : null;
      const timestamp = block?.timestamp ? new Date(block.timestamp * 1000) : new Date();

      if (receipt.status === 0) {
        await Transaction.updateMany(
          { txHash, status: "PENDING" },
          { status: "FAILED", blockNumber: receipt.blockNumber, timestamp }
        );
        continue;
      }

      let matched = false;
      for (const log of receipt.logs || []) {
        let parsed;
        try {
          parsed = contract.interface.parseLog(log);
        } catch {
          continue;
        }
        if (parsed?.name === "CropPurchased") {
          matched = true;
          await handleCropPurchased({
            cropId: parsed.args.cropId,
            buyer: parsed.args.buyer,
            units: parsed.args.units,
            value: parsed.args.value,
            txHash: receipt.hash || txHash,
            blockNumber: receipt.blockNumber,
            logIndex: log.logIndex,
            timestamp,
          });
        } else if (parsed?.name === "CropListed") {
          await handleCropListed({
            cropId: parsed.args.cropId,
            farmer: parsed.args.farmer,
            pricePerUnit: parsed.args.pricePerUnit,
            quantity: parsed.args.quantity,
            expiry: parsed.args.expiry,
            offchainId: parsed.args.offchainId,
            txHash: receipt.hash || txHash,
            blockNumber: receipt.blockNumber,
            logIndex: log.logIndex,
            timestamp,
          });
        }
      }

      if (!matched) {
        await Transaction.updateMany(
          { txHash, status: "PENDING" },
          { status: "CONFIRMED", blockNumber: receipt.blockNumber, timestamp }
        );
      }
    } catch (error) {
      console.warn("Pending tx reconcile failed:", txHash, error?.message || error);
    }
  }
}

async function syncPastEvents(provider, contract) {
  const latest = await provider.getBlockNumber();
  if (!Number.isFinite(latest) || latest <= 0) {
    return;
  }
  const fromEnv = Number(process.env.TX_SYNC_FROM_BLOCK);
  const lookback = Number(process.env.TX_SYNC_LOOKBACK_BLOCKS) || 5000;
  const fromBlock = Number.isFinite(fromEnv) ? Math.max(0, Math.floor(fromEnv)) : Math.max(0, latest - lookback);

  if (fromBlock > latest) {
    return;
  }

  const listed = await contract.queryFilter(contract.filters.CropListed(), fromBlock, latest);
  for (const event of listed) {
    try {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block?.timestamp ? new Date(block.timestamp * 1000) : new Date();
      await handleCropListed({
        cropId: event.args?.cropId,
        farmer: event.args?.farmer,
        pricePerUnit: event.args?.pricePerUnit,
        quantity: event.args?.quantity,
        offchainId: event.args?.offchainId,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        timestamp,
      });
    } catch (error) {
      console.warn("Sync CropListed failed:", error?.message || error);
    }
  }

  const purchased = await contract.queryFilter(contract.filters.CropPurchased(), fromBlock, latest);
  for (const event of purchased) {
    try {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block?.timestamp ? new Date(block.timestamp * 1000) : new Date();
      await handleCropPurchased({
        cropId: event.args?.cropId,
        buyer: event.args?.buyer,
        units: event.args?.units,
        value: event.args?.value,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        timestamp,
      });
    } catch (error) {
      console.warn("Sync CropPurchased failed:", error?.message || error);
    }
  }
}

export async function listCropOnChain(crop) {
  const rpcUrl = process.env.GANACHE_RPC_URL;
  const meta = loadContractMeta();
  const contractAddress = process.env.CONTRACT_ADDRESS || meta?.address;
  const adminKey = process.env.ADMIN_PRIVATE_KEY;
  if (!rpcUrl || !contractAddress || !adminKey) {
    throw new Error("Blockchain config missing for on-chain listing.");
  }

  if (!isValidPrivateKey(adminKey)) {
    throw new Error(
      "Invalid ADMIN_PRIVATE_KEY. Provide a real 32-byte hex private key from Ganache (starts with 0x)."
    );
  }

  const abi = meta?.abi;
  if (!abi) {
    throw new Error("Contract ABI missing.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(adminKey, provider);
  const contract = new ethers.Contract(contractAddress, abi, signer);

  const baseValue = Number(crop.quantityBaseValue);
  const quantity = Number.isFinite(baseValue) && baseValue > 0 ? Math.floor(baseValue) : parseQuantity(crop.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Invalid quantity for on-chain listing.");
  }

  let perBaseEth = crop.pricePerBaseUnitEth;
  if (!perBaseEth && crop.pricePerUnitEth && crop.unitScale) {
    const perUnitWei = ethers.parseEther(String(crop.pricePerUnitEth));
    const scale = BigInt(crop.unitScale);
    if (scale > 0n) {
      perBaseEth = ethers.formatEther(perUnitWei / scale);
    }
  }
  if (!perBaseEth && crop.priceEth) {
    const totalWei = ethers.parseEther(String(crop.priceEth));
    perBaseEth = ethers.formatEther(totalWei / BigInt(quantity));
  }

  if (!perBaseEth) {
    throw new Error("Per-base-unit ETH price missing for on-chain listing.");
  }

  const price = ethers.parseEther(String(perBaseEth));
  const expiry = Math.floor(new Date(crop.expiryDate).getTime() / 1000);
  if (!Number.isFinite(expiry)) {
    throw new Error("Invalid expiry date.");
  }

  const tx = await contract.listCrop(
    crop.farmerWallet,
    price,
    quantity,
    expiry,
    crop._id.toString()
  );
  const receipt = await tx.wait();

  let cropId = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "CropListed") {
        cropId = Number(parsed.args.cropId);
        break;
      }
    } catch {
      // ignore non-matching logs
    }
  }

  return { txHash: receipt.hash, cropId };
}

export async function initBlockchainListener() {
  const rpcUrl = process.env.GANACHE_RPC_URL;
  const meta = loadContractMeta();
  const contractAddress = process.env.CONTRACT_ADDRESS || meta?.address;
  if (!rpcUrl || !contractAddress) {
    console.warn("Blockchain listener skipped: GANACHE_RPC_URL or CONTRACT_ADDRESS missing.");
    return;
  }

  const abi = meta?.abi;
  if (!abi) {
    console.warn("Blockchain listener skipped: contract ABI not found.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  contract.on("CropListed", async (cropId, farmer, pricePerUnit, quantity, expiry, offchainId, event) => {
    const txHash = event.transactionHash;
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block?.timestamp ? new Date(block.timestamp * 1000) : new Date();
    await handleCropListed({
      cropId,
      farmer,
      pricePerUnit,
      quantity,
      offchainId,
      txHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      timestamp,
    });
  });

  contract.on("CropPurchased", async (cropId, buyer, units, value, event) => {
    const txHash = event.transactionHash;
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block?.timestamp ? new Date(block.timestamp * 1000) : new Date();
    await handleCropPurchased({
      cropId,
      buyer,
      units,
      value,
      txHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      timestamp,
    });
  });

  const intervalMs = Number(process.env.TX_RECONCILE_INTERVAL_MS) || 15000;
  const doSync = String(process.env.TX_SYNC_ENABLED || "true").toLowerCase() !== "false";
  if (doSync) {
    syncPastEvents(provider, contract).catch((error) => {
      console.warn("Initial event sync failed:", error?.message || error);
    });
  }
  setTimeout(() => {
    reconcilePendingTransactions(provider, contract).catch((error) => {
      console.warn("Initial tx reconcile failed:", error?.message || error);
    });
  }, 1500);
  setInterval(() => {
    reconcilePendingTransactions(provider, contract).catch((error) => {
      console.warn("Tx reconcile failed:", error?.message || error);
    });
  }, intervalMs);

  console.log("Blockchain listener active.");
}
