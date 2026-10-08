const mongoose = require("mongoose");

// A recipient who must never receive a tracking image. Checked on every send
// (To and Cc): one opted-out address turns tracking off for that whole mail.
const optOutSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    note: { type: String, default: "", trim: true, maxlength: 200 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailTrackingOptOut", optOutSchema);
