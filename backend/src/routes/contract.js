import express from "express";
import { ethers } from "ethers";
import { loadContractMeta } from "../services/contractMeta.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const meta = loadContractMeta();
    const rpcUrl = process.env.GANACHE_RPC_URL;
    let chainId = null;

    if (rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const network = await provider.getNetwork();
        chainId = Number(network.chainId);
      } catch {
        chainId = null;
      }
    }

    res.json({
      address: process.env.CONTRACT_ADDRESS || meta?.address || null,
      abi: meta?.abi || null,
      chainId,
    });
  })
);

export default router;
