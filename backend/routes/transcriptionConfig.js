const express = require("express");
const { verifyToken } = require("../middleware/verifyToken");
const { transcriptionConfigLimiter } = require("../middleware/rateLimiters");
const { isTranscriptionEnabled, getTranscriptMode } = require("../utils/speech/config");
const { TRANSCRIPT_NOTICE_VERSION } = require("../utils/speech/transcriptNotice");

// GET /api/transcription/config
//
// What the call screen needs to know before it starts the live transcript feature, for any signed-in person:
//   { enabled, mode, noticeVersion }
//     enabled        the server switch TRANSCRIPTION_ENABLED (default off). When false the screen must behave exactly as before.
//     mode           "notice" (people are told) or "consent" (reserved for a later consent screen; today only a label).
//     noticeVersion  the wording version of the "this call is being transcribed" notice the app should show.
// It answers 200 even when the feature is off, so asking is always safe. It never returns the Azure key, a token, or any setting that
// is not listed above.
function createTranscriptionConfigRouter({
  auth = verifyToken,
  limiter = transcriptionConfigLimiter,
  isEnabled = isTranscriptionEnabled,
  getMode = getTranscriptMode,
} = {}) {
  const router = express.Router();
  router.get("/", auth, limiter, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ enabled: isEnabled(), mode: getMode(), noticeVersion: TRANSCRIPT_NOTICE_VERSION });
  });
  return router;
}

module.exports = createTranscriptionConfigRouter();
module.exports.createTranscriptionConfigRouter = createTranscriptionConfigRouter;
