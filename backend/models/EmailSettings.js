const mongoose = require("mongoose");

// Default disclosure line added to every mail that carries a tracking image.
const DEFAULT_DISCLOSURE =
  "";

// One document (key "email") holding the Email module's global switches.
// Open tracking is OFF until a Super Admin turns it on here AND the server's
// EMAIL_TRACKING_ENABLED env switch is on (see services/email/emailSettings.js).
const emailSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "email", unique: true, immutable: true },
    trackingEnabled: { type: Boolean, default: false },
    // A tracking notice in the footer of tracked mail. OFF by default: recipients see no
    // notice unless a Super Admin explicitly switches this on (the Privacy Policy is what
    // informs them). It is a new field on purpose: an older document that still carries the
    // previous "disclosureEnabled: true" default is NOT read as switched on. Exposed to the
    // API and the sender as `disclosureEnabled` (see services/email/emailSettings.js).
    footerNoticeEnabled: { type: Boolean, default: false },
    // Track mail that has @humancareconnect.co recipients. One pixel is shared by all
    // recipients, so an open by our own staff can look like the client's: the screens say so.
    trackInternalRecipients: { type: Boolean, default: true },
    // Rewrite links of tracked mail through our redirect to record clicks. OFF until a
    // Super Admin switches it on AND EMAIL_TRACKING_LINKS_ENABLED is set on the server.
    trackClicks: { type: Boolean, default: false },
    // "Send attachments as secure links" may be offered at all. OFF until a Super Admin
    // switches it on AND EMAIL_SECURE_LINKS_ENABLED is set on the server.
    secureLinksEnabled: { type: Boolean, default: false },
    // How long a secure link works. Capped by EMAIL_SECURE_LINK_DAYS_MAX at use time.
    secureLinkDays: { type: Number, default: 7, min: 1, max: 365 },
    disclosureText: { type: String, default: DEFAULT_DISCLOSURE, trim: true, maxlength: 300 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailSettings", emailSettingsSchema);
module.exports.DEFAULT_DISCLOSURE = DEFAULT_DISCLOSURE;
