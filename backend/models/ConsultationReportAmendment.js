const mongoose = require("mongoose");

// Append-only corrections to a finalised ConsultationReport. Never edited or deleted.
const amendmentSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "ConsultationReport", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    authorName: { type: String, default: "" },
    // PHI at rest: blob of { reason, text }.
    cipherText: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

amendmentSchema.index({ reportId: 1, createdAt: 1 });

const locked = () => new Error("Amendments are read-only.");
amendmentSchema.pre("save", function () {
  if (!this.isNew) throw locked();
});
amendmentSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndRemove"],
  function () {
    throw locked();
  }
);

module.exports = mongoose.model("ConsultationReportAmendment", amendmentSchema);
