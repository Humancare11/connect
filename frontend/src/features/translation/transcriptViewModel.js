// The saved transcript as the doctor's and the admin's dashboards show it. Pure functions over the GET /api/appointments/:id/transcript answer.
//
// The saved transcript is the record: unlike the live panel it LISTS everything, including unclear and echo lines, with a mark on each, so
// nobody can mistake a hidden line for a missing one. Nothing here edits a line.
import { getLanguage, languageBase } from "./languages.js";

export const MACHINE_TRANSLATED_NOTE = "Machine-translated, may contain errors";
export const MIN_REASON = 3;
export const MAX_REASON = 300;

export const GAP_LABELS = Object.freeze({
  muted: "Microphone muted",
  recognizer_down: "Speech recognition was unavailable",
  mic_stalled: "Microphone stopped sending sound",
  backgrounded: "App was in the background",
  interrupted: "Interrupted (for example by a phone call)",
  not_recognised: "Speech not recognised",
  other: "Not recorded",
});

export const gapLabel = (reason) => GAP_LABELS[reason] || GAP_LABELS.other;

// The marks shown on a line. Each is { key, label, tone } (tone: "warn" for things a reader must not overlook, "info" otherwise).
export function lineMarks(seg) {
  const marks = [];
  if (!seg || seg.kind !== "line") return marks;
  if (seg.unreadable) marks.push({ key: "unreadable", label: "Could not be read", tone: "warn" });
  if (seg.confidenceTier === "unclear") marks.push({ key: "unclear", label: "Unclear", tone: "warn" });
  else if (seg.confidenceTier === "low") marks.push({ key: "low", label: "Low confidence", tone: "info" });
  if (seg.flags && seg.flags.suspectedEcho) marks.push({ key: "echo", label: "Possible echo of the other voice", tone: "warn" });
  if (seg.flags && seg.flags.languageNotInList) marks.push({ key: "language", label: "Language not supported for transcription", tone: "warn" });
  if (seg.noticePending) marks.push({ key: "noticePending", label: "Recorded before the notice was confirmed", tone: "warn" });
  if (seg.lateUpload) marks.push({ key: "lateUpload", label: "Uploaded late", tone: "info" });
  if (seg.languageSource === "auto") marks.push({ key: "auto", label: "Language detected automatically", tone: "info" });
  return marks;
}

export function languageName(code) {
  const l = code ? getLanguage(code) || getLanguage(languageBase(code)) : null;
  return l ? l.name : code || "";
}

// "Doctor" / "Patient"
export const speakerName = (seg) => (seg && seg.speakerRole === "doctor" ? "Doctor" : "Patient");

// The English record under a line in another language (the record language is English); never a copy of the same words.
export function englishRecord(seg) {
  const tr = (seg && seg.translations) || {};
  const key = Object.keys(tr).find((k) => k.toLowerCase() === "en" || k.toLowerCase().startsWith("en-"));
  const text = key ? String(tr[key] || "") : "";
  return text && text.trim().toLowerCase() !== String(seg.original || "").trim().toLowerCase() ? text : "";
}

// Shapes the answer for display. Unknown or missing parts become empty, never an exception.
export function buildTranscriptView(data) {
  const d = data && typeof data === "object" ? data : {};
  const segments = Array.isArray(d.segments) ? d.segments : [];
  const items = segments.map((seg) => {
    if (seg.kind === "gap") {
      return { id: seg.id, type: "gap", at: seg.spokeAt, label: gapLabel(seg.reason), speaker: speakerName(seg), from: seg.from, to: seg.to };
    }
    const marks = lineMarks(seg);
    return {
      id: seg.id,
      type: "line",
      at: seg.spokeAt,
      speaker: speakerName(seg),
      text: seg.original,
      english: englishRecord(seg),
      language: languageName(seg.sourceLang),
      marks,
      hidden: Boolean(seg.hidden), // not shown in the live panel
      lighter: seg.confidenceTier === "low" || seg.confidenceTier === "unclear",
      machineTranslated: Boolean(seg.machineTranslated),
    };
  });
  const summary = d.summary || {};
  const notice = d.notice || {};
  return {
    items,
    isEmpty: items.length === 0,
    truncated: Boolean(d.truncated),
    summary: {
      lines: Number(summary.lines) || 0,
      gaps: Number(summary.gaps) || 0,
      hidden: Number(summary.hidden) || 0,
      noticePending: Number(summary.noticePending) || 0,
      lateUpload: Number(summary.lateUpload) || 0,
    },
    noticeBothShown: Boolean(notice.bothShown),
    notice: { patient: notice.patient || null, doctor: notice.doctor || null },
  };
}

// The sentence under the heading: what a reader must know before relying on the text.
export function summaryNotes(view) {
  const s = view.summary;
  const notes = [];
  if (!view.noticeBothShown) notes.push("The “this call is being transcribed” notice was not confirmed on both sides.");
  if (s.noticePending) notes.push(`${s.noticePending} line${s.noticePending === 1 ? "" : "s"} recorded before the notice was confirmed.`);
  if (s.hidden) notes.push(`${s.hidden} unclear or echo line${s.hidden === 1 ? " is" : "s are"} included here but were not shown during the call.`);
  if (s.gaps) notes.push(`${s.gaps} period${s.gaps === 1 ? "" : "s"} when speech was not recorded.`);
  if (s.lateUpload) notes.push(`${s.lateUpload} line${s.lateUpload === 1 ? "" : "s"} uploaded after the call ended.`);
  if (view.truncated) notes.push("Only the first part of a very long transcript is shown.");
  return notes;
}

// Validates the reason typed before a delete. Returns an error text, or "" when fine.
export function reasonError(reason) {
  const clean = String(reason || "").replace(/\s+/g, " ").trim();
  if (clean.length < MIN_REASON) return `Please give a reason (at least ${MIN_REASON} characters).`;
  if (clean.length > MAX_REASON) return `The reason must be at most ${MAX_REASON} characters.`;
  return "";
}

// What to say when a request fails. The server's own message is only used for the cases it words for people.
export function loadErrorMessage(err) {
  const status = err && err.response && err.response.status;
  if (status === 403 || status === 404) return "You do not have access to this transcript.";
  if (status === 503) return "The transcript cannot be opened right now. Please try again.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  return "Could not load the transcript.";
}

// ---- the two requests, with the http client passed in (so they are tested without a browser) ----
export const transcriptPath = (appointmentId) => `/api/appointments/${appointmentId}/transcript`;

// -> { view } or { error }
export async function fetchTranscript(http, appointmentId) {
  try {
    const res = await http.get(transcriptPath(appointmentId));
    return { view: buildTranscriptView(res && res.data) };
  } catch (err) {
    return { error: loadErrorMessage(err) };
  }
}

// Checks the reason first (no request is made without a good one). -> { deleted } or { error }
export async function deleteTranscript(http, appointmentId, reason) {
  const bad = reasonError(reason);
  if (bad) return { error: bad };
  try {
    const res = await http.delete(transcriptPath(appointmentId), { data: { reason: String(reason).replace(/\s+/g, " ").trim() } });
    return { deleted: Number(res && res.data && res.data.deleted) || 0 };
  } catch (err) {
    return { error: loadErrorMessage(err).replace("load", "delete") };
  }
}
