// What the translation screens show, worked out from the engine state. Pure functions, so they are tested without a browser.
import { LANGUAGE_LIST, NONE, UNSUPPORTED_SPEECH_NOTE, canTranscribeLanguage, getLanguage, languageBase, searchLanguages } from "./languages.js";

export const REAL_VOICE_LABEL = "Real voice (no translation)";
export const REAL_VOICE_HELP = "You hear the other person's own voice. No subtitles, no translated voice.";
export const MACHINE_TRANSLATED = "Machine-translated, may contain errors";
export const NOTICE_LINE_1 = "This call is being transcribed.";
export const NOTICE_LINE_2 = "Please keep the call in a quiet place. Other voices nearby may be transcribed.";
export const RECONNECTING_TEXT = "Subtitles unavailable, reconnecting…";
export const NO_SPEECH_NOTE_OWN = "Subtitles only: your own speech in this language cannot be transcribed.";
export const LANGUAGE_HELP = "Choose the language YOU speak. You will hear and read the other person in this language. The other person's original voice is muted while translation is on.";
export const NO_VOICE_NOTE = "No voice for this language: subtitles only.";

// The rows of the LANGUAGE list: "Real voice" is ALWAYS first (also while searching), then the languages that match the search.
export function buildLanguageRows({ query = "", selected = NONE } = {}) {
  const none = { code: NONE, name: REAL_VOICE_LABEL, nativeName: "", help: REAL_VOICE_HELP, selected: selected === NONE || !getLanguage(selected), note: "", isNone: true };
  const matches = searchLanguages(query).map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
    rtl: l.rtl,
    selected: selected === l.code,
    note: !l.canTranscribe ? NO_SPEECH_NOTE_OWN : !l.hasVoice ? NO_VOICE_NOTE : "",
    isNone: false,
  }));
  return { rows: [none, ...matches], matchCount: matches.length, noResults: String(query).trim() !== "" && matches.length === 0 };
}

export const totalLanguages = () => LANGUAGE_LIST.length;

// Short text for the small badge on the LANGUAGE button ("DE", "HI", "ZH-HANS"), or "" for Real voice.
export function languageBadge(code) {
  if (!code || code === NONE) return "";
  return String(code).toUpperCase().slice(0, 7);
}

// The explanation under the list for the language that is picked right now.
export function selectedNote(code) {
  if (!code || code === NONE) return REAL_VOICE_HELP;
  const l = getLanguage(code);
  if (!l) return REAL_VOICE_HELP;
  if (!l.canTranscribe) return NO_SPEECH_NOTE_OWN;
  if (!l.hasVoice) return NO_VOICE_NOTE;
  return `You speak ${l.name}. You will hear and read the other person in ${l.name}.`;
}

// The doctor's banner: the patient picked a language Azure cannot listen to, so the patient's own speech will not be transcribed.
export function peerUnsupportedNote(role, peerReadLang) {
  if (role !== "doctor" || !peerReadLang || peerReadLang === NONE) return "";
  return getLanguage(peerReadLang) && !canTranscribeLanguage(peerReadLang) ? UNSUPPORTED_SPEECH_NOTE : "";
}

export function formatClock(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function speakerLabel(entry) {
  if (entry.who === "me") return "You";
  return entry.from === "doctor" ? "Doctor" : "Patient";
}

// The live transcript panel lists finished sentences only. Echo of our own voice and unclear sentences are saved (for the record) but are
// not listed here.
export function visibleTranscript(entries) {
  return (Array.isArray(entries) ? entries : []).filter((e) => e && e.final && !(e.flags && e.flags.echo) && e.tier !== "unclear");
}

// The translation shown under the original: in the language this person reads if there is one, otherwise the English record, and only
// when it says something different from the original.
export function translationFor(entry, readLang) {
  const tr = (entry && entry.tr) || {};
  const pick = (code) => { const k = Object.keys(tr).find((x) => x.toLowerCase() === String(code).toLowerCase()); return k ? tr[k] : ""; };
  const mine = readLang && readLang !== NONE ? pick(readLang) : "";
  const text = mine || pick("en");
  return text && text.trim().toLowerCase() !== String(entry.text || "").trim().toLowerCase() ? text : "";
}

export const isSameLanguage = (a, b) => languageBase(a) === languageBase(b);
