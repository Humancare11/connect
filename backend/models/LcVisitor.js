const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// A website visitor who gave contact details or started a chat. Visitors who only browse live in the in-memory
// presence registry and never reach this collection. Contact fields are encrypted (LIVECHAT_ENCRYPTION_KEY);
// emailHash is a keyed hash used only to find a returning contact.
const visitorSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    name: ENC_FIELD,
    email: ENC_FIELD,
    phone: ENC_FIELD,
    emailHash: { type: String, default: "", index: true },
    consent: {
      cookies: { type: Boolean, default: false },
      privacyAcceptedAt: { type: Date, default: null },
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    visits: { type: Number, default: 1 },
    chatCount: { type: Number, default: 0 },
    lastIp: { type: String, default: "" },
    geo: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    device: {
      type: { type: String, default: "" },
      os: { type: String, default: "" },
      browser: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

visitorSchema.index({ lastSeenAt: 1 });

module.exports = mongoose.model("LcVisitor", visitorSchema);
