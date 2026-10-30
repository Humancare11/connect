import test from "node:test";
import assert from "node:assert/strict";
import {
  createCurrencyLoader,
  readCachedCurrency,
  CURRENCY_CACHE_KEY,
  RETRY_DELAYS_MS,
  BACKGROUND_RETRY_MS,
} from "./currencyLoader.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setImmediate(r));

// A sessionStorage that works (or throws, like a blocked one).
const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};
const brokenStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
const tooMany = (retryAfter) => Object.assign(new Error("429"), { response: { status: 429, headers: retryAfter === undefined ? {} : { "retry-after": String(retryAfter) } } });

// Wait that records the delay and resolves at once, so retries run instantly.
const recordingWait = () => {
  const delays = [];
  return { delays, wait: (ms) => { delays.push(ms); return Promise.resolve(); } };
};

function setup(responses, opts = {}) {
  const seen = [];
  let i = 0;
  const loader = createCurrencyLoader({
    fetchCurrency: () => {
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      if (next instanceof Error) return Promise.reject(next);
      return next && next.promise ? next.promise : Promise.resolve(next);
    },
    onChange: (s) => seen.push(s),
    warn: () => {},
    ...opts,
  });
  return { loader, seen, calls: () => i };
}

test("starts loading (a skeleton), then shows the server currency", async () => {
  const a = deferred();
  const { loader, seen } = setup([a]);
  assert.equal(loader.getState().loading, true);
  loader.load();
  a.resolve({ currency: "EUR", source: "profile" });
  await flush();
  assert.deepEqual(loader.getState(), { currency: "EUR", loading: false, source: "profile" });
  assert.equal(seen.at(-1).currency, "EUR");
});

test("INR from the server is kept (the server only says INR when rupees are active)", async () => {
  const { loader } = setup([{ currency: "INR", country: "IN", source: "ip" }]);
  await loader.load();
  assert.equal(loader.getState().currency, "INR");
});

test("an unsupported or missing currency in a successful answer is USD", async () => {
  for (const data of [{ currency: "JPY" }, {}, null, { currency: "" }]) {
    const { loader } = setup([data]);
    await loader.load();
    assert.equal(loader.getState().currency, "USD", JSON.stringify(data));
    assert.equal(loader.getState().loading, false);
  }
});

// ── Failures are retried; the visitor never sees a wrong currency meanwhile ─────────────────────────────────────────────
test("a 429 is retried (honouring Retry-After, capped) and the answer is INR - never USD in between", async () => {
  const { delays, wait } = recordingWait();
  const { loader, seen, calls } = setup([tooMany(2), tooMany(), { currency: "INR", country: "IN", source: "ip" }], { wait });
  await loader.load();
  assert.equal(calls(), 3);
  assert.deepEqual(delays, [2000, RETRY_DELAYS_MS[1]], "Retry-After 2s, then the backoff step");
  assert.equal(loader.getState().currency, "INR");
  assert.ok(seen.every((s) => s.loading || s.currency === "INR"), "every state is either loading (skeleton) or the right currency");
  assert.equal(seen.some((s) => !s.loading && s.currency === "USD"), false, "USD was never shown");
});

test("Retry-After is capped at ten seconds", async () => {
  const { delays, wait } = recordingWait();
  const { loader } = setup([tooMany(120), { currency: "EUR", source: "ip" }], { wait });
  await loader.load();
  assert.deepEqual(delays, [10000]);
});

test("network errors and 5xx are retried with growing delays", async () => {
  const { delays, wait } = recordingWait();
  const { loader, calls } = setup([new Error("network"), Object.assign(new Error("503"), { response: { status: 503, headers: {} } }), new Error("network"), { currency: "GBP", source: "ip" }], { wait });
  await loader.load();
  assert.equal(calls(), 4);
  assert.deepEqual(delays, RETRY_DELAYS_MS.slice(0, 3));
  assert.equal(loader.getState().currency, "GBP");
});

test("while retrying the state stays loading (skeleton), so no price is shown in a guessed currency", async () => {
  const gate = deferred();
  const states = [];
  const loader = createCurrencyLoader({
    fetchCurrency: () => Promise.reject(new Error("down")),
    onChange: (s) => states.push(s),
    wait: () => gate.promise,
    warn: () => {},
  });
  loader.load();
  await flush();
  await flush();
  assert.equal(loader.getState().loading, true);
  assert.equal(states.some((s) => !s.loading), false);
  loader.dispose();
  gate.resolve();
});

test("after every retry has failed: the last known currency (or USD) with source error, a warning, and it keeps trying until the server answers", async () => {
  const { delays, wait } = recordingWait();
  const warnings = [];
  const failures = Array.from({ length: RETRY_DELAYS_MS.length + 1 }, () => new Error("down"));
  const { loader, calls } = setup([...failures, new Error("down"), { currency: "INR", country: "IN", source: "ip" }], {
    wait,
    warn: (m) => warnings.push(m),
  });
  await loader.load();
  assert.equal(calls(), RETRY_DELAYS_MS.length + 3, "5 tries, one background try that fails, one that succeeds");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /could not load/);
  assert.deepEqual(delays.slice(-2), [BACKGROUND_RETRY_MS, BACKGROUND_RETRY_MS]);
  assert.equal(loader.getState().currency, "INR", "switched to the right one as soon as the server answered");
});

test("when the server stays down the visitor sees USD marked as an error (not a stuck skeleton), and background retries stop eventually", async () => {
  const { wait } = recordingWait();
  const seen = [];
  const loader = createCurrencyLoader({ fetchCurrency: () => Promise.reject(new Error("down")), onChange: (s) => seen.push(s), wait, maxBackgroundRetries: 3, warn: () => {} });
  await loader.load();
  assert.deepEqual(loader.getState(), { currency: "USD", loading: false, source: "error" });
});

test("a failure after an earlier real answer keeps that currency, never USD", async () => {
  const { wait } = recordingWait();
  let n = 0;
  const loader = createCurrencyLoader({
    fetchCurrency: () => (n++ === 0 ? Promise.resolve({ currency: "INR", source: "ip" }) : Promise.reject(new Error("down"))),
    onChange: () => {},
    wait,
    maxBackgroundRetries: 1,
    warn: () => {},
  });
  await loader.load();
  assert.equal(loader.getState().currency, "INR");
  await loader.load(); // asked again (no storage here), and the server is down
  assert.deepEqual(loader.getState(), { currency: "INR", loading: false, source: "error" });
});

// ── The session remembers the answer ───────────────────────────────────────────────────────────────────────────────────
test("the answer is remembered for the session: the next page load asks nothing and shows it at once", async () => {
  const storage = memoryStorage();
  const first = setup([{ currency: "INR", country: "IN", source: "ip" }], { storage, identity: "|" });
  await first.loader.load();
  assert.equal(JSON.parse(storage.data[CURRENCY_CACHE_KEY]).currency, "INR");

  // a new page (new loader, same session) while the server would now fail with 429
  const second = setup([tooMany(60)], { storage, identity: "|" });
  await second.loader.load();
  assert.equal(second.calls(), 0, "no request at all");
  assert.deepEqual(second.loader.getState(), { currency: "INR", loading: false, source: "ip" });
});

test("another visitor identity (login, logout, a changed profile country) asks the server again and replaces the remembered answer", async () => {
  const storage = memoryStorage();
  await setup([{ currency: "INR", source: "ip" }], { storage, identity: "|" }).loader.load();
  const login = setup([{ currency: "EUR", source: "profile" }], { storage, identity: "u1|Germany" });
  await login.loader.load();
  assert.equal(login.calls(), 1);
  assert.equal(login.loader.getState().currency, "EUR");
  // back to logged out in the same session: the logged-out answer is asked again (the remembered one is the German user's)
  const logout = setup([{ currency: "INR", source: "ip" }], { storage, identity: "|" });
  await logout.loader.load();
  assert.equal(logout.calls(), 1);
  assert.equal(logout.loader.getState().currency, "INR");
  assert.equal(readCachedCurrency(storage, "|").currency, "INR");
  assert.equal(readCachedCurrency(storage, "u1|Germany"), null);
});

test("a server 'default' answer (location unknown) is shown but not remembered", async () => {
  const storage = memoryStorage();
  const { loader } = setup([{ currency: "USD", country: "", source: "default" }], { storage, identity: "|" });
  await loader.load();
  assert.equal(loader.getState().currency, "USD");
  assert.equal(CURRENCY_CACHE_KEY in storage.data, false);
});

test("blocked or broken storage, and a corrupt remembered value, are ignored", async () => {
  const a = setup([{ currency: "EUR", source: "ip" }], { storage: brokenStorage, identity: "|" });
  await a.loader.load();
  assert.equal(a.loader.getState().currency, "EUR");
  for (const raw of ["not json", "null", JSON.stringify({ identity: "|", currency: "JPY", source: "ip" }), JSON.stringify({ identity: "|", currency: "EUR", source: "default" }), JSON.stringify({ identity: "other", currency: "EUR", source: "ip" })]) {
    const storage = memoryStorage({ [CURRENCY_CACHE_KEY]: raw });
    const b = setup([{ currency: "GBP", source: "ip" }], { storage, identity: "|" });
    await b.loader.load();
    assert.equal(b.calls(), 1, raw);
    assert.equal(b.loader.getState().currency, "GBP", raw);
  }
  assert.equal(readCachedCurrency(null, "|"), null);
});

// ── Reloads and stale answers ──────────────────────────────────────────────────────────────────────────────────────────
test("login and logout reload: no wrong-currency flash while the new currency is loading", async () => {
  const anon = deferred(), loggedIn = deferred(), loggedOut = deferred();
  const { loader, seen, calls } = setup([anon, loggedIn, loggedOut]);
  loader.load();
  anon.resolve({ currency: "USD", source: "ip" });
  await flush();
  assert.equal(loader.getState().currency, "USD");

  loader.load(); // the visitor logs in (German profile)
  assert.equal(loader.getState().loading, true, "loading again: consumers show a skeleton");
  assert.equal(calls(), 2);
  loggedIn.resolve({ currency: "EUR", source: "profile" });
  await flush();
  assert.equal(loader.getState().currency, "EUR");

  loader.load(); // logs out
  loggedOut.resolve({ currency: "USD", source: "ip" });
  await flush();
  assert.equal(loader.getState().currency, "USD");
  assert.ok(seen.some((s) => s.loading));
});

test("an answer that arrives after a newer load was started is ignored", async () => {
  const slow = deferred(), fast = deferred();
  const { loader } = setup([slow, fast]);
  loader.load();
  loader.load();
  fast.resolve({ currency: "GBP", source: "ip" });
  await flush();
  slow.resolve({ currency: "EUR", source: "ip" });
  await flush();
  assert.equal(loader.getState().currency, "GBP");
});

test("a retry that was waiting when a newer load started does nothing", async () => {
  const gate = deferred();
  let calls = 0;
  const loader = createCurrencyLoader({
    fetchCurrency: () => { calls += 1; return calls === 1 ? Promise.reject(new Error("down")) : Promise.resolve({ currency: "EUR", source: "ip" }); },
    onChange: () => {},
    wait: () => gate.promise,
    warn: () => {},
  });
  loader.load(); // fails, now waiting to retry
  await flush();
  await loader.load(); // a newer load answers EUR
  assert.equal(loader.getState().currency, "EUR");
  gate.resolve(); // the old retry wakes up: it must not ask again or change anything
  await flush();
  await flush();
  assert.equal(calls, 2);
  assert.equal(loader.getState().currency, "EUR");
});

test("after dispose nothing is reported", async () => {
  const a = deferred();
  const { loader, seen } = setup([a]);
  loader.load();
  const before = seen.length;
  loader.dispose();
  a.resolve({ currency: "EUR", source: "ip" });
  await flush();
  assert.equal(seen.length, before);
});
