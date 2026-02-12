import express from "express";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, contact, location, role, walletAddress } = req.body;
    if (!name || !contact || !location || !role || !walletAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["FARMER", "BUYER"].includes(role)) {
      return res.status(400).json({ error: "Role must be FARMER or BUYER" });
    }

    const normalized = walletAddress.toLowerCase();
    const exists = await User.findOne({ walletAddress: normalized });
    if (exists) {
      return res.status(409).json({ error: "Wallet already registered" });
    }

    const user = await User.create({
      name,
      contact,
      location,
      role,
      walletAddress: normalized,
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
    });
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
