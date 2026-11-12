// Live transcript / translation module switches (Azure AI Speech).
//
//   TRANSCRIPTION_ENABLED                 "true" turns the feature on. Default: off. With it off the token endpoint answers 404
//                                         exactly as if it did not exist.
//   AZURE_SPEECH_KEY                      the connect-speech key. Server only; it is never sent to a browser or written to a log.
//   AZURE_SPEECH_REGION                   default eastus.
//   TRANSCRIPT_UNCLEAR_BELOW              a saved line with recognition confidence below this is marked "unclear" (default 0.4).
//   TRANSCRIPT_LOW_BELOW                  below this (and not unclear) it is marked "low" (default 0.7). Tuned in the step 10 calibration.
//   TRANSCRIPT_LATE_UPLOAD_MINUTES        a transcript row that reaches the server more than this long after the appointment was completed or
//                                         cancelled is still saved, but marked lateUpload (default 30).
//   TRANSCRIPT_MODE                       "notice" (default) = people are told the call is transcribed. "consent" = reserved for a later
//                                         consent screen: today it only labels the data (the mode in force is stored on every notice and
//                                         every saved row) and is shown to the app by GET /api/transcription/config; it blocks nothing.
//                                         Anything that is not exactly "notice" or "consent" is treated as "notice" (what the system
//                                         really does today), with a one-time warning.
//   SPEECH_TOKEN_MAX_PER_APPOINTMENT      most tokens one person can fetch for one appointment (default 40, about 6 hours of
//                                         call with a refresh every 9 minutes). A bound on cost if a call is left open.

const DEFAULT_REGION = "eastus";
const DEFAULT_MAX_PER_APPOINTMENT = 40;
const DEFAULT_UNCLEAR_BELOW = 0.4;
const DEFAULT_LOW_BELOW = 0.7;
const DEFAULT_LATE_UPLOAD_MINUTES = 30;
const MAX_LATE_UPLOAD_MINUTES = 60 * 24 * 30;
const TRANSCRIPT_MODES = ["notice", "consent"];
let warnedBadMode = false;

function isTranscriptionEnabled(env = process.env) {
  return String(env.TRANSCRIPTION_ENABLED || "").trim().toLowerCase() === "true";
}

// The region becomes part of a host name, so only a plain Azure region id is accepted.
function parseRegion(value) {
  const region = String(value || DEFAULT_REGION).trim().toLowerCase();
  return /^[a-z0-9]{3,30}$/.test(region) ? region : null;
}

function getSpeechConfig(env = process.env) {
  const key = String(env.AZURE_SPEECH_KEY || "").trim();
  const region = parseRegion(env.AZURE_SPEECH_REGION);
  if (!key) return { ok: false, reason: "missing_key" };
  if (!region) return { ok: false, reason: "bad_region" };
  return { ok: true, key, region };
}

function getMaxTokensPerAppointment(env = process.env) {
  const n = Number(env.SPEECH_TOKEN_MAX_PER_APPOINTMENT);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_PER_APPOINTMENT;
}

// Confidence thresholds for the saved transcript. Invalid or inconsistent values fall back to the defaults.
function getConfidenceThresholds(env = process.env) {
  const unclear = Number(env.TRANSCRIPT_UNCLEAR_BELOW);
  const low = Number(env.TRANSCRIPT_LOW_BELOW);
  const valid = env.TRANSCRIPT_UNCLEAR_BELOW !== undefined && env.TRANSCRIPT_LOW_BELOW !== undefined &&
    String(env.TRANSCRIPT_UNCLEAR_BELOW).trim() !== "" && String(env.TRANSCRIPT_LOW_BELOW).trim() !== "" &&
    Number.isFinite(unclear) && Number.isFinite(low) && unclear > 0 && unclear < low && low <= 1;
  return valid ? { unclearBelow: unclear, lowBelow: low } : { unclearBelow: DEFAULT_UNCLEAR_BELOW, lowBelow: DEFAULT_LOW_BELOW };
}

// Minutes after an appointment ended beyond which an uploaded transcript row is marked lateUpload. A positive whole number; anything
// else falls back to 30.
function getLateUploadMinutes(env = process.env) {
  const raw = String(env.TRANSCRIPT_LATE_UPLOAD_MINUTES ?? "").trim();
  if (!/^[0-9]+$/.test(raw)) return DEFAULT_LATE_UPLOAD_MINUTES;
  const n = Number(raw);
  return n >= 1 && n <= MAX_LATE_UPLOAD_MINUTES ? n : DEFAULT_LATE_UPLOAD_MINUTES;
}

// "notice" or "consent". Unset or empty = notice. A value that is neither is treated as notice (it never claims consent that is not
// there) and reported once in the log (the value is a setting, not a secret).
function getTranscriptMode(env = process.env) {
  const raw = String(env.TRANSCRIPT_MODE ?? "").trim().toLowerCase();
  if (raw === "") return "notice";
  if (TRANSCRIPT_MODES.includes(raw)) return raw;
  if (!warnedBadMode) {
    warnedBadMode = true;
    console.warn(`[transcription] TRANSCRIPT_MODE="${String(env.TRANSCRIPT_MODE).slice(0, 30)}" is not "notice" or "consent"; using "notice".`);
  }
  return "notice";
}

module.exports = {
  DEFAULT_REGION,
  DEFAULT_MAX_PER_APPOINTMENT,
  isTranscriptionEnabled,
  parseRegion,
  getSpeechConfig,
  getMaxTokensPerAppointment,
  getConfidenceThresholds,
  getLateUploadMinutes,
  TRANSCRIPT_MODES,
  getTranscriptMode,
};
