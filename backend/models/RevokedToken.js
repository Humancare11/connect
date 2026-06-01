const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, default: "", index: true },
    reason: { type: String, default: "manual" },
    revokedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

revokedTokenSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
