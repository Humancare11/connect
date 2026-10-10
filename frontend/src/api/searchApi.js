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
// leave the browser - plus, for "full" submissions and the separate settle
// call, a random in-memory interaction id (see createSearchSession). The
// id is not an account, session or device identifier and is never stored.
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

// ── Search analytics: interaction ids (memory only) ──────────────────────────
// One "interaction" is one search episode (typing, pausing, then submitting or
// picking a suggestion). Its id is a random UUID v4 generated here and held
// only inside a search session object: never written to localStorage,
// sessionStorage, cookies, URLs or any other client state, so it cannot link
// one visit to the next. The backend only records anything when analytics is
// enabled server-side; the client behaves the same either way.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * A lowercase UUID v4, or null when the browser has no secure random source
 * (analytics is then simply skipped for that interaction).
 */
export function newInteractionId() {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    // crypto.randomUUID only exists in secure contexts; getRandomValues does not.
    if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch {
    // fall through
  }
  return null;
}
const validInteractionId = (id) => typeof id === "string" && UUID_V4.test(id);

export const SETTLE_REASONS = ["idle", "select"];

/**
 * Runs a backend search.
 * @param {string} query - raw user input
 * @param {{ mode?: "instant" | "full", types?: string[], signal?: AbortSignal, interactionId?: string, client?: object }} [options]
 *   interactionId is sent only with "full" requests (instant requests carry no
 *   analytics data); `client` is for tests.
 * @returns {Promise<object>} the /api/search response body
 */
export async function searchHealthcare(query, { mode = "instant", types, signal, interactionId, client = searchClient } = {}) {
  const q = cleanQuery(query);
  // Mirrors the backend's validation so obviously invalid input never
  // leaves the browser.
  if (q.length < SEARCH_MIN_LENGTH) return emptyResponse(mode);
  const body = { q: q.slice(0, SEARCH_MAX_LENGTH), mode };
  if (Array.isArray(types) && types.length) body.types = types;
  if (mode === "full" && validInteractionId(interactionId)) body.interactionId = interactionId;
  const response = await client.post("/api/search", body, { signal });
  return response.data;
}

/**
 * Tells the backend a search "settled" without Enter (POST /api/search/settle).
 * Body is exactly { interactionId, q, reason }; the server recomputes
 * everything else. Fire-and-forget: it never throws or rejects, logs nothing,
 * and resolves to one of "sent" (204), "rate_limited" (429), "failed"
 * (400 / network / timeout / anything else) or "skipped" (invalid input, no
 * request made). It is never retried.
 */
export async function settleSearch({ interactionId, q, reason } = {}, { client = searchClient } = {}) {
  const text = cleanQuery(q).slice(0, SEARCH_MAX_LENGTH);
  if (!validInteractionId(interactionId) || !SETTLE_REASONS.includes(reason) || text.length < SEARCH_MIN_LENGTH) {
    return "skipped";
  }
  try {
    // keepalive lets a "select" request finish even as the page navigates.
    await client.post(
      "/api/search/settle",
      { interactionId, q: text, reason },
      { timeout: 5000, fetchOptions: { credentials: "omit", keepalive: true } },
    );
    return "sent";
  } catch (err) {
    return err?.response?.status === 429 ? "rate_limited" : "failed";
  }
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

// Search analytics timings (see createSearchSession).
export const SEARCH_IDLE_SETTLE_MS = 1500;
export const SEARCH_IDLE_SETTLE_MIN_LENGTH = 3;
export const SEARCH_EPISODE_INACTIVITY_MS = 30 * 60 * 1000;
const SETTLE_BACKOFF_MS = 60 * 1000;

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
 *
 * Search analytics (all in memory, all best-effort, none of it visible):
 * the session tracks one interaction "episode" and tells the backend when a
 * search settles. Instant requests carry no analytics data.
 *
 * - The id is created lazily on the first query of an episode and reused for
 *   every request of that episode (including a repeated Enter on the same text).
 * - It rotates (a new id on the next query) when: the box is cleared or the
 *   query gets too short (reset()); the user types a new query after a full
 *   submission; the query changes to something that neither extends nor
 *   shortens the previous one; a suggestion is selected (select()); or 30
 *   minutes pass without input.
 * - Idle settle: 1500 ms after instant results for a query of 3+ characters
 *   are shown, if nothing else happened, a "settle" with reason "idle" is sent
 *   (once per distinct query). Any new input, submit, selection, reset or
 *   unmount cancels the timer; a timer that fires for an outdated query sends
 *   nothing.
 * - select(): the user picked a shown suggestion (click, or Enter on a
 *   highlighted one). Sends reason "select" for the query that produced the
 *   shown suggestions, then ends the episode.
 * - Full submissions send the id inside the normal /api/search request.
 * - Settle failures (400, 429, network, timeout) are swallowed; after a 429
 *   settle calls pause for a minute. Nothing is retried.
 */
export function createSearchSession({
  search = searchHealthcare,
  now = () => Date.now(),
  settle = settleSearch,
  newId = newInteractionId,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
} = {}) {
  let latestId = 0;
  let controller = null;
  const cache = new Map();

  // Interaction episode: { id, lastQuery, lastInputAt, submittedQuery, shownQuery, settledQuery }
  let episode = null;
  let idleTimer = null;
  let settleBlockedUntil = 0;

  const normalize = (query) => cleanQuery(query).toLowerCase();

  function stopIdle() {
    if (idleTimer !== null) clearTimer(idleTimer);
    idleTimer = null;
  }

  function endEpisode() {
    stopIdle();
    episode = null;
  }

  // Registers input `q` (normalised) and returns the episode it belongs to,
  // starting a new one (new id) when the rotation rules say so.
  function touch(q) {
    const at = now();
    if (episode) {
      const related = q.startsWith(episode.lastQuery) || episode.lastQuery.startsWith(q);
      const expired = at - episode.lastInputAt >= SEARCH_EPISODE_INACTIVITY_MS;
      const newQueryAfterSubmit = episode.submittedQuery !== null && q !== episode.submittedQuery;
      if (expired || newQueryAfterSubmit || !related) episode = null;
    }
    if (!episode) {
      const id = newId();
      episode = {
        id: validInteractionId(id) ? id : null,
        lastQuery: q,
        lastInputAt: at,
        submittedQuery: null,
        shownQuery: null,
        settledQuery: null,
      };
    } else {
      episode.lastQuery = q;
      episode.lastInputAt = at;
    }
    return episode;
  }

  function sendSettle(interactionId, q, reason) {
    if (now() < settleBlockedUntil) return;
    try {
      Promise.resolve(settle({ interactionId, q, reason })).then(
        (result) => {
          if (result === "rate_limited") settleBlockedUntil = now() + SETTLE_BACKOFF_MS;
        },
        () => {},
      );
    } catch {
      // Analytics must never affect search.
    }
  }

  function scheduleIdleSettle(ep, q, runId) {
    stopIdle();
    if (!ep.id || q.length < SEARCH_IDLE_SETTLE_MIN_LENGTH || ep.settledQuery === q) return;
    idleTimer = setTimer(() => {
      idleTimer = null;
      // Outdated? Another request, reset, selection or submit happened since.
      if (episode !== ep || runId !== latestId || ep.lastQuery !== q || ep.submittedQuery !== null) return;
      ep.settledQuery = q;
      sendSettle(ep.id, q, "idle");
    }, SEARCH_IDLE_SETTLE_MS);
  }

  function cancel() {
    latestId += 1;
    if (controller) controller.abort();
    controller = null;
  }

  // Cancels any request AND ends the interaction episode (box cleared or
  // query too short, page unmounted).
  function reset() {
    cancel();
    endEpisode();
  }

  // The user picked a suggestion that is on screen. Never throws.
  function select() {
    try {
      const ep = episode;
      if (ep && ep.id && ep.shownQuery && ep.submittedQuery === null) {
        sendSettle(ep.id, ep.shownQuery, "select");
      }
    } catch {
      // Analytics must never affect selection.
    }
    endEpisode();
  }

  async function run(query, { mode = "instant", types } = {}) {
    cancel();
    stopIdle(); // any new request means the user is not idle
    const id = latestId;
    const q = normalize(query);
    let ep = null;
    if (q.length >= SEARCH_MIN_LENGTH) {
      try {
        ep = touch(q);
        if (mode === "full") ep.submittedQuery = q;
      } catch {
        ep = null;
      }
    }
    const key = `${mode}|${(types || []).join(",")}|${q}`;
    const cached = mode === "instant" ? cache.get(key) : null;
    if (cached && cached.expiresAt > now()) {
      if (ep && cached.response?.success !== false) {
        ep.shownQuery = q;
        scheduleIdleSettle(ep, q, id);
      }
      return cached.response;
    }

    const current = new AbortController();
    controller = current;
    try {
      const response = await search(query, {
        mode,
        types,
        signal: current.signal,
        ...(mode === "full" && ep && ep.id ? { interactionId: ep.id } : {}),
      });
      if (id !== latestId) return null;
      if (mode === "instant") {
        if (cache.size >= INSTANT_CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, { response, expiresAt: now() + INSTANT_CACHE_TTL_MS });
        if (ep && response?.success !== false) {
          ep.shownQuery = q;
          scheduleIdleSettle(ep, q, id);
        }
      }
      return response;
    } catch {
      if (id !== latestId || current.signal.aborted) return null;
      return { ...emptyResponse(mode), success: false };
    } finally {
      if (controller === current) controller = null;
    }
  }

  return { run, cancel, reset, select };
}
