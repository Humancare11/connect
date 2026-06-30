const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["user", "doctor", "admin", "superadmin", "paymentadmin", "employeeadmin"],
      required: true,
      index: true,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
