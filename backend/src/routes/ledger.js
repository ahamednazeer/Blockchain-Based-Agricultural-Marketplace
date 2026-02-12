import express from "express";
import LedgerEvent from "../models/LedgerEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await LedgerEvent.find().sort({ timestamp: -1 }).limit(200);
    res.json(events);
  })
);

export default router;
