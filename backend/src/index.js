import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import cropRoutes from "./routes/crops.js";
import transactionRoutes from "./routes/transactions.js";
import ledgerRoutes from "./routes/ledger.js";
import contractRoutes from "./routes/contract.js";
import statsRoutes from "./routes/stats.js";
import rateRoutes from "./routes/rates.js";
import uploadRoutes from "./routes/uploads.js";
import path from "path";
import User from "./models/User.js";
import { initBlockchainListener } from "./services/blockchain.js";
import { startExpiryMonitor } from "./services/expiry.js";
import { startFulfillmentMonitor } from "./services/fulfillment.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/crops", cropRoutes);
app.use("/transactions", transactionRoutes);
app.use("/ledger", ledgerRoutes);
app.use("/contract", contractRoutes);
app.use("/stats", statsRoutes);
app.use("/rates", rateRoutes);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.use("/uploads", uploadRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

async function ensureAdmin() {
  const adminWallet = process.env.ADMIN_WALLET;
  if (!adminWallet) {
    console.warn("ADMIN_WALLET not set. Admin user not auto-created.");
    return;
  }

  const normalized = adminWallet.toLowerCase();
  const existing = await User.findOne({ walletAddress: normalized });
  if (!existing) {
    await User.create({
      name: "System Admin",
      contact: "admin",
      location: "HQ",
      role: "ADMIN",
      walletAddress: normalized,
      status: "ACTIVE",
    });
    console.log("Admin user created.");
    return;
  }

  if (existing.role !== "ADMIN" || existing.status !== "ACTIVE") {
    existing.role = "ADMIN";
    existing.status = "ACTIVE";
    await existing.save();
    console.log("Admin user updated to ACTIVE.");
  }
}

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  await ensureAdmin();
  await initBlockchainListener();
  startExpiryMonitor();
  startFulfillmentMonitor();

  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
}

start();
