import express from "express";
import Transaction from "../models/Transaction.js";
import Crop from "../models/Crop.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const wallet = String(req.user.walletAddress || "");
    const walletRegex = wallet ? new RegExp(`^${wallet}$`, "i") : null;
    const tx = await Transaction.find({
      $or: walletRegex
        ? [{ farmerWallet: walletRegex }, { buyerWallet: walletRegex }]
        : [{ farmerWallet: req.user.walletAddress }, { buyerWallet: req.user.walletAddress }],
    })
      .populate("cropId", "name quantityUnit unitScale pricePerUnitInr pricePerUnitEth")
      .sort({ createdAt: -1 });
    res.json(tx);
  })
);

router.get(
  "/admin",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const txWithCrop = await Transaction.find()
      .populate("cropId", "name quantityUnit unitScale pricePerUnitInr pricePerUnitEth")
      .sort({ createdAt: -1 });
    res.json(txWithCrop);
  })
);

router.patch(
  "/:id/fulfillment",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ["PENDING", "SHIPPED", "DELIVERED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid fulfillment status" });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const farmer = String(tx.farmerWallet || "").toLowerCase();
    const requester = String(req.user.walletAddress || "").toLowerCase();
    if (farmer !== requester) {
      return res.status(403).json({ error: "Forbidden" });
    }

    tx.fulfillmentStatus = status;
    await tx.save();
    res.json(tx);
  })
);

router.post(
  "/intent",
  auth,
  asyncHandler(async (req, res) => {
    const { txHash, cropId, valueEth, units, shippingAddressId } = req.body;
    if (!txHash || !cropId || !valueEth) {
      return res.status(400).json({ error: "txHash, cropId, and valueEth required" });
    }

    const unitsValue = units !== undefined ? Number(units) : null;
    if (unitsValue !== null && (!Number.isInteger(unitsValue) || unitsValue <= 0)) {
      return res.status(400).json({ error: "Units must be a positive integer" });
    }

    const existing = await Transaction.findOne({ txHash, cropId });
    if (existing) {
      return res.json(existing);
    }

    const crop = await Crop.findById(cropId);
    if (!crop) {
      return res.status(404).json({ error: "Crop not found" });
    }

    let shippingAddress = null;
    let shippingId = null;
    if (shippingAddressId) {
      const addresses = req.user.shippingAddresses || [];
      const match = addresses.find((addr) => String(addr._id) === String(shippingAddressId));
      if (!match) {
        return res.status(400).json({ error: "Shipping address not found" });
      }
      shippingId = String(match._id);
      shippingAddress = {
        label: match.label,
        recipientName: match.recipientName,
        phone: match.phone,
        line1: match.line1,
        line2: match.line2,
        city: match.city,
        state: match.state,
        postalCode: match.postalCode,
        country: match.country,
      };
    }

    const tx = await Transaction.create({
      txHash,
      cropId: crop._id,
      cropName: crop.name,
      farmerWallet: crop.farmerWallet,
      buyerWallet: req.user.walletAddress,
      valueEth,
      units: unitsValue || undefined,
      status: "PENDING",
      shippingAddressId: shippingId || undefined,
      shippingAddress: shippingAddress || undefined,
    });

    res.status(201).json(tx);
  })
);

export default router;
