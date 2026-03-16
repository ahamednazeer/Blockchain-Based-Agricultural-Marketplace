import express from "express";
import Crop from "../models/Crop.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, optionalAuth, requireRole } from "../middleware/auth.js";
import { getOnChainCrop, listCropOnChain } from "../services/blockchain.js";
import { haversineDistanceKm, normalizeCoordinates } from "../services/geo.js";

const router = express.Router();
const DEFAULT_PINCODE = "606107";

function normalizePincode(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const includeAvailability = String(req.query.availability || "ACTIVE").toUpperCase();
    const query = includeAvailability === "ALL"
      ? {}
      : { status: "APPROVED", expiryDate: { $gt: now } };

    const requestedPincode = normalizePincode(req.query.pincode);
    const requestedLatLng = normalizeCoordinates(req.query.lat, req.query.lng);
    const requestedRadiusKm = Number(req.query.radiusKm || 0);
    const hasRadiusFilter = Number.isFinite(requestedRadiusKm) && requestedRadiusKm > 0;

    if (req.user?.role === "BUYER") {
      const buyerPincode = requestedPincode || normalizePincode(req.user.pincode);
      if (buyerPincode) {
        query.farmerPincode = buyerPincode;
      }
    }

    const crops = await Crop.find(query).sort({ createdAt: -1 });
    let rows = crops.map((crop) => crop.toObject());

    if (requestedLatLng && hasRadiusFilter) {
      rows = rows
        .map((crop) => {
          const distance = crop?.farmerGeo
            ? haversineDistanceKm(requestedLatLng, crop.farmerGeo)
            : null;
          return {
            ...crop,
            distanceKm:
              typeof distance === "number" && Number.isFinite(distance)
                ? Number(distance.toFixed(2))
                : null,
          };
        })
        .filter((crop) => crop.distanceKm !== null && crop.distanceKm <= requestedRadiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json(rows);
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
      qualityGrade,
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
      freshnessPeriodDays,
      expiryDate,
      storageType,
      description,
      imageUrl,
      imageUrls,
      certificateUrl,
    } = req.body;

    if (!name || !category || !harvestDate || !storageType || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedGrade = String(qualityGrade || "B").toUpperCase();
    if (!["A", "B"].includes(normalizedGrade)) {
      return res.status(400).json({ error: "Quality grade must be A or B" });
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

    const harvest = new Date(harvestDate);
    if (Number.isNaN(harvest.getTime())) {
      return res.status(400).json({ error: "Harvest date is invalid" });
    }

    const freshnessDays = Number(freshnessPeriodDays);
    const hasFreshnessDays = Number.isInteger(freshnessDays) && freshnessDays > 0;

    let effectiveExpiryDate = expiryDate;
    if (hasFreshnessDays) {
      const computed = new Date(harvest);
      computed.setDate(computed.getDate() + freshnessDays);
      effectiveExpiryDate = computed.toISOString();
    } else if (!expiryDate) {
      return res.status(400).json({ error: "Freshness period (days) or expiry date is required" });
    }

    const expiry = new Date(effectiveExpiryDate);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ error: "Expiry date must be in the future" });
    }

    const crop = await Crop.create({
      name,
      category,
      qualityGrade: normalizedGrade,
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
      freshnessPeriodDays: hasFreshnessDays ? freshnessDays : undefined,
      expiryDate: effectiveExpiryDate,
      storageType,
      description,
      imageUrl: imageUrl || "",
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      certificateUrl: certificateUrl || "",
      farmerWallet: req.user.walletAddress,
      farmerPincode: normalizePincode(req.user.pincode) || DEFAULT_PINCODE,
      farmerGeo: req.user.geoLocation || undefined,
      farmerId: req.user._id,
    });

    res.status(201).json(crop);
  })
);

router.patch(
  "/:id/stock",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const crop = await Crop.findById(req.params.id);
    if (!crop) {
      return res.status(404).json({ error: "Crop not found" });
    }
    if (String(crop.farmerId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (crop.status === "EXPIRED" || crop.status === "REJECTED") {
      return res.status(400).json({ error: `Cannot update stock for ${crop.status} listing` });
    }

    const baseFromBody = Number(req.body.quantityBaseValue);
    const displayFromBody = Number(req.body.quantityValue);
    const scale = Number(crop.unitScale || 1);

    let nextBase = Number.isFinite(baseFromBody) ? Math.floor(baseFromBody) : null;
    if (nextBase === null && Number.isFinite(displayFromBody) && scale > 0) {
      nextBase = Math.floor(displayFromBody * scale);
    }
    if (!Number.isFinite(nextBase) || nextBase < 0) {
      return res.status(400).json({ error: "quantityBaseValue or quantityValue must be a valid number" });
    }

    crop.quantityBaseValue = nextBase;
    const displayValue = scale > 0 ? nextBase / scale : nextBase;
    crop.quantityValue = displayValue;
    if (crop.quantityUnit) {
      const formatted = Number.isInteger(displayValue)
        ? String(displayValue)
        : String(Number(displayValue.toFixed(6)));
      crop.quantity = `${formatted} ${crop.quantityUnit}`;
    }

    if (new Date(crop.expiryDate) <= new Date()) {
      crop.status = "EXPIRED";
    } else {
      crop.status = nextBase === 0 ? "SOLD" : "APPROVED";
    }

    await crop.save();
    res.json(crop);
  })
);

router.delete(
  "/:id/expired",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const crop = await Crop.findById(req.params.id);
    if (!crop) {
      return res.status(404).json({ error: "Crop not found" });
    }
    if (String(crop.farmerId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const isExpired = crop.status === "EXPIRED" || new Date(crop.expiryDate) <= new Date();
    if (!isExpired) {
      return res.status(400).json({ error: "Only expired listings can be removed" });
    }

    await Crop.deleteOne({ _id: crop._id });
    res.json({ success: true, id: crop._id });
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

    if (crop.contractCropId) {
      await Crop.updateMany(
        { _id: { $ne: crop._id }, contractCropId: crop.contractCropId },
        { $unset: { contractCropId: "", txHash: "" } }
      );
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
