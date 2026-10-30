// Loads the visitor's currency from the server and reloads it when the login state changes. Pure (no React): the provider
// in context/CurrencyContext.jsx wires it to the page, and the tests drive it with a fake fetch.
//
// One visitor must always see ONE currency, so:
//   - A resolved currency is remembered for the session (sessionStorage, keyed by who the visitor is), and every later page load
//     and every other component uses it without asking the server again. A different person / profile country asks again.
//   - A failed request (network error, 5xx, 429 "too many requests") is retried with backoff, honouring Retry-After. While it is
//     being retried `loading` stays true, so price slots show a skeleton - never "$" first and then "₹".
//   - Only when every retry has failed (the API is really down) does the visitor see the last known currency, or USD if there is
//     none, marked source "error"; it keeps retrying in the background and switches to the right one as soon as the server answers.
//   - An answer that arrives after a newer load was started (login, then logout, quickly) is ignored.
import { DEFAULT_CURRENCY, normalizeCurrency, SUPPORTED_CURRENCIES } from "./currencyDisplay.js";

export const CURRENCY_CACHE_KEY = "hc:currency:v1";
// Delays before retry 1..4 (so five tries in about nine seconds), then one try every BACKGROUND_RETRY_MS while the page stays open.
export const RETRY_DELAYS_MS = [400, 1000, 2500, 5000];
export const BACKGROUND_RETRY_MS = 20000;
export const MAX_BACKGROUND_RETRIES = 30;
const MAX_RETRY_AFTER_MS = 10000;

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only an answer that says who/where the visitor really is is remembered. "default" means the server could not place the visitor
// (no location data yet), which may change on the next request, so it is shown but not kept.
const CACHEABLE_SOURCES = new Set(["profile", "ip"]);

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
    try {
      return await Promise.resolve(fetchCurrency());
    } catch (err) {
      throw err || new Error("currency request failed");
    }
  };

  function accept(data) {
    const result = { currency: normalizeCurrency(data?.currency), source: String(data?.source || "") };
    lastGood = result;
    if (CACHEABLE_SOURCES.has(result.source)) writeCachedCurrency(storage, identity, result);
    set({ ...result, loading: false });
  }

  async function load() {
    const mine = ++sequence;

    const cached = readCachedCurrency(storage, identity);
    if (cached) {
      lastGood = cached;
      set({ ...cached, loading: false });
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
    getState: () => state,
    dispose() {
      disposed = true;
      sequence += 1;
    },
  };
}
