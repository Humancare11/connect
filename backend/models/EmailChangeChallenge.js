const mongoose = require("mongoose");

// One pending "change my login email" verification per doctor. Holds only a
// hash of the OTP; the canonical Doctor.email is untouched until it is verified.
const emailChangeChallengeSchema = new mongoose.Schema(
  {
    doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    newEmail:   { type: String, required: true, lowercase: true, trim: true },
    otpHash:    { type: String, required: true },
    attempts:   { type: Number, default: 0 },
    usedAt:     { type: Date, default: null },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt:  { type: Date, required: true },
  },
  { timestamps: true }
);

emailChangeChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("EmailChangeChallenge", emailChangeChallengeSchema);
