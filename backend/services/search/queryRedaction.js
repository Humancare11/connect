// Shared, pure query-privacy helpers for Healthcare Discovery Search.
//
// No I/O, no logging, no database or model access, and only regex literals
// (never a pattern built from input).
//
// - redactQuery: masks contact details and long numbers with placeholders.
//   Used for the text sent to the AI query-understanding layer.
// - analyzeForAnalytics: decides whether a normalised query may be stored in
//   search analytics at all. Analytics never stores a redacted term: if any
//   pattern below fires, the whole event is dropped.
//
// Both are best-effort, pattern-based heuristics. They cannot recognise every
// identifying string (free-text names, addresses and personal stories in
// particular), so they reduce, but never eliminate, the chance of personal
// data reaching a store.

const MAX_QUERY_CHARS = 100;

// Strips contact details and long numbers a user might type into the box.
// Behaviour must stay byte-for-byte identical (golden-tested): it is the exact
// text the AI provider receives.
function redactQuery(query) {
  return String(query || "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\d{5,}/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_CHARS);
}

// ── Analytics privacy analysis ──────────────────────────────────────────────

const DROP_REASONS = Object.freeze(["contact", "number", "identifier", "selfid", "length", "doctor", "invalid"]);

// More tokens than this reads as a personal narrative, not a search topic.
const MAX_ANALYTICS_TOKENS = 8;

const CONTACT_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /(?:^|\s)@\w{2,}/, // @handle
  /https?:\/\//, // URL
  /\bwww\./, // URL without scheme
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|in|uk|us|edu|gov|info|app|me|ai)\b/, // domain
];

const NUMBER_PATTERNS = [
  /\+?\d[\d\s().-]{6,}\d/, // phone-like / long separated numbers
  /\d{5,}/, // long digit runs (patient, doctor, appointment style ids)
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // IPv4
  /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b|::[0-9a-f]{1,4}\b|\b[0-9a-f]{1,4}::/, // IPv6
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/, // dd/mm/yyyy
  /\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b/, // yyyy-mm-dd
];

const SELF_ID_PATTERNS = [
  /\b(?:my name is|my name's|i am called|i'm called|im called|patient name|full name)\b/,
  /\b(?:mr|mrs|mister)\b\.?\s+[a-z]{2,}/, // title + name ("ms" alone is multiple sclerosis)
  /\bms\.\s*[a-z]{2,}/,
  /\b(?:my|home|house|mailing|postal) address\b/,
  /\b[a-z]+\s+(?:street|road|avenue|lane)\b/, // "main street" (not "road rash")
  /\b(?:apartment|pin ?code|post ?code|zip ?code|flat no)\b/,
];

// "dr rahul": a person's name, not a health topic.
const DOCTOR_NAME_PATTERNS = [/\bdr\.?\s+[a-z]{2,}/];

const matchesAny = (patterns, text) => patterns.some((pattern) => pattern.test(text));

// Letters mixed with several digits in one token, e.g. "apt-2024-00123".
// Short or digit-light tokens such as "covid19" or "hba1c" are kept.
function hasIdentifierToken(text) {
  return text.split(/\s+/).some((token) => {
    if (token.length < 6) return false;
    const digits = (token.match(/\d/g) || []).length;
    return digits >= 3 && /[a-z]/.test(token);
  });
}

// normalized: the already-normalised (trimmed, lower-cased) query.
// Returns { store, reasons }. store === false means: do not record anything.
function analyzeForAnalytics(normalized) {
  if (typeof normalized !== "string") return { store: false, reasons: ["invalid"] };
  const text = normalized.toLowerCase().replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > MAX_QUERY_CHARS) return { store: false, reasons: ["length"] };

  const reasons = [];
  if (matchesAny(CONTACT_PATTERNS, text)) reasons.push("contact");
  if (matchesAny(NUMBER_PATTERNS, text)) reasons.push("number");
  if (hasIdentifierToken(text)) reasons.push("identifier");
  if (matchesAny(SELF_ID_PATTERNS, text)) reasons.push("selfid");
  if (matchesAny(DOCTOR_NAME_PATTERNS, text)) reasons.push("doctor");
  if (text.split(" ").length > MAX_ANALYTICS_TOKENS) reasons.push("length");

  return { store: reasons.length === 0, reasons };
}

module.exports = { redactQuery, analyzeForAnalytics, DROP_REASONS, MAX_ANALYTICS_TOKENS, MAX_QUERY_CHARS };
