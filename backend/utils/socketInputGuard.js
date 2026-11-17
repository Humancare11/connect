const { asObjectIdString, asRoomToken, isPlainObject, typeName } = require("./inputGuards");
const { deniedMessage } = require("./appointmentRoomAccess");

// Checks the PAYLOAD of every Socket.IO event before any handler runs (Socket.IO packet middleware), so a handler only ever sees
// well-formed input. A valid request from a real client is passed on untouched. Anything else is dropped, with ONE log line that
// carries only the event name, the field NAME and its JavaScript type (never the value) and, where the app already answered
// invalid input with an event, that same answer.
//
//   * Appointment call events: appointmentId must be a 24-hex-character string (an object / array / "$..." is the way a client could
//     turn a lookup into a query for many appointments).
//   * Chat (appointment-message): text, fileName, fileType, fileUrl, senderId must be strings (or absent); text is at most 2000
//     characters and fileName / fileType at most 200. senderName is not read from the browser at all (the server uses the signed-in
//     user's own name, see server.js).
//   * Direct (link) rooms: roomId must be a plain safe token; the other text fields must be strings.
//   * user-online / join: userId, role, token must be strings when present.

const APPOINTMENT_EVENTS = new Set([
  "join-appointment-room",
  "leave-appointment-room",
  "video-telemetry",
  "video-offer",
  "video-answer",
  "ice-candidate",
  "ice-restart-request",
  "call-connected",
  "call-stats",
  "admin-watch-call",
  "admin-unwatch-call",
  "camera-state",
  "lang-changed",
  "caption",
  "tr-status",
  "request-peer-rebuild",
  "appointment-message",
]);

const DIRECT_EVENTS = new Set([
  "verify-direct-pin",
  "direct-session-takeover",
  "join-direct-room",
  "leave-direct-room",
  "direct-video-offer",
  "direct-video-answer",
  "direct-ice-candidate",
  "direct-ice-restart-request",
  "direct-media-state",
  "direct-call-connected",
  "admin-watch-direct-room",
  "admin-unwatch-direct-room",
  "direct-call-stats",
  "direct-call-problem",
  "direct-room-message",
]);

// optional string fields per event family: name -> max length (0 = type check only, no length limit)
const IDENTITY_STRINGS = { userId: 64, role: 32, token: 8192 };
const CHAT_STRINGS = { text: 2000, fileName: 200, fileType: 200, fileUrl: 1024, senderId: 64 };
const DIRECT_STRINGS = { guestId: 128, pin: 64, name: 200, sessionToken: 8192, role: 32, reason: 200 };

// -> null when fine, else { field, type }
function checkOptionalStrings(payload, limits) {
  for (const [field, max] of Object.entries(limits)) {
    const v = payload[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") return { field, type: typeName(v) };
    if (max && v.length > max) return { field, type: "string_too_long" };
  }
  return null;
}

// -> { ok: true } | { ok: false, field, type }
function validatePacket(event, payload) {
  if (event === "user-online") {
    if (payload === undefined || payload === null) return { ok: true };
    if (!isPlainObject(payload)) return { ok: false, field: "payload", type: typeName(payload) };
    const bad = checkOptionalStrings(payload, IDENTITY_STRINGS);
    return bad ? { ok: false, ...bad } : { ok: true };
  }

  if (APPOINTMENT_EVENTS.has(event)) {
    if (!isPlainObject(payload)) return { ok: false, field: "payload", type: typeName(payload) };
    if (!asObjectIdString(payload.appointmentId)) return { ok: false, field: "appointmentId", type: typeName(payload.appointmentId) };
    let bad = null;
    if (event === "join-appointment-room") {
      bad = checkOptionalStrings(payload, IDENTITY_STRINGS);
      if (!bad) for (const f of ["capabilities", "clientInfo"]) if (payload[f] !== undefined && payload[f] !== null && !isPlainObject(payload[f])) bad = { field: f, type: typeName(payload[f]) };
    } else if (event === "appointment-message") {
      bad = checkOptionalStrings(payload, CHAT_STRINGS);
    }
    return bad ? { ok: false, ...bad } : { ok: true };
  }

  if (DIRECT_EVENTS.has(event)) {
    if (!isPlainObject(payload)) return { ok: false, field: "payload", type: typeName(payload) };
    // direct-call-stats carries the room id at the top of the sample, like the others
    if (!asRoomToken(payload.roomId)) return { ok: false, field: "roomId", type: typeName(payload.roomId) };
    const limits = event === "direct-room-message" ? { text: 0 } : DIRECT_STRINGS;
    const bad = checkOptionalStrings(payload, limits);
    return bad ? { ok: false, ...bad } : { ok: true };
  }

  return { ok: true };
}

// Installs the check on one socket. `logger` and the error-event limiter are injectable for tests.
function installSocketInputGuard(socket, { logger = console, now = () => Date.now() } = {}) {
  let windowStart = 0;
  let sent = 0;
  const mayAnswer = () => {
    const t = now();
    if (t - windowStart > 1000) { windowStart = t; sent = 0; }
    sent += 1;
    return sent <= 5;
  };

  socket.use((packet, next) => {
    const event = packet[0];
    const payload = packet[1];
    const verdict = validatePacket(event, payload);
    if (verdict.ok) return next();

    logger.warn("[security] socket input rejected", { event: String(event).slice(0, 60), socketId: socket.id, field: verdict.field, type: verdict.type });
    if (!mayAnswer()) return undefined;
    try {
      if (event === "join-appointment-room") {
        // the same answer the app already gives for an invalid appointment id
        socket.emit("room-access-denied", { msg: deniedMessage("invalid_appointment"), reason: "invalid_appointment" });
      } else if (event !== "appointment-message" && event !== "user-online") {
        socket.emit("signaling-error", { event: String(event).slice(0, 60), code: "invalid_payload", msg: "That request was not accepted (invalid_payload)." });
      }
    } catch { /* the socket may already be gone */ }
    return undefined; // not calling next(): the packet is dropped, no handler runs
  });
}

module.exports = { installSocketInputGuard, validatePacket, APPOINTMENT_EVENTS, DIRECT_EVENTS };
