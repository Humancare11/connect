const express = require("express");
const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/verifyToken");
const { transcriptNoticeLimiter, transcriptWriteLimiter, transcriptReadLimiter } = require("../middleware/rateLimiters");
const { decideAppointmentAccess, lookupParticipantBooking } = require("../utils/appointmentRoomAccess");
const { classifyAppointmentLookupError } = require("../utils/roomDenyReason");
const { recordSecurityEvent } = require("../utils/securityMonitor");
const { isTranscriptionEnabled, getConfidenceThresholds, getLateUploadMinutes, getTranscriptMode } = require("../utils/speech/config");
const { getClientIp } = require("../utils/clientIp");
const { noticeRoleKey, recordNoticeShown, bothNoticesShown } = require("../utils/speech/transcriptNotice");
const { MAX_BATCH, prepareBatch, serializeSegment, isLateUpload } = require("../utils/speech/transcriptSegments");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const TranscriptSegment = require("../models/TranscriptSegment");
const TranscriptAccessLog = require("../models/TranscriptAccessLog");

// Live transcript routes of one appointment, mounted at /api/appointments/:id (see server.js).
//
// The feature flag TRANSCRIPTION_ENABLED (default off) controls only the LIVE feature: while it is off the two routes that create
// something (POST /transcript-notice and POST /transcript) answer 404 as if they did not exist. Saved transcripts are our proof, so
// reading them (the booking's doctor, admin, superadmin) and deleting them (admin, superadmin) work whether the flag is on or off.
//
//   POST /transcript-notice
//     The call screen calls this when it shows "This call is being transcribed" to the signed-in patient or doctor of the booking.
//     Body (optional): { version } = the notice wording that was displayed. Nothing else from the body is used: the person, the role,
//     the time and the IP all come from the server. The record is NEVER refused because of the version (see transcriptNotice.js).
//     Also optional: { clientShownAt } = when the browser says it showed the notice. Stored as the separate, UNTRUSTED, informational
//     field clientShownAt (never used for any decision; dropped if it is not a sensible time).
//     Also optional: { consent: "accepted" | "declined" }, kept only when TRANSCRIPT_MODE is "consent" (a later consent screen).
//     Answers { recorded, role, shownAt, version, versionUnrecognized, mode, consent, bothShown }. Repeating the call is safe: the first time stays
//     on file (recorded: false).
//
//   POST /transcript            (the patient or doctor of the booking: their own browser sends their own speech)
//     Body: { items: [ ...up to 25 rows ] }, each row { type: "line", clientId, original, translations?, sourceLang?, languageSource?,
//     confidence?, flags?, ageMs? } or { type: "gap", clientId, reason, durationMs?, ageMs? }.
//     Rows are ALWAYS accepted from a participant, also while the "transcribed" notices are not both on file yet (the browser retries
//     the notice until it works) and also after the appointment is completed (the last lines are sent as the call ends). A row saved
//     before both notices were on file is marked noticePending = true, and a row that reaches the server more than
//     TRANSCRIPT_LATE_UPLOAD_MINUTES (default 30) after the appointment was completed or cancelled is marked lateUpload = true (still
//     saved, never rejected). Each row is checked on its own: good rows are saved, bad ones
//     come back in `rejected`, so one bad row never loses the others. Sending the same clientId again is harmless (`duplicates`).
//     Answers { accepted, duplicates, rejected: [{ index, clientId, reason }], noticePending }.
//
//   GET /transcript             (the booking's doctor, or an admin / superadmin; never the patient; works with the flag off)
//     Answers the rows in speaking order with the notice record and a summary. Every read is written to the audit log FIRST: if that
//     cannot be saved, nothing is returned.
//
//   DELETE /transcript          (admin / superadmin; works with the flag off) body { reason } (3 to 300 characters)
//     Removes every row of the appointment. The notice record stays. Audited (who, when, why, how many).
//
// Nothing in this file logs transcript text. There is no way to edit a row.

const DENIED = {
  invalid_appointment: [400, "A valid appointment id is required."],
  appointment_not_found: [404, "Appointment not found."],
  not_participant: [403, "You are not a participant of this appointment."],
  appointment_ended: [403, "This appointment has ended."],
  not_confirmed: [403, "This appointment is not confirmed yet."],
  server_error: [503, "Could not check the appointment. Please try again."],
};

// A participant may send transcript rows once the call can have happened, including after it ended (last lines, retries).
const TRANSCRIBABLE_STATUSES = new Set(["confirmed", "complete", "completed", "cancelled"]);
const MACHINE_TRANSLATION_NOTICE = "Machine-translated, may contain errors.";
const MAX_REASON = 300;
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;

const modelFor = (kind) => (kind === "category_consultation" ? CategoryConsultation : Appointment);
const modelNameFor = (kind) => (kind === "category_consultation" ? "CategoryConsultation" : "Appointment");

function createAppointmentTranscriptRouter({
  auth = verifyToken,
  noticeLimiter = transcriptNoticeLimiter,
  writeLimiter = transcriptWriteLimiter,
  readLimiter = transcriptReadLimiter,
  decideAccess = decideAppointmentAccess,
  lookupParticipant = lookupParticipantBooking,
  isEnabled = isTranscriptionEnabled,
  record = recordNoticeShown,
  thresholds = getConfidenceThresholds,
  lateUploadMinutes = getLateUploadMinutes,
  mode = getTranscriptMode,
  now = () => new Date(),
} = {}) {
  const router = express.Router({ mergeParams: true });

  // Live feature off: the routes that create something behave exactly like routes that do not exist. (Not used for read / delete.)
  const gate = (req, res, next) => (isEnabled() ? next() : res.status(404).json({ msg: "Not found." }));

  const bad = (res, status, msg, code) => res.status(status).json({ msg, code });
  const deny = (res, reason) => {
    const [status, msg] = DENIED[reason] || DENIED.server_error;
    return res.status(status).json({ msg, code: reason });
  };
  const securityEvent = (req, title, appointmentId) =>
    recordSecurityEvent(req, { type: "unauthorized_access", severity: "medium", title, resource: "Transcript", resourceId: appointmentId });

  // Admins and superadmins may look at any booking; this finds which kind it is (or null).
  async function findKindAny(appointmentId) {
    if (await Appointment.exists({ _id: appointmentId })) return "appointment";
    if (await CategoryConsultation.exists({ _id: appointmentId })) return "category_consultation";
    return null;
  }

  // ---------------------------------------------------------------------------------------------------------------- notice
  router.post("/transcript-notice", gate, auth, noticeLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = String(req.params.id || "");
    if (!mongoose.isValidObjectId(appointmentId)) return deny(res, "invalid_appointment");

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    if (!userId || !noticeRoleKey(role) || !mongoose.isValidObjectId(userId)) return deny(res, "not_participant");

    const access = await decideAccess({ userId, role }, appointmentId);
    if (!access.allowed) {
      if (access.reason === "not_participant") securityEvent(req, "Transcript notice posted for an appointment the user is not part of", appointmentId);
      return deny(res, access.reason);
    }

    try {
      const out = await record({
        kind: access.kind,
        appointmentId,
        userId,
        role,
        version: req.body && req.body.version,
        userAgent: req.get("user-agent"),
        ip: getClientIp(req),
        clientShownAt: req.body && req.body.clientShownAt,
        mode: mode(),
        consent: req.body && req.body.consent,
        now: now(),
      });
      return res.json({
        recorded: out.recorded,
        role: noticeRoleKey(role),
        shownAt: out.entry ? out.entry.shownAt : null,
        version: out.entry ? out.entry.version : null,
        versionUnrecognized: out.entry ? Boolean(out.entry.versionUnrecognized) : false,
        mode: out.entry ? out.entry.mode || "notice" : "notice",
        consent: out.entry ? out.entry.consent || "" : "",
        bothShown: out.bothShown,
      });
    } catch (err) {
      console.error("[transcript-notice] could not save:", err?.name || "error");
      return res.status(500).json({ msg: "Could not record the notice." });
    }
  });

  // ---------------------------------------------------------------------------------------------------------------- write
  router.post("/transcript", gate, auth, writeLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = String(req.params.id || "");
    if (!mongoose.isValidObjectId(appointmentId)) return deny(res, "invalid_appointment");

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    const speakerRole = noticeRoleKey(role);
    if (!userId || !speakerRole || !mongoose.isValidObjectId(userId)) return deny(res, "not_participant");

    const items = req.body && req.body.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH) {
      return bad(res, 400, `Send between 1 and ${MAX_BATCH} items.`, "bad_batch");
    }

    let found;
    try {
      found = await lookupParticipant({ userId, role }, appointmentId);
    } catch (err) {
      return deny(res, classifyAppointmentLookupError(err));
    }
    if (!found.appointment) return deny(res, "appointment_not_found");
    if (!found.allowed) {
      securityEvent(req, "Transcript lines posted for an appointment the user is not part of", appointmentId);
      return deny(res, "not_participant");
    }
    if (!TRANSCRIBABLE_STATUSES.has(String(found.appointment.status || "").toLowerCase())) {
      return bad(res, 403, "This appointment is not open for transcription.", "not_active");
    }

    try {
      // Lines are never refused for a missing notice; they are marked, and the transcript view shows the mark.
      const booking = await modelFor(found.kind).findById(appointmentId).select("+transcriptNotice status updatedAt cancelledAt").lean();
      const noticePending = !bothNoticesShown(booking);
      const receivedAt = now();
      // Rows are never refused for arriving late; they are marked, and the transcript view shows the mark.
      const lateUpload = isLateUpload(booking, receivedAt, lateUploadMinutes());

      const { docs, rejected } = prepareBatch(
        items,
        {
          appointmentId: new mongoose.Types.ObjectId(appointmentId),
          appointmentModel: modelNameFor(found.kind),
          recordedBy: new mongoose.Types.ObjectId(userId),
          speakerRole,
          receivedAt,
          noticePending,
          lateUpload,
          captureMode: mode(),
        },
        thresholds()
      );

      let accepted = 0;
      if (docs.length) {
        // One upsert per row, keyed by (appointment, person, clientId): a retried row is a no-op instead of a duplicate.
        const ops = docs.map(({ appointmentId: a, recordedBy: r, clientId, ...rest }) => ({
          updateOne: { filter: { appointmentId: a, recordedBy: r, clientId }, update: { $setOnInsert: rest }, upsert: true },
        }));
        const result = await TranscriptSegment.bulkWrite(ops, { ordered: false });
        accepted = result.upsertedCount;
      }
      return res.json({ accepted, duplicates: docs.length - accepted, rejected, noticePending, lateUpload });
    } catch (err) {
      console.error("[transcript] could not save:", err?.name || "error"); // never the rows
      return res.status(500).json({ msg: "Could not save the transcript." });
    }
  });

  // ---------------------------------------------------------------------------------------------------------------- read
  router.get("/transcript", auth, readLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = String(req.params.id || "");
    if (!mongoose.isValidObjectId(appointmentId)) return deny(res, "invalid_appointment");

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    const isAdmin = role === "admin" || role === "superadmin";
    if (!userId || !mongoose.isValidObjectId(userId) || (role !== "doctor" && !isAdmin)) {
      if (userId) securityEvent(req, "Transcript read refused for this role", appointmentId);
      return deny(res, "not_participant"); // patients, partners, other staff: never
    }

    try {
      let kind;
      if (isAdmin) {
        kind = await findKindAny(appointmentId);
        if (!kind) return deny(res, "appointment_not_found");
      } else {
        const found = await lookupParticipant({ userId, role }, appointmentId);
        if (!found.appointment) return deny(res, "appointment_not_found");
        if (!found.allowed) {
          securityEvent(req, "Transcript read for an appointment the doctor is not part of", appointmentId);
          return deny(res, "not_participant");
        }
        kind = found.kind;
      }

      const asked = Number.parseInt(req.query.limit, 10);
      const limit = Number.isFinite(asked) ? Math.min(MAX_LIMIT, Math.max(1, asked)) : DEFAULT_LIMIT;
      const fetched = await TranscriptSegment.find({ appointmentId }).select("+enc").sort({ spokeAt: 1, _id: 1 }).limit(limit + 1).lean();
      const truncated = fetched.length > limit;
      const rows = truncated ? fetched.slice(0, limit) : fetched;

      // Audit first, fail closed: no audit row, no transcript.
      try {
        await TranscriptAccessLog.create({
          appointmentId,
          userId,
          role,
          action: "view",
          count: rows.length,
          ip: getClientIp(req),
          userAgent: String(req.get("user-agent") || "").slice(0, 300),
          at: now(),
        });
      } catch (err) {
        console.error("[transcript] audit write failed, nothing returned:", err?.name || "error");
        return bad(res, 503, "The transcript cannot be opened right now. Please try again.", "audit_unavailable");
      }

      const noticeDoc = await modelFor(kind).findById(appointmentId).select("+transcriptNotice").lean();
      const n = (noticeDoc && noticeDoc.transcriptNotice) || {};
      const entry = (e) =>
        e
          ? {
              shownAt: e.shownAt,
              version: e.version,
              versionUnrecognized: Boolean(e.versionUnrecognized),
              // what the browser CLAIMED (its own clock): untrusted, informational, shown next to the server's shownAt
              clientShownAt: e.clientShownAt || null,
              mode: e.mode || "notice",
              consent: e.consent || "",
              // who and from where is for admins only
              ...(isAdmin ? { userId: String(e.userId), ip: e.ip || "", userAgent: e.userAgent || "" } : {}),
            }
          : null;

      const segments = rows.map(serializeSegment);
      const lines = segments.filter((s) => s.kind === "line");
      return res.json({
        appointmentId,
        notice: { bothShown: bothNoticesShown(noticeDoc), patient: entry(n.patient), doctor: entry(n.doctor) },
        summary: {
          lines: lines.length,
          gaps: segments.length - lines.length,
          hidden: lines.filter((s) => s.hidden).length,
          noticePending: segments.filter((s) => s.noticePending).length,
          lateUpload: segments.filter((s) => s.lateUpload).length,
        },
        machineTranslationNotice: MACHINE_TRANSLATION_NOTICE,
        truncated,
        segments,
      });
    } catch (err) {
      if (err && (err.name === "CastError" || err.name === "BSONError")) return deny(res, "invalid_appointment");
      console.error("[transcript] could not read:", err?.name || "error");
      return res.status(500).json({ msg: "Could not load the transcript." });
    }
  });

  // -------------------------------------------------------------------------------------------------------------- delete
  router.delete("/transcript", auth, readLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = String(req.params.id || "");
    if (!mongoose.isValidObjectId(appointmentId)) return deny(res, "invalid_appointment");

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    if (!userId || !mongoose.isValidObjectId(userId) || (role !== "admin" && role !== "superadmin")) {
      if (userId) securityEvent(req, "Transcript delete refused for this role", appointmentId);
      return deny(res, "not_participant");
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim() : "";
    if (reason.length < 3) return bad(res, 400, "Please give a reason (at least 3 characters).", "reason_required");
    if (reason.length > MAX_REASON) return bad(res, 400, `The reason must be at most ${MAX_REASON} characters.`, "reason_too_long");

    let audit;
    try {
      // Written BEFORE anything is removed (fail closed), then completed with the number of rows removed.
      audit = await TranscriptAccessLog.create({
        appointmentId,
        userId,
        role,
        action: "delete",
        count: null,
        reason,
        ip: getClientIp(req),
        userAgent: String(req.get("user-agent") || "").slice(0, 300),
        at: now(),
      });
    } catch (err) {
      console.error("[transcript] audit write failed, nothing deleted:", err?.name || "error");
      return bad(res, 503, "The transcript cannot be deleted right now. Please try again.", "audit_unavailable");
    }

    try {
      const result = await TranscriptSegment.deleteMany({ appointmentId });
      await TranscriptAccessLog.updateOne({ _id: audit._id }, { $set: { count: result.deletedCount } }).catch((err) =>
        console.error("[transcript] could not complete the audit row:", err?.name || "error")
      );
      return res.json({ deleted: result.deletedCount });
    } catch (err) {
      console.error("[transcript] could not delete:", err?.name || "error");
      return res.status(500).json({ msg: "Could not delete the transcript." });
    }
  });

  return router;
}

module.exports = createAppointmentTranscriptRouter();
module.exports.createAppointmentTranscriptRouter = createAppointmentTranscriptRouter;
