// Helpers over the generated language table (languages.data.js).
import { LANGUAGES, STT_LOCALES, NONE } from "./languages.data.js";

export { NONE, STT_LOCALES };

export const UNSUPPORTED_SPEECH_NOTE = "Patient's speech in this language cannot be transcribed.";

const RTL = new Set(["ar", "he", "fa", "ur", "ps", "prs", "ku"]);

export const LANGUAGE_LIST = Object.freeze(
  LANGUAGES.map(([code, name, nativeName, locale, voice]) =>
    Object.freeze({ code, name, nativeName, locale, voice, canTranscribe: Boolean(locale), hasVoice: Boolean(voice), rtl: RTL.has(code) })
  )
);

const BY_CODE = new Map(LANGUAGE_LIST.map((l) => [l.code.toLowerCase(), l]));

export function getLanguage(code) {
  return typeof code === "string" ? BY_CODE.get(code.toLowerCase()) || null : null;
}

// "zh-Hans" -> "zh", "en-IN" -> "en", "fr-ca" -> "fr". Two codes with the same base are the same language for the detection list.
export function languageBase(codeOrLocale) {
  return String(codeOrLocale || "").toLowerCase().split("-")[0];
}

export const isKnownLanguage = (code) => getLanguage(code) !== null;
export const localeForLanguage = (code) => getLanguage(code)?.locale || null;
export const voiceForLanguage = (code) => getLanguage(code)?.voice || null;
export const canTranscribeLanguage = (code) => Boolean(getLanguage(code)?.canTranscribe);
export const languageName = (code) => getLanguage(code)?.name || String(code || "");

// Search for the LANGUAGE panel: English name, native name, or the code. Empty query = everything, in the table's (A to Z) order.
export function searchLanguages(query, list = LANGUAGE_LIST) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q));
}

// The language that goes with a speech locale ("de-DE" -> German). Exact locale first, then the same base language; null if unknown.
export function languageForLocale(locale) {
  if (typeof locale !== "string" || !locale) return null;
  const exact = LANGUAGE_LIST.find((l) => l.locale && l.locale.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const base = languageBase(locale);
  return LANGUAGE_LIST.find((l) => languageBase(l.code) === base) || null;
}
