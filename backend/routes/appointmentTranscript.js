const express = require("express");
const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/verifyToken");
const { transcriptNoticeLimiter } = require("../middleware/rateLimiters");
const { decideAppointmentAccess } = require("../utils/appointmentRoomAccess");
const { recordSecurityEvent } = require("../utils/securityMonitor");
const { isTranscriptionEnabled } = require("../utils/speech/config");
const { getClientIp } = require("../utils/clientIp");
const { noticeRoleKey, recordNoticeShown } = require("../utils/speech/transcriptNotice");

// Live transcript routes of one appointment, mounted at /api/appointments/:id (see server.js). Feature flag TRANSCRIPTION_ENABLED
// (default off): while it is off every route here answers 404 as if it did not exist.
//
//   POST /api/appointments/:id/transcript-notice
//     The call screen calls this when it shows "This call is being transcribed" to the signed-in patient or doctor of the booking.
//     Body (optional): { version } = the notice wording that was displayed. Nothing else from the body is used: the person, the role,
//     the time and the IP all come from the server. The record is NEVER refused because of the version (see transcriptNotice.js).
//     Answers { recorded, role, shownAt, version, versionUnrecognized, bothShown }. Repeating the call is safe: the first time stays
//     on file (recorded: false).
//
// (The transcript itself, GET/POST/DELETE .../transcript, is added in a later step.)

const DENIED = {
  invalid_appointment: [400, "A valid appointment id is required."],
  appointment_not_found: [404, "Appointment not found."],
  not_participant: [403, "You are not a participant of this appointment."],
  appointment_ended: [403, "This appointment has ended."],
  not_confirmed: [403, "This appointment is not confirmed yet."],
  server_error: [503, "Could not check the appointment. Please try again."],
};

function createAppointmentTranscriptRouter({
  auth = verifyToken,
  noticeLimiter = transcriptNoticeLimiter,
  decideAccess = decideAppointmentAccess,
  isEnabled = isTranscriptionEnabled,
  record = recordNoticeShown,
  now = () => new Date(),
} = {}) {
  const router = express.Router({ mergeParams: true });

  // Feature off: behave exactly like a route that does not exist.
  const gate = (req, res, next) => (isEnabled() ? next() : res.status(404).json({ msg: "Not found." }));

  router.post("/transcript-notice", gate, auth, noticeLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = String(req.params.id || "");
    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ msg: DENIED.invalid_appointment[1], code: "invalid_appointment" });
    }

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    if (!userId || !noticeRoleKey(role) || !mongoose.isValidObjectId(userId)) {
      return res.status(403).json({ msg: DENIED.not_participant[1], code: "not_participant" });
    }

    const access = await decideAccess({ userId, role }, appointmentId);
    if (!access.allowed) {
      const [status, msg] = DENIED[access.reason] || DENIED.server_error;
      if (access.reason === "not_participant") {
        recordSecurityEvent(req, {
          type: "unauthorized_access",
          severity: "medium",
          title: "Transcript notice posted for an appointment the user is not part of",
          resource: "TranscriptNotice",
          resourceId: appointmentId,
        });
      }
      return res.status(status).json({ msg, code: access.reason });
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
        now: now(),
      });
      return res.json({
        recorded: out.recorded,
        role: noticeRoleKey(role),
        shownAt: out.entry ? out.entry.shownAt : null,
        version: out.entry ? out.entry.version : null,
        versionUnrecognized: out.entry ? Boolean(out.entry.versionUnrecognized) : false,
        bothShown: out.bothShown,
      });
    } catch (err) {
      console.error("[transcript-notice] could not save:", err?.name || "error");
      return res.status(500).json({ msg: "Could not record the notice." });
    }
  });

  return router;
}

module.exports = createAppointmentTranscriptRouter();
module.exports.createAppointmentTranscriptRouter = createAppointmentTranscriptRouter;
