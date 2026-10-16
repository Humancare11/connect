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
    // Patient context an agent fills in (follow-up date, preferred language, ...). Free text, so encrypted.
    context: {
      followUpDate: ENC_FIELD,
      preferredLanguage: ENC_FIELD,
      contactPreference: ENC_FIELD,
      reasonForContact: ENC_FIELD,
      custom: [{ _id: false, key: { type: String, maxlength: 24 }, value: ENC_FIELD }],
    },
    consent: {
      cookies: { type: Boolean, default: false },
      // Kept for records written before 2026-10-10. No longer written: the chat shows no privacy acceptance any more.
      privacyAcceptedAt: { type: Date, default: null },
      // The AI notice shown above "Start chat" (no checkbox). Written only while the Super Admin setting "Show AI notice" is on.
      aiNoticeAcceptedAt: { type: Date, default: null },
      policyVersion: { type: String, default: "", maxlength: 20 },
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
