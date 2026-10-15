const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// "When I send from this mailbox, use this signature" (optional, per admin).
// Overrides the admin's general default for that mailbox only. Like the
// signature itself it belongs to the owner and is never visible to anyone else.
const emailSignatureDefaultSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true },
    mailbox: { type: ObjectId, ref: "Mailbox", required: true },
    signature: { type: ObjectId, ref: "EmailSignature", required: true },
  },
  { timestamps: true }
);

emailSignatureDefaultSchema.index({ owner: 1, mailbox: 1 }, { unique: true });
emailSignatureDefaultSchema.index({ signature: 1 });

module.exports = mongoose.model("EmailSignatureDefault", emailSignatureDefaultSchema);
