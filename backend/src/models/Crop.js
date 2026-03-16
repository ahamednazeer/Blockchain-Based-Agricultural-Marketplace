import mongoose from "mongoose";

const CropSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    qualityGrade: { type: String, enum: ["A", "B"], default: "B" },
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
    freshnessPeriodDays: { type: Number, min: 1 },
    expiryDate: { type: Date, required: true },
    storageType: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    imageUrls: { type: [String], default: [] },
    certificateUrl: { type: String, default: "" },
    farmerWallet: { type: String, required: true },
    farmerPincode: { type: String, required: true, default: "606107", match: /^\d{6}$/ },
    farmerGeo: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
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

CropSchema.pre("validate", function preValidate(next) {
  if (!this.farmerPincode) {
    this.farmerPincode = "606107";
  }
  next();
});

export default mongoose.model("Crop", CropSchema);
