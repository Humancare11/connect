const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// A chat message. `text` is encrypted and must never be logged. sender "note" is an internal note and is never
// sent to the patient.
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },
    sender: { type: String, enum: ["patient", "ai", "agent", "system", "note"], required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    agentName: { type: String, default: "", maxlength: 40 }, // display name at the time (not patient data)
    internal: { type: Boolean, default: false }, // team-only line (e.g. "Super Admin took over from Sam"); never sent to the patient
    text: ENC_FIELD,
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "LcFile", default: null },
    // Admin side only. English translation of a message, cached so it is never translated twice (encrypted like text).
    // same=true: the original is already English (nothing to show).
    translations: [
      {
        _id: false,
        lang: { type: String, maxlength: 8 },
        same: { type: Boolean, default: false },
        from: { type: String, default: "", maxlength: 8 },
        fromName: { type: String, default: "", maxlength: 40 },
        text: ENC_FIELD,
      },
    ],
    // The admin's own English text when the reply was translated before sending (what the patient got is `text`).
    sourceText: ENC_FIELD,
    // Site pages shown as buttons under an AI reply (titles and urls come from the server allowlist, not patient data).
    links: [{ _id: false, title: { type: String, maxlength: 120 }, url: { type: String, maxlength: 200 } }],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("LcMessage", messageSchema);
