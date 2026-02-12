import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    txHash: { type: String, required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop" },
    cropName: { type: String },
    farmerWallet: { type: String, required: true },
    buyerWallet: { type: String, required: true },
    valueEth: { type: String, required: true },
    units: { type: Number },
    status: { type: String, enum: ["PENDING", "CONFIRMED", "FAILED"], default: "PENDING" },
    fulfillmentStatus: {
      type: String,
      enum: ["PENDING", "SHIPPED", "DELIVERED"],
      default: "PENDING",
    },
    shippingAddressId: { type: String },
    shippingAddress: {
      label: { type: String },
      recipientName: { type: String },
      phone: { type: String },
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
    blockNumber: { type: Number },
    logIndex: { type: Number },
    timestamp: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", TransactionSchema);
