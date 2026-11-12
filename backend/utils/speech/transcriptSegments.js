// Turning what a browser sends into transcript rows (and rows back into readable lines).
//
// Design rule: the transcript is our proof, so one bad row must never cost the good ones. A batch is checked row by row: every valid
// row is saved, every invalid one is reported back (index, clientId, reason) so the browser can drop just that one. Only a request that
// is not a batch at all is refused outright.
//
// The server decides who spoke (recordedBy, speakerRole come from the login token) and when (receivedAt is the server clock; spokeAt is
// receivedAt minus the age the browser reports, so a wrong browser clock cannot move a row). Nothing here logs any text.
const { encryptPHI, decryptPHI } = require("../phiCrypto");
const { getConfidenceThresholds } = require("./config");

const MAX_BATCH = 25; // the app-wide JSON limit is 100 KB, so batches stay small; a browser that gets 413 sends half
const MAX_TEXT = 2000; // one recognized sentence is far below this
const MAX_TRANSLATIONS = 3;
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // a browser that was offline can send lines up to this old
const MAX_GAP_MS = 24 * 60 * 60 * 1000;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const LANG_CODE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const GAP_REASONS = new Set(["muted", "recognizer_down", "mic_stalled", "backgrounded", "interrupted", "other"]);
const LANGUAGE_SOURCES = new Set(["declared", "auto"]);

const ENDED_STATUSES = new Set(["complete", "completed", "cancelled"]);

// When did this booking end? The best time already stored on it: the admin's cancelledAt for a cancellation, otherwise the last time the
// booking changed (updatedAt). updatedAt can be later than the real end (any later edit moves it), so this can only UNDER-flag a late
// upload, never flag an on-time one. If bookings ever get a dedicated completedAt, read it here.
function bookingEndedAt(booking) {
  if (!booking) return null;
  const status = String(booking.status || "").toLowerCase();
  if (!ENDED_STATUSES.has(status)) return null;
  const at = (status === "cancelled" && booking.cancelledAt) || booking.updatedAt;
  const date = at ? new Date(at) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// true when `receivedAt` is more than `minutes` after the booking ended. A booking that has not ended is never late.
function isLateUpload(booking, receivedAt, minutes) {
  const endedAt = bookingEndedAt(booking);
  return Boolean(endedAt) && receivedAt.getTime() - endedAt.getTime() > minutes * 60 * 1000;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Plain text only: control characters become spaces, runs of spaces collapse. Returns { ok, value } or { ok:false, reason }.
function cleanText(value) {
  if (typeof value !== "string") return { ok: false, reason: "empty_text" };
  const text = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty_text" };
  if (text.length > MAX_TEXT) return { ok: false, reason: "text_too_long" };
  return { ok: true, value: text };
}

const languageBase = (code) => String(code || "").toLowerCase().split("-")[0];

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function confidenceTier(confidence, thresholds) {
  if (confidence === null || confidence === undefined) return "unknown";
  if (confidence < thresholds.unclearBelow) return "unclear";
  if (confidence < thresholds.lowBelow) return "low";
  return "normal";
}

// Checks one row. Returns { doc } (ready to store, minus the booking and person fields added by the caller) or { reason }.
function prepareOne(item, { receivedAt, thresholds }) {
  if (!isObject(item)) return { reason: "bad_item" };
  if (typeof item.clientId !== "string" || !CLIENT_ID.test(item.clientId)) return { reason: "bad_client_id" };
  const ageMs = clampInt(item.ageMs, 0, MAX_AGE_MS);
  const spokeAt = new Date(receivedAt.getTime() - ageMs);

  if (item.type === "gap") {
    if (typeof item.reason !== "string" || !GAP_REASONS.has(item.reason)) return { reason: "bad_gap_reason" };
    const durationMs = clampInt(item.durationMs, 0, MAX_GAP_MS);
    // a gap cannot end in the future
    const gapTo = new Date(Math.min(spokeAt.getTime() + durationMs, receivedAt.getTime()));
    return { doc: { kind: "gap", clientId: item.clientId, spokeAt, gapReason: item.reason, gapFrom: spokeAt, gapTo } };
  }

  if (item.type !== "line") return { reason: "bad_type" };

  const original = cleanText(item.original);
  if (!original.ok) return { reason: original.reason };

  const translations = {};
  if (item.translations !== undefined && item.translations !== null) {
    if (!isObject(item.translations)) return { reason: "bad_translations" };
    const entries = Object.entries(item.translations);
    if (entries.length > MAX_TRANSLATIONS) return { reason: "too_many_translations" };
    for (const [code, text] of entries) {
      if (!LANG_CODE.test(code)) return { reason: "bad_translation_language" };
      if (typeof text === "string" && text.trim() === "") continue; // an empty translation is simply not stored
      const t = cleanText(text);
      if (!t.ok) return { reason: t.reason === "text_too_long" ? "text_too_long" : "bad_translation" };
      translations[code.toLowerCase()] = t.value;
    }
  }

  const sourceLang = typeof item.sourceLang === "string" && LANG_CODE.test(item.sourceLang) ? item.sourceLang : "";
  const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1 ? item.confidence : null;
  const flags = isObject(item.flags) ? item.flags : {};
  const machineTranslated = Object.keys(translations).some((code) => !sourceLang || languageBase(code) !== languageBase(sourceLang));

  return {
    doc: {
      kind: "line",
      clientId: item.clientId,
      spokeAt,
      sourceLang,
      languageSource: LANGUAGE_SOURCES.has(item.languageSource) ? item.languageSource : "",
      confidence,
      confidenceTier: confidenceTier(confidence, thresholds),
      flags: { suspectedEcho: flags.suspectedEcho === true, languageNotInList: flags.languageNotInList === true },
      machineTranslated,
      enc: encryptPHI({ original: original.value, translations }),
    },
  };
}

// items -> { docs, rejected }. `base` carries what the server knows: appointmentId, appointmentModel, recordedBy, speakerRole,
// receivedAt, noticePending.
function prepareBatch(items, base, thresholds = getConfidenceThresholds()) {
  const docs = [];
  const rejected = [];
  items.forEach((item, index) => {
    const out = prepareOne(item, { receivedAt: base.receivedAt, thresholds });
    if (out.doc) docs.push({ ...out.doc, ...base });
    else rejected.push({ index, clientId: isObject(item) && typeof item.clientId === "string" ? item.clientId.slice(0, 64) : null, reason: out.reason });
  });
  return { docs, rejected };
}

// A stored row -> what the transcript view gets. `hidden` = the default view should not show it (an echo of our own translated voice,
// or a line the recognizer was not sure about); it is still returned so a reviewer can look at it.
function serializeSegment(row) {
  const base = {
    id: String(row._id),
    kind: row.kind,
    speakerRole: row.speakerRole,
    recordedBy: String(row.recordedBy),
    spokeAt: row.spokeAt,
    receivedAt: row.receivedAt,
    noticePending: Boolean(row.noticePending),
    lateUpload: Boolean(row.lateUpload),
  };
  if (row.kind === "gap") return { ...base, reason: row.gapReason, from: row.gapFrom, to: row.gapTo };

  let words = null;
  try {
    words = decryptPHI(row.enc);
  } catch {
    words = null; // wrong key or damaged data: say so, never throw and never log what it was
  }
  const flags = { suspectedEcho: Boolean(row.flags && row.flags.suspectedEcho), languageNotInList: Boolean(row.flags && row.flags.languageNotInList) };
  return {
    ...base,
    sourceLang: row.sourceLang,
    languageSource: row.languageSource,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    flags,
    hidden: flags.suspectedEcho || row.confidenceTier === "unclear",
    machineTranslated: Boolean(row.machineTranslated),
    unreadable: !words,
    original: words ? words.original : null,
    translations: words ? words.translations || {} : {},
  };
}

module.exports = {
  MAX_BATCH,
  MAX_TEXT,
  MAX_TRANSLATIONS,
  MAX_AGE_MS,
  GAP_REASONS,
  ENDED_STATUSES,
  bookingEndedAt,
  isLateUpload,
  cleanText,
  confidenceTier,
  languageBase,
  prepareOne,
  prepareBatch,
  serializeSegment,
};
