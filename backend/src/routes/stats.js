import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";
import User from "../models/User.js";
import Crop from "../models/Crop.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

function sumEth(rows) {
  return rows.reduce((total, row) => total + Number(row.valueEth || 0), 0);
}

router.get(
  "/marketplace",
  asyncHandler(async (req, res) => {
    const [farmers, buyers, crops, transactions] = await Promise.all([
      User.countDocuments({ role: "FARMER", status: "ACTIVE" }),
      User.countDocuments({ role: "BUYER", status: "ACTIVE" }),
      Crop.countDocuments({ status: "APPROVED", expiryDate: { $gt: new Date() } }),
      Transaction.find({ status: "CONFIRMED" }),
    ]);

    res.json({
      farmers,
      buyers,
      activeListings: crops,
      totalEth: sumEth(transactions),
    });
  })
);

router.get(
  "/admin",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const [users, crops, transactions] = await Promise.all([
      User.find(),
      Crop.find(),
      Transaction.find(),
    ]);

    const now = new Date();
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const byRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    const cropCounts = crops.reduce(
      (acc, crop) => {
        acc.total += 1;
        acc[crop.status] = (acc[crop.status] || 0) + 1;
        if (crop.status === "APPROVED" && crop.expiryDate > now) {
          acc.active += 1;
        }
        return acc;
      },
      { total: 0, active: 0 }
    );

    const txCounts = transactions.reduce(
      (acc, tx) => {
        acc.total += 1;
        acc[tx.status] = (acc[tx.status] || 0) + 1;
        acc.totalEth += Number(tx.valueEth || 0);
        return acc;
      },
      { total: 0, totalEth: 0 }
    );

    const categories = crops.reduce((acc, crop) => {
      const key = crop.category || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const expiringSoon = crops.filter((crop) => {
      if (crop.status !== "APPROVED") return false;
      const expiry = new Date(crop.expiryDate);
      const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).length;

    const revenue30d = sumEth(
      transactions.filter((tx) => {
        if (tx.status !== "CONFIRMED") return false;
        const ts = tx.timestamp || tx.createdAt;
        return ts && ts >= last30;
      })
    );

    res.json({
      users: {
        total: users.length,
        pending: users.filter((u) => u.status === "PENDING").length,
        active: users.filter((u) => u.status === "ACTIVE").length,
        byRole,
      },
      crops: {
        total: cropCounts.total,
        pending: cropCounts.PENDING || 0,
        approved: cropCounts.APPROVED || 0,
        sold: cropCounts.SOLD || 0,
        expired: cropCounts.EXPIRED || 0,
        active: cropCounts.active,
        expiringSoon,
      },
      transactions: {
        total: txCounts.total,
        pending: txCounts.PENDING || 0,
        confirmed: txCounts.CONFIRMED || 0,
        totalEth: txCounts.totalEth,
      },
      reports: {
        revenue30d,
        categories,
      },
    });
  })
);

router.get(
  "/farmer",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const [crops, transactions] = await Promise.all([
      Crop.find({ farmerId: req.user._id }),
      Transaction.find({ farmerWallet: req.user.walletAddress }),
    ]);

    const counts = crops.reduce(
      (acc, crop) => {
        acc.total += 1;
        acc[crop.status] = (acc[crop.status] || 0) + 1;
        if (crop.status === "APPROVED" && crop.expiryDate > now) {
          acc.active += 1;
        }
        return acc;
      },
      { total: 0, active: 0 }
    );

    res.json({
      listings: {
        total: counts.total,
        pending: counts.PENDING || 0,
        approved: counts.APPROVED || 0,
        sold: counts.SOLD || 0,
        expired: counts.EXPIRED || 0,
        active: counts.active,
      },
      revenueEth: sumEth(transactions.filter((t) => t.status === "CONFIRMED")),
    });
  })
);

router.get(
  "/buyer",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const [transactions, activeListings] = await Promise.all([
      Transaction.find({ buyerWallet: req.user.walletAddress }),
      Crop.countDocuments({ status: "APPROVED", expiryDate: { $gt: new Date() } }),
    ]);

    res.json({
      orders: {
        total: transactions.length,
        pending: transactions.filter((t) => t.status === "PENDING").length,
        confirmed: transactions.filter((t) => t.status === "CONFIRMED").length,
      },
      spentEth: sumEth(transactions.filter((t) => t.status === "CONFIRMED")),
      activeListings,
    });
  })
);

export default router;
