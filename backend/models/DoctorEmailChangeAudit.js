const mongoose = require("mongoose");

// Append-only trail of doctor login-email changes: who (doctor _id), what
// (action), how it went (outcome + a short safe reason category) and when.
// Deliberately NOT stored: OTPs or their hashes, passwords, tokens, the old or
// new email address, IP address or User-Agent. The doctor _id ties a row to the
// account; the address itself is not needed to audit that a change happened.
const ACTIONS = ["request", "verify", "complete"];
const OUTCOMES = ["success", "failure"];

const doctorEmailChangeAuditSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    action: { type: String, enum: ACTIONS, required: true },
    outcome: { type: String, enum: OUTCOMES, required: true },
    // Fixed category such as "otp_invalid" or "email_delivery_failed"; never free text.
    reason: { type: String, default: "", maxlength: 60 },
    // The request's X-Request-Id, to line a row up with server logs.
    correlationId: { type: String, default: "", maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

doctorEmailChangeAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DoctorEmailChangeAudit", doctorEmailChangeAuditSchema);
module.exports.ACTIONS = ACTIONS;
module.exports.OUTCOMES = OUTCOMES;
