// "This call is being transcribed" notice record.
//
// When the call screen shows the notice to the patient and to the doctor, each browser tells the server, and the server stores on the
// booking WHO saw it and WHEN. This is the proof that both people were told before anything was transcribed.
//
//   • The server decides everything that matters: the person comes from the login token, the time is the server's clock, the role from
//     the token, the IP from the request (trusted-proxy aware, like Consent), never from the body. The browser may only say which
//     wording ("version") it displayed.
//   • The record is NEVER refused because of the version: a known version is saved as is, a missing one as the current version, and an
//     unknown or malformed one is still saved (cleaned, at most 50 characters, no HTML) with versionUnrecognized = true.
//   • First write wins: showing the notice again (a page reload, a reconnect) never moves the original time.
//   • Stored on the booking itself (Appointment or CategoryConsultation) under `transcriptNotice`, hidden by default (select: false) so
//     no existing screen or API that returns a booking ever includes it. Read it with .select("+transcriptNotice").
//   • No migration: bookings that never had a notice simply have no such field.
//
// For a doctor, userId is the Doctor account id (the login id), also for category consultations, where the booking itself points at an
// Enrollment instead.
const mongoose = require("mongoose");

const TRANSCRIPT_NOTICE_VERSION = "v1";
// Wordings the app has shipped. Add a version here when the notice text changes.
const KNOWN_NOTICE_VERSIONS = new Set(["v1"]);
const MAX_RAW_VERSION_LENGTH = 50;
const MAX_IP_LENGTH = 64;
const ROLE_KEY = { user: "patient", doctor: "doctor" };

const noticeEntrySchema = () =>
  new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      shownAt: { type: Date, required: true },
      version: { type: String, default: TRANSCRIPT_NOTICE_VERSION, maxlength: MAX_RAW_VERSION_LENGTH },
      // true when the browser sent a version we do not know (the cleaned raw value is then in `version`)
      versionUnrecognized: { type: Boolean, default: false },
      userAgent: { type: String, default: "" },
      // from the request (trusted-proxy aware, like Consent.ipAddress); never from the body
      ip: { type: String, default: "", maxlength: MAX_IP_LENGTH },
    },
    { _id: false }
  );

// Spread into a booking schema: { ...transcriptNoticeFields() }
function transcriptNoticeFields() {
  return {
    transcriptNotice: {
      type: new mongoose.Schema({ patient: noticeEntrySchema(), doctor: noticeEntrySchema() }, { _id: false }),
      default: undefined,
      select: false,
    },
  };
}

// Turns whatever the browser sent into text that is safe to store: no control characters, none of the characters HTML needs
// (< > & quotes), single spaces, at most 50 characters. Never throws.
function sanitizeRawVersion(value) {
  let text;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") text = String(value);
  else return "(non-text value)";
  text = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/[<>&"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_RAW_VERSION_LENGTH)
    .trim();
  return text || "(empty)";
}

// The wording version the browser says it displayed. NEVER refuses:
//   missing / empty        -> the current version, versionUnrecognized false
//   a known version (v1)   -> saved as is, versionUnrecognized false
//   anything else          -> saved cleaned, versionUnrecognized true
function resolveNoticeVersion(value) {
  if (value === undefined || value === null) return { version: TRANSCRIPT_NOTICE_VERSION, versionUnrecognized: false };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return { version: TRANSCRIPT_NOTICE_VERSION, versionUnrecognized: false };
    if (KNOWN_NOTICE_VERSIONS.has(trimmed)) return { version: trimmed, versionUnrecognized: false };
  }
  return { version: sanitizeRawVersion(value), versionUnrecognized: true };
}

function noticeRoleKey(role) {
  return ROLE_KEY[role] || null;
}

// True once both the patient and the doctor have a recorded time. `doc` must have been loaded with +transcriptNotice.
function bothNoticesShown(doc) {
  const n = doc && doc.transcriptNotice;
  return Boolean(n && n.patient && n.patient.shownAt && n.doctor && n.doctor.shownAt);
}

function modelFor(kind) {
  // Required here, not at the top: the models import transcriptNoticeFields from this file.
  return kind === "category_consultation" ? require("../../models/CategoryConsultation") : require("../../models/Appointment");
}

// Records that `userId` (acting as `role`) was shown the notice. Returns { recorded, entry, bothShown }:
// recorded is false when this person's notice was already on file (the original entry is returned, untouched).
async function recordNoticeShown({ kind, appointmentId, userId, role, version, userAgent, ip, now = new Date() }) {
  const key = noticeRoleKey(role);
  if (!key) throw new Error("recordNoticeShown: role must be user or doctor");
  const Model = modelFor(kind);
  const path = `transcriptNotice.${key}`;
  const resolved = resolveNoticeVersion(version);
  const entry = {
    userId: new mongoose.Types.ObjectId(String(userId)),
    shownAt: now,
    version: resolved.version,
    versionUnrecognized: resolved.versionUnrecognized,
    userAgent: String(userAgent || "").slice(0, 300),
    ip: String(ip || "").slice(0, MAX_IP_LENGTH),
  };

  // One atomic step: only writes when this person has no entry yet, so two tabs or a quick double call cannot both "win".
  // timestamps:false because this is an audit record, not a change to the booking (updatedAt stays as it was).
  const result = await Model.updateOne(
    { _id: appointmentId, [`${path}.shownAt`]: { $exists: false } },
    { $set: { [path]: entry } },
    { timestamps: false }
  );

  const doc = await Model.findById(appointmentId).select("+transcriptNotice").lean();
  return {
    recorded: result.modifiedCount === 1,
    entry: doc && doc.transcriptNotice ? doc.transcriptNotice[key] : null,
    bothShown: bothNoticesShown(doc),
  };
}

module.exports = {
  TRANSCRIPT_NOTICE_VERSION,
  KNOWN_NOTICE_VERSIONS,
  transcriptNoticeFields,
  resolveNoticeVersion,
  sanitizeRawVersion,
  noticeRoleKey,
  bothNoticesShown,
  recordNoticeShown,
};
