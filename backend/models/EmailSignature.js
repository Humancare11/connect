const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// A personal email signature. Strictly private to its owner: every query in the
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
    content: { type: String, required: true, maxlength: 1000 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

emailSignatureSchema.index({ owner: 1, nameKey: 1 }, { unique: true });
// At most ONE default per owner, enforced by the database, not only by the code.
emailSignatureSchema.index({ owner: 1 }, { unique: true, partialFilterExpression: { isDefault: true }, name: "one_default_per_owner" });

module.exports = mongoose.model("EmailSignature", emailSignatureSchema);
