const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// Attachment metadata for a mail message. Inbound bytes stay in Gmail until
// first download, then are cached in S3 (`s3Key`); outbound bytes are written
// to S3 at send time. Downloads always go through an authenticated endpoint.
const emailAttachmentSchema = new mongoose.Schema(
  {
    message: { type: ObjectId, ref: "EmailMessage", required: true, index: true },
    mailbox: { type: ObjectId, ref: "Mailbox", required: true },

    filename: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, default: "application/octet-stream", maxlength: 150 },
    size: { type: Number, default: 0, min: 0 },

    // Gmail attachment ids can change between fetches, so keep the MIME partId
    // too and re-resolve the id from the message when needed.
    gmailAttachmentId: { type: String, default: "" },
    partId: { type: String, default: "" },
    contentId: { type: String, default: "" },
    isInline: { type: Boolean, default: false },

    // Empty until the file has been cached/stored in S3.
    s3Key: { type: String, default: "" },
    cachedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailAttachment", emailAttachmentSchema);
