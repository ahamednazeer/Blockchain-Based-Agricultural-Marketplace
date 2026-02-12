import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getEthInrRate } from "../services/rates.js";

const router = express.Router();

router.get(
  "/eth-inr",
  asyncHandler(async (req, res) => {
    const result = await getEthInrRate();
    res.json(result);
  })
);

export default router;
