import express from "express";
import Transaction from "../models/Transaction.js";
import Crop from "../models/Crop.js";
import LedgerEvent from "../models/LedgerEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const HOUR_MS = 1000 * 60 * 60;

function normalizeWallet(value) {
  return String(value || "").toLowerCase();
}

function canManageOrder(user, tx) {
  if (!user || !tx) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "FARMER") return false;
  return normalizeWallet(tx.farmerWallet) === normalizeWallet(user.walletAddress);
}

function resolveLedgerHash(tx, suffix) {
  if (tx?.txHash) {
    return tx.txHash;
  }
  return `manual-${tx?._id || "tx"}-${suffix}-${Date.now()}`;
}

async function writeOrderLedgerEvent(type, tx, actor, payload = {}) {
  await LedgerEvent.create({
    type,
    cropId: tx?.contractCropId || undefined,
    offchainId: tx?.cropId ? String(tx.cropId) : undefined,
    actor: actor || "system",
    txHash: resolveLedgerHash(tx, type),
    valueEth: tx?.valueEth,
    valueDvu: tx?.valueDvu,
    units: tx?.units,
    timestamp: new Date(),
    ...payload,
  });
}

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
      .populate(
        "cropId",
        "name quantityUnit unitScale pricePerUnitInr pricePerUnitEth qualityGrade farmerPincode"
      )
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
      .populate(
        "cropId",
        "name quantityUnit unitScale pricePerUnitInr pricePerUnitEth qualityGrade farmerPincode"
      )
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

    const farmer = normalizeWallet(tx.farmerWallet);
    const requester = normalizeWallet(req.user.walletAddress);
    if (farmer !== requester) {
      return res.status(403).json({ error: "Forbidden" });
    }

    tx.fulfillmentStatus = status;
    if (status === "SHIPPED") {
      tx.pickupStatus = "PICKED_UP";
      tx.transitStatus = "IN_TRANSIT";
      tx.pickupAt = tx.pickupAt || new Date();
      tx.transitAt = tx.transitAt || new Date();
    }
    if (status === "DELIVERED") {
      tx.pickupStatus = "PICKED_UP";
      tx.transitStatus = "DELIVERED";
      tx.deliveredAt = new Date();
      if (tx.slaDeadlineAt instanceof Date) {
        tx.slaBreached = tx.deliveredAt.getTime() > tx.slaDeadlineAt.getTime();
      }
    }
    await tx.save();
    await writeOrderLedgerEvent("FulfillmentUpdated", tx, req.user.walletAddress, {
      note: `Fulfillment updated to ${status}`,
    });
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
      slaDeadlineAt: (() => {
        const defaultSlaHours = Number(process.env.DELIVERY_SLA_HOURS || 24);
        const baseline = new Date(Date.now() + defaultSlaHours * HOUR_MS);
        const expiry = new Date(crop.expiryDate);
        if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < baseline.getTime()) {
          return expiry;
        }
        return baseline;
      })(),
      shippingAddressId: shippingId || undefined,
      shippingAddress: shippingAddress || undefined,
    });

    res.status(201).json(tx);
  })
);

router.patch(
  "/:id/courier/assign",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const { partnerName, contact, trackingId } = req.body;
    if (!partnerName) {
      return res.status(400).json({ error: "partnerName is required" });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (normalizeWallet(tx.farmerWallet) !== normalizeWallet(req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    tx.courier = {
      partnerName,
      contact: contact || "",
      trackingId: trackingId || "",
      assignedAt: new Date(),
    };
    await tx.save();
    await writeOrderLedgerEvent("CourierAssigned", tx, req.user.walletAddress, {
      note: `Courier assigned: ${partnerName}`,
    });
    res.json(tx);
  })
);

router.patch(
  "/:id/courier/status",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const { pickupStatus, transitStatus } = req.body;
    const allowedPickup = ["PENDING", "PICKED_UP"];
    const allowedTransit = ["PENDING", "IN_TRANSIT", "DELIVERED"];

    if (pickupStatus && !allowedPickup.includes(pickupStatus)) {
      return res.status(400).json({ error: "Invalid pickupStatus" });
    }
    if (transitStatus && !allowedTransit.includes(transitStatus)) {
      return res.status(400).json({ error: "Invalid transitStatus" });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (normalizeWallet(tx.farmerWallet) !== normalizeWallet(req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (pickupStatus) {
      tx.pickupStatus = pickupStatus;
      if (pickupStatus === "PICKED_UP") {
        tx.pickupAt = tx.pickupAt || new Date();
        tx.fulfillmentStatus = tx.fulfillmentStatus === "PENDING" ? "SHIPPED" : tx.fulfillmentStatus;
      }
    }
    if (transitStatus) {
      tx.transitStatus = transitStatus;
      if (transitStatus === "IN_TRANSIT") {
        tx.transitAt = tx.transitAt || new Date();
        tx.fulfillmentStatus = tx.fulfillmentStatus === "PENDING" ? "SHIPPED" : tx.fulfillmentStatus;
      }
      if (transitStatus === "DELIVERED") {
        tx.fulfillmentStatus = "DELIVERED";
        tx.deliveredAt = tx.deliveredAt || new Date();
        if (tx.slaDeadlineAt instanceof Date) {
          tx.slaBreached = tx.deliveredAt.getTime() > tx.slaDeadlineAt.getTime();
        }
      }
    }

    await tx.save();
    await writeOrderLedgerEvent("DeliveryStatusUpdated", tx, req.user.walletAddress, {
      note: `Pickup=${tx.pickupStatus}, Transit=${tx.transitStatus}`,
    });
    res.json(tx);
  })
);

router.patch(
  "/:id/return/request",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (normalizeWallet(tx.buyerWallet) !== normalizeWallet(req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (tx.status !== "CONFIRMED") {
      return res.status(400).json({ error: "Return available only for confirmed orders" });
    }
    if (tx.returnStatus !== "NONE") {
      return res.status(400).json({ error: `Return already ${tx.returnStatus}` });
    }

    tx.returnStatus = "REQUESTED";
    tx.returnReason = String(reason || "Not satisfied").trim();
    tx.returnRequestedAt = new Date();
    await tx.save();
    await writeOrderLedgerEvent("ReturnRequested", tx, req.user.walletAddress, {
      note: tx.returnReason,
    });
    res.json(tx);
  })
);

router.patch(
  "/:id/return/review",
  auth,
  asyncHandler(async (req, res) => {
    const { decision } = req.body;
    const normalized = String(decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED", "COMPLETED"].includes(normalized)) {
      return res.status(400).json({ error: "decision must be APPROVED, REJECTED, or COMPLETED" });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (!canManageOrder(req.user, tx)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (tx.returnStatus === "NONE") {
      return res.status(400).json({ error: "No return request exists for this order" });
    }

    tx.returnStatus = normalized;
    if (normalized === "REJECTED" || normalized === "COMPLETED") {
      tx.returnResolvedAt = new Date();
    }
    await tx.save();
    await writeOrderLedgerEvent("ReturnReviewed", tx, req.user.walletAddress, {
      note: `Return ${normalized}`,
    });
    res.json(tx);
  })
);

router.patch(
  "/:id/rating",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const score = Number(req.body.score);
    const feedback = String(req.body.feedback || "").trim();
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: "score must be an integer between 1 and 5" });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (normalizeWallet(tx.buyerWallet) !== normalizeWallet(req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (tx.fulfillmentStatus !== "DELIVERED") {
      return res.status(400).json({ error: "Rating is allowed only after delivery" });
    }

    tx.rating = { score, feedback, ratedAt: new Date() };
    await tx.save();
    await writeOrderLedgerEvent("OrderRated", tx, req.user.walletAddress, {
      note: feedback || `Rated ${score}/5`,
    });
    res.json(tx);
  })
);

export default router;
