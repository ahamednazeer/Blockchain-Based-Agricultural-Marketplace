import express from "express";
import User from "../models/User.js";
import Crop from "../models/Crop.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";
import { haversineDistanceKm, normalizeCoordinates } from "../services/geo.js";

const router = express.Router();
const DEFAULT_PINCODE = "606107";
const DEFAULT_BUYER_DVU = Math.max(0, Number(process.env.DEFAULT_BUYER_DVU || 5000));

function normalizePincode(value) {
  const normalized = String(value ?? DEFAULT_PINCODE).trim();
  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const {
      name,
      contact,
      location,
      pincode,
      role,
      walletAddress,
      latitude,
      longitude,
      geoLocation,
    } = req.body;
    if (!name || !contact || !location || !role || !walletAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["FARMER", "BUYER"].includes(role)) {
      return res.status(400).json({ error: "Role must be FARMER or BUYER" });
    }

    const normalizedPincode = normalizePincode(pincode);
    if (!normalizedPincode) {
      return res.status(400).json({ error: "Pincode must be a 6-digit number" });
    }

    const normalized = walletAddress.toLowerCase();
    const exists = await User.findOne({ walletAddress: normalized });
    if (exists) {
      return res.status(409).json({ error: "Wallet already registered" });
    }

    const normalizedGeo =
      normalizeCoordinates(latitude, longitude) ||
      normalizeCoordinates(geoLocation?.lat, geoLocation?.lng);

    const user = await User.create({
      name,
      contact,
      location,
      pincode: normalizedPincode,
      role,
      walletAddress: normalized,
      dvuBalance: role === "BUYER" ? DEFAULT_BUYER_DVU : 0,
      geoLocation: normalizedGeo || undefined,
    });

    res.status(201).json({ id: user._id, status: user.status });
  })
);

router.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    res.json({
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      wallet: req.user.walletAddress,
      status: req.user.status,
      location: req.user.location,
      pincode: req.user.pincode,
      dvuBalance: Number(req.user.dvuBalance || 0),
      geoLocation: req.user.geoLocation || null,
    });
  })
);

router.patch(
  "/me/location",
  auth,
  asyncHandler(async (req, res) => {
    const { location, pincode, latitude, longitude, geoLocation } = req.body;
    const nextPincode = pincode !== undefined ? normalizePincode(pincode) : req.user.pincode;
    if (!nextPincode) {
      return res.status(400).json({ error: "Pincode must be a 6-digit number" });
    }
    const nextGeo =
      normalizeCoordinates(latitude, longitude) ||
      normalizeCoordinates(geoLocation?.lat, geoLocation?.lng);

    if (location !== undefined) {
      req.user.location = String(location || "").trim();
    }
    req.user.pincode = nextPincode;
    if (nextGeo) {
      req.user.geoLocation = nextGeo;
    }
    await req.user.save();

    res.json({
      id: req.user._id,
      location: req.user.location,
      pincode: req.user.pincode,
      geoLocation: req.user.geoLocation || null,
    });
  })
);

router.get(
  "/farmers/near",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const requestedOrigin = normalizeCoordinates(req.query.lat, req.query.lng);
    const buyerOrigin =
      normalizeCoordinates(req.user.geoLocation?.lat, req.user.geoLocation?.lng) || null;
    const origin = requestedOrigin || buyerOrigin;
    const radiusKm = Math.max(1, Number(req.query.radiusKm || 50));
    const category = String(req.query.category || "").trim();
    const pincode = String(req.query.pincode || req.user.pincode || "").trim();

    const cropQuery = {
      status: "APPROVED",
      expiryDate: { $gt: new Date() },
      ...(category ? { category } : {}),
      ...(pincode ? { farmerPincode: pincode } : {}),
    };

    const activeCrops = await Crop.find(cropQuery)
      .select("farmerId farmerWallet farmerPincode category quantityBaseValue")
      .sort({ createdAt: -1 });

    const farmerIds = Array.from(
      new Set(activeCrops.map((crop) => String(crop.farmerId || "")).filter(Boolean))
    );
    if (farmerIds.length === 0) {
      return res.json([]);
    }

    const farmers = await User.find({
      _id: { $in: farmerIds },
      role: "FARMER",
      status: "ACTIVE",
    }).select("name location pincode walletAddress geoLocation");

    const listingCountByFarmer = activeCrops.reduce((acc, crop) => {
      const key = String(crop.farmerId || "");
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const enriched = farmers
      .map((farmer) => {
        const farmerGeo = normalizeCoordinates(farmer.geoLocation?.lat, farmer.geoLocation?.lng);
        const distanceKm =
          origin && farmerGeo ? haversineDistanceKm(origin, farmerGeo) : null;
        return {
          id: farmer._id,
          name: farmer.name,
          location: farmer.location,
          pincode: farmer.pincode,
          walletAddress: farmer.walletAddress,
          geoLocation: farmer.geoLocation || null,
          activeListings: listingCountByFarmer[String(farmer._id)] || 0,
          distanceKm:
            typeof distanceKm === "number" && Number.isFinite(distanceKm)
              ? Number(distanceKm.toFixed(2))
              : null,
        };
      })
      .filter((farmer) => {
        if (!origin) return true;
        if (farmer.distanceKm === null) return false;
        return farmer.distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        const ad = a.distanceKm;
        const bd = b.distanceKm;
        if (ad === null && bd === null) return 0;
        if (ad === null) return 1;
        if (bd === null) return -1;
        return ad - bd;
      });

    res.json(enriched);
  })
);

router.get(
  "/addresses",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    res.json(req.user.shippingAddresses || []);
  })
);

router.post(
  "/addresses",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const {
      label,
      recipientName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    if (!recipientName || !phone || !line1 || !city || !state || !postalCode) {
      return res.status(400).json({ error: "Missing required address fields" });
    }

    const addresses = req.user.shippingAddresses || [];
    const makeDefault = Boolean(isDefault) || addresses.length === 0;

    if (makeDefault) {
      addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    addresses.push({
      label: label || "Primary",
      recipientName,
      phone,
      line1,
      line2: line2 || "",
      city,
      state,
      postalCode,
      country: country || "India",
      isDefault: makeDefault,
    });

    req.user.shippingAddresses = addresses;
    await req.user.save();
    res.status(201).json(req.user.shippingAddresses);
  })
);

router.patch(
  "/addresses/:id/default",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const addresses = req.user.shippingAddresses || [];
    let found = false;
    addresses.forEach((addr) => {
      if (String(addr._id) === req.params.id) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });
    if (!found) {
      return res.status(404).json({ error: "Address not found" });
    }
    req.user.shippingAddresses = addresses;
    await req.user.save();
    res.json(req.user.shippingAddresses);
  })
);

router.patch(
  "/addresses/:id",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const {
      label,
      recipientName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    const addresses = req.user.shippingAddresses || [];
    const target = addresses.find((addr) => String(addr._id) === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Address not found" });
    }

    if (!recipientName || !phone || !line1 || !city || !state || !postalCode) {
      return res.status(400).json({ error: "Missing required address fields" });
    }

    target.label = label || target.label || "Primary";
    target.recipientName = recipientName;
    target.phone = phone;
    target.line1 = line1;
    target.line2 = line2 || "";
    target.city = city;
    target.state = state;
    target.postalCode = postalCode;
    target.country = country || target.country || "India";

    if (isDefault) {
      addresses.forEach((addr) => {
        addr.isDefault = String(addr._id) === String(target._id);
      });
    }

    req.user.shippingAddresses = addresses;
    await req.user.save();
    res.json(req.user.shippingAddresses);
  })
);

router.delete(
  "/addresses/:id",
  auth,
  requireRole("BUYER"),
  asyncHandler(async (req, res) => {
    const addresses = req.user.shippingAddresses || [];
    const before = addresses.length;
    const remaining = addresses.filter((addr) => String(addr._id) !== req.params.id);
    if (remaining.length === before) {
      return res.status(404).json({ error: "Address not found" });
    }

    if (remaining.length > 0 && !remaining.some((addr) => addr.isDefault)) {
      remaining[0].isDefault = true;
    }

    req.user.shippingAddresses = remaining;
    await req.user.save();
    res.json(req.user.shippingAddresses);
  })
);

router.get(
  "/admin",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  })
);

router.post(
  "/admin/:id/approve",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "ACTIVE" },
      { new: true }
    );
    res.json(user);
  })
);

router.post(
  "/admin/:id/reject",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "REJECTED" },
      { new: true }
    );
    res.json(user);
  })
);

router.post(
  "/admin/:id/suspend",
  auth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "SUSPENDED" },
      { new: true }
    );
    res.json(user);
  })
);

export default router;
