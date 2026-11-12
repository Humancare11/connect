// Languages, the detection candidate list and the confidence rules. Run: node --test tests/transcriptionLanguages.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGE_LIST, STT_LOCALES, NONE, getLanguage, languageBase, searchLanguages, canTranscribeLanguage, voiceForLanguage, localeForLanguage, UNSUPPORTED_SPEECH_NOTE } from "../src/features/translation/languages.js";
import { buildCandidateLocales, normalizeBrowserLanguage, MAX_CANDIDATES, COUNTRY_LOCALES, FILLERS } from "../src/features/translation/candidates.js";
import { confidenceTier, normalizeThresholds, DEFAULT_THRESHOLDS, showLive, speakAloud, showLighter, safetyNetTriggered } from "../src/features/translation/confidence.js";

// ---------------------------------------------------------------------------------------------------------------- languages
test("the list: 95 languages, A to Z, Javanese is gone, 'Real voice' is a separate value", () => {
  assert.equal(LANGUAGE_LIST.length, 95);
  assert.equal(getLanguage("jv"), null, "jv is not a valid translation target");
  assert.equal(NONE, "none");
  assert.equal(getLanguage(NONE), null, "'none' is not a language");
  const names = LANGUAGE_LIST.map((l) => l.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")), "kept in A to Z order");
  assert.equal(new Set(LANGUAGE_LIST.map((l) => l.code)).size, 95, "no duplicate codes");
});

test("exactly the 15 languages without speech support are marked, and they keep their place in the list", () => {
  const unsupported = LANGUAGE_LIST.filter((l) => !l.canTranscribe).map((l) => l.code).sort();
  assert.deepEqual(unsupported, ["as", "fj", "ht", "iu", "kmr", "ku", "mg", "mi", "mww", "prs", "sm", "sr-Latn", "ti", "to", "ty"].sort());
  for (const code of unsupported) {
    assert.equal(getLanguage(code).hasVoice, false, code + " has no voice either");
    assert.equal(canTranscribeLanguage(code), false);
    assert.equal(localeForLanguage(code), null);
  }
  assert.equal(UNSUPPORTED_SPEECH_NOTE, "Patient's speech in this language cannot be transcribed.");
});

test("every language that can be transcribed has a speech locale Azure supports and a standard neural voice for it", () => {
  for (const l of LANGUAGE_LIST.filter((x) => x.canTranscribe)) {
    assert.ok(STT_LOCALES.has(l.locale), `${l.code}: ${l.locale} is a real Azure locale`);
    assert.match(l.voice || "", /^[a-z]{2,3}(-[A-Za-z0-9]+)+Neural$/, `${l.code}: ${l.voice}`);
    assert.ok(!/Multilingual|HD|Dragon|:/.test(l.voice), `${l.code}: standard voices only (${l.voice})`);
    assert.equal(languageBase(l.voice), languageBase(l.locale), `${l.code}: the voice speaks the locale's language`);
  }
});

test("well-known languages have the expected locale and voice", () => {
  assert.equal(localeForLanguage("de"), "de-DE");
  assert.equal(voiceForLanguage("de"), "de-DE-KatjaNeural");
  assert.equal(localeForLanguage("hi"), "hi-IN");
  assert.equal(localeForLanguage("zh-Hans"), "zh-CN");
  assert.equal(localeForLanguage("yue"), "zh-HK");
  assert.equal(localeForLanguage("en"), "en-US");
  assert.equal(getLanguage("DE").code, "de", "codes are matched without regard to case");
  assert.equal(getLanguage("fr-ca").name, "French (Canada)");
});

test("search finds English names, native names and codes; empty shows everything", () => {
  assert.deepEqual(searchLanguages("hind").map((l) => l.code), ["hi"]);
  assert.deepEqual(searchLanguages("deutsch").map((l) => l.code), ["de"]);
  assert.deepEqual(searchLanguages("हिन्दी").map((l) => l.code), ["hi"]);
  assert.ok(searchLanguages("chinese").length >= 2);
  assert.ok(searchLanguages("zh").some((l) => l.code === "zh-Hans"));
  assert.equal(searchLanguages("").length, 95);
  assert.equal(searchLanguages("   ").length, 95);
  assert.equal(searchLanguages("qqqq").length, 0);
});

test("languageBase treats variants as one language", () => {
  assert.equal(languageBase("zh-Hans"), "zh");
  assert.equal(languageBase("en-IN"), "en");
  assert.equal(languageBase("FR-ca"), "fr");
  assert.equal(languageBase(""), "");
  assert.equal(languageBase(undefined), "");
});

// ---------------------------------------------------------------------------------------------------------------- candidates
const bases = (list) => list.map(languageBase);

test("browser tags become exact Azure locales; nonsense becomes null", () => {
  const cases = { "en-IN": "en-IN", en: "en-US", hi: "hi-IN", "hi-IN": "hi-IN", "zh-Hans-CN": "zh-CN", "zh-Hant-TW": "zh-TW", pt: "pt-BR", "pt-PT": "pt-PT", en_GB: "en-GB", "sr-Latn-RS": "sr-RS", "es-419": "es-ES", de: "de-DE", fr: "fr-FR" };
  for (const [tag, locale] of Object.entries(cases)) assert.equal(normalizeBrowserLanguage(tag), locale, tag);
  for (const bad of ["", "x", "xx", "klingon", "en-", "<b>", null, undefined, 5, {}]) assert.equal(normalizeBrowserLanguage(bad), null, String(bad));
});

test("an Indian patient: the browser's exact English, Hindi, and the country's languages, 10 in all, Hindi included", () => {
  const list = buildCandidateLocales({ browserLanguages: ["en-IN", "hi"], profileCountry: "IN" });
  assert.equal(list.length, MAX_CANDIDATES);
  assert.deepEqual(list.slice(0, 2), ["en-IN", "hi-IN"]);
  for (const l of ["hi-IN", "ta-IN", "te-IN", "bn-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]) assert.ok(list.includes(l), l);
});

test("an English-only US browser: English, then the common languages (Hindi and Arabic among them)", () => {
  const list = buildCandidateLocales({ browserLanguages: ["en-US"], profileCountry: "US" });
  assert.equal(list.length, MAX_CANDIDATES);
  assert.equal(list[0], "en-US");
  assert.ok(list.includes("es-US") || list.includes("es-ES"));
  assert.ok(list.includes("hi-IN") && list.includes("ar-SA"));
});

test("a German browser that also lists English: German first, English kept, then fillers", () => {
  const list = buildCandidateLocales({ browserLanguages: ["de-DE", "en"] });
  assert.deepEqual(list.slice(0, 2), ["de-DE", "en-US"]);
  assert.equal(list.length, MAX_CANDIDATES);
});

test("no browser languages at all: still a full, English-containing list", () => {
  for (const input of [{}, { browserLanguages: [] }, { browserLanguages: undefined }, { browserLanguages: "en" }, { browserLanguages: [null, 5, {}, "zz"] }]) {
    const list = buildCandidateLocales(input);
    assert.equal(list.length, MAX_CANDIDATES);
    assert.ok(bases(list).includes("en"));
  }
});

test("never two locales of the same language, never more than 10, only locales Azure supports", () => {
  const inputs = [
    { browserLanguages: ["en-US", "en-GB", "en-IN", "en-AU"], profileCountry: "GB" },
    { browserLanguages: ["zh-CN", "zh-TW", "zh-HK"], profileCountry: "HK" },
    { browserLanguages: ["es-ES", "es-MX", "es-AR", "pt-BR", "pt-PT"], profileCountry: "MX" },
    { browserLanguages: Array.from({ length: 30 }, (_, i) => FILLERS[i % FILLERS.length]), profileCountry: "IN" },
    { browserLanguages: ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur", "fr", "de"], profileCountry: "IN" },
  ];
  for (const input of inputs) {
    const list = buildCandidateLocales(input);
    assert.ok(list.length <= MAX_CANDIDATES);
    assert.equal(new Set(bases(list)).size, list.length, "one locale per language: " + list.join(","));
    for (const l of list) assert.ok(STT_LOCALES.has(l), l + " is a real Azure locale");
  }
});

test("English is always in the list, even when ten other languages come first", () => {
  const ten = ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur", "fr", "de", "es"];
  const list = buildCandidateLocales({ browserLanguages: ten, profileCountry: "IN" });
  assert.equal(list.length, MAX_CANDIDATES);
  assert.ok(bases(list).includes("en"), list.join(","));
  assert.equal(list[0], "hi-IN", "the person's own first language stays first");
});

test("a picked language goes first, and a country's own English is preferred", () => {
  const list = buildCandidateLocales({ pickedLocale: "de-DE", browserLanguages: ["en-US"], profileCountry: "IN" });
  assert.equal(list[0], "de-DE");
  assert.ok(list.includes("en-US"));
  const noEnglish = buildCandidateLocales({ browserLanguages: ["hi"], profileCountry: "IN" });
  assert.ok(noEnglish.includes("en-IN"), "India's English, not en-US: " + noEnglish.join(","));
});

test("a smaller max is respected and unknown countries do no harm", () => {
  assert.equal(buildCandidateLocales({ browserLanguages: ["fr"], max: 4 }).length, 4);
  assert.equal(buildCandidateLocales({ profileCountry: "ZZ" }).length, MAX_CANDIDATES);
  assert.equal(buildCandidateLocales({ profileCountry: 5 }).length, MAX_CANDIDATES);
  assert.ok(Object.keys(COUNTRY_LOCALES).length > 40);
});

// ---------------------------------------------------------------------------------------------------------------- confidence
test("tiers follow the thresholds, with unknown treated as shown", () => {
  assert.equal(confidenceTier(0.95), "normal");
  assert.equal(confidenceTier(0.7), "normal");
  assert.equal(confidenceTier(0.69), "low");
  assert.equal(confidenceTier(0.4), "low");
  assert.equal(confidenceTier(0.39), "unclear");
  assert.equal(confidenceTier(0), "unclear");
  for (const v of [null, undefined, NaN, "0.9", {}]) assert.equal(confidenceTier(v), "unknown");
  assert.equal(confidenceTier(0.5, { unclearBelow: 0.6, lowBelow: 0.9 }), "unclear");
});

test("normal: shown and spoken; low: shown lighter and spoken; unclear: neither shown nor spoken; unknown: shown", () => {
  assert.deepEqual(["normal", "low", "unclear", "unknown"].map((t) => [showLive(t), speakAloud(t), showLighter(t)]), [
    [true, true, false], [true, true, true], [false, false, false], [true, true, false],
  ]);
});

test("thresholds from the server are used when sane, otherwise the defaults", () => {
  assert.deepEqual(normalizeThresholds({ unclearBelow: 0.3, lowBelow: 0.6 }), { unclearBelow: 0.3, lowBelow: 0.6 });
  for (const bad of [null, undefined, {}, { unclearBelow: 0.8, lowBelow: 0.6 }, { unclearBelow: 0, lowBelow: 0.6 }, { unclearBelow: 0.4, lowBelow: 1.5 }, { unclearBelow: "a", lowBelow: "b" }]) {
    assert.deepEqual(normalizeThresholds(bad), DEFAULT_THRESHOLDS);
  }
});

test("the wrong-language safety net: two of the last three finals below 0.4", () => {
  assert.equal(safetyNetTriggered([]), false);
  assert.equal(safetyNetTriggered([0.05]), false, "one is not enough");
  assert.equal(safetyNetTriggered([0.05, 0.06]), true);
  assert.equal(safetyNetTriggered([0.9, 0.05, 0.06]), true);
  assert.equal(safetyNetTriggered([0.05, 0.9, 0.06]), true);
  assert.equal(safetyNetTriggered([0.05, 0.9, 0.8]), false);
  assert.equal(safetyNetTriggered([0.05, 0.05, 0.9, 0.9, 0.9]), false, "only the last three count");
  assert.equal(safetyNetTriggered([0.9, 0.85, 0.77, 0.88]), false, "good speech never triggers");
  assert.equal(safetyNetTriggered([null, undefined, NaN]), false);
  assert.equal(safetyNetTriggered(undefined), false);
  assert.equal(safetyNetTriggered([0.49, 0.45], 0.5), true, "the limit can be changed");
  assert.equal(safetyNetTriggered([0.5, 0.45], 0.5), false, "exactly at the limit is not below it");
});
