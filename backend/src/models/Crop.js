import mongoose from "mongoose";

const CropSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: String, required: true },
    quantityValue: { type: Number },
    quantityUnit: { type: String },
    quantityBaseValue: { type: Number },
    quantityBaseUnit: { type: String },
    unitScale: { type: Number },
    priceEth: { type: String, required: true },
    pricePerUnitEth: { type: String },
    pricePerUnitInr: { type: String },
    pricePerBaseUnitEth: { type: String },
    pricePerBaseUnitInr: { type: String },
    priceInr: { type: String },
    priceCurrency: { type: String },
    harvestDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    storageType: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    imageUrls: { type: [String], default: [] },
    certificateUrl: { type: String, default: "" },
    farmerWallet: { type: String, required: true },
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SOLD", "EXPIRED"],
      default: "PENDING",
    },
    contractCropId: { type: Number },
    txHash: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Crop", CropSchema);
