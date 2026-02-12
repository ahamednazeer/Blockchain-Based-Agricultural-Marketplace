import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    location: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "FARMER", "BUYER"], required: true },
    walletAddress: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    nonce: { type: String, default: "" },
    shippingAddresses: [
      {
        label: { type: String, default: "Primary" },
        recipientName: { type: String, required: true },
        phone: { type: String, required: true },
        line1: { type: String, required: true },
        line2: { type: String, default: "" },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, default: "India" },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
