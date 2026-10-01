import axios from "axios";

// Client for the backend Healthcare Discovery Search (POST /api/search).
//
// Used by the hero search in pages/Home.jsx. The backend owns matching,
// ranking, result ids and navigation paths; mode "full" may additionally use
// server-side AI query understanding. The browser never talks to any AI
// provider and never sees how a result was found.
//
// Search is public, so this client deliberately uses its own axios instance
// (none of the auth interceptors from ../api): no Authorization header and no
// cookies are sent - `credentials: "omit"` also covers a same-origin API,
// where XHR would attach cookies regardless of withCredentials. Search
// requests are never tied to the user's identity; only { q, mode, types }
// leave the browser.
const searchClient = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || "",
  withCredentials: false,
  timeout: 8000,
  adapter: "fetch",
  fetchOptions: { credentials: "omit" },
});

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_GROUPS = ["categories", "specialties", "conditions", "services", "doctors", "blogs"];

const emptyResponse = (mode) => ({
  success: true,
  query: { normalized: "" },
  results: Object.fromEntries(SEARCH_GROUPS.map((group) => [group, []])),
  meta: { total: 0, mode },
});

const cleanQuery = (query) => String(query ?? "").replace(/\s+/g, " ").trim();

/**
 * Runs a backend search.
 * @param {string} query - raw user input
 * @param {{ mode?: "instant" | "full", types?: string[], signal?: AbortSignal }} [options]
 * @returns {Promise<object>} the /api/search response body
 */
export async function searchHealthcare(query, { mode = "instant", types, signal } = {}) {
  const q = cleanQuery(query);
  // Mirrors the backend's validation so obviously invalid input never
  // leaves the browser.
  if (q.length < SEARCH_MIN_LENGTH) return emptyResponse(mode);
  const body = { q: q.slice(0, SEARCH_MAX_LENGTH), mode };
  if (Array.isArray(types) && types.length) body.types = types;
  const response = await searchClient.post("/api/search", body, { signal });
  return response.data;
}

// Only same-site paths built by the backend are ever navigated to.
const safePath = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/\s/.test(value) ? value : null;

/**
 * Flattens a response into dropdown suggestions shaped like the legacy
 * searchIndex items ({ id, type, title, route }), keeping the backend's
 * group order and ranking. `route` always comes from the backend; items
 * without a safe same-site path are dropped.
 */
export function toSuggestions(response) {
  const results = response?.results || {};
  return SEARCH_GROUPS.flatMap((group) =>
    (results[group] || []).map((item) => ({
      id: `${item.type}:${item.id}`,
      type: item.type,
      title: item.title,
      description: item.description || "",
      route: safePath(item.navigation?.path),
      specialty: item.metadata?.specialtyName,
      category: item.metadata?.categoryName,
    })),
  ).filter((item) => item.title && item.route);
}

const INSTANT_CACHE_MAX = 30;
const INSTANT_CACHE_TTL_MS = 60 * 1000;

/**
 * One search box = one session.
 *
 * - run() aborts the previous request and resolves to `null` when it has been
 *   superseded (by a newer run() or cancel()), so an older response can never
 *   overwrite newer results.
 * - Failures (400, 429, 503, network, timeout) resolve to an empty response
 *   with success:false instead of throwing, so the page never crashes.
 * - Recent "instant" responses are reused for a minute (e.g. when the user
 *   deletes characters), which keeps request volume under the rate limit.
 */
export function createSearchSession({ search = searchHealthcare, now = () => Date.now() } = {}) {
  let latestId = 0;
  let controller = null;
  const cache = new Map();

  function cancel() {
    latestId += 1;
    if (controller) controller.abort();
    controller = null;
  }

  async function run(query, { mode = "instant", types } = {}) {
    cancel();
    const id = latestId;
    const key = `${mode}|${(types || []).join(",")}|${cleanQuery(query).toLowerCase()}`;
    const cached = mode === "instant" ? cache.get(key) : null;
    if (cached && cached.expiresAt > now()) return cached.response;

    const current = new AbortController();
    controller = current;
    try {
      const response = await search(query, { mode, types, signal: current.signal });
      if (id !== latestId) return null;
      if (mode === "instant") {
        if (cache.size >= INSTANT_CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, { response, expiresAt: now() + INSTANT_CACHE_TTL_MS });
      }
      return response;
    } catch {
      if (id !== latestId || current.signal.aborted) return null;
      return { ...emptyResponse(mode), success: false };
    } finally {
      if (controller === current) controller = null;
    }
  }

  return { run, cancel };
}
