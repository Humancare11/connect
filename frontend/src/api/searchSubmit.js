import { toSuggestions } from "./searchApi.js";

// Same canonical form the backend matcher uses for names (queryNormalizer):
// accents stripped, apostrophes dropped, "&" read as "and", every other
// non-alphanumeric run collapsed to one space. Used only to compare the typed
// query with a result's name.
const normalizeName = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// True when the query is exactly the name of the TOP result and of no other
// result. Aliases, prefixes, descriptions and AI-intent matches never count.
function isExactTopMatch(query, suggestions) {
  const wanted = normalizeName(query);
  if (!wanted) return false;
  const exact = suggestions.filter((item) => normalizeName(item.title) === wanted);
  return exact.length === 1 && exact[0] === suggestions[0];
}

// One submission at a time per session and query: a repeated Enter / click for
// the same query while its full search is still running is ignored instead of
// sending a second request. Typing something else still supersedes it.
const inFlight = new WeakMap(); // session -> normalised query being submitted

/**
 * Decides what the hero search does with a submitted ("full" mode) query.
 *
 * - "superseded": a newer search replaced this one, or the same query is
 *                 already being submitted; do nothing.
 * - "error":      the request failed (reason says how); not the same as no match.
 * - "empty":      no valid results; `degraded` is true when smart matching was
 *                 unavailable, so "nothing found" is not the whole story.
 * - "navigate":   open the first result: either it is the only result and the query
 *                 names it (not a partial hit such as a prefix), or the query is
 *                 exactly the name of the top result (and of no other).
 * - "show":       otherwise (broad queries, aliases, several non-exact matches)
 *                 display the results in backend rank order and let the user
 *                 choose, so AI-ranked results stay visible.
 */
export async function runSubmitSearch(session, query, { automatic = false } = {}) {
  const key = normalizeName(query);
  if (!automatic && key && inFlight.get(session) === key) return { action: "superseded", suggestions: [] };
  if (!automatic) inFlight.set(session, key);
  try {
    const response = await session.run(query, { mode: "full", ...(automatic ? { automatic: true } : {}) });
    if (!response) return { action: "superseded", suggestions: [] };
    if (response.success === false) return { action: "error", reason: response.error || "network", suggestions: [] };
    const suggestions = toSuggestions(response);
    if (suggestions.length === 0) return { action: "empty", degraded: response.meta?.ai?.fallback === true, suggestions };
    if ((suggestions.length === 1 && suggestions[0].recognized) || isExactTopMatch(query, suggestions)) return { action: "navigate", suggestions };
    return { action: "show", suggestions };
  } finally {
    if (!automatic && inFlight.get(session) === key) inFlight.delete(session);
  }
}

/**
 * What an explicit Search (the button or Enter) does right now.
 *
 * - "open":   a result is highlighted and is actually on screen for the current
 *             query, so open it (no new search).
 * - "submit": otherwise run a full search for what was typed. This includes
 *             results still loading, an empty list and a stale index.
 */
export function chooseExplicitAction({ isSearching, suggestions, activeIndex }) {
  const visible = !isSearching && suggestions.length > 0;
  if (visible && activeIndex >= 0 && activeIndex < suggestions.length) {
    return { action: "open", item: suggestions[activeIndex] };
  }
  return { action: "submit" };
}
