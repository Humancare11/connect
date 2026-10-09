import { SEARCH_GROUPS } from "./searchApi.js";
import { runSubmitSearch } from "./searchSubmit.js";

// Automatic semantic enhancement for the hero search.
//
// While the user types, the page shows "instant" (deterministic, no AI)
// results. When those results do not clearly answer the query, ONE "full"
// search is scheduled after the user pauses, and its results replace the
// instant ones. The frontend knows no medical meaning: it only reads the
// backend's own result metadata (rank, matchedOn). The backend still decides
// whether the AI is actually called (it skips it on exact literal hits).

// Pause after the instant results are shown before the full search starts.
// Every further keystroke cancels it, so full mode never runs per keystroke.
export const AUTO_FULL_DELAY_MS = 1200;
// Queries shorter than this are never enhanced automatically.
export const AUTO_FULL_MIN_LENGTH = 4;
// A finished full search is reused for the same query for this long.
const DONE_TTL_MS = 60 * 1000;
const DONE_MAX = 20;
// matchedOn values meaning the query hit the result's own name/title.
const NAME_FIELDS = new Set(["name", "title"]);
// An alias hit is trusted as a direct answer only for short, alias-like queries.
const ALIAS_STRONG_MAX_WORDS = 2;

const queryKey = (query) => String(query ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// The backend's best result for the response (lowest rank, else group order).
function topResult(response) {
  const results = response?.results || {};
  const items = SEARCH_GROUPS.flatMap((group) => results[group] || []);
  const ranked = items.filter((item) => Number.isFinite(item.rank));
  return ranked.length ? ranked.reduce((best, item) => (item.rank < best.rank ? item : best)) : items[0] || null;
}

/**
 * True when the instant response already answers the query: its top result
 * matched on its own name/title (exact, prefix, or named in the query), or on
 * an alias for a short alias-like query. No results, or anything else
 * (alias for a long sentence, description, ...), is "weak".
 */
export function isStrongInstantResult(response, query) {
  const top = topResult(response);
  if (!top) return false;
  if (NAME_FIELDS.has(top.matchedOn)) return true;
  return top.matchedOn === "alias" && queryKey(query).split(" ").length <= ALIAS_STRONG_MAX_WORDS;
}

/**
 * One instance per search box, wrapping its searchSession.
 *
 * - consider(query, instantResponse, onResults): after the instant results are
 *   shown, schedules at most one full search if they are weak.
 * - join(query): for a manual submit. Returns the outcome promise of an
 *   in-flight/finished automatic search for the same query (no duplicate
 *   request), or null after dropping any other pending automatic work.
 * - cancel(): drops the timer and supersedes an in-flight automatic search.
 */
export function createAutoFullSearch({
  session,
  delayMs = AUTO_FULL_DELAY_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => Date.now(),
  run = runSubmitSearch,
} = {}) {
  let token = 0; // bumped whenever pending work is dropped
  let timer = null;
  let pendingKey = null; // scheduled or running
  let inflight = null; // { key, promise }
  const done = new Map(); // key -> { outcome, expiresAt }

  const fresh = (key) => {
    const entry = done.get(key);
    return entry && entry.expiresAt > now() ? entry.outcome : null;
  };

  function cancel() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    pendingKey = null;
    token += 1;
    if (inflight) session.cancel(); // the late response resolves as superseded
    inflight = null;
  }

  function remember(key, outcome) {
    if (outcome.action !== "show" && outcome.action !== "navigate") return; // never cache empty/failed
    if (done.size >= DONE_MAX) done.delete(done.keys().next().value);
    done.set(key, { outcome, expiresAt: now() + DONE_TTL_MS });
  }

  function consider(query, instantResponse, onResults) {
    const key = queryKey(query);
    if (key.length < AUTO_FULL_MIN_LENGTH || !instantResponse || instantResponse.success === false) return;
    if (isStrongInstantResult(instantResponse, query)) return;

    const cached = fresh(key);
    if (cached) return onResults(cached.suggestions);
    if (pendingKey === key) return; // same query already scheduled or running

    cancel();
    pendingKey = key;
    const mine = token;
    timer = setTimer(async () => {
      timer = null;
      const promise = run(session, query);
      inflight = { key, promise };
      const outcome = await promise;
      if (inflight?.promise === promise) inflight = null;
      if (mine !== token) return; // superseded while running
      pendingKey = null;
      remember(key, outcome);
      // Empty/failed/superseded: the instant results simply stay.
      if (outcome.action === "show" || outcome.action === "navigate") onResults(outcome.suggestions);
    }, delayMs);
  }

  function join(query) {
    const key = queryKey(query);
    const cached = fresh(key);
    if (cached) return Promise.resolve(cached);
    if (inflight?.key === key) return inflight.promise;
    cancel();
    return null;
  }

  return { consider, join, cancel };
}
