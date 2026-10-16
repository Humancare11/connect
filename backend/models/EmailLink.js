const mongoose = require("mongoose");

// One link of a sent mail that was rewritten through our redirect. The redirect
// can only ever go to a URL stored here, which was in the mail as the admin wrote
// it, so it can never be turned into an open redirect.
//
// Only the SHA-256 of the token is stored, like the open-tracking token.
const emailLinkSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "EmailMessage", required: true },
    index: { type: Number, required: true },
    url: { type: String, required: true, maxlength: 2048 },
    tokenHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

emailLinkSchema.index({ tokenHash: 1 }, { unique: true });
emailLinkSchema.index({ message: 1, index: 1 });

module.exports = mongoose.model("EmailLink", emailLinkSchema);
