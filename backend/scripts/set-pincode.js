import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Crop from "../src/models/Crop.js";

dotenv.config();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  let pincode = process.env.DEFAULT_PINCODE || "606107";
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--pincode" || value === "--value") {
      pincode = argv[index + 1];
      index += 1;
    }
  }
  const normalized = String(pincode || "").trim();
  if (!/^\d{6}$/.test(normalized)) {
    fail("Pincode must be a 6-digit number. Example: --pincode 606107");
  }
  return normalized;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    fail("MONGODB_URI is missing in backend/.env");
  }

  const pincode = parseArgs(process.argv.slice(2));
  await mongoose.connect(mongoUri);

  try {
    const userResult = await User.updateMany(
      { role: { $in: ["FARMER", "BUYER"] } },
      { $set: { pincode } }
    );
    const cropResult = await Crop.updateMany({}, { $set: { farmerPincode: pincode } });

    console.log(
      `Updated pincode=${pincode}. Users matched=${userResult.matchedCount}, modified=${userResult.modifiedCount}; crops matched=${cropResult.matchedCount}, modified=${cropResult.modifiedCount}.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to set pincode:", error.message);
  process.exit(1);
});
