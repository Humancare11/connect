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
//   4. the languages of their profile country (India: Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu)
//   5. common languages, until there are 10
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

// -> up to `max` locales, no two of the same language, always including an English one.
export function buildCandidateLocales({ pickedLocale = null, browserLanguages = [], profileCountry = "", max = MAX_CANDIDATES } = {}) {
  const countryList = COUNTRY_LOCALES[String(profileCountry || "").toUpperCase()] || [];
  const browser = Array.isArray(browserLanguages) ? browserLanguages.slice(0, 20).map(normalizeBrowserLanguage) : [];

  // 1 + 2: the picked language and the browser languages
  let list = dedupeByLanguage([pickedLocale, ...browser]);

  // 3: English is always there (an English speaker must be understood), even if that means dropping the last browser language
  if (!list.some((l) => languageBase(l) === "en")) {
    const english = countryList.find((l) => languageBase(l) === "en" && supported(l)) || "en-US";
    list = [...list.slice(0, Math.max(0, max - 1)), english];
  }

  // 4 + 5: the profile country's languages, then the common ones, until the list is full
  return dedupeByLanguage([...list, ...countryList, ...FILLERS]).slice(0, max);
}
