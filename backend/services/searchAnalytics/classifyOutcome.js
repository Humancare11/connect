// Server-side classification of one search into an analytics outcome.
//
// Pure: works on the internal matches produced by the deterministic matcher
// (which carry scores) plus the catalog index, and uses the trusted route
// resolution in resultBuilder. It never looks at titles or guesses paths, and
// nothing here comes from the client.

const { resolveNavigation } = require("../search/resultBuilder");
const { RESULT_TYPES, PAGE_TYPES, RELEVANT_SCORE } = require("./constants");

const round1 = (value) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

// matches: { [type]: [{ type, record, score, matchedOn }] }
// index:   catalog.index ({ categoryById, specialtyById })
//
// outcome:
//   no_results            nothing matched
//   dedicated_page_found  a relevant (score >= RELEVANT_SCORE) category,
//                         specialty, condition or service result resolves to
//                         its OWN page. Aliases and AI-intent matches arrive
//                         as ordinary matches, so equivalent pages count.
//   fallback_only         everything else, including blog-only results and
//                         results that only fall back to a parent/listing page
function classifyOutcome({ matches, index }) {
  const entries = [];
  for (const type of RESULT_TYPES) {
    for (const match of (matches && matches[type]) || []) {
      entries.push({ type, record: match.record, score: Number(match.score) || 0 });
    }
  }

  let hasDoctor = false;
  let dedicatedPageAvailable = false;
  let relevantDedicated = false;
  let top = null;

  for (const entry of entries) {
    if (entry.type === "doctor") {
      hasDoctor = true;
      continue;
    }
    entry.nav = resolveNavigation(entry.type, entry.record, index);
    if (PAGE_TYPES.includes(entry.type) && entry.nav.dedicated) {
      dedicatedPageAvailable = true;
      if (entry.score >= RELEVANT_SCORE) relevantDedicated = true;
    }
    if (!top || entry.score > top.score) top = entry;
  }

  const resultCount = entries.length;
  const present = new Set(entries.map((entry) => entry.type));

  let outcome = "fallback_only";
  if (resultCount === 0) outcome = "no_results";
  else if (relevantDedicated) outcome = "dedicated_page_found";

  return {
    resultCount,
    resultTypes: RESULT_TYPES.filter((type) => present.has(type)),
    outcome,
    dedicatedPageAvailable,
    topResultType: top ? top.type : null,
    topResultPath: top ? top.nav.path : null,
    topResultDedicated: top ? top.nav.dedicated : null,
    topScore: top ? round1(top.score) : null,
    // The recorder drops the whole event when a doctor is involved.
    hasDoctor,
  };
}

// Maps what happened in the AI layer to the stored status.
//   requested  full mode (the only mode that may use AI)
//   consulted  no exact literal hit, so the AI layer was actually asked
//   used       the AI layer added results
//   status     the AI layer's own outcome: "ok" | "failed" | "skipped"
function deriveAiStatus({ requested, consulted, used, status } = {}) {
  if (!requested) return "not_requested";
  if (!consulted) return "not_needed";
  if (used) return "used";
  if (status === "ok") return "no_match";
  return "unavailable";
}

// A fallback/no-result outcome is only a CONFIRMED content gap when the AI
// layer was not down: with aiStatus "unavailable" the page may well exist.
function isConfirmedGap({ outcome, aiStatus }) {
  return (outcome === "fallback_only" || outcome === "no_results") && aiStatus !== "unavailable";
}

module.exports = { classifyOutcome, deriveAiStatus, isConfirmedGap };
