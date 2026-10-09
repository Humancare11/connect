const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// A chat message. `text` is encrypted and must never be logged. sender "note" is an internal note and is never
// sent to the patient.
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },
    sender: { type: String, enum: ["patient", "ai", "agent", "system", "note"], required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    text: ENC_FIELD,
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "LcFile", default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("LcMessage", messageSchema);
