import express from "express";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get(
  "/nonce",
  asyncHandler(async (req, res) => {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    const normalized = wallet.toLowerCase();
    const user = await User.findOne({ walletAddress: normalized });
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
    const user = await User.findOne({ walletAddress: normalized });
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
    res.json({ token, role: user.role, wallet: user.walletAddress, name: user.name });
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
