import express from "express";
import Crop from "../models/Crop.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";
import { getOnChainCrop, listCropOnChain } from "../services/blockchain.js";

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const crops = await Crop.find({ status: "APPROVED", expiryDate: { $gt: now } }).sort({ createdAt: -1 });
    res.json(crops);
  })
);

router.post(
  "/",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const {
      name,
      category,
      quantity,
      quantityValue,
      quantityUnit,
      quantityBaseValue,
      quantityBaseUnit,
      unitScale,
      priceEth,
      pricePerUnitEth,
      pricePerUnitInr,
      pricePerBaseUnitEth,
      pricePerBaseUnitInr,
      priceInr,
      priceCurrency,
      harvestDate,
      expiryDate,
      storageType,
      description,
      imageUrl,
      imageUrls,
      certificateUrl,
    } = req.body;

    if (!name || !category || !harvestDate || !expiryDate || !storageType || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const parsedQuantityValue = Number(quantityValue);
    const hasQuantityValue = Number.isFinite(parsedQuantityValue) && parsedQuantityValue > 0;
    const normalizedUnit = typeof quantityUnit === "string" ? quantityUnit.trim() : "";
    const parsedUnitScale = Number(unitScale);
    const hasUnitScale = Number.isInteger(parsedUnitScale) && parsedUnitScale > 0;
    const parsedBaseValue = Number(quantityBaseValue);
    const hasBaseValue = Number.isInteger(parsedBaseValue) && parsedBaseValue > 0;
    const quantityLabel =
      hasQuantityValue && normalizedUnit ? `${parsedQuantityValue} ${normalizedUnit}` : quantity;

    if (!quantityLabel) {
      return res.status(400).json({ error: "Quantity and unit required" });
    }

    if (!hasBaseValue) {
      return res.status(400).json({ error: "Quantity base value required for unit scaling." });
    }
    if (!hasUnitScale) {
      return res.status(400).json({ error: "Unit scale required for unit scaling." });
    }

    const priceNumeric = Number(priceEth);
    if (!Number.isFinite(priceNumeric) || priceNumeric <= 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    const perBaseEth = Number(pricePerBaseUnitEth);
    if (!Number.isFinite(perBaseEth) || perBaseEth <= 0) {
      return res.status(400).json({ error: "Price per base unit ETH is required" });
    }

    const expiry = new Date(expiryDate);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ error: "Expiry date must be in the future" });
    }

    const crop = await Crop.create({
      name,
      category,
      quantity: quantityLabel,
      quantityValue: hasQuantityValue ? parsedQuantityValue : undefined,
      quantityUnit: normalizedUnit || undefined,
      quantityBaseValue: hasBaseValue ? parsedBaseValue : undefined,
      quantityBaseUnit: typeof quantityBaseUnit === "string" ? quantityBaseUnit.trim() : undefined,
      unitScale: hasUnitScale ? parsedUnitScale : undefined,
      priceEth,
      pricePerUnitEth: pricePerUnitEth || undefined,
      pricePerUnitInr: pricePerUnitInr || undefined,
      pricePerBaseUnitEth: pricePerBaseUnitEth || undefined,
      pricePerBaseUnitInr: pricePerBaseUnitInr || undefined,
      priceInr: priceInr || undefined,
      priceCurrency: priceCurrency || undefined,
      harvestDate,
      expiryDate,
      storageType,
      description,
      imageUrl: imageUrl || "",
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      certificateUrl: certificateUrl || "",
      farmerWallet: req.user.walletAddress,
      farmerId: req.user._id,
    });

    res.status(201).json(crop);
  })
);

router.get(
  "/mine",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const crops = await Crop.find({ farmerId: req.user._id }).sort({ createdAt: -1 });
    res.json(crops);
  })
);

router.get(
  "/admin/all",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const crops = await Crop.find().sort({ createdAt: -1 });
    res.json(crops);
  })
);

router.post(
  "/admin/:id/approve",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const crop = await Crop.findById(req.params.id);
    if (!crop) {
      return res.status(404).json({ error: "Crop not found" });
    }

    let needsPublish = !crop.contractCropId;
    if (!needsPublish) {
      const onChainCrop = await getOnChainCrop(crop.contractCropId);
      const offchainMatches =
        !onChainCrop?.offchainId || String(onChainCrop.offchainId) === String(crop._id);
      needsPublish = !onChainCrop || !offchainMatches;
    }

    if (needsPublish) {
      const onchain = await listCropOnChain(crop);
      crop.contractCropId = onchain.cropId || crop.contractCropId;
      crop.txHash = onchain.txHash;
    }

    crop.status = "APPROVED";
    await crop.save();
    res.json(crop);
  })
);

router.post(
  "/admin/:id/reject",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const crop = await Crop.findByIdAndUpdate(
      req.params.id,
      { status: "REJECTED" },
      { new: true }
    );
    res.json(crop);
  })
);

export default router;
