import { toSuggestions } from "./searchApi.js";

/**
 * Decides what the hero search does with a submitted ("full" mode) query.
 *
 * - "superseded": a newer search replaced this one; do nothing.
 * - "empty":      no valid results; show the no-results state.
 * - "navigate":   exactly one valid result; open it directly.
 * - "show":       several results; display them (backend rank order) and let
 *                 the user choose, so AI-ranked results are visible.
 */
export async function runSubmitSearch(session, query) {
  const response = await session.run(query, { mode: "full" });
  if (!response) return { action: "superseded", suggestions: [] };
  const suggestions = toSuggestions(response);
  if (suggestions.length === 0) return { action: "empty", suggestions };
  if (suggestions.length === 1) return { action: "navigate", suggestions };
  return { action: "show", suggestions };
}
