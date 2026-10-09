const mongoose = require("mongoose");

// IPs blocked from live chat by an admin (abuse). Blocked visitors cannot connect to /livechat.
const blockedIpSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    reason: { type: String, default: "", maxlength: 300 },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LcBlockedIp", blockedIpSchema);
