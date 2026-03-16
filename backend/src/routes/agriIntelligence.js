import express from "express";
import multer from "multer";
import Crop from "../models/Crop.js";
import Transaction from "../models/Transaction.js";
import { auth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buildMarketPriceForecast,
  resolveChatbotResponse,
  resolveCropHealthAssessment,
} from "../services/agriIntelligence.js";
import { getEthInrRate } from "../services/rates.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file?.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed for crop assessment"));
    }
    return cb(null, true);
  },
});

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIsoDay(dateValue) {
  if (!dateValue) {
    return null;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function buildDailyHistory(points) {
  const dayMap = new Map();

  for (const point of points) {
    const day = toIsoDay(point?.date);
    const priceEth = Number(point?.priceEth || 0);
    if (!day || !Number.isFinite(priceEth) || priceEth <= 0) {
      continue;
    }

    const existing = dayMap.get(day) || { total: 0, count: 0 };
    existing.total += priceEth;
    existing.count += 1;
    dayMap.set(day, existing);
  }

  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, aggregate]) => ({
      date,
      priceEth: aggregate.total / Math.max(aggregate.count, 1),
    }));
}

router.post(
  "/chat",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message || "").trim();
    const language = String(req.body?.language || "").trim();
    const farmContext =
      req.body?.farmContext && typeof req.body.farmContext === "object" ? req.body.farmContext : {};

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const response = await resolveChatbotResponse({
      message,
      language,
      farmContext,
    });

    res.json({
      generatedAt: new Date().toISOString(),
      ...response,
    });
  })
);

router.post(
  "/crop-health",
  auth,
  requireRole("FARMER"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const cropName = String(req.body?.cropName || "").trim();
    const symptoms = String(req.body?.symptoms || "").trim();
    const language = String(req.body?.language || "").trim();

    if (!req.file && !symptoms) {
      return res.status(400).json({ error: "Provide crop image or symptom text for assessment" });
    }

    const assessment = await resolveCropHealthAssessment({
      cropName,
      symptoms,
      language,
      imageBuffer: req.file?.buffer,
      imageMimeType: req.file?.mimetype,
      imageName: req.file?.originalname,
    });

    res.json({
      generatedAt: new Date().toISOString(),
      cropName: cropName || null,
      image: req.file
        ? {
            filename: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
          }
        : null,
      ...assessment,
    });
  })
);

router.get(
  "/market-forecast",
  auth,
  requireRole("FARMER"),
  asyncHandler(async (req, res) => {
    const cropQuery = String(req.query.crop || "").trim();
    const language = String(req.query.language || "").trim();
    const horizonDays = Number(req.query.days || 7);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);

    const txFilters = {
      status: "CONFIRMED",
      createdAt: { $gte: cutoff },
    };

    if (cropQuery) {
      const regex = new RegExp(escapeRegex(cropQuery), "i");
      const cropMatches = await Crop.find(
        { $or: [{ name: regex }, { category: regex }] },
        { _id: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(400);
      const cropIds = cropMatches.map((crop) => crop._id);
      txFilters.$or = cropIds.length
        ? [{ cropName: regex }, { cropId: { $in: cropIds } }]
        : [{ cropName: regex }];
    }

    const txRows = await Transaction.find(txFilters, {
      valueEth: 1,
      units: 1,
      createdAt: 1,
      timestamp: 1,
      cropId: 1,
    })
      .populate("cropId", "unitScale")
      .sort({ createdAt: 1 })
      .limit(1500);

    const txPoints = txRows.map((tx) => {
      const valueEth = Number(tx.valueEth || 0);
      const units = Number(tx.units || 0);
      const unitScale = Number(tx.cropId?.unitScale || 1);
      
      if (!Number.isFinite(valueEth) || valueEth <= 0) {
        return null;
      }

      const pricePerBaseUnit = units > 0 ? valueEth / units : valueEth;
      const priceEth = pricePerBaseUnit * unitScale;
      
      return {
        date: tx.timestamp || tx.createdAt,
        priceEth,
      };
    });

    let history = buildDailyHistory(txPoints.filter(Boolean));

    if (history.length < 4) {
      const listingRegex = cropQuery ? new RegExp(escapeRegex(cropQuery), "i") : null;
      const listingFilters = cropQuery
        ? {
            status: { $in: ["APPROVED", "SOLD"] },
            $or: [{ name: listingRegex }, { category: listingRegex }],
          }
        : { status: { $in: ["APPROVED", "SOLD"] } };

      const listings = await Crop.find(listingFilters, {
        createdAt: 1,
        pricePerUnitEth: 1,
        priceEth: 1,
        quantityValue: 1,
      })
        .sort({ createdAt: -1 })
        .limit(300);

      const listingPoints = listings.map((crop) => {
        const perUnitEth = Number(crop.pricePerUnitEth || 0);
        const totalEth = Number(crop.priceEth || 0);
        const quantityValue = Number(crop.quantityValue || 0);
        const priceEth =
          perUnitEth > 0
            ? perUnitEth
            : totalEth > 0 && quantityValue > 0
              ? totalEth / quantityValue
              : totalEth;
        return {
          date: crop.createdAt,
          priceEth,
        };
      });

      history = buildDailyHistory([...history, ...listingPoints]);
    }

    if (!history.length) {
      return res.status(404).json({ error: "Not enough pricing history for forecast" });
    }

    const { rate } = await getEthInrRate();
    const ethInrRate = Number(rate) || 0;

    const forecast = await buildMarketPriceForecast({
      cropQuery,
      language,
      horizonDays,
      history,
      ethInrRate,
    });

    res.json({
      generatedAt: new Date().toISOString(),
      ...forecast,
    });
  })
);

router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || "Failed to process agri intelligence request" });
  }
  next();
});

export default router;
