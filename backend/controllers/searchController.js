// POST /api/search - Healthcare Discovery Search (deterministic, with optional
// AI query understanding in "full" mode).
//
// Public, unauthenticated. The query is validated and matched in memory
// against the public search catalog; it is never logged and is sent to an
// external service only, in "full" mode, to the AI query-understanding layer
// (backend only, optional, falls back to deterministic search). It is never
// used to build a database query.
//
// Search analytics (services/searchAnalytics) is OFF unless
// SEARCH_ANALYTICS_ENABLED=true. When on, a privacy-filtered copy of a
// qualifying search is recorded in the background AFTER the response has been
// sent; it can never change or delay the response. See searchEvents.js.

const { getSearchCatalog } = require("../services/search/searchCatalog");
const { validateQuery, QueryValidationError } = require("../services/search/queryNormalizer");
const { executeSearchDetailed, SearchUnavailableError } = require("../services/search/searchService");
const { RESULT_TYPES, DEFAULT_SEARCH_TYPES } = require("../services/search/searchConstants");
const { searchEvents } = require("../services/searchAnalytics/searchEvents");
const { UUID_V4 } = require("../services/searchAnalytics/constants");

const MODES = ["instant", "full"];
const ALLOWED_BODY_KEYS = new Set(["q", "mode", "types", "interactionId"]);
const SETTLE_BODY_KEYS = new Set(["interactionId", "q", "reason"]);
const SETTLE_REASONS = ["idle", "select"];

// Every validation failure has the same shape. Messages are fixed strings
// and never echo the input; `field` says which part of the body was wrong.
function badRequest(res, { error, field }) {
  return res.status(400).json({ success: false, error: { code: "INVALID_REQUEST", field, message: error } });
}

function parseRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object.", field: "body" };
  }
  if (Object.keys(body).some((key) => !ALLOWED_BODY_KEYS.has(key))) {
    return { error: "Only q, mode and types are accepted.", field: "body" };
  }

  let q;
  try {
    q = validateQuery(body.q);
  } catch (err) {
    if (err instanceof QueryValidationError) return { error: err.message, field: "q" };
    throw err;
  }

  const mode = body.mode === undefined ? "instant" : body.mode;
  if (!MODES.includes(mode)) {
    return { error: `mode must be one of: ${MODES.join(", ")}.`, field: "mode" };
  }

  // TEMPORARILY DISABLED: the default excludes doctors (see
  // DEFAULT_SEARCH_TYPES); an explicit types list may still include "doctor".
  let types = DEFAULT_SEARCH_TYPES;
  if (body.types !== undefined) {
    if (!Array.isArray(body.types) || body.types.length === 0 || body.types.length > RESULT_TYPES.length) {
      return { error: `types must be a non-empty array of: ${RESULT_TYPES.join(", ")}.`, field: "types" };
    }
    if (body.types.some((type) => typeof type !== "string" || !RESULT_TYPES.includes(type))) {
      return { error: `types may only contain: ${RESULT_TYPES.join(", ")}.`, field: "types" };
    }
    types = RESULT_TYPES.filter((type) => body.types.includes(type));
  }

  // Optional analytics id: anything that is not a lowercase UUID v4 is simply
  // ignored (never an error), so it can never break an ordinary search.
  const interactionId = typeof body.interactionId === "string" && UUID_V4.test(body.interactionId) ? body.interactionId : null;

  return { q, mode, types, interactionId, typesExplicit: body.types !== undefined };
}

// POST /api/search/settle body: exactly { interactionId, q, reason }.
function parseSettleRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object.", field: "body" };
  }
  if (Object.keys(body).some((key) => !SETTLE_BODY_KEYS.has(key))) {
    return { error: "Only interactionId, q and reason are accepted.", field: "body" };
  }
  if (typeof body.interactionId !== "string" || !UUID_V4.test(body.interactionId)) {
    return { error: "interactionId must be a UUID v4.", field: "interactionId" };
  }
  let q;
  try {
    q = validateQuery(body.q);
  } catch (err) {
    if (err instanceof QueryValidationError) return { error: err.message, field: "q" };
    throw err;
  }
  if (!SETTLE_REASONS.includes(body.reason)) {
    return { error: `reason must be one of: ${SETTLE_REASONS.join(", ")}.`, field: "reason" };
  }
  return { interactionId: body.interactionId, q, reason: body.reason };
}

function createSearchController({ getCatalog = getSearchCatalog, ai, analytics = searchEvents } = {}) {
  return async function search(req, res) {
    // Invalid requests are rejected here, before any catalog/database access.
    const parsed = parseRequest(req.body);
    if (parsed.error) return badRequest(res, parsed);

    try {
      // req.ip only keys the per-client AI minute cap; it is never sent to
      // the AI provider. No user, session or cookie data is read here.
      const { body, facts } = await executeSearchDetailed(parsed, { getCatalog, clientKey: req.ip, ...(ai ? { ai } : {}) });
      res.json(body);
      // After the response is on its way: hand a plain copy to analytics. It
      // is off by default, never throws and never touches the response.
      try {
        analytics.afterFullSearch(res, {
          mode: parsed.mode,
          interactionId: parsed.interactionId,
          typesExplicit: parsed.typesExplicit,
          q: parsed.q,
          facts,
        });
      } catch {
        // Nothing analytics does may reach the client.
      }
      return undefined;
    } catch (err) {
      if (err instanceof SearchUnavailableError) {
        return res.status(503).json({
          success: false,
          error: { code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable." },
        });
      }
      throw err;
    }
  };
}

// POST /api/search/settle - a search settled without Enter (idle pause or a
// clicked suggestion). Answers 204 for every well-formed body, whether or not
// anything is recorded (analytics off, event dropped by the privacy filter,
// duplicate, or a storage failure), so it reveals nothing about what is
// stored. Matching and persistence happen after the response.
function createSettleController({ getCatalog = getSearchCatalog, analytics = searchEvents } = {}) {
  return function settle(req, res) {
    const parsed = parseSettleRequest(req.body);
    if (parsed.error) return badRequest(res, parsed);

    res.status(204).end();
    try {
      analytics.afterSettle(res, parsed, getCatalog);
    } catch {
      // Nothing analytics does may reach the client.
    }
    return undefined;
  };
}

module.exports = {
  search: createSearchController(),
  settle: createSettleController(),
  createSearchController,
  createSettleController,
  parseRequest,
  parseSettleRequest,
};
