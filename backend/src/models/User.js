import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    location: { type: String, required: true },
    pincode: { type: String, required: true, default: "606107", match: /^\d{6}$/ },
    role: { type: String, enum: ["ADMIN", "FARMER", "BUYER"], required: true },
    walletAddress: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    nonce: { type: String, default: "" },
    dvuBalance: { type: Number, default: 0, min: 0 },
    geoLocation: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
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

UserSchema.pre("validate", function preValidate(next) {
  if (!this.pincode) {
    this.pincode = "606107";
  }
  next();
});

export default mongoose.model("User", UserSchema);
