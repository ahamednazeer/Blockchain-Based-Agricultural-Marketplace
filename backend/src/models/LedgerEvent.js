import mongoose from "mongoose";

const LedgerEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    cropId: { type: Number },
    offchainId: { type: String },
    actor: { type: String, required: true },
    txHash: { type: String, required: true },
    valueEth: { type: String },
    units: { type: Number },
    timestamp: { type: Date },
    blockNumber: { type: Number },
    logIndex: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("LedgerEvent", LedgerEventSchema);
