import express from "express";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loadContractMeta } from "../services/contractMeta.js";

const router = express.Router();
let adminWalletCache = { wallets: new Set(), expiresAt: 0 };

async function getAdminWalletCandidates() {
  if (Date.now() < adminWalletCache.expiresAt) {
    return adminWalletCache.wallets;
  }

  const wallets = new Set();
  const envAdmin = String(process.env.ADMIN_WALLET || "").toLowerCase();
  if (envAdmin) {
    wallets.add(envAdmin);
  }

  try {
    const rpcUrl = process.env.GANACHE_RPC_URL;
    const meta = loadContractMeta();
    const contractAddress = process.env.CONTRACT_ADDRESS || meta?.address;
    const abi = meta?.abi;
    if (rpcUrl && contractAddress && abi) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const owner = String(await contract.owner()).toLowerCase();
      if (owner) {
        wallets.add(owner);
      }
    }
  } catch {
    // ignore network issues; env wallet may still be available
  }

  adminWalletCache = { wallets, expiresAt: Date.now() + 30 * 1000 };
  return wallets;
}

async function findOrProvisionUser(wallet) {
  const normalized = String(wallet || "").toLowerCase();
  if (!normalized) return null;

  let user = await User.findOne({ walletAddress: normalized });
  const adminWallets = await getAdminWalletCandidates();
  const isAdminWallet = adminWallets.has(normalized);
  const defaultPincode = process.env.DEFAULT_PINCODE || "606107";

  if (!user && isAdminWallet) {
    user = await User.create({
      name: "System Admin",
      contact: "admin",
      location: "HQ",
      pincode: defaultPincode,
      role: "ADMIN",
      walletAddress: normalized,
      status: "ACTIVE",
      dvuBalance: 0,
    });
    return user;
  }

  if (user && isAdminWallet) {
    let changed = false;
    if (user.role !== "ADMIN") {
      user.role = "ADMIN";
      changed = true;
    }
    if (user.status !== "ACTIVE") {
      user.status = "ACTIVE";
      changed = true;
    }
    if (!user.pincode) {
      user.pincode = defaultPincode;
      changed = true;
    }
    if (!Number.isFinite(Number(user.dvuBalance))) {
      user.dvuBalance = 0;
      changed = true;
    }
    if (changed) {
      await user.save();
    }
  }

  return user;
}

router.get(
  "/nonce",
  asyncHandler(async (req, res) => {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    const normalized = wallet.toLowerCase();
    const user = await findOrProvisionUser(normalized);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const nonce = randomBytes(16).toString("hex");
    user.nonce = nonce;
    await user.save();

    res.json({ nonce, message: `AgriChain login nonce: ${nonce}` });
  })
);

router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { wallet, signature } = req.body;
    if (!wallet || !signature) {
      return res.status(400).json({ error: "Wallet and signature required" });
    }

    const normalized = wallet.toLowerCase();
    const user = await findOrProvisionUser(normalized);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const message = `AgriChain login nonce: ${user.nonce}`;
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== normalized) {
      return res.status(401).json({ error: "Signature mismatch" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "User not approved" });
    }

    user.nonce = randomBytes(16).toString("hex");
    await user.save();

    const token = signToken(user);
    res.json({
      token,
      role: user.role,
      wallet: user.walletAddress,
      name: user.name,
      location: user.location,
      pincode: user.pincode,
      dvuBalance: Number(user.dvuBalance || 0),
      geoLocation: user.geoLocation || null,
    });
  })
);

router.post(
  "/admin",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: "Admin credentials not configured" });
    }

    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const admin = await User.findOne({ role: "ADMIN", status: "ACTIVE" });
    if (!admin) {
      return res.status(500).json({ error: "Admin user not available" });
    }

    const token = signToken(admin);
    res.json({ token, role: admin.role, wallet: admin.walletAddress, name: admin.name });
  })
);

export default router;
