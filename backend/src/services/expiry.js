import Crop from "../models/Crop.js";

export function startExpiryMonitor() {
  const intervalMs = Number(process.env.EXPIRY_CHECK_INTERVAL_MS || 1000 * 60 * 60);

  const runCheck = async () => {
    const now = new Date();
    await Crop.updateMany(
      { expiryDate: { $lte: now }, status: { $in: ["PENDING", "APPROVED"] } },
      { status: "EXPIRED" }
    );
  };

  runCheck();
  setInterval(runCheck, intervalMs);
}
