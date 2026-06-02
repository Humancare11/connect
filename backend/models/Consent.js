const mongoose = require("mongoose");

const consentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["accepted", "revoked"], required: true, default: "accepted" },
    policyVersion: { type: String, required: true, default: "privacy-hipaa-v1" },
    acceptedAt: { type: Date, required: true, default: Date.now },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

consentSchema.index({ userId: 1, acceptedAt: -1 });

module.exports = mongoose.model("Consent", consentSchema);
