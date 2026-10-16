// Deterministic in-memory matcher for Healthcare Discovery Search.
//
// Compares the normalised query against catalog strings with plain string
// operations (equality, prefix, word-prefix, containment). It never builds
// a RegExp or a database query from user input and never calls out.
//
// It only discovers available content and providers: it does not interpret
// symptoms, rank by medical relevance or suggest a diagnosis.

const {
  normalizeForMatch,
  tokenize,
  coreQuery,
  singularize,
  singularForm,
  compactForm,
} = require("./queryNormalizer");
const { RESULT_TYPES, MAX_RESULTS_PER_TYPE, MAX_RESULTS_TOTAL } = require("./searchConstants");

// Base scores (0-100) before the field weight is applied.
const SCORE = Object.freeze({
  EXACT: 100, // value equals the query
  EQUIVALENT: 98, // equal after singular/plural or separator folding
  PREFIX: 85, // value starts with the query
  WORD_PREFIX: 70, // every query word starts a word of the value
  NAMED_IN_QUERY: 65, // the whole value appears inside a longer query
  CONTAINS: 50, // the value contains the query (query >= 4 characters, PR 10)
});

// Field weights. Resulting priority (score = base × weight):
//   exact name 100 > name plural/separator variant 98 > exact alias 95 >
//   alias variant 93.1 > name prefix 85 > alias prefix 80.75 >
//   name word-prefix 70 > alias word-prefix 66.5 > value named in query 65 >
//   name contains 50 > blog path 49 > alias contains 47.5 > description 42.
// Anything below MIN_SCORE (40) is dropped.
const WEIGHT = Object.freeze({ NAME: 1, ALIAS: 0.95, DESCRIPTION: 0.6, BLOG_PATH: 0.7 });

const MIN_SCORE = 40;
const MIN_MATCH_LENGTH = 2;
// Mid-word substring matching ("heatrash" for "rash") is only trusted for
// queries of 4+ characters. Short terms and abbreviations ("uti", "ent", "flu", "gp",
// "bp") match on whole words, word prefixes, exact names and approved aliases
// only, so "uti" can never match "Routine Check-Ups" (PR 10).
const MIN_SUBSTRING_LENGTH = 4;
// The filler-stripped "core" query ranks slightly below the literal query.
const CORE_QUERY_PENALTY = 5;
// A doctor surfaced through a strongly matched specialty.
const SPECIALTY_DOCTOR_WEIGHT = 0.85;
const STRONG_SPECIALTY_SCORE = 70;

// All comparison forms of one normalised string.
function formsOf(normalized) {
  const tokens = tokenize(normalized);
  return {
    text: normalized,
    tokens,
    singular: singularForm(normalized),
    singularTokens: tokens.map(singularize),
    compact: compactForm(normalized),
  };
}

const wordPrefixMatch = (query, value) =>
  query.tokens.every((q, i) =>
    value.tokens.some((v, j) => v.startsWith(q) || value.singularTokens[j].startsWith(query.singularTokens[i])),
  );

// Scores one catalog value against one query, 0-100. Both arguments are
// normalised strings or their precomputed forms.
function scoreText(queryIn, valueIn, { textOnly = false } = {}) {
  const query = typeof queryIn === "string" ? formsOf(queryIn) : queryIn;
  const value = typeof valueIn === "string" ? formsOf(valueIn) : valueIn;
  if (!query.text || !value.text) return 0;

  // Long free text (descriptions, blog paths) only counts whole-word prefixes.
  // (PR 10: 3-letter terms are too ambiguous for free text; titles and names still match them.)
  if (textOnly) return query.text.length >= MIN_SUBSTRING_LENGTH && wordPrefixMatch(query, value) ? SCORE.WORD_PREFIX : 0;

  if (value.text === query.text) return SCORE.EXACT;
  if (value.singular === query.singular || value.compact === query.compact) return SCORE.EQUIVALENT;
  if (value.text.startsWith(query.text)) return SCORE.PREFIX;
  if (wordPrefixMatch(query, value)) return SCORE.WORD_PREFIX;
  // The whole value is named inside a longer query, e.g. "chronic migraine
  // pain" contains the condition "chronic migraine".
  if (value.singularTokens.every((v) => query.singularTokens.includes(v))) return SCORE.NAMED_IN_QUERY;
  if (query.text.length >= MIN_SUBSTRING_LENGTH && (value.text.includes(query.text) || value.compact.includes(query.compact))) {
    return SCORE.CONTAINS;
  }
  return 0;
}

const field = (value, weight, label, textOnly = false) => ({ value, weight, label, textOnly });
const aliasFields = (aliases) => (aliases || []).map((alias) => field(alias, WEIGHT.ALIAS, "alias"));
const taxonomyFields = (record) => [
  field(record.name, WEIGHT.NAME, "name"),
  ...aliasFields(record.aliases),
  field(record.description, WEIGHT.DESCRIPTION, "description", true),
];

const FIELD_BUILDERS = {
  category: (category) => [field(category.name, WEIGHT.NAME, "name"), field(category.description, WEIGHT.DESCRIPTION, "description", true)],
  specialty: taxonomyFields,
  condition: taxonomyFields,
  service: taxonomyFields,
  doctor: (doctor) => [
    field([doctor.firstName, doctor.surname].filter(Boolean).join(" "), WEIGHT.NAME, "name"),
    field(doctor.surname, WEIGHT.NAME, "name"),
    field(doctor.specialization, 0.8, "specialization"),
    field(doctor.specialtyName, 0.8, "specialization"),
    field(doctor.subSpecialization, 0.75, "subSpecialization"),
  ],
  blog: (blog) => [
    field(blog.title, WEIGHT.NAME, "title"),
    field(blog.path, WEIGHT.BLOG_PATH, "path", true),
    field(blog.description, WEIGHT.DESCRIPTION, "description", true),
  ],
};

// Catalog records are frozen and rebuilt on every catalog refresh, so their
// normalised fields can be cached per record object.
const fieldCache = new WeakMap();
function fieldsFor(type, record) {
  let fields = fieldCache.get(record);
  if (!fields) {
    fields = FIELD_BUILDERS[type](record)
      .map((f) => ({ ...f, forms: formsOf(normalizeForMatch(f.value)) }))
      .filter((f) => f.forms.text);
    fieldCache.set(record, fields);
  }
  return fields;
}

// viaCore: the best score came from the filler-stripped core query rather
// than the literal text the user typed.
function bestScore(queryForms, fields) {
  let best = { score: 0, matchedOn: null, viaCore: false };
  for (const { forms, weight, label, textOnly } of fields) {
    for (const { query, penalty, core } of queryForms) {
      const raw = scoreText(query, forms, { textOnly });
      const score = raw ? raw * weight - penalty : 0;
      if (score > best.score) best = { score, matchedOn: label, viaCore: Boolean(core) };
    }
  }
  return best;
}

// Where each result type's records live in the catalog.
const RECORDS = {
  category: (catalog) => catalog.categories || [],
  specialty: (catalog) => catalog.specialties || [],
  condition: (catalog) => (catalog.conditions || []).filter((c) => c.kind !== "service"),
  service: (catalog) => (catalog.conditions || []).filter((c) => c.kind === "service"),
  doctor: (catalog) => catalog.doctors || [],
  blog: (catalog) => catalog.blogs || [],
};

const recordKey = (type, record) =>
  type === "doctor" ? String(record.doctorId) : type === "blog" ? record.id : record._id;
const recordTitle = (type, record) =>
  type === "doctor" ? record.displayName : type === "blog" ? record.title : record.name;

function byRank(type) {
  return (a, b) =>
    b.score - a.score ||
    recordTitle(type, a.record).localeCompare(recordTitle(type, b.record)) ||
    recordKey(type, a.record).localeCompare(recordKey(type, b.record));
}

// Returns { category: [...], specialty: [...], ... } of internal matches:
// { type, score, matchedOn, record } where record is a frozen catalog entry.
function matchCatalog(catalog, normalizedQuery, options = {}) {
  const types = options.types && options.types.length ? options.types : RESULT_TYPES;
  const perTypeLimit = options.perTypeLimit || MAX_RESULTS_PER_TYPE;
  const totalLimit = options.totalLimit || MAX_RESULTS_TOTAL;

  const matches = Object.fromEntries(RESULT_TYPES.map((type) => [type, []]));
  // Punctuation-heavy input can normalise to almost nothing (e.g. "(a+)+$"
  // -> "a"); a single character would prefix-match far too broadly.
  const full = normalizeForMatch(normalizedQuery);
  if (full.length < MIN_MATCH_LENGTH) return matches;

  const queryForms = [{ query: formsOf(full), penalty: 0 }];
  const core = coreQuery(full);
  if (core.length >= MIN_MATCH_LENGTH && core !== full) {
    queryForms.push({ query: formsOf(core), penalty: CORE_QUERY_PENALTY, core: true });
  }

  // Specialties are always scored: doctors can be reached through them.
  const scoredTypes = new Set([...types, ...(types.includes("doctor") ? ["specialty"] : [])]);
  const scored = {};
  for (const type of scoredTypes) {
    scored[type] = RECORDS[type](catalog).map((record) => ({
      type,
      record,
      ...bestScore(queryForms, fieldsFor(type, record)),
    }));
  }

  // Doctors of a strongly matched specialty are relevant even when their own
  // fields do not contain the query (e.g. a specialty alias like "skin doctor").
  if (scored.doctor) {
    const strongSpecialties = new Map(
      scored.specialty
        .filter((match) => match.score >= STRONG_SPECIALTY_SCORE)
        .map((match) => [match.record.name, match.score]),
    );
    for (const match of scored.doctor) {
      const specialtyScore = strongSpecialties.get(match.record.specialtyName);
      const viaSpecialty = specialtyScore ? specialtyScore * SPECIALTY_DOCTOR_WEIGHT : 0;
      if (viaSpecialty > match.score) {
        match.score = viaSpecialty;
        match.matchedOn = "specialty";
      }
    }
  }

  let kept = [];
  for (const type of types) {
    const ranked = scored[type]
      .filter((match) => match.score >= MIN_SCORE)
      .sort(byRank(type))
      .slice(0, perTypeLimit);
    kept = kept.concat(ranked);
  }

  if (kept.length > totalLimit) {
    kept = kept.sort((a, b) => b.score - a.score).slice(0, totalLimit);
  }
  for (const match of kept) matches[match.type].push(match);
  for (const type of RESULT_TYPES) matches[type].sort(byRank(type));
  return matches;
}

// Merges several match sets (e.g. literal query + resolved AI intent) into
// one: per record the best score wins, then the usual per-type and total
// limits and ordering apply.
function mergeMatches(matchSets, options = {}) {
  const types = options.types && options.types.length ? options.types : RESULT_TYPES;
  const perTypeLimit = options.perTypeLimit || MAX_RESULTS_PER_TYPE;
  const totalLimit = options.totalLimit || MAX_RESULTS_TOTAL;
  const best = Object.fromEntries(RESULT_TYPES.map((type) => [type, new Map()]));
  for (const set of matchSets) {
    for (const type of types) {
      for (const match of (set && set[type]) || []) {
        const key = recordKey(type, match.record);
        const current = best[type].get(key);
        if (!current || match.score > current.score) best[type].set(key, match);
      }
    }
  }
  let kept = [];
  for (const type of types) kept = kept.concat([...best[type].values()].sort(byRank(type)).slice(0, perTypeLimit));
  if (kept.length > totalLimit) kept = kept.sort((a, b) => b.score - a.score).slice(0, totalLimit);
  const merged = Object.fromEntries(RESULT_TYPES.map((type) => [type, []]));
  for (const match of kept) merged[match.type].push(match);
  for (const type of RESULT_TYPES) merged[type].sort(byRank(type));
  return merged;
}

module.exports = { matchCatalog, mergeMatches, scoreText, MIN_SCORE, SCORE, WEIGHT };
