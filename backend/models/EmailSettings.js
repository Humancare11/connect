const mongoose = require("mongoose");

// Default disclosure line added to every mail that carries a tracking image.
const DEFAULT_DISCLOSURE =
  "This email may contain an image that tells us when it was opened. See our Privacy Policy for details.";

// One document (key "email") holding the Email module's global switches.
// Open tracking is OFF until a Super Admin turns it on here AND the server's
// EMAIL_TRACKING_ENABLED env switch is on (see services/email/emailSettings.js).
const emailSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "email", unique: true, immutable: true },
    trackingEnabled: { type: Boolean, default: false },
    // Disclosure line in the footer of tracked mail. ON by default whenever tracking is enabled.
    disclosureEnabled: { type: Boolean, default: true },
    disclosureText: { type: String, default: DEFAULT_DISCLOSURE, trim: true, maxlength: 300 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailSettings", emailSettingsSchema);
module.exports.DEFAULT_DISCLOSURE = DEFAULT_DISCLOSURE;
