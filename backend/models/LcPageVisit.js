const mongoose = require("mongoose");

// One page in a chatting visitor's timeline. Written only for visitors who start a chat; visitors who never
// chat exist in memory only. Paths are stored without query string or hash.
const pageVisitSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },
    visitorId: { type: String, required: true },
    path: { type: String, required: true, maxlength: 300 },
    title: { type: String, default: "", maxlength: 200 },
    enteredAt: { type: Date, required: true },
    seconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

pageVisitSchema.index({ conversationId: 1, enteredAt: 1 });

module.exports = mongoose.model("LcPageVisit", pageVisitSchema);
