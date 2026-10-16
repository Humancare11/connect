const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// The AI Review log: one row per human review of a chat the safety layer flagged as medical. APPEND-ONLY: rows are
// never edited or deleted (the schema refuses updates and deletes, and there is no route for them).
//
// It lives in its own collection on purpose. Retention and the Trash purge delete chats, messages and files, but they
// never touch this collection, so the record of who reviewed what survives the chat. A small reference (the public
// chat id, when the chat started, why it was flagged) is copied into every row so the log still names the chat after
// the chat itself is gone. The note is encrypted like other free text; reviewers are told not to put patient names or
// health details in it.
const reviewLogSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true }, // public chat id, e.g. HC7K2M9QX
  chatStartedAt: { type: Date, default: null },
  flagReasons: [{ type: String, maxlength: 40 }],
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reviewerName: { type: String, default: "", maxlength: 120 }, // name at the time
  outcome: { type: String, enum: ["ok", "issue"], required: true },
  note: ENC_FIELD,
  at: { type: Date, default: Date.now, index: true },
});

const refuse = () => {
  throw new Error("The AI review log is append-only.");
};
reviewLogSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete", "bulkWrite"],
  refuse
);
reviewLogSchema.pre("save", function guard() {
  if (!this.isNew) refuse();
});
reviewLogSchema.pre("deleteOne", { document: true, query: false }, refuse);

module.exports = mongoose.model("LcReviewLog", reviewLogSchema);
