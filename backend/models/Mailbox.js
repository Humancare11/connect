const mongoose = require("mongoose");

// Impersonation guard: the service account's domain-wide delegation can act as
// ANY user in the Workspace domain, so a Mailbox address must be inside the
// company domain. The sync/send code only ever impersonates addresses that
// exist as active Mailbox rows — never an address taken from a request.
const EMAIL_DOMAIN = (process.env.EMAIL_ALLOWED_DOMAIN || "humancareconnect.co").toLowerCase();
const ADDRESS_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// A shared company mailbox (support@, tech@, ...) that admins send and receive
// through. Managed by a Super Admin; adding one needs no code change.
const mailboxSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: (v) => ADDRESS_RE.test(v) && v.endsWith(`@${EMAIL_DOMAIN}`),
        message: `Mailbox address must be a valid @${EMAIL_DOMAIN} address.`,
      },
    },
    // Short label shown on the chip, e.g. "Support".
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    // Chip colour (hex). The UI derives the soft background from it.
    color: { type: String, default: "#0d7a6f", match: /^#[0-9a-fA-F]{6}$/ },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },

    // Company footer appended to outgoing mail. Company only — never the admin.
    signature: { type: String, default: "Human Care Connect", trim: true, maxlength: 500 },

    // Empty = every admin/superadmin may use this mailbox (current requirement).
    // Hook for restricting a mailbox to specific admins later.
    allowedAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Gmail sync state ──
    gmailHistoryId: { type: String, default: "" },
    lastSyncAt: { type: Date, default: null },
    lastReconcileAt: { type: Date, default: null },
    lastSyncError: { type: String, default: "" },

    // Lease so only one backend instance syncs a mailbox at a time.
    syncLease: {
      owner: { type: String, default: "" },
      until: { type: Date, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Set when a Super Admin deactivates it; cleared on reactivation. History stays.
    deactivatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Atomically claims (or renews) the sync lease. Returns the mailbox when this
// owner now holds the lease, or null when another live owner holds it.
mailboxSchema.statics.acquireLease = function acquireLease(mailboxId, owner, ttlMs) {
  const now = new Date();
  return this.findOneAndUpdate(
    {
      _id: mailboxId,
      isActive: true,
      $or: [
        { "syncLease.until": null },
        { "syncLease.until": { $lt: now } },
        { "syncLease.owner": owner },
      ],
    },
    { $set: { "syncLease.owner": owner, "syncLease.until": new Date(now.getTime() + ttlMs) } },
    { returnDocument: "after" }
  );
};

// Releases the lease, but only if this owner still holds it.
mailboxSchema.statics.releaseLease = function releaseLease(mailboxId, owner) {
  return this.updateOne(
    { _id: mailboxId, "syncLease.owner": owner },
    { $set: { "syncLease.owner": "", "syncLease.until": null } }
  );
};

module.exports = mongoose.model("Mailbox", mailboxSchema);
module.exports.EMAIL_DOMAIN = EMAIL_DOMAIN;
module.exports.isCompanyAddress = (v) => ADDRESS_RE.test(v) && v.endsWith(`@${EMAIL_DOMAIN}`);
