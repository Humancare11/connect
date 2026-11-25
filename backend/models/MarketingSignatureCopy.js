const mongoose = require("mongoose");

// A TEMPORARY hosted copy of a signature image, made for a test mail (real campaigns keep their copy on the campaign).
// Served by /api/m/sig/<token> until `expiresAt` (7 days). The S3 object is removed by the daily sweep in
// services/marketing/signature.js; the row itself is dropped by MongoDB three days after it expired, so the sweep
// always has a chance to find it first.
const SWEEP_GRACE_SECONDS = 3 * 24 * 3600;

const schema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    key: { type: String, required: true },
    mime: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: SWEEP_GRACE_SECONDS });

module.exports = mongoose.model("MarketingSignatureCopy", schema);
