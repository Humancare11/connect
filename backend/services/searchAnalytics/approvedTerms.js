// The search terms that the Daily terms report may show even when only one
// person searched them.
//
// A term is approved only when the WHOLE normalised search equals the name or an
// approved alias of a public catalog record (category, specialty, condition,
// service). Keys are built with exactly the function that builds
// SearchInteraction.termKey - singularForm(normalizeForMatch(text)) - so
// membership is exact equality after the existing normalisation:
//   - "Fever", " fever " and "fevers" share the key "fever" and match;
//   - "john migraine" has its own key, which no catalog entry has, so it does
//     not match merely because the Migraine page was returned for it.
// Not used: descriptions, doctor names, blog titles/paths (not curated search
// vocabulary), match scores, outcomes or dedicatedPageFound, and no fuzzy or
// partial matching of any kind.
//
// What is displayed for an approved term is the catalog's own wording (its
// label), never the visitor's raw text.
//
// If the catalog cannot be loaded nothing is approved, which means every term
// keeps the ordinary minimum of 3 interactions per UTC day.
//
// Pure apart from the catalog read: no database writes, no logging of terms.

const { normalizeForMatch, singularForm } = require("../search/queryNormalizer");
const { analyzeForAnalytics } = require("../search/queryRedaction");
const { MAX_TERM_LENGTH } = require("./constants");

// Same shape the model requires of a termKey (and the API accepts).
const TERM_KEY_FORMAT = /^[a-z0-9]+(?: [a-z0-9]+)*$/;

// [text, isName] pairs of one taxonomy record.
const taxonomyValues = (record) => [
  [record.name, true],
  ...(Array.isArray(record.aliases) ? record.aliases : []).map((alias) => [alias, false]),
];

// Map of approved term key -> label (the catalog's wording, lower-cased).
function approvedTermLabels(catalog) {
  const labels = new Map(); // key -> { label, isName }
  if (!catalog || typeof catalog !== "object") return new Map();
  const records = [
    ...(catalog.categories || []).map((category) => [[category.name, true]]),
    ...(catalog.specialties || []).map(taxonomyValues),
    ...(catalog.conditions || []).map(taxonomyValues), // conditions and services
  ];
  for (const values of records) {
    for (const [value, isName] of values) {
      if (typeof value !== "string") continue;
      const key = singularForm(normalizeForMatch(value));
      // An entry that could never be stored (or would fail the privacy rules) is not approved.
      if (!key || key.length > MAX_TERM_LENGTH || !TERM_KEY_FORMAT.test(key)) continue;
      const label = value.trim().replace(/\s+/g, " ").toLowerCase();
      // Checked on the wording itself as well: normalisation removes characters ("@") the rules look for.
      if (analyzeForAnalytics(label).store !== true || analyzeForAnalytics(key).store !== true) continue;
      const current = labels.get(key);
      // A record name beats an alias; otherwise the alphabetically first wording, so the choice is deterministic.
      if (!current || (isName && !current.isName) || (isName === current.isName && label < current.label)) {
        labels.set(key, { label, isName });
      }
    }
  }
  return new Map([...labels].map(([key, entry]) => [key, entry.label]));
}

// Catalog objects are frozen and rebuilt on refresh, so the derived result is
// cached per catalog object.
const cache = new WeakMap();
const NONE = Object.freeze({ keys: Object.freeze([]), labels: new Map() });

// Resolves to { keys: string[], labels: Map } - empty when the catalog is unavailable.
async function loadApprovedTerms(getCatalog) {
  try {
    const catalog = await getCatalog();
    if (!catalog || typeof catalog !== "object") return NONE;
    let approved = cache.get(catalog);
    if (!approved) {
      const labels = approvedTermLabels(catalog);
      approved = { keys: [...labels.keys()].sort(), labels };
      cache.set(catalog, approved);
    }
    return approved;
  } catch {
    return NONE;
  }
}

module.exports = { approvedTermLabels, loadApprovedTerms };
