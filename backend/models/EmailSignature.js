const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// An admin's personal email signature: ONE image, nothing else. Strictly private to its owner:
// every query in the API includes `owner`, and nothing here is ever shown to another admin.
//
// One document per owner (unique index). The document may exist without an image: it also
// holds the "Add to new mails automatically" switch, which should survive a removed image.
const emailSignatureSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true },
    // The processed image (see utils/signatureImage.js). `key` is a private S3 key: it is never
    // returned by the API. Null when there is no image.
    image: {
      type: new mongoose.Schema(
        {
          key: { type: String, required: true },
          mime: { type: String, enum: ["image/png", "image/jpeg"], required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
          bytes: { type: Number, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    // "Add to new mails automatically": the starting state of the compose/reply checkbox.
    autoAdd: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Named explicitly: older versions of this collection had other indexes on `owner`
// (scripts/cleanupEmailSignatures.js drops them).
emailSignatureSchema.index({ owner: 1 }, { unique: true, name: "one_signature_per_owner" });

module.exports = mongoose.model("EmailSignature", emailSignatureSchema);
