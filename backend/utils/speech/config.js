// Live transcript / translation module switches (Azure AI Speech).
//
//   TRANSCRIPTION_ENABLED                 "true" turns the feature on. Default: off. With it off the token endpoint answers 404
//                                         exactly as if it did not exist.
//   AZURE_SPEECH_KEY                      the connect-speech key. Server only; it is never sent to a browser or written to a log.
//   AZURE_SPEECH_REGION                   default eastus.
//   SPEECH_TOKEN_MAX_PER_APPOINTMENT      most tokens one person can fetch for one appointment (default 40, about 6 hours of
//                                         call with a refresh every 9 minutes). A bound on cost if a call is left open.

const DEFAULT_REGION = "eastus";
const DEFAULT_MAX_PER_APPOINTMENT = 40;

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

module.exports = {
  DEFAULT_REGION,
  DEFAULT_MAX_PER_APPOINTMENT,
  isTranscriptionEnabled,
  parseRegion,
  getSpeechConfig,
  getMaxTokensPerAppointment,
};
