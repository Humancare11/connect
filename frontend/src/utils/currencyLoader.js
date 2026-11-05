// Loads the visitor's currency from the server and reloads it when the login state changes. Pure (no React): the provider
// in context/CurrencyContext.jsx wires it to the page, and the tests drive it with a fake fetch.
//
// One visitor must always see ONE currency, so:
//   - A resolved currency is remembered for the session (sessionStorage) and shown at once on every later page load, so no page waits
//     or flashes. It is re-checked with the server in the background on each page load: if the server now says something else (rupees
//     were switched on, the visitor travelled or switched network) the whole page follows it, once. A failed re-check changes nothing.
//     Only an answer that placed the visitor by IP is remembered; the currency does not depend on who is logged in.
//   - A failed request (network error, 5xx, 429 "too many requests") is retried with backoff, honouring Retry-After. While it is
//     being retried `loading` stays true, so price slots show a skeleton - never "$" first and then "₹".
//   - Only when every retry has failed (the API is really down) does the visitor see the last known currency, or USD if there is
//     none, marked source "error"; it keeps retrying in the background and switches to the right one as soon as the server answers.
//   - An answer that arrives after a newer load was started (login, then logout, quickly) is ignored.
//   - The visitor's IP can change while a tab stays open (a VPN, a phone moving between networks). recheck() asks the server again
//     during the session - on a route change and when the tab becomes visible (throttled, see RECHECK_MIN_INTERVAL_MS), and without
//     the throttle right before a payment is created. If the currency changed the whole page follows it and onCurrencyChanged is
//     told once; a failed re-check changes nothing.
import { DEFAULT_CURRENCY, normalizeCurrency, SUPPORTED_CURRENCIES } from "./currencyDisplay.js";

export const CURRENCY_CACHE_KEY = "hc:currency:v2"; // v2: the currency follows the IP only (v1 entries could hold a profile-country answer)
// Delays before retry 1..4 (so five tries in about nine seconds), then one try every BACKGROUND_RETRY_MS while the page stays open.
export const RETRY_DELAYS_MS = [400, 1000, 2500, 5000];
export const BACKGROUND_RETRY_MS = 20000;
export const MAX_BACKGROUND_RETRIES = 30;
const MAX_RETRY_AFTER_MS = 10000;
// A re-check during the session (route change, tab visible again) is made at most this often. The payment step bypasses it.
export const RECHECK_MIN_INTERVAL_MS = 20000;

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only an answer that says who/where the visitor really is is remembered. "default" means the server could not place the visitor
// (no location data yet), which may change on the next request, so it is shown but not kept.
const CACHEABLE_SOURCES = new Set(["ip"]);

export function readCachedCurrency(storage, identity) {
  try {
    const raw = storage?.getItem(CURRENCY_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.identity !== identity) return null;
    if (!SUPPORTED_CURRENCIES.includes(data.currency) || !CACHEABLE_SOURCES.has(data.source)) return null;
    return { currency: data.currency, source: data.source };
  } catch {
    return null;
  }
}

function writeCachedCurrency(storage, identity, { currency, source }) {
  try {
    storage?.setItem(CURRENCY_CACHE_KEY, JSON.stringify({ identity, currency, source, at: Date.now() }));
  } catch {
    // private window / blocked storage: the currency is simply asked for again next time
  }
}

// How long to wait before the next try: the server's Retry-After (seconds) when it sent one, else the backoff step.
function delayFor(error, fallbackMs) {
  const seconds = Number(error?.response?.headers?.["retry-after"]);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return fallbackMs;
}

export function createCurrencyLoader({
  fetchCurrency,
  onChange,
  storage = null,
  identity = "",
  wait = defaultWait,
  delays = RETRY_DELAYS_MS,
  backgroundMs = BACKGROUND_RETRY_MS,
  maxBackgroundRetries = MAX_BACKGROUND_RETRIES,
  warn = (...args) => console.warn(...args),
  now = () => Date.now(),
  recheckMinMs = RECHECK_MIN_INTERVAL_MS,
  onCurrencyChanged = () => {},
}) {
  let sequence = 0;
  let disposed = false;
  let state = { currency: DEFAULT_CURRENCY, loading: true, source: "" };
  let lastGood = null; // the last real answer of this loader

  const set = (next) => {
    state = next;
    if (!disposed) onChange(state);
  };

  const ask = async () => {
    let data;
    try {
      data = await Promise.resolve(fetchCurrency());
    } catch (err) {
      throw err || new Error("currency request failed");
    }
    // The server answers source "error" when its own location lookup failed: that is not an answer about this visitor, so it is
    // retried like a failed request instead of being shown (and instead of being remembered).
    if (data?.source === "error") throw new Error("the server could not place the visitor");
    return data;
  };

  function accept(data) {
    const result = { currency: normalizeCurrency(data?.currency), source: String(data?.source || "") };
    lastGood = result;
    if (CACHEABLE_SOURCES.has(result.source)) writeCachedCurrency(storage, identity, result);
    set({ ...result, loading: false });
  }

  let lastRecheckAt = 0;
  let recheckInFlight = null;

  // Ask the server again where the visitor is now. Resolves { changed, currency, ok, skipped }; it never rejects and never touches the
  // state unless the server gave a real, different answer. `force` skips the throttle (used right before a payment is created).
  function recheck({ force = false } = {}) {
    const unchanged = (extra = {}) => ({ changed: false, currency: state.currency, ok: false, skipped: false, ...extra });
    if (disposed) return Promise.resolve(unchanged({ skipped: true }));
    // The first load is still deciding the currency: its answer is the fresh one.
    if (state.loading) return Promise.resolve(unchanged({ skipped: true }));
    if (recheckInFlight) return recheckInFlight;
    if (!force && lastRecheckAt && now() - lastRecheckAt < recheckMinMs) return Promise.resolve(unchanged({ skipped: true }));
    lastRecheckAt = now();
    const mine = sequence;
    recheckInFlight = (async () => {
      try {
        let data;
        try {
          data = await ask();
        } catch {
          return unchanged(); // the re-check failed (429, network, 5xx): keep what the session shows
        }
        if (disposed || mine !== sequence) return unchanged({ skipped: true });
        const fresh = { currency: normalizeCurrency(data?.currency), source: String(data?.source || "") };
        // Whatever the server answers is what it will charge in right now, so the screen follows it - also "default" (it could not
        // place this IP, e.g. a VPN address missing from the GeoIP data, so it prices in USD). Only a real IP answer is remembered.
        // (A request that FAILED never gets here, and the server's own "error" answer is thrown by ask(): those change nothing.)
        if (fresh.currency === state.currency) {
          if (CACHEABLE_SOURCES.has(fresh.source)) {
            writeCachedCurrency(storage, identity, fresh);
            if (state.source !== fresh.source) set({ ...fresh, loading: false });
          }
          return unchanged({ ok: true });
        }
        const from = state.currency;
        accept(data);
        try {
          onCurrencyChanged({ from, to: fresh.currency });
        } catch {
          // a notice that fails to show must not undo the new currency
        }
        return { changed: true, currency: fresh.currency, ok: true, skipped: false };
      } finally {
        recheckInFlight = null;
      }
    })();
    return recheckInFlight;
  }

  async function load() {
    const mine = ++sequence;
    lastRecheckAt = now(); // asking now counts as a check: a route change a moment after the page loaded does not ask again

    const cached = readCachedCurrency(storage, identity);
    if (cached) {
      lastGood = cached;
      set({ ...cached, loading: false });
      try {
        const data = await ask();
        if (mine !== sequence) return;
        const fresh = { currency: normalizeCurrency(data?.currency), source: String(data?.source || "") };
        // "default" (the server could not place the visitor this time) is never allowed to overrule a real answer
        if (CACHEABLE_SOURCES.has(fresh.source) && (fresh.currency !== cached.currency || fresh.source !== cached.source)) accept(data);
        else if (CACHEABLE_SOURCES.has(fresh.source)) writeCachedCurrency(storage, identity, fresh);
      } catch {
        // the re-check failed (429, network): keep what the session already shows
      }
      return;
    }

    set({ ...state, loading: true });

    let lastError = null;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      if (attempt > 0) await wait(delayFor(lastError, delays[attempt - 1]));
      if (mine !== sequence) return;
      try {
        const data = await ask();
        if (mine !== sequence) return;
        accept(data);
        return;
      } catch (err) {
        if (mine !== sequence) return;
        lastError = err;
      }
    }

    // Every try failed. Show what we last knew (or USD), say so, and keep trying quietly.
    warn(`[currency] could not load the visitor's currency after ${delays.length + 1} tries; showing ${lastGood?.currency || DEFAULT_CURRENCY} until it can`);
    set({ currency: lastGood?.currency || DEFAULT_CURRENCY, loading: false, source: "error" });

    for (let retry = 0; retry < maxBackgroundRetries; retry += 1) {
      await wait(delayFor(lastError, backgroundMs));
      if (mine !== sequence) return;
      try {
        const data = await ask();
        if (mine !== sequence) return;
        accept(data);
        return;
      } catch (err) {
        if (mine !== sequence) return;
        lastError = err;
      }
    }
  }

  return {
    load,
    recheck,
    getState: () => state,
    dispose() {
      disposed = true;
      sequence += 1;
    },
  };
}
