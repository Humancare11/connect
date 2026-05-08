const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    otp:       { type: String, required: true },
    type:      { type: String, enum: ["register", "forgot"], required: true },
    role:      { type: String, enum: ["user", "doctor"], default: "user" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB auto-deletes documents once expiresAt is reached
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, type: 1, role: 1 });

module.exports = mongoose.model("OTP", otpSchema);
