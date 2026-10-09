// Strict validation of the model's structured output (PR 11).
//
// The model is untrusted. Nothing it returns reaches the result builder until
// it has passed validateIntent(): exact object shape (no extra or missing
// keys), enum values, array sizes, string lengths, confidence range 0-1, and
// every category/specialty name must exist in the backend's controlled
// vocabulary (built from the public search catalog). Free-text condition terms
// are only ever mapped back onto vocabulary names by resolveConditionTerms().
// The schema has no id, url or route fields, and none is ever accepted.

const { normalizeForMatch, singularForm, compactForm } = require("./queryNormalizer");

// PR 11 schema: the primary kind of thing the phrase is looking for.
const INTENTS = ["condition", "specialty", "category", "service", "doctor", "blog", "unknown"];
const LIMITS = Object.freeze({
  categoryNames: 3,
  specialtyNames: 3,
  conditionTerms: 5,
  termLength: 60,
  doctorNameText: 60,
  blogTopicText: 60,
});
const OUTPUT_KEYS = [
  "intent", "categoryNames", "specialtyNames", "conditionTerms", "doctorNameText",
  "blogTopicText", "wantsDoctor", "wantsArticle", "confidence",
];

class SearchAiError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "SearchAiError";
    this.reason = reason;
  }
}



const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cleanText = (value, max) => {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) throw new SearchAiError("invalid_output");
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return trimmed || null;
};

// Returns a normalised intent or throws SearchAiError("invalid_output").
function validateIntent(raw, vocabulary) {
  if (!isPlainObject(raw)) throw new SearchAiError("invalid_output");
  const keys = Object.keys(raw).sort();
  if (keys.length !== OUTPUT_KEYS.length || !OUTPUT_KEYS.every((k) => keys.includes(k))) {
    throw new SearchAiError("invalid_output");
  }
  if (!INTENTS.includes(raw.intent)) throw new SearchAiError("invalid_output");

  const allowedCategories = new Set(vocabulary.categories);
  const allowedSpecialties = new Set(vocabulary.specialties.map((s) => s.name));
  const nameList = (value, max, allowed) => {
    if (!Array.isArray(value) || value.length > max) throw new SearchAiError("invalid_output");
    for (const item of value) {
      // Unknown taxonomy names reject the whole output.
      if (typeof item !== "string" || !allowed.has(item)) throw new SearchAiError("invalid_taxonomy");
    }
    return [...new Set(value)];
  };
  const categoryNames = nameList(raw.categoryNames, LIMITS.categoryNames, allowedCategories);
  const specialtyNames = nameList(raw.specialtyNames, LIMITS.specialtyNames, allowedSpecialties);

  if (!Array.isArray(raw.conditionTerms) || raw.conditionTerms.length > LIMITS.conditionTerms) {
    throw new SearchAiError("invalid_output");
  }
  const conditionTerms = [...new Set(raw.conditionTerms.map((t) => cleanText(t, LIMITS.termLength)).filter(Boolean))];

  if (typeof raw.wantsDoctor !== "boolean" || typeof raw.wantsArticle !== "boolean") throw new SearchAiError("invalid_output");
  if (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    throw new SearchAiError("invalid_output");
  }

  return {
    intent: raw.intent,
    categoryNames,
    specialtyNames,
    conditionTerms,
    doctorNameText: cleanText(raw.doctorNameText, LIMITS.doctorNameText),
    blogTopicText: cleanText(raw.blogTopicText, LIMITS.blogTopicText),
    wantsDoctor: raw.wantsDoctor,
    wantsArticle: raw.wantsArticle,
    confidence: raw.confidence,
  };
}

// Maps free-text condition terms onto vocabulary names (name or alias,
// compared with the search normalisation). Unlisted terms are dropped.
function resolveConditionTerms(terms, vocabulary) {
  // Exact names are registered before any alias, so an alias that happens to
  // equal another record's name (Chronic Migraine's "migraine" vs Migraine)
  // can never steal that name.
  const keys = new Map();
  const entries = [...vocabulary.conditions, ...vocabulary.services];
  const register = (text, owner) => {
    const n = normalizeForMatch(text);
    for (const key of [n, singularForm(n), compactForm(n)]) if (key && !keys.has(key)) keys.set(key, owner);
  };
  for (const entry of entries) register(entry.name, entry.name);
  for (const entry of entries) for (const alias of entry.aliases) register(alias, entry.name);
  const resolved = [];
  for (const term of terms) {
    const n = normalizeForMatch(term);
    const name = keys.get(n) || keys.get(singularForm(n)) || keys.get(compactForm(n));
    if (name && !resolved.includes(name)) resolved.push(name);
  }
  return resolved;
}

module.exports = { validateIntent, resolveConditionTerms, SearchAiError, INTENTS, LIMITS, OUTPUT_KEYS };
