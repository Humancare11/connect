const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// A personal email signature (text, an image, or an image with text lines). Strictly private to its owner: every query in the
// API includes `owner`, and nothing here is ever shown to another admin.
//
// Plain text only (the composer is plain text). It is escaped when the HTML part
// of a mail is built, so markup, images and scripts cannot be smuggled in.
const emailSignatureSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // Lower-case copy of the name: names are unique per owner, ignoring case.
    nameKey: { type: String, required: true },
    // Always present. text: the signature. image: the PLAIN-TEXT version (the image is shown in
    // the HTML part only). image_text: the lines shown under the image, and in the plain text.
    content: { type: String, required: true, maxlength: 1000 },
    layout: { type: String, enum: ["text", "image", "image_text"], default: "text" },
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
    // Alt text of the image; empty = the first text line is used.
    imageAlt: { type: String, default: "", maxlength: 120 },
    // One link for the whole image (http or https), click-tracked like other links; empty = none.
    imageLink: { type: String, default: "", maxlength: 500 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

emailSignatureSchema.index({ owner: 1, nameKey: 1 }, { unique: true });
// At most ONE default per owner, enforced by the database, not only by the code.
emailSignatureSchema.index({ owner: 1 }, { unique: true, partialFilterExpression: { isDefault: true }, name: "one_default_per_owner" });

module.exports = mongoose.model("EmailSignature", emailSignatureSchema);
