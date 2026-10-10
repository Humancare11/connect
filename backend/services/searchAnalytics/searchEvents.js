// Connects live search to search analytics: the feature flag, which searches
// qualify, and scheduling the recording AFTER the response has been sent.
//
// Nothing here can change a search response:
//  - Disabled (the default) means no listener, no task and no write at all.
//  - Every public method is synchronous, never throws and returns a short
//    status string (used by tests).
//  - The work runs in the background runner, once the response has finished.
//    The response never waits for matching, validation or persistence.
//
// The only thing taken from the HTTP layer is the response's "finish" signal;
// no address, header, cookie, account or body is read here. Callers pass plain
// values only.

const { matchCatalog } = require("../search/deterministicMatcher");
const { DEFAULT_SEARCH_TYPES, MAX_RESULTS_PER_TYPE, MAX_RESULTS_TOTAL } = require("../search/searchConstants");
const { deriveAiStatus } = require("./classifyOutcome");
const { runInBackground } = require("./backgroundRunner");
const { recordSearchInteraction } = require("./recorder");

// Off unless the variable is exactly the string "true".
function isSearchAnalyticsEnabled(env = process.env) {
  return env.SEARCH_ANALYTICS_ENABLED === "true";
}

// Runs fn once the response has been fully handed to the network layer
// (immediately if it already has). fn must not throw; callers wrap it.
function afterResponse(response, fn) {
  if (response.writableFinished) fn();
  else response.once("finish", fn);
}

function createSearchEvents({
  isEnabled = isSearchAnalyticsEnabled,
  run = runInBackground,
  record = recordSearchInteraction,
  match = matchCatalog,
} = {}) {
  const enabled = () => {
    try {
      return isEnabled() === true;
    } catch {
      return false;
    }
  };

  // Full submission through POST /api/search.
  //   request: { mode, interactionId, typesExplicit, q }
  //   facts:   internal facts from executeSearchDetailed
  // Records only global-search-box submissions: mode "full", a valid
  // interactionId, and no explicit `types` list.
  function afterFullSearch(response, { mode, interactionId, typesExplicit, q, facts }) {
    try {
      if (!enabled()) return "disabled";
      if (mode !== "full" || !interactionId || typesExplicit || !facts) return "skipped";
      afterResponse(response, () => {
        try {
          run(() => record({
            interactionId,
            q,
            settledBy: "submit",
            aiStatus: deriveAiStatus({
              requested: facts.ai.requested,
              consulted: facts.ai.consulted,
              used: facts.ai.used,
              status: facts.ai.status,
            }),
            matches: facts.matches,
            index: facts.index,
          }));
        } catch {
          // Analytics must never surface an error.
        }
      });
      return "scheduled";
    } catch {
      return "error";
    }
  }

  // POST /api/search/settle. The result is recomputed here by the same
  // deterministic matcher instant search uses; the client supplies only the
  // text, the interaction id and the reason. No AI is involved.
  //   settle: { interactionId, q, reason }   reason: "idle" | "select"
  function afterSettle(response, { interactionId, q, reason }, getCatalog) {
    try {
      if (!enabled()) return "disabled";
      afterResponse(response, () => {
        try {
          run(async () => {
            const catalog = await getCatalog();
            const matches = match(catalog, q, {
              types: DEFAULT_SEARCH_TYPES,
              perTypeLimit: MAX_RESULTS_PER_TYPE,
              totalLimit: MAX_RESULTS_TOTAL,
            });
            await record({
              interactionId,
              q,
              settledBy: reason,
              aiStatus: "not_requested",
              matches,
              index: catalog.index,
            });
          });
        } catch {
          // Analytics must never surface an error.
        }
      });
      return "scheduled";
    } catch {
      return "error";
    }
  }

  return { afterFullSearch, afterSettle };
}

const searchEvents = createSearchEvents();

module.exports = { createSearchEvents, searchEvents, isSearchAnalyticsEnabled, afterResponse };
