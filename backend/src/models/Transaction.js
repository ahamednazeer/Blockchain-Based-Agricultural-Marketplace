import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    txHash: { type: String, required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop" },
    cropName: { type: String },
    farmerWallet: { type: String, required: true },
    buyerWallet: { type: String, required: true },
    valueEth: { type: String, required: true },
    valueDvu: { type: Number, min: 0 },
    units: { type: Number },
    status: { type: String, enum: ["PENDING", "CONFIRMED", "FAILED"], default: "PENDING" },
    fulfillmentStatus: {
      type: String,
      enum: ["PENDING", "SHIPPED", "DELIVERED"],
      default: "PENDING",
    },
    pickupStatus: {
      type: String,
      enum: ["PENDING", "PICKED_UP"],
      default: "PENDING",
    },
    transitStatus: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "DELIVERED"],
      default: "PENDING",
    },
    courier: {
      partnerName: { type: String },
      contact: { type: String },
      trackingId: { type: String },
      assignedAt: { type: Date },
    },
    slaDeadlineAt: { type: Date },
    pickupAt: { type: Date },
    transitAt: { type: Date },
    deliveredAt: { type: Date },
    slaBreached: { type: Boolean, default: false },
    returnStatus: {
      type: String,
      enum: ["NONE", "REQUESTED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "NONE",
    },
    returnReason: { type: String },
    returnRequestedAt: { type: Date },
    returnResolvedAt: { type: Date },
    rating: {
      score: { type: Number, min: 1, max: 5 },
      feedback: { type: String },
      ratedAt: { type: Date },
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
