const express = require("express");
const mongoose = require("mongoose");
const { verifyToken } = require("../middleware/verifyToken");
const { speechTokenLimiter } = require("../middleware/rateLimiters");
const { decideAppointmentAccess } = require("../utils/appointmentRoomAccess");
const { recordSecurityEvent } = require("../utils/securityMonitor");
const { isTranscriptionEnabled, getMaxTokensPerAppointment } = require("../utils/speech/config");
const { createSpeechTokenService, SpeechTokenError } = require("../utils/speech/speechTokenService");

// GET /api/speech-token?appointmentId=<id>
//
// Gives a participant of a live (confirmed, not finished) appointment a 10-minute Azure Speech token for the call's live
// transcript / translation. Only the booking's own patient and doctor get one; admins and everyone else are refused, so a
// token can only be minted for a real consultation. Feature flag: TRANSCRIPTION_ENABLED (default off, answers 404).
// Nothing here ever logs or returns the Azure key, and a token is never logged.

const DENIED = {
  invalid_appointment: [400, "A valid appointmentId is required."],
  appointment_not_found: [404, "Appointment not found."],
  not_participant: [403, "You are not a participant of this appointment."],
  appointment_ended: [403, "This appointment has ended."],
  not_confirmed: [403, "This appointment is not confirmed yet."],
  server_error: [503, "Could not check the appointment. Please try again."],
};

function createSpeechTokenRouter({
  auth = verifyToken,
  limiter = speechTokenLimiter,
  service = createSpeechTokenService(),
  decideAccess = decideAppointmentAccess,
  isEnabled = isTranscriptionEnabled,
  maxPerAppointment = getMaxTokensPerAppointment,
} = {}) {
  const router = express.Router();

  // Feature off: behave exactly like a route that does not exist.
  const gate = (req, res, next) => (isEnabled() ? next() : res.status(404).json({ msg: "Not found." }));

  router.get("/", gate, auth, limiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const appointmentId = typeof req.query.appointmentId === "string" ? req.query.appointmentId : "";
    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ msg: DENIED.invalid_appointment[1], code: "invalid_appointment" });
    }

    const role = req.user?.role;
    const userId = req.user?.id ? String(req.user.id) : "";
    if (!userId || (role !== "user" && role !== "doctor")) {
      return res.status(403).json({ msg: DENIED.not_participant[1], code: "not_participant" });
    }

    const access = await decideAccess({ userId, role }, appointmentId);
    if (!access.allowed) {
      const [status, msg] = DENIED[access.reason] || DENIED.server_error;
      if (access.reason === "not_participant") {
        recordSecurityEvent(req, {
          type: "unauthorized_access",
          severity: "medium",
          title: "Speech token requested for an appointment the user is not part of",
          resource: "SpeechToken",
          resourceId: appointmentId,
        });
      }
      return res.status(status).json({ msg, code: access.reason });
    }

    if (!service.allowForAppointment(appointmentId, userId, maxPerAppointment())) {
      return res.status(429).json({ msg: "The live translation limit for this appointment has been reached.", code: "appointment_cap" });
    }

    try {
      const { token, region, expiresInSeconds } = await service.getToken();
      return res.json({ token, region, expiresInSeconds });
    } catch (err) {
      if (err instanceof SpeechTokenError) {
        const msg = err.code === "not_configured" ? "Live translation is not configured." : "The speech service is unavailable. Please try again.";
        return res.status(err.httpStatus).json({ msg, code: err.code });
      }
      console.error("[speech-token] unexpected error:", err?.name || "error");
      return res.status(500).json({ msg: "Could not issue a speech token." });
    }
  });

  return router;
}

module.exports = createSpeechTokenRouter();
module.exports.createSpeechTokenRouter = createSpeechTokenRouter;
