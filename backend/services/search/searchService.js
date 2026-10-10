// Healthcare Discovery Search: the single entry point that turns a validated
// request into a response body.
//
// 1. Deterministic search on the literal query (always).
// 2. mode "instant": done. mode "full": optionally ask the AI query-
//    understanding layer (searchAiService) to classify the phrase - only when
//    the deterministic search found no exact hit on what the user typed.
// 3. The validated intent only SELECTS catalog records by exact name (or runs
//    the same deterministic matcher on short model-provided texts). Every
//    result, id and navigation path still comes from the public catalog and
//    resultBuilder; the AI layer can never add anything else.
// 4. Any AI problem (disabled, limits, timeout, invalid output) falls back to
//    the deterministic results.

const { getSearchCatalog } = require("./searchCatalog");
const { matchCatalog, mergeMatches } = require("./deterministicMatcher");
const { buildResults } = require("./resultBuilder");
const { validateQuery, QueryValidationError } = require("./queryNormalizer");
const { createSearchAiService, MIN_CONFIDENCE } = require("./searchAiService");
const { correctQuery } = require("./typoTolerance");
const { MAX_RESULTS_PER_TYPE, MAX_RESULTS_TOTAL } = require("./searchConstants");

// A literal (non-core) match at or above this score is an exact name/alias
// hit: the query is already understood, so the AI layer is not consulted.
const EXACT_LITERAL_SCORE = 95;
// Intent-derived matches rank just below equally strong literal matches.
const AI_WEIGHT = 0.9;
const DOCTOR_VIA_SPECIALTY = 0.85;

class SearchUnavailableError extends Error {
  constructor() {
    super("Search catalog unavailable.");
    this.name = "SearchUnavailableError";
  }
}

const defaultAi = createSearchAiService();

const hasAnyMatch = (matches) => Object.values(matches).some((list) => list.length);

function hasExactLiteralHit(matches) {
  return Object.values(matches).some((list) => list.some((m) => m.score >= EXACT_LITERAL_SCORE && !m.viaCore));
}

const intentMatch = (type, record, score) => ({ type, record, score, matchedOn: "intent", viaCore: false });

// Runs the deterministic matcher on a short model-provided text, restricted
// to one result type. Invalid texts are ignored.
function matchText(catalog, text, type, keep) {
  let q;
  try {
    q = validateQuery(text);
  } catch (err) {
    if (err instanceof QueryValidationError) return [];
    throw err;
  }
  return matchCatalog(catalog, q, { types: [type] })[type]
    .filter(keep)
    .map((m) => ({ ...m, score: m.score * AI_WEIGHT, matchedOn: "intent" }));
}

// Validated intent -> matches over the public catalog. Names were already
// checked against the vocabulary; they are resolved here by exact equality.
function matchesFromIntent(catalog, intent, types) {
  const out = Object.fromEntries(types.map((type) => [type, []]));
  if (!intent || intent.confidence < MIN_CONFIDENCE) return out;
  const want = (type) => types.includes(type);
  const exact = AI_WEIGHT * 100;

  if (want("category")) {
    for (const name of intent.categoryNames) {
      for (const record of catalog.categories.filter((c) => c.name === name)) out.category.push(intentMatch("category", record, exact));
    }
  }
  for (const name of intent.specialtyNames) {
    if (want("specialty")) {
      for (const record of catalog.specialties.filter((s) => s.name === name)) out.specialty.push(intentMatch("specialty", record, exact));
    }
    if (want("doctor") && intent.wantsDoctor) {
      for (const record of catalog.doctors.filter((d) => d.specialtyName === name)) {
        out.doctor.push(intentMatch("doctor", record, exact * DOCTOR_VIA_SPECIALTY));
      }
    }
  }
  for (const name of intent.conditionNames || []) {
    for (const record of catalog.conditions.filter((c) => c.name === name)) {
      const type = record.kind === "service" ? "service" : "condition";
      if (want(type)) out[type].push(intentMatch(type, record, exact));
    }
  }
  if (want("doctor") && intent.doctorNameText) {
    out.doctor.push(...matchText(catalog, intent.doctorNameText, "doctor", (m) => m.matchedOn === "name"));
  }
  if (want("blog") && (intent.wantsArticle || intent.blogTopicText)) {
    const topics = [intent.blogTopicText, ...(intent.conditionNames || []), ...intent.specialtyNames].filter(Boolean);
    for (const topic of topics.slice(0, 5)) out.blog.push(...matchText(catalog, topic, "blog", () => true));
  }
  return out;
}

// request: { q (validated, normalised), mode, types } from parseRequest.
// options.clientKey: opaque per-client key for the AI minute cap (never sent
// to the AI provider).
<<<<<<< HEAD
//
// Resolves to { body, facts }. `body` is the public response, byte-for-byte
// what executeSearch returns. `facts` is INTERNAL (matches with scores, the
// catalog index and what the AI layer did) for search analytics; it must never
// be sent to a client.
async function executeSearchDetailed(request, { getCatalog = getSearchCatalog, ai = defaultAi, clientKey } = {}) {
=======
async function executeSearch(request, { getCatalog = getSearchCatalog, ai = defaultAi, clientKey, signal } = {}) {
>>>>>>> 0668226c6b98cdc6539c7d09f7470f9e127f832d
  let catalog;
  try {
    catalog = await getCatalog();
  } catch (err) {
    // Only the error message is logged: the query is never part of it.
    console.error("[search] catalog unavailable:", err?.message || "unknown error");
    throw new SearchUnavailableError();
  }

  const limits = { types: request.types, perTypeLimit: MAX_RESULTS_PER_TYPE, totalLimit: MAX_RESULTS_TOTAL };
  let matches = matchCatalog(catalog, request.q, limits);

  // PR 10: when nothing matched at all, try ONE conservative spelling repair
  // against the public catalog vocabulary. The repaired query goes through the
  // same matcher and ordering; an unconfident repair changes nothing.
  let corrected = null;
  if (!hasAnyMatch(matches)) {
    const repaired = correctQuery(catalog, request.q);
    if (repaired) {
      const retry = matchCatalog(catalog, repaired, limits);
      if (hasAnyMatch(retry)) {
        matches = retry;
        corrected = repaired;
      }
    }
  }

  let aiMeta = null;
  const aiFacts = { requested: request.mode === "full", consulted: false, used: false, status: undefined };
  if (request.mode === "full") {
    aiMeta = { used: false, fallback: false, cached: false };
    if (!hasExactLiteralHit(matches)) {
      aiFacts.consulted = true;
      let outcome;
      try {
        outcome = await ai.understand(request.q, catalog, { clientKey, signal });
      } catch {
        outcome = { status: "failed" };
      }
<<<<<<< HEAD
      aiFacts.status = outcome.status;
      if (outcome.status === "failed") {
=======
      if (outcome.status === "cancelled") {
        // The client went away: neither an AI result nor a provider fallback.
      } else if (outcome.status === "failed") {
>>>>>>> 0668226c6b98cdc6539c7d09f7470f9e127f832d
        aiMeta.fallback = true;
      } else if (outcome.status === "ok") {
        aiMeta.cached = Boolean(outcome.cached);
        const fromIntent = matchesFromIntent(catalog, outcome.intent, request.types);
        if (Object.values(fromIntent).some((list) => list.length)) {
          matches = mergeMatches([matches, fromIntent], limits);
          // Remember which results the AI layer confirmed, even when an equally
          // strong literal match was kept (used by crossTypeOrdering). Marks a
          // boolean on in-memory match objects only; nothing is returned or stored.
          for (const type of Object.keys(fromIntent)) {
            const chosen = new Set(fromIntent[type].map((m) => m.record));
            for (const m of matches[type] || []) if (chosen.has(m.record)) m.aiChosen = true;
          }
          aiMeta.used = true;
          aiFacts.used = true;
        } else {
          aiMeta.fallback = true;
        }
      }
    }
  }

  const { results, total } = buildResults(matches, catalog);
  const meta = { total, mode: request.mode, limits: { perType: MAX_RESULTS_PER_TYPE, total: MAX_RESULTS_TOTAL } };
  if (aiMeta) meta.ai = aiMeta;
<<<<<<< HEAD
  const body = { success: true, query: { normalized: request.q }, results, meta };
  return { body, facts: { matches, index: catalog.index, ai: aiFacts } };
=======
  return { success: true, query: { normalized: request.q, ...(corrected ? { corrected } : {}) }, results, meta };
>>>>>>> 0668226c6b98cdc6539c7d09f7470f9e127f832d
}

// The public entry point: only the response body.
async function executeSearch(request, options) {
  return (await executeSearchDetailed(request, options)).body;
}

module.exports = { executeSearch, executeSearchDetailed, matchesFromIntent, SearchUnavailableError, EXACT_LITERAL_SCORE };
