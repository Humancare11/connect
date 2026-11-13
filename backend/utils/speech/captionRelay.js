// Live captions and language changes over the call's Socket.IO room.
//
//   lang-changed  { appointmentId, lang }     "I now read / hear <lang>" ("none" = Real voice, no translation). Sent by the LISTENER to the
//                                             other person, whose own recognizer then adds or removes that translation target.
//   tr-status     { appointmentId, status }   "my recognizer is: ok | no_match | stalled | backgrounded | interrupted | down". Sent by the SPEAKER, so the
//                                             listener learns at once that translation will not arrive and can give the real voice back.
//   caption       { appointmentId, id, final, text, srcLang?, conf?, tr? }
//                                             one recognized sentence (final) or its growing partial, from the SPEAKER, with its
//                                             translations already in the languages the listener needs (tr: { en: "...", de: "..." }).
//
// Both are pure relays to the other person in the same appointment room. Rules:
//   • Feature flag off: ignored silently, exactly like an event the server has never heard of.
//   • The sender must be in the appointment room (the room check every call event uses) and must be the booking's patient or doctor.
//   • Who the sender is comes from the SOCKET (its logged-in identity), never from the payload: the relayed `from` is "patient" or
//     "doctor" as the server knows them. Any `from` / `role` / `at` in the payload is ignored.
//   • Only known fields are relayed, each checked and size-capped; anything else is dropped. A whole message is at most 8 KB.
//   • Rate limited per socket (partials are frequent, languages are rare).
//   • NOTHING here logs a payload or any part of it. A refused message is reported with the event name and a code only
//     (rejectSignal), and the code never contains text.
//   • The server keeps no copy: no database write, no memory beyond the call, no replay for someone who joins later (the saved
//     transcript, POST /api/appointments/:id/transcript, is the record; live captions are best-effort).
const LANG_CODE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const CAPTION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT = 2000;
const MAX_TRANSLATIONS = 3;
const STATUSES = new Set(["ok", "no_match", "stalled", "backgrounded", "interrupted", "down"]);
const MAX_MESSAGE_BYTES = 8 * 1024;
const MAX_PAYLOAD_KEYS = 20;
const MAX_ID_LENGTH = 64;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Control characters become spaces, runs of spaces collapse. Returns "" for anything that is not text.
function cleanCaptionText(value) {
  if (typeof value !== "string" || value.length > MAX_TEXT * 2) return "";
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

function parseAppointmentId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;
}

// -> { ok: true, appointmentId, lang } or { ok: false }
function parseLangChanged(payload) {
  if (!isObject(payload) || Object.keys(payload).length > MAX_PAYLOAD_KEYS) return { ok: false };
  const appointmentId = parseAppointmentId(payload.appointmentId);
  if (!appointmentId) return { ok: false };
  const lang = payload.lang;
  if (lang !== "none" && !(typeof lang === "string" && LANG_CODE.test(lang))) return { ok: false };
  return { ok: true, appointmentId, lang };
}

// -> { ok: true, appointmentId, status } or { ok: false }
function parseStatus(payload) {
  if (!isObject(payload) || Object.keys(payload).length > MAX_PAYLOAD_KEYS) return { ok: false };
  const appointmentId = parseAppointmentId(payload.appointmentId);
  if (!appointmentId || typeof payload.status !== "string" || !STATUSES.has(payload.status)) return { ok: false };
  return { ok: true, appointmentId, status: payload.status };
}

// -> { ok: true, appointmentId, caption } or { ok: false, reason }
function parseCaption(payload) {
  if (!isObject(payload) || Object.keys(payload).length > MAX_PAYLOAD_KEYS) return { ok: false, reason: "invalid_payload" };
  const appointmentId = parseAppointmentId(payload.appointmentId);
  if (!appointmentId) return { ok: false, reason: "invalid_payload" };
  if (typeof payload.id !== "string" || !CAPTION_ID.test(payload.id)) return { ok: false, reason: "invalid_payload" };
  if (typeof payload.final !== "boolean") return { ok: false, reason: "invalid_payload" };
  const text = cleanCaptionText(payload.text);
  if (!text) return { ok: false, reason: "invalid_payload" };

  const srcLang = typeof payload.srcLang === "string" && LANG_CODE.test(payload.srcLang) ? payload.srcLang : "";
  const conf = typeof payload.conf === "number" && Number.isFinite(payload.conf) && payload.conf >= 0 && payload.conf <= 1 ? payload.conf : null;

  const tr = {};
  if (payload.tr !== undefined && payload.tr !== null) {
    if (!isObject(payload.tr)) return { ok: false, reason: "invalid_payload" };
    const keys = Object.keys(payload.tr);
    if (keys.length > MAX_TRANSLATIONS) return { ok: false, reason: "invalid_payload" };
    for (const code of keys) {
      if (!LANG_CODE.test(code)) return { ok: false, reason: "invalid_payload" };
      const value = payload.tr[code];
      if (typeof value === "string" && value.trim() === "") continue; // an empty translation is simply not relayed
      const t = cleanCaptionText(value);
      if (!t) return { ok: false, reason: "invalid_payload" };
      tr[code.toLowerCase()] = t;
    }
  }

  const caption = { id: payload.id, final: payload.final, text, srcLang, conf, tr };
  if (Buffer.byteLength(JSON.stringify(caption), "utf8") > MAX_MESSAGE_BYTES) return { ok: false, reason: "too_big" };
  return { ok: true, appointmentId, caption };
}

// Wires the two events. Everything the server owns is passed in, so this module has no globals and can be tested without a server:
//   isEnabled()                       the TRANSCRIPTION_ENABLED switch
//   isInRoom(socket, appointmentId)   server.js isSocketInAppointmentRoom
//   getSenderRole(socket)             "user" | "doctor" | other, from the socket's login (never the payload)
//   allowLang(socketId), allowCaption(socketId)   per-socket rate limits (true = allowed)
//   relay(socket, appointmentId, event, payload)  deliver to the OTHER people in the room
//   reject(socket, event, code)       tell the sender, logging only the event name and the code
//   now()                             clock for the delivery time stamp
function createCaptionHandlers({ isEnabled, isInRoom, getSenderRole, allowLang, allowCaption, allowStatus = allowLang, relay, reject, now = () => Date.now() }) {
  const speakerOf = (role) => (role === "doctor" ? "doctor" : role === "user" ? "patient" : null);

  function onLangChanged(socket, payload) {
    if (!isEnabled()) return;
    const parsed = parseLangChanged(payload);
    if (!parsed.ok) return reject(socket, "lang-changed", "invalid_payload");
    if (!isInRoom(socket, parsed.appointmentId)) return reject(socket, "lang-changed", "not_in_room");
    const from = speakerOf(getSenderRole(socket));
    if (!from) return reject(socket, "lang-changed", "not_allowed");
    if (!allowLang(socket.id)) return reject(socket, "lang-changed", "rate_limited");
    relay(socket, parsed.appointmentId, "lang-changed", { appointmentId: parsed.appointmentId, lang: parsed.lang, from });
    return undefined;
  }

  function onStatus(socket, payload) {
    if (!isEnabled()) return;
    const parsed = parseStatus(payload);
    if (!parsed.ok) return reject(socket, "tr-status", "invalid_payload");
    if (!isInRoom(socket, parsed.appointmentId)) return reject(socket, "tr-status", "not_in_room");
    const from = speakerOf(getSenderRole(socket));
    if (!from) return reject(socket, "tr-status", "not_allowed");
    if (!allowStatus(socket.id)) return reject(socket, "tr-status", "rate_limited");
    relay(socket, parsed.appointmentId, "tr-status", { appointmentId: parsed.appointmentId, status: parsed.status, from });
    return undefined;
  }

  function onCaption(socket, payload) {
    if (!isEnabled()) return;
    const parsed = parseCaption(payload);
    if (!parsed.ok) return reject(socket, "caption", parsed.reason);
    if (!isInRoom(socket, parsed.appointmentId)) return reject(socket, "caption", "not_in_room");
    const from = speakerOf(getSenderRole(socket));
    if (!from) return reject(socket, "caption", "not_allowed");
    if (!allowCaption(socket.id)) return reject(socket, "caption", "rate_limited");
    relay(socket, parsed.appointmentId, "caption", { appointmentId: parsed.appointmentId, from, ...parsed.caption, at: now() });
    return undefined;
  }

  return { onLangChanged, onCaption, onStatus };
}

module.exports = {
  MAX_TEXT,
  MAX_TRANSLATIONS,
  MAX_MESSAGE_BYTES,
  cleanCaptionText,
  parseLangChanged,
  parseCaption,
  parseStatus,
  STATUSES,
  createCaptionHandlers,
};
