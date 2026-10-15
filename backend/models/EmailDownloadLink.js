const mongoose = require("mongoose");

// A secure download link for ONE attachment of a sent mail ("Send attachments as
// secure links"). The file itself is in S3 (EmailAttachment.s3Key); this row is the
// permission to fetch it until `expiresAt`. Only the SHA-256 of the token is stored,
// like the other tracking tokens, so reading the database never yields a usable link.
//
// Rows are kept after they expire so the mail page can say "expired" and the
// public page can tell an expired link from garbage.
const downloadLinkSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "EmailMessage", required: true },
    attachment: { type: mongoose.Schema.Types.ObjectId, ref: "EmailAttachment", required: true },
    index: { type: Number, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

downloadLinkSchema.index({ tokenHash: 1 }, { unique: true });
downloadLinkSchema.index({ message: 1, index: 1 });

module.exports = mongoose.model("EmailDownloadLink", downloadLinkSchema);
