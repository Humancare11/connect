const mongoose = require("mongoose");

// History of patient account-deletion requests, kept AFTER the user record is
// deleted so admins can always see who asked for deletion and what happened.
// One row per request: a user who is rejected and asks again, or cancels and
// asks again, has several rows.
//
// TODO(legal review): this is personal data (name, email, patient ID, free-text
// reason) kept after the account itself is gone. Legal must confirm the
// purpose/legal basis, the retention period and the purge rule. `purgeAt` is
// intentionally left empty for now: the TTL index below does nothing while it
// is unset, so nothing is ever auto-deleted until a retention period is
// decided and written into that field.
//
// Only the minimum is stored. Deliberately NOT stored: IP address, raw
// User-Agent, phone number, date of birth, location.
const STATUSES = ["pending", "approved", "rejected", "cancelled", "deleted_by_admin"];

const accountDeletionRequestSchema = new mongoose.Schema(
  {
    // The user's _id — retained appointments/payments/invoices point at it, so
    // this is what ties the history to the records we keep.
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: Number, default: null },

    // Snapshot at the time of the request.
    name: { type: String, default: "", trim: true, maxlength: 200 },
    email: { type: String, default: "", trim: true, lowercase: true, maxlength: 254, index: true },
    reason: { type: String, default: "", trim: true, maxlength: 500 },

    status: { type: String, enum: STATUSES, default: "pending" },
    requestedAt: { type: Date, required: true, default: Date.now },
    // Approve / reject / cancel / direct-delete time.
    decidedAt: { type: Date, default: null },
    // Snapshot of the admin who decided (null for a user's own cancellation).
    decidedBy: {
      type: new mongoose.Schema(
        {
          id: { type: String, default: "" },
          name: { type: String, default: "" },
          email: { type: String, default: "" },
          role: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: null,
    },
    // "review" = approved/rejected from the request; "direct_delete" = an admin
    // used "Delete User" while the request was pending.
    decidedVia: { type: String, enum: ["review", "direct_delete", ""], default: "" },

    // Whether the emails actually went out (activity logging is a no-op, so
    // this is the only record).
    emails: {
      requested: { type: Boolean, default: false },
      decision: { type: Boolean, default: false },
    },

    // Where the request came from, via the same detection as signup
    // (utils/clientInfo.js). platform "web" | "app" | "" (unknown / backfilled).
    requestSource: {
      platform: { type: String, default: "" },
      subType: { type: String, default: "" },
      appVersion: { type: String, default: "" },
      source: { type: String, default: "" }, // "header" | "inferred" | "user-agent"
    },

    // Created by the backfill script (or lazily for a request made before this
    // history existed): the decider and request source are unknown.
    backfilled: { type: Boolean, default: false },

    // Empty = keep. See the legal-review TODO above.
    purgeAt: { type: Date, default: null },
  },
  { timestamps: true }
);

accountDeletionRequestSchema.index({ status: 1, requestedAt: -1 });
accountDeletionRequestSchema.index({ patientId: 1 });
// At most one open request per user: makes "decide exactly once" and a
// double-submit safe.
accountDeletionRequestSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_per_user" }
);
// TTL: only acts on documents whose purgeAt is a date. Unset for now.
accountDeletionRequestSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AccountDeletionRequest", accountDeletionRequestSchema);
module.exports.STATUSES = STATUSES;
