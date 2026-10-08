// POST /api/search - Healthcare Discovery Search (deterministic, with optional
// AI query understanding in "full" mode).
//
// Public, unauthenticated. The query is validated and matched in memory
// against the public search catalog; it is never logged, stored, sent to an
// external service except, in "full" mode, the AI query-understanding layer
// (backend only, optional, falls back to deterministic search). It is never
// used to build a database query.

const { getSearchCatalog } = require("../services/search/searchCatalog");
const { validateQuery, QueryValidationError } = require("../services/search/queryNormalizer");
const { executeSearch, SearchUnavailableError } = require("../services/search/searchService");
const { RESULT_TYPES, DEFAULT_SEARCH_TYPES } = require("../services/search/searchConstants");

const MODES = ["instant", "full"];
const ALLOWED_BODY_KEYS = new Set(["q", "mode", "types"]);

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

  return { q, mode, types };
}

function createSearchController({ getCatalog = getSearchCatalog, ai } = {}) {
  return async function search(req, res) {
    // Invalid requests are rejected here, before any catalog/database access.
    const parsed = parseRequest(req.body);
    if (parsed.error) return badRequest(res, parsed);

    // Aborted when the client goes away before the response was sent (tab
    // closed, request cancelled). It reaches the AI provider call so an
    // abandoned search stops costing money instead of running to the timeout.
    const disconnect = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) disconnect.abort();
    });

    try {
      // req.ip only keys the per-client AI minute cap; it is never sent to
      // the AI provider. No user, session or cookie data is read here.
      const result = await executeSearch(parsed, { getCatalog, clientKey: req.ip, signal: disconnect.signal, ...(ai ? { ai } : {}) });
      if (disconnect.signal.aborted) return undefined; // nobody is listening
      return res.json(result);
    } catch (err) {
      if (disconnect.signal.aborted) return undefined;
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

module.exports = {
  search: createSearchController(),
  createSearchController,
  parseRequest,
};
