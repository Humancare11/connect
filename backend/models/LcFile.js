const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// A report uploaded by a patient (pdf/jpg/png, max 10 MB). The object lives in S3; agents get short-lived
// presigned URLs only, there is no public URL.
const fileSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    visitorId: { type: String, required: true },
    s3Key: { type: String, required: true },
    name: ENC_FIELD,
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    // Who opened the file (presigned URL issued), newest last. A record of access for PHI.
    accessLog: [{ _id: false, userId: { type: mongoose.Schema.Types.ObjectId }, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("LcFile", fileSchema);
