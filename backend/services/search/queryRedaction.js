// Shared, pure query-privacy helpers for Healthcare Discovery Search.
//
// No I/O, no logging, no database or model access, and only regex literals
// (never a pattern built from input).
//
// - redactQuery: masks contact details and long numbers with placeholders.
//   Last line of defence for the text sent to the AI query-understanding layer.
// - analyzeForAnalytics: decides whether a normalised query may be stored in
//   search analytics at all. Analytics never stores a redacted term: if any
//   rule below fires, the whole event is dropped.
// - analyzeForAi: decides whether a normalised query may be sent to the AI
//   query-understanding provider at all. When a rule fires the caller SKIPS the
//   AI call (deterministic search only). Nothing is masked-and-sent.
//
// Both analyses use ONE shared rule set (sensitiveReasons), so anything that is
// not sent to the provider is also not stored. They differ only in the
// token-count rule: analytics also drops long, narrative-style queries, while
// the AI gate does not (long natural-language sentences stay AI-assisted).
//
// These are best-effort, pattern-based heuristics. They cannot recognise every
// identifying string. In particular a personal name with NO cue word
// ("<first name> <last name> has diabetes") is not detectable by patterns; that
// is a documented limitation (see the Phase 5/6 reports), not a guarantee.

const MAX_QUERY_CHARS = 100;

// Strips contact details and long numbers a user might type into the box.
// Behaviour must stay byte-for-byte identical (golden-tested). It only runs
// behind the privacy gate, as defence in depth.
function redactQuery(query) {
  return String(query || "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\d{5,}/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_CHARS);
}

// ── Shared sensitive-content rules ──────────────────────────────────────────

const DROP_REASONS = Object.freeze(["contact", "number", "identifier", "selfid", "length", "doctor", "date", "invalid"]);

// More tokens than this reads as a personal narrative, not a search topic
// (analytics only; see the header).
const MAX_ANALYTICS_TOKENS = 8;

const CONTACT_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /(?:^|\s)@\w{2,}/, // @handle
  /https?:\/\//, // URL
  /\bwww\./, // URL without scheme
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|in|uk|us|edu|gov|info|app|me|ai)\b/, // domain
  // Obfuscated / spelled-out email forms.
  /\b[a-z0-9._-]+\s+(?:at|\[at\]|\(at\))\s+[a-z0-9.-]+\s+(?:dot|\[dot\]|\(dot\))\s+[a-z]{2,}\b/, // "x at y dot com"
  /[a-z0-9._-]+\s*[[({]\s*at\s*[\])}]\s*[a-z0-9]/, // "x(at)y", "x[at]y"
  /[a-z0-9-]+\s*[[({]\s*dot\s*[\])}]\s*[a-z]{2,}/, // "y(dot)com"
  /\bdot\s+(?:com|org|net|edu|gov|co|io|in|uk|info)\b/, // "... dot com"
  /\b(?:gmail|googlemail|yahoo|hotmail|icloud|protonmail|rediffmail)\b/, // mail providers
  /\bat\s+example\b/, // "jdoe at example"
];

const NUMBER_PATTERNS = [
  /\+?\d[\d\s().-]{6,}\d/, // phone-like / long separated numbers
  /\d{5,}/, // long digit runs (patient, doctor, appointment style ids)
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // IPv4
  /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b|::[0-9a-f]{1,4}\b|\b[0-9a-f]{1,4}::/, // IPv6
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/, // dd/mm/yyyy
  /\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b/, // yyyy-mm-dd
  // Five or more digit words in a row ("five five five zero one ...").
  /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:\s+|-|,\s*)){4,}(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/,
];

// Short identifiers. Letters mixed with several digits in one token are handled
// by hasIdentifierToken; these are cue-based forms.
const IDENTIFIER_PATTERNS = [
  /\b[a-z]{1,6}[-_][a-z]+\d+[a-z\d]*\b/, // "pt-ab12" (not "covid-19", "sars-cov-2")
  /\b(?:mrn|uhid|ssn|nhs|passport|licen[cs]e|policy|claim|ticket|ref|id)\s*(?:no\.?|number|#|:)?\s*[a-z]*\d+[a-z\d]*\b/, // "id 442", "mrn 12"
];

const SELF_ID_PATTERNS = [
  /\b(?:my name is|my name's|i am called|i'm called|im called|patient name|full name)\b/,
  /\b(?:mr|mrs|mister)\b\.?\s+[a-z]{2,}/, // title + name ("ms" alone is multiple sclerosis)
  /\bms\.\s*[a-z]{2,}/,
  /\b(?:my|home|house|mailing|postal) address\b/,
  /\b[a-z]+\s+(?:street|road|avenue|lane)\b/, // "main street" (not "road rash")
  /\b(?:apartment|pin ?code|post ?code|zip ?code|flat no)\b/,
  // Cue-based names. Each excludes the common non-name word that can follow.
  /\bpatient\s+(?!(?:portal|education|care|info|information|support|rights|forms?|safety|stories|story|services?|experience|advocate|advocacy|assistance)\b)[a-z]{2,}/, // "patient john doe"
  /\b(?:named|surname|first name|last name)\s+[a-z]{2,}/,
  /(?:^|\s)name\s+(?!(?:change|changes|tag|tags|badge|brand|generic|of|for|and|or|in|on|at|the|a|an|to|check|search)\b)[a-z]{2,}/, // "name jane roe", not "name change certificate"
  /\b(?:my|our)\s+(?:son|daughter|child|kid|baby|wife|husband|partner|mother|mom|mum|father|dad|brother|sister|grandmother|grandfather|neighbou?r|friend|colleague|boss|cousin|uncle|aunt|nephew|niece)\s+(?!(?:has|had|have|is|was|needs?|got|gets|keeps|feels|seems|with|and|or|who|also|suffers|complains|cannot|can't|cant|will|would|might|often)\b)[a-z]{2,}/, // "my son aarav", not "my son has fever"
  /\b(?:doctor|physician|nurse|surgeon)\s+(?!(?:for|near|nearby|in|to|with|who|that|and|or|of|at|on|online|visit|appointments?|consultations?|specialists?|my|an?|the|i|need|want|free|best|good|top|urgent|available|today|tomorrow|notes?|letters?|certificates?|prescriptions?|referrals?|advice|help|me|practitioners?|assistants?|second|chat|calls?)\b)[a-z]{2,}/, // "doctor smith", not "doctor for acne"
  // Addresses.
  /\b(?:i|we)\s+live[sd]?\s+(?:in|at|on|near)\b/,
  /\b\d{1,5}[a-z]?\s+[a-z]+\s+(?:st|ave|rd|blvd|ln|street|road|avenue|lane|drive)\b/, // "12 oak st", "221b baker st"
  /\b(?:flat|apt|apartment|unit|suite|ste|room|rm|house|plot|bldg|door)\s*(?:no\.?|number|#)?\s*\d+[a-z]?\b/, // "flat 4b", "apt 77"
];

// "dr rahul": a person's name, not a health topic.
const DOCTOR_NAME_PATTERNS = [/\bdr\.?\s+[a-z]{2,}/];

// Dates of birth and similar. "born" / "birthday" count only when a date
// follows, so "born premature baby care" is not affected.
const DATE_PATTERNS = [
  /\b(?:dob|d\.o\.b\.?|date of birth|birth ?date)\b/,
  /\b(?:born|birthday)\b(?:\s+(?:on|in|at|is|was))?\s*[:-]?\s*(?:the\s+)?(?:\d|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b)/,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/, // "5 march"
  /\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/, // "march 5"
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\b/, // "march 1980"
];

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

// The one shared rule set. text: lower-cased, whitespace-collapsed.
// Reports each reason at most once, in a fixed order.
function sensitiveReasons(text) {
  const reasons = [];
  if (matchesAny(CONTACT_PATTERNS, text)) reasons.push("contact");
  if (matchesAny(NUMBER_PATTERNS, text)) reasons.push("number");
  if (hasIdentifierToken(text) || matchesAny(IDENTIFIER_PATTERNS, text)) reasons.push("identifier");
  if (matchesAny(SELF_ID_PATTERNS, text)) reasons.push("selfid");
  if (matchesAny(DOCTOR_NAME_PATTERNS, text)) reasons.push("doctor");
  if (matchesAny(DATE_PATTERNS, text)) reasons.push("date");
  return reasons;
}

const prepare = (normalized) => normalized.toLowerCase().replace(/\s+/g, " ").trim();

// normalized: the already-normalised (trimmed, lower-cased) query.
// Returns { store, reasons }. store === false means: do not record anything.
function analyzeForAnalytics(normalized) {
  if (typeof normalized !== "string") return { store: false, reasons: ["invalid"] };
  const text = prepare(normalized);
  if (text.length < 2 || text.length > MAX_QUERY_CHARS) return { store: false, reasons: ["length"] };

  const reasons = sensitiveReasons(text);
  if (text.split(" ").length > MAX_ANALYTICS_TOKENS) reasons.push("length");

  return { store: reasons.length === 0, reasons };
}

// normalized: the normalised query that would be sent to the provider.
// Returns { safe, reasons }. safe === false means: do not call the AI.
// Same rules as analytics, without the token-count (narrative) rule.
function analyzeForAi(normalized) {
  if (typeof normalized !== "string") return { safe: false, reasons: ["invalid"] };
  const text = prepare(normalized);
  if (text.length < 2 || text.length > MAX_QUERY_CHARS) return { safe: false, reasons: ["length"] };

  const reasons = sensitiveReasons(text);
  return { safe: reasons.length === 0, reasons };
}

module.exports = { redactQuery, analyzeForAnalytics, analyzeForAi, DROP_REASONS, MAX_ANALYTICS_TOKENS, MAX_QUERY_CHARS };
