// The list of languages the recognizer may hear a person speak, when they have not picked one ("Real voice" default).
//
// Azure's continuous language detection takes up to 10 candidates and refuses two locales of the same language (en-US with en-GB).
// A language that is NOT in the list is force-fitted to the nearest candidate and comes out as nonsense with a low confidence
// (measured: Hindi heard as English at 0.12 to 0.19 until Hindi was a candidate), so the list is always filled to 10 and built from
// what we know about the person:
//
//   1. the language they picked (if any; the engine then listens for that one language directly and this list is not used)
//   2. their browser languages, with the exact locale (en-IN stays en-IN, "hi" becomes hi-IN)
//   3. English (their country's English if it has one), so an English speaker is always understood
//   4. HINDI, always (many of our patients are Indian: an English browser must never push it out, measured on staging: Hindi heard as
//      English at low confidence), a few more browser languages, then the main Indian languages (Bengali, Tamil, Telugu, Marathi)
//   5. the languages of their profile country, then common languages (Spanish, Arabic, French...), then the rest of the Indian ones, until
//      there are 10
//
// Only locales Azure can really listen for (STT_LOCALES) are ever returned.
import { STT_LOCALES, languageBase } from "./languages.js";

export const MAX_CANDIDATES = 10;

// A base language with no region ("hi", "en") or an unsupported region becomes this locale.
const DEFAULT_LOCALE = {
  en: "en-US", es: "es-ES", pt: "pt-BR", zh: "zh-CN", ar: "ar-SA", fr: "fr-FR", de: "de-DE", hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN",
  mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", ur: "ur-IN", it: "it-IT", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", tr: "tr-TR",
  nl: "nl-NL", pl: "pl-PL", vi: "vi-VN", id: "id-ID", th: "th-TH", uk: "uk-UA", fil: "fil-PH", sw: "sw-KE", ne: "ne-NP", si: "si-LK",
};

// Locales to expect from a profile country (ISO code). Unsupported ones are filtered out when the list is built.
export const COUNTRY_LOCALES = {
  IN: ["en-IN", "hi-IN", "ta-IN", "te-IN", "bn-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN", "ur-IN"],
  PK: ["ur-PK", "en-IN", "pa-IN"], BD: ["bn-BD", "en-IN"], LK: ["si-LK", "ta-LK", "en-IN"], NP: ["ne-NP", "hi-IN", "en-IN"],
  US: ["en-US", "es-US"], CA: ["en-CA", "fr-CA"], GB: ["en-GB"], IE: ["en-IE"], AU: ["en-AU"], NZ: ["en-NZ"], ZA: ["en-ZA", "af-ZA", "zu-ZA"],
  NG: ["en-NG"], KE: ["en-KE", "sw-KE"], GH: ["en-GH"], SG: ["en-SG", "zh-CN", "ta-IN"], PH: ["fil-PH", "en-PH"], MY: ["ms-MY", "en-IN", "zh-CN"],
  DE: ["de-DE"], AT: ["de-AT"], CH: ["de-CH", "fr-CH", "it-CH"], FR: ["fr-FR"], BE: ["nl-BE", "fr-BE"], NL: ["nl-NL"], ES: ["es-ES"], MX: ["es-MX"],
  AR: ["es-AR"], CO: ["es-CO"], CL: ["es-CL"], PE: ["es-PE"], PT: ["pt-PT"], BR: ["pt-BR"], IT: ["it-IT"], PL: ["pl-PL"], RU: ["ru-RU"], UA: ["uk-UA"],
  TR: ["tr-TR"], SA: ["ar-SA"], AE: ["ar-AE", "en-IN", "hi-IN"], EG: ["ar-EG"], QA: ["ar-QA"], KW: ["ar-KW"], JO: ["ar-JO"], MA: ["ar-MA"],
  CN: ["zh-CN"], HK: ["zh-HK", "en-HK"], TW: ["zh-TW"], JP: ["ja-JP"], KR: ["ko-KR"], VN: ["vi-VN"], TH: ["th-TH"], ID: ["id-ID"],
};

// The Indian languages that always get a slot (after English and Hindi), and the rest that fill what is left.
export const INDIAN_PRIORITY = ["bn-IN", "ta-IN", "te-IN", "mr-IN"];
export const INDIAN_REST = ["gu-IN", "kn-IN", "ml-IN", "pa-IN", "ur-IN"];
export const ALWAYS_LOCALE = "hi-IN";
const MAX_BROWSER_EXTRA = 3; // browser languages beyond English and Hindi that are kept ahead of the Indian ones

// Common languages used to fill the list, most useful first.
export const FILLERS = [
  "en-US", "es-ES", "hi-IN", "ar-SA", "fr-FR", "de-DE", "pt-BR", "zh-CN", "ru-RU", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN",
  "ml-IN", "pa-IN", "ur-IN", "it-IT", "ja-JP", "ko-KR", "tr-TR", "vi-VN", "pl-PL", "id-ID", "fil-PH",
];

const supported = (locale) => STT_LOCALES.has(locale);

function defaultLocaleForBase(base) {
  if (DEFAULT_LOCALE[base] && supported(DEFAULT_LOCALE[base])) return DEFAULT_LOCALE[base];
  const own = `${base}-${base.toUpperCase()}`;
  if (supported(own)) return own;
  for (const l of [...STT_LOCALES].sort()) if (languageBase(l) === base) return l;
  return null;
}

// A browser language tag ("en-IN", "hi", "zh-Hans-CN", "pt") -> a locale Azure can listen for, or null.
export function normalizeBrowserLanguage(tag) {
  if (typeof tag !== "string") return null;
  const cleaned = tag.trim().replace(/_/g, "-");
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/.test(cleaned)) return null;
  const parts = cleaned.split("-");
  const base = parts[0].toLowerCase();
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p)); // "Hans" (script) and "419" (area) are not regions
  if (region) {
    const exact = `${base}-${region.toUpperCase()}`;
    if (supported(exact)) return exact;
  }
  return defaultLocaleForBase(base);
}

// A list of locales with at most one per language, keeping the first of each.
function dedupeByLanguage(locales) {
  const seen = new Set();
  return locales.filter((l) => {
    if (!l || !supported(l)) return false;
    const base = languageBase(l);
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

// The profile country as stored on the account ("IN") -> a two-letter ISO code, or "" when there is none (then nothing changes).
export function profileCountryCode(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return v.toLowerCase() === "india" ? "IN" : "";
}

// Which English to listen for. Indian English is recognised best as en-IN (step 0 tests: en-IN 0.94 against en-US 0.66-0.88), so an Indian
// person gets en-IN: profile country India, any Indian locale among the browser / UI languages (a region of IN, or a bare Indic language
// such as "hi"). Everyone else keeps their browser's English, then their country's, then en-US.
const INDIC_BARE = new Set(["hi", "ta", "te", "mr", "gu", "kn", "ml", "pa"]);
export function englishChoice({ browserLanguages = [], profileCountry = "" } = {}) {
  const raw = Array.isArray(browserLanguages) ? browserLanguages.slice(0, 20).filter((t) => typeof t === "string") : [];
  const countryList = COUNTRY_LOCALES[String(profileCountry || "").toUpperCase()] || [];
  if (String(profileCountry || "").toUpperCase() === "IN" && supported("en-IN")) return { locale: "en-IN", why: "profile country IN" };
  const indian = raw.some((t) => { const parts = t.trim().replace(/_/g, "-").split("-"); return parts.slice(1).some((x) => x.toUpperCase() === "IN") || (parts.length === 1 && INDIC_BARE.has(parts[0].toLowerCase())); });
  if (indian && supported("en-IN")) return { locale: "en-IN", why: "Indian locale in the browser" };
  const own = raw.map(normalizeBrowserLanguage).find((l) => l && languageBase(l) === "en");
  if (own) return { locale: own, why: "browser" };
  return { locale: countryList.find((l) => languageBase(l) === "en" && supported(l)) || "en-US", why: "default" };
}

// -> up to `max` locales, no two of the same language (ONE English), always including an English one and Hindi.
//   excludeBases: languages (base codes, "en") left OUT, to ask the recognizer for a second opinion when it keeps hearing a language with
//   low confidence (the wrong-language safety net). The picked language is never excluded.
export function buildCandidateLocales({ pickedLocale = null, browserLanguages = [], profileCountry = "", max = MAX_CANDIDATES, excludeBases = [] } = {}) {
  const countryList = COUNTRY_LOCALES[String(profileCountry || "").toUpperCase()] || [];
  const browser = Array.isArray(browserLanguages) ? browserLanguages.slice(0, 20).map(normalizeBrowserLanguage) : [];
  const excluded = new Set((excludeBases || []).map((b) => String(b).toLowerCase()));
  const keep = (l) => l && (l === pickedLocale || !excluded.has(languageBase(l)));
  const english = englishChoice({ browserLanguages, profileCountry }).locale;

  // The picked language and the browser languages in their own order (a few of them), then English and Hindi if they were not among them.
  // the browser's English is replaced by the chosen one (one English only); a language the person PICKED stays exactly as picked
  const browserChosen = browser.map((l) => (l && languageBase(l) === "en" ? english : l));
  const own = dedupeByLanguage([pickedLocale, ...browserChosen].filter(keep)).slice(0, MAX_BROWSER_EXTRA + 2);
  const head = dedupeByLanguage([...own, english, ALWAYS_LOCALE].filter(keep));
  const rest = [...INDIAN_PRIORITY, ...countryList, ...FILLERS, ...INDIAN_REST].filter(keep);
  return dedupeByLanguage([...head, ...rest]).slice(0, max);
}
