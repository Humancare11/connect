const mongoose = require("mongoose");

// Canned replies agents can insert into a chat.
const cannedReplySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    text: { type: String, required: true, maxlength: 1000 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LcCannedReply", cannedReplySchema);
