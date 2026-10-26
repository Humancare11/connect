// Machine-readable reasons sent with the "room-access-denied" socket event so
// clients can tell a final refusal (the call is over / not yours) from a
// transient one (expired token, DB hiccup, a rejoin racing its own stale
// socket) that is worth retrying.
const DENY_REASONS = new Set([
  "unauthenticated",
  "invalid_appointment",
  "room_full",
  "appointment_ended",
  "not_participant",
  "appointment_not_found",
  "server_error",
]);

const LEGACY_REASON_MAP = {
  missing_appointment: "invalid_appointment",
};

function normalizeDenyReason(reason) {
  const mapped = LEGACY_REASON_MAP[reason] || reason;
  return DENY_REASONS.has(mapped) ? mapped : "server_error";
}

// A malformed appointment id is a permanent client error; anything else thrown
// while looking the appointment up (Mongo disconnect, timeout, ...) is transient.
function classifyAppointmentLookupError(err) {
  const name = err?.name;
  if (name === "CastError" || name === "BSONError" || name === "BSONTypeError") {
    return "invalid_appointment";
  }
  return "server_error";
}

module.exports = { DENY_REASONS, normalizeDenyReason, classifyAppointmentLookupError };
