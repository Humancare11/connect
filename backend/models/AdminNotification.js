const mongoose = require("mongoose");

// General admin-facing notification (Phase 1). Independent of DirectCallAlert,
// which keeps its own room-specific model, endpoints and read state.
//
// Read state is per admin: `readBy` holds the ids (token `id` == User._id) of
// admins who have read it, so one admin reading a notification never clears it
// for another. Admin headcount is small, so the array stays tiny; an admin who
// has not read it is simply absent from the array.
const NOTIFICATION_TYPES = [
  "doctor_registered",
  "doctor_enrollment_submitted",
  "appointment_created",
  "user_registered",
  "partner_case_created",
  "support_ticket_created",
  "account_deletion_requested",
  "doctor_profile_updated",
  "appointment_confirmed_by_doctor",
  "appointment_completed_by_doctor",
  "doctor_account_deletion_requested",
  "payment_needs_reconciliation",
  "doctor_approved",
  "doctor_rejected",
  "partner_case_cancelled",
  "partner_case_message",
  "security_repeated_failed_logins",
  "security_critical_event",
];

const REF_TYPES = ["doctor", "enrollment", "appointment", "user", "partner_case", "ticket", "user_ticket"];

// Internal admin routes only: no scheme, no host, no protocol-relative "//", no "..".
const INTERNAL_LINK_RE = /^\/admin-dashboard(\/[A-Za-z0-9._~-]+)*\/?(\?[A-Za-z0-9=&._~%-]*)?$/;
const isInternalAdminLink = (value) =>
  typeof value === "string" && value.length <= 300 && !value.includes("..") && INTERNAL_LINK_RE.test(value);

const adminNotificationSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: NOTIFICATION_TYPES },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, default: "", trim: true, maxlength: 300 },
  refType: { type: String, enum: [...REF_TYPES, null], default: null },
  refId: { type: String, default: "", trim: true, maxlength: 64 },
  link: {
    type: String,
    default: "",
    validate: {
      validator: (v) => v === "" || isInternalAdminLink(v),
      message: "link must be an internal /admin-dashboard route.",
    },
  },
  // Optional idempotency key, e.g. "appointment_created:<appointmentId>".
  dedupeKey: { type: String, trim: true, maxlength: 200 },
  readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  // Same 90-day retention as DirectCallAlert / DirectRoomEvent.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

// Unique only where a key is present; documents without one are not indexed.
adminNotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
adminNotificationSchema.index({ createdAt: -1 });

const AdminNotification = mongoose.model("AdminNotification", adminNotificationSchema);
module.exports = AdminNotification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.REF_TYPES = REF_TYPES;
module.exports.isInternalAdminLink = isInternalAdminLink;
