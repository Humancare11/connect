// Validation and normalisation for search input.
//
// The query is only ever compared against in-memory catalog strings; it is
// never turned into a MongoDB filter, a field selector or a RegExp.

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
// Anything far beyond the limit is rejected before any string processing.
const MAX_RAW_LENGTH = 1000;

// Words that carry no search meaning on their own ("doctor for migraine",
// "I have acne", "Dr Rahul"). Used only to derive a secondary "core" query.
const FILLER_WORDS = new Set([
  "a", "an", "the", "i", "im", "my", "me", "have", "has", "had", "for", "of",
  "with", "about", "to", "in", "on", "near", "need", "want", "find", "help",
  "dr", "doctor", "doctors", "specialist", "specialists",
  "article", "articles", "blog", "blogs", "treatment",
]);

class QueryValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QueryValidationError";
    this.code = code;
  }
}

// Validates a raw query and returns its normalised form. Throws
// QueryValidationError (never echoing the input) when it is unusable.
function validateQuery(raw) {
  if (raw === undefined) {
    throw new QueryValidationError("INVALID_QUERY", "q is required.");
  }
  if (typeof raw !== "string") {
    throw new QueryValidationError("INVALID_QUERY", "q must be a string.");
  }
  if (raw.length > MAX_RAW_LENGTH) {
    throw new QueryValidationError("INVALID_QUERY", `q must be at most ${MAX_QUERY_LENGTH} characters.`);
  }
  const normalized = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (normalized.length < MIN_QUERY_LENGTH) {
    throw new QueryValidationError("INVALID_QUERY", `q must be at least ${MIN_QUERY_LENGTH} characters.`);
  }
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new QueryValidationError("INVALID_QUERY", `q must be at most ${MAX_QUERY_LENGTH} characters.`);
  }
  return normalized;
}

// Canonical form used for matching both queries and catalog text:
// accents stripped, apostrophes dropped ("men's" -> "mens"), "&" read as
// "and", every other non-alphanumeric run collapsed to a single space.
function normalizeForMatch(value) {
  if (typeof value !== "string" || !value) return "";
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(normalized) {
  return normalized ? normalized.split(" ") : [];
}

// The query with filler words removed, or "" when nothing meaningful is left.
function coreQuery(normalizedForMatch) {
  return tokenize(normalizedForMatch)
    .filter((token) => !FILLER_WORDS.has(token))
    .join(" ");
}

// Conservative singular form of one normalised token, used only to compare
// query and catalog text symmetrically ("migraines" ~ "migraine",
// "allergies" ~ "allergy"). Short tokens, tokens with digits and Latin/Greek
// endings (-ss, -us, -is: "sinus", "arthritis") are left unchanged.
function singularize(token) {
  if (token.length < 4 || /\d/.test(token)) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ss") || token.endsWith("us") || token.endsWith("is")) return token;
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

// Singular form of a whole normalised string.
function singularForm(normalizedForMatch) {
  return tokenize(normalizedForMatch).map(singularize).join(" ");
}

// Separator-insensitive form ("follow up" ~ "followup", "covid 19" ~ "covid19").
function compactForm(normalizedForMatch) {
  return normalizedForMatch.split(" ").join("");
}

module.exports = {
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
  QueryValidationError,
  validateQuery,
  normalizeForMatch,
  tokenize,
  coreQuery,
  singularize,
  singularForm,
  compactForm,
};
