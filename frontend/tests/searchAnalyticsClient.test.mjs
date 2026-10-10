// Phase 3: the hero search's analytics lifecycle on the client (interaction
// ids, idle settle, selection settle, full submission). Run from frontend/:
//   node --test tests/searchAnalyticsClient.test.mjs
// Everything is injected (fake clock, fake timers, fake network) or hits a
// stub server on 127.0.0.1 only: no backend, no analytics, no real network.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";

import {
  createSearchSession,
  searchHealthcare,
  settleSearch,
  newInteractionId,
  SEARCH_GROUPS,
  SEARCH_IDLE_SETTLE_MS,
  SEARCH_IDLE_SETTLE_MIN_LENGTH,
  SEARCH_EPISODE_INACTIVITY_MS,
} from "../src/api/searchApi.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ok = () => ({
  success: true,
  query: { normalized: "x" },
  results: Object.fromEntries(SEARCH_GROUPS.map((g) => [g, []])),
  meta: { total: 0, mode: "instant" },
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

// A session wired to a fake clock, fake timers, a fake search and a fake settle.
function harness({ search, settleResult = "sent", newId, settle } = {}) {
  let t = 0;
  let seq = 0;
  const timers = [];
  const searches = [];
  const settles = [];
  const session = createSearchSession({
    now: () => t,
    newId: newId || (() => uuid((seq += 1))),
    setTimer: (fn, ms) => { const handle = { fn, ms, cleared: false, fired: false }; timers.push(handle); return handle; },
    clearTimer: (handle) => { handle.cleared = true; },
    search: async (q, options) => { searches.push({ q, ...options }); return search ? search(q, options) : ok(); },
    settle: settle || (async (payload) => { settles.push(payload); return settleResult; }),
  });
  return {
    session, searches, settles, timers,
    advance: (ms) => { t += ms; },
    live: () => timers.filter((h) => !h.cleared && !h.fired),
    // Fires every timer that has not been cleared (what a real clock would do).
    fire: async () => { for (const h of timers) if (!h.cleared && !h.fired) { h.fired = true; h.fn(); } await tick(); },
    // Fires a timer even if it was cleared: proves a late callback is harmless.
    fireStale: async (h) => { h.fired = true; h.fn(); await tick(); },
  };
}

// ── Interaction id ────────────────────────────────────────────────────────
test("newInteractionId returns a lowercase UUID v4", () => {
  const ids = new Set(Array.from({ length: 50 }, () => newInteractionId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, UUID_V4);
});

test("newInteractionId falls back to getRandomValues (insecure contexts) and to null without crypto", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: (a) => { a.fill(0xab); return a; } },
    });
    assert.match(newInteractionId(), UUID_V4);
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
    assert.equal(newInteractionId(), null);
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID: () => { throw new Error("x"); } } });
    assert.equal(newInteractionId(), null);
  } finally {
    Object.defineProperty(globalThis, "crypto", original);
  }
});

test("the id is created lazily, in memory only, and instant requests never carry it", async () => {
  const h = harness();
  assert.equal(h.searches.length, 0);
  await h.session.run("diabetes", { mode: "instant" });
  assert.equal(h.searches.length, 1);
  assert.equal("interactionId" in h.searches[0], false);
  await h.fire();
  assert.equal(h.settles[0].interactionId, uuid(1));
});

// ── Reuse and rotation ────────────────────────────────────────────────────
test("one episode keeps one id while the user extends or shortens the query", async () => {
  const h = harness();
  for (const q of ["dia", "diab", "diabe", "diab", "diabetes"]) {
    await h.session.run(q, { mode: "instant" });
    await h.fire();
  }
  assert.deepEqual([...new Set(h.settles.map((s) => s.interactionId))], [uuid(1)]);
  assert.deepEqual(h.settles.map((s) => s.q), ["dia", "diab", "diabe", "diab", "diabetes"]);
});

test("a non-prefix change of query starts a new episode (new id)", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  await h.session.run("acne", { mode: "instant" });
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.interactionId), [uuid(1), uuid(2)]);
});

test("case and extra spaces do not count as a different query", async () => {
  const h = harness();
  await h.session.run("Knee  Pain", { mode: "instant" });
  await h.session.run("knee pain  ", { mode: "instant" });
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.interactionId), [uuid(1)]);
});

test("reset() (box cleared / too short / unmount) ends the episode", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  h.session.reset();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.interactionId), [uuid(1), uuid(2)]);
});

test("after 30 minutes without input the next query gets a new id", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  h.advance(SEARCH_EPISODE_INACTIVITY_MS - 1);
  await h.session.run("diabetes mellitus", { mode: "instant" });
  await h.fire();
  h.advance(SEARCH_EPISODE_INACTIVITY_MS); // exactly 30 minutes since the last input
  await h.session.run("diabetes mellitus", { mode: "instant" });
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.interactionId), [uuid(1), uuid(1), uuid(2)]);
});

test("a new query after a full submission rotates; repeating the submitted text does not", async () => {
  const h = harness();
  await h.session.run("acne", { mode: "instant" });
  await h.session.run("acne", { mode: "full" });
  await h.session.run("acne", { mode: "full" }); // double Enter: same interaction
  await h.session.run("acne", { mode: "instant" }); // same text again: not a new query
  await h.session.run("acne scars", { mode: "instant" }); // a new query after the submission
  await h.fire();
  const fulls = h.searches.filter((s) => s.mode === "full");
  assert.equal(fulls.length, 2);
  assert.equal(fulls[0].interactionId, uuid(1));
  assert.equal(fulls[1].interactionId, uuid(1));
  assert.equal(h.settles.at(-1).interactionId, uuid(2));
});

test("selecting a suggestion rotates the id for whatever comes next", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  h.session.select();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  assert.deepEqual(h.settles.map((s) => [s.interactionId, s.reason]), [[uuid(1), "select"], [uuid(2), "idle"]]);
});

// ── Idle settle ───────────────────────────────────────────────────────────
test("idle settle: 1500 ms after instant results for a query of 3+ characters", async () => {
  const h = harness();
  await h.session.run("ab", { mode: "instant" });
  assert.equal(h.live().length, 0); // 2 characters: not eligible
  await h.session.run("abc", { mode: "instant" });
  assert.equal(h.live().length, 1);
  assert.equal(h.live()[0].ms, SEARCH_IDLE_SETTLE_MS);
  assert.equal(SEARCH_IDLE_SETTLE_MS, 1500);
  assert.equal(SEARCH_IDLE_SETTLE_MIN_LENGTH, 3);
  assert.equal(h.settles.length, 0); // nothing before the timer
  await h.fire();
  assert.deepEqual(h.settles, [{ interactionId: uuid(1), q: "abc", reason: "idle" }]);
});

test("the timer starts only once the instant results are in", async () => {
  let release;
  const h = harness({ search: () => new Promise((resolve) => { release = () => resolve(ok()); }) });
  const pending = h.session.run("diabetes", { mode: "instant" });
  assert.equal(h.timers.length, 0);
  release();
  await pending;
  assert.equal(h.live().length, 1);
});

test("cached instant results also start the idle timer", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  await h.session.run("diabetes mellitus", { mode: "instant" });
  await h.fire();
  await h.session.run("diabetes", { mode: "instant" }); // served from the instant cache
  assert.equal(h.searches.length, 2);
  assert.equal(h.live().length, 1);
});

test("a query is settled once per episode; re-showing it does not repeat the request", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  await h.session.run("diabetes", { mode: "instant" });
  assert.equal(h.live().length, 0);
  await h.fire();
  assert.equal(h.settles.length, 1);
});

test("failed or superseded instant requests never start an idle timer", async () => {
  const failing = harness({ search: async () => { throw new Error("network"); } });
  const body = await failing.session.run("diabetes", { mode: "instant" });
  assert.equal(body.success, false);
  assert.equal(failing.timers.length, 0);

  const resolvers = [];
  const h = harness({ search: () => new Promise((resolve) => resolvers.push(() => resolve(ok()))) });
  const first = h.session.run("diab", { mode: "instant" });
  const second = h.session.run("diabetes", { mode: "instant" });
  resolvers[0]();
  resolvers[1]();
  assert.equal(await first, null);
  await second;
  assert.equal(h.live().length, 1);
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.q), ["diabetes"]);
});

// ── Timer cancellation and stale-query protection ─────────────────────────
test("new input cancels the pending idle timer", async () => {
  const h = harness();
  await h.session.run("diab", { mode: "instant" });
  const first = h.live()[0];
  await h.session.run("diabe", { mode: "instant" });
  assert.equal(first.cleared, true);
  assert.equal(h.live().length, 1);
  await h.fire();
  assert.deepEqual(h.settles.map((s) => s.q), ["diabe"]);
});

test("reset, select, full submit and unmount all cancel the pending timer", async () => {
  for (const action of [
    (h) => h.session.reset(),
    (h) => h.session.select(),
    (h) => { h.session.run("diabetes", { mode: "full" }); },
  ]) {
    const h = harness();
    await h.session.run("diabetes", { mode: "instant" });
    const timer = h.live()[0];
    action(h);
    await tick();
    assert.equal(timer.cleared, true);
    const idleSettles = () => h.settles.filter((s) => s.reason === "idle");
    assert.equal(idleSettles().length, 0);
  }
});

test("a timer callback that fires late for an outdated query sends nothing", async () => {
  const h = harness();
  await h.session.run("diab", { mode: "instant" });
  const stale = h.live()[0];
  await h.session.run("diabetes", { mode: "instant" }); // newer query: stale timer was cleared
  await h.fireStale(stale);
  assert.equal(h.settles.length, 0);

  // Request-level cancel() also invalidates a timer that is still pending.
  const live = h.live()[0];
  h.session.cancel();
  await h.fireStale(live);
  assert.equal(h.settles.length, 0);

  // After a reset, an old timer is harmless as well.
  await h.session.run("acne", { mode: "instant" });
  const beforeReset = h.live()[0];
  h.session.reset();
  await h.fireStale(beforeReset);
  assert.equal(h.settles.length, 0);

  // And after a submit.
  await h.session.run("psoriasis", { mode: "instant" });
  const beforeSubmit = h.live()[0];
  await h.session.run("psoriasis", { mode: "full" });
  await h.fireStale(beforeSubmit);
  assert.equal(h.settles.length, 0);
});

// ── Suggestion selection ──────────────────────────────────────────────────
test("select sends reason select for the query that produced the shown suggestions", async () => {
  const h = harness();
  await h.session.run("diab", { mode: "instant" });
  await h.fire(); // idle settle for "diab"
  await h.session.run("diabetes", { mode: "instant" });
  h.session.select();
  assert.deepEqual(h.settles.at(-1), { interactionId: uuid(1), q: "diabetes", reason: "select" });
  assert.equal(h.live().length, 0);
});

test("select uses the shown query, not newer text whose results have not arrived", async () => {
  let release;
  const h = harness({ search: (q) => (q === "diabetes care" ? new Promise((resolve) => { release = () => resolve(ok()); }) : ok()) });
  await h.session.run("diabetes", { mode: "instant" });
  h.session.run("diabetes care", { mode: "instant" }); // typed on; response still pending
  h.session.select(); // the user clicks a suggestion from the "diabetes" list
  assert.deepEqual(h.settles, [{ interactionId: uuid(1), q: "diabetes", reason: "select" }]);
  release?.();
});

test("select without shown results, after a full submit, or with no episode sends nothing and never throws", async () => {
  const none = harness();
  none.session.select();
  assert.equal(none.settles.length, 0);

  const early = harness({ search: () => new Promise(() => {}) });
  early.session.run("diabetes", { mode: "instant" });
  early.session.select(); // nothing has been shown yet
  assert.equal(early.settles.length, 0);

  const submitted = harness();
  await submitted.session.run("diabetes", { mode: "instant" });
  await submitted.session.run("diabetes", { mode: "full" });
  submitted.session.select();
  assert.equal(submitted.settles.length, 0); // the server already has the submission
});

test("select never throws even if the settle call does", async () => {
  const h = harness({ settle: () => { throw new Error("boom"); } });
  await h.session.run("diabetes", { mode: "instant" });
  assert.doesNotThrow(() => h.session.select());
  const rejecting = harness({ settle: () => Promise.reject(new Error("boom")) });
  await rejecting.session.run("diabetes", { mode: "instant" });
  assert.doesNotThrow(() => rejecting.session.select());
  await tick();
});

// ── Full submission ───────────────────────────────────────────────────────
test("a full submission carries the interaction id; instant requests do not", async () => {
  const h = harness();
  await h.session.run("diab", { mode: "instant" });
  await h.session.run("diabetes", { mode: "full" });
  assert.equal("interactionId" in h.searches[0], false);
  assert.equal(h.searches[1].mode, "full");
  assert.equal(h.searches[1].interactionId, uuid(1));
  assert.deepEqual(h.settles, []); // no settle call for a submission
});

test("a full submission as the first request of an episode creates the id", async () => {
  const h = harness();
  await h.session.run("diabetes", { mode: "full" });
  assert.equal(h.searches[0].interactionId, uuid(1));
  assert.equal(h.live().length, 0); // a submission never starts an idle timer
});

test("without a usable id (no crypto) searches and settles still work, minus analytics", async () => {
  for (const bad of [null, "not-a-uuid", 42]) {
    const h = harness({ newId: () => bad });
    await h.session.run("diab", { mode: "instant" });
    assert.equal(h.live().length, 0);
    const body = await h.session.run("diabetes", { mode: "full" });
    assert.equal(body.success, true);
    assert.equal("interactionId" in h.searches[1], false);
    h.session.select();
    assert.equal(h.settles.length, 0);
  }
});

// ── Failed / limited settle requests ──────────────────────────────────────
test("settle failures are invisible: no rejection, search keeps working", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    for (const settle of [async () => { throw new Error("400"); }, () => { throw new Error("sync"); }, () => Promise.reject(null)]) {
      const h = harness({ settle });
      await h.session.run("diabetes", { mode: "instant" });
      await h.fire();
      h.session.select();
      const body = await h.session.run("acne", { mode: "full" });
      assert.equal(body.success, true);
    }
    await tick();
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(unhandled, []);
});

test("after a 429 settle calls pause for a minute, a 400 does not pause them", async () => {
  const limited = harness({ settleResult: "rate_limited" });
  await limited.session.run("diabetes", { mode: "instant" });
  await limited.fire();
  await limited.session.run("diabetes mellitus", { mode: "instant" });
  await limited.fire();
  assert.equal(limited.settles.length, 1); // second one suppressed during the pause
  limited.advance(60 * 1000);
  await limited.session.run("diabetes mellitus type", { mode: "instant" });
  await limited.fire();
  assert.equal(limited.settles.length, 2);

  const failed = harness({ settleResult: "failed" });
  await failed.session.run("diabetes", { mode: "instant" });
  await failed.fire();
  await failed.session.run("diabetes mellitus", { mode: "instant" });
  await failed.fire();
  assert.equal(failed.settles.length, 2);
});

test("settled requests are never retried", async () => {
  const h = harness({ settleResult: "failed" });
  await h.session.run("diabetes", { mode: "instant" });
  await h.fire();
  await h.fire();
  await tick();
  assert.equal(h.settles.length, 1);
});

// ── settleSearch (the network call) ───────────────────────────────────────
test("settleSearch posts exactly { interactionId, q, reason } without credentials", async () => {
  const calls = [];
  const client = { post: async (url, body, config) => { calls.push({ url, body, config }); return { status: 204 }; } };
  const result = await settleSearch({ interactionId: uuid(7), q: "  Knee    Pain ", reason: "idle" }, { client });
  assert.equal(result, "sent");
  assert.equal(calls[0].url, "/api/search/settle");
  assert.deepEqual(calls[0].body, { interactionId: uuid(7), q: "Knee Pain", reason: "idle" });
  assert.deepEqual(calls[0].config.fetchOptions, { credentials: "omit", keepalive: true });
  assert.equal(calls[0].config.timeout, 5000);
  assert.equal(calls[0].config.headers, undefined);
  assert.equal(calls[0].config.withCredentials, undefined);
});

test("settleSearch maps 204 / 400 / 429 / network errors and never throws", async () => {
  const withStatus = (status) => ({ post: async () => { throw Object.assign(new Error(String(status)), { response: { status } }); } });
  assert.equal(await settleSearch({ interactionId: uuid(1), q: "acne", reason: "select" }, { client: withStatus(400) }), "failed");
  assert.equal(await settleSearch({ interactionId: uuid(1), q: "acne", reason: "select" }, { client: withStatus(429) }), "rate_limited");
  assert.equal(await settleSearch({ interactionId: uuid(1), q: "acne", reason: "select" }, { client: withStatus(503) }), "failed");
  assert.equal(await settleSearch({ interactionId: uuid(1), q: "acne", reason: "select" }, { client: { post: async () => { throw new Error("network"); } } }), "failed");
  assert.equal(await settleSearch({ interactionId: uuid(1), q: "acne", reason: "select" }, { client: { post: async () => { throw null; } } }), "failed");
});

test("settleSearch makes no request for invalid input", async () => {
  let calls = 0;
  const client = { post: async () => { calls += 1; return {}; } };
  for (const bad of [
    undefined, {}, { q: "acne", reason: "idle" },
    { interactionId: "nope", q: "acne", reason: "idle" },
    { interactionId: "6F1C2A9E-3B7D-4C58-9A1E-0D2F5B8E7C41", q: "acne", reason: "idle" }, // uppercase
    { interactionId: "6f1c2a9e-3b7d-1c58-9a1e-0d2f5b8e7c41", q: "acne", reason: "idle" }, // not version 4
    { interactionId: uuid(1), q: "a", reason: "idle" },
    { interactionId: uuid(1), q: "   ", reason: "idle" },
    { interactionId: uuid(1), q: "acne", reason: "submit" },
    { interactionId: uuid(1), q: "acne", reason: "instant" },
    { interactionId: uuid(1), q: "acne" },
  ]) {
    assert.equal(await settleSearch(bad, { client }), "skipped", JSON.stringify(bad));
  }
  assert.equal(calls, 0);
});

test("settleSearch cuts the text to the 100 character limit", async () => {
  let sent;
  await settleSearch({ interactionId: uuid(1), q: "x".repeat(300), reason: "idle" }, { client: { post: async (_u, body) => { sent = body; return {}; } } });
  assert.equal(sent.q.length, 100);
});

// ── searchHealthcare ──────────────────────────────────────────────────────
test("searchHealthcare sends interactionId only on full requests and only when valid", async () => {
  const bodies = [];
  const client = { post: async (_url, body) => { bodies.push(body); return { data: ok() }; } };
  await searchHealthcare("acne", { mode: "instant", interactionId: uuid(1), client });
  await searchHealthcare("acne", { mode: "full", interactionId: uuid(1), client });
  await searchHealthcare("acne", { mode: "full", interactionId: "bad", client });
  await searchHealthcare("acne", { mode: "full", client });
  await searchHealthcare("acne", { mode: "full", types: ["condition"], interactionId: uuid(2), client });
  assert.deepEqual(bodies, [
    { q: "acne", mode: "instant" },
    { q: "acne", mode: "full", interactionId: uuid(1) },
    { q: "acne", mode: "full" },
    { q: "acne", mode: "full" },
    { q: "acne", mode: "full", types: ["condition"], interactionId: uuid(2) },
  ]);
});

test("on the wire: real requests against a stub server, with no auth header and no cookies", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: JSON.parse(raw) });
      if (req.url === "/api/search/settle") {
        const { q } = JSON.parse(raw);
        res.writeHead(q === "limited" ? 429 : q === "invalid" ? 400 : 204);
        res.end();
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(ok()));
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { default: axios } = await import("axios");
  const client = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, withCredentials: false });
  try {
    await searchHealthcare("Cardio care", { mode: "full", interactionId: uuid(3), client });
    await searchHealthcare("Cardio care", { mode: "instant", interactionId: uuid(3), client });
    assert.equal(await settleSearch({ interactionId: uuid(3), q: "cardio care", reason: "idle" }, { client }), "sent");
    assert.equal(await settleSearch({ interactionId: uuid(3), q: "limited", reason: "idle" }, { client }), "rate_limited");
    assert.equal(await settleSearch({ interactionId: uuid(3), q: "invalid", reason: "select" }, { client }), "failed");
    assert.deepEqual(seen.map((s) => [s.method, s.url]), [
      ["POST", "/api/search"], ["POST", "/api/search"],
      ["POST", "/api/search/settle"], ["POST", "/api/search/settle"], ["POST", "/api/search/settle"],
    ]);
    assert.deepEqual(seen[0].body, { q: "Cardio care", mode: "full", interactionId: uuid(3) });
    assert.deepEqual(seen[1].body, { q: "Cardio care", mode: "instant" });
    assert.deepEqual(seen[2].body, { interactionId: uuid(3), q: "cardio care", reason: "idle" });
    for (const s of seen) {
      assert.equal(s.headers.authorization, undefined);
      assert.equal(s.headers.cookie, undefined);
    }
  } finally {
    server.close();
  }
});

// ── Nothing is persisted ──────────────────────────────────────────────────
test("a whole lifecycle touches no browser storage, cookies, history or location", async () => {
  const traps = ["localStorage", "sessionStorage", "document", "indexedDB", "location", "history", "navigator"];
  const saved = traps.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  let touched = 0;
  try {
    for (const name of traps) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { touched += 1; throw new Error(`${name} accessed`); } });
    }
    const h = harness();
    await h.session.run("diabetes", { mode: "instant" });
    await h.fire();
    h.session.select();
    await h.session.run("acne", { mode: "full" });
    h.session.reset();
    assert.equal(touched, 0);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});

test("the client source never references browser storage, cookies, URLs or history", () => {
  const code = fs.readFileSync(new URL("../src/api/searchApi.js", import.meta.url), "utf8")
    .split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
  for (const forbidden of ["localStorage", "sessionStorage", "document.cookie", "indexedDB", "history.", "location.", "URLSearchParams", "gtag", "analytics.", "dataLayer", "fbq("]) {
    assert.ok(!code.includes(forbidden), forbidden);
  }
});

// ── Home.jsx wiring (UI behaviour must not change) ────────────────────────
const home = fs.readFileSync(new URL("../src/pages/Home.jsx", import.meta.url), "utf8");

test("Home notifies the session only from the two selection paths", () => {
  assert.equal((home.match(/searchSession\.select\(\)/g) || []).length, 2);
  // Clicking a suggestion: select() runs first, then the unchanged handleSearch(item).
  assert.match(home, /onClick=\{\(\) => \{\s*searchSession\.select\(\);[^\n]*\n\s*handleSearch\(item\);\s*\}\}/);
  // Enter on a highlighted suggestion.
  assert.match(home, /searchSession\.select\(\);[^\n]*\n\s*handleSearch\(filteredSuggestions\[activeIndex\]\);/);
  // The automatic "open the top result" after a full search is NOT a selection.
  const submit = home.slice(home.indexOf("const submitSearch"), home.indexOf("// ── Keyboard navigation"));
  assert.ok(!submit.includes("select()"));
  const handleSearch = home.slice(home.indexOf("const handleSearch"), home.indexOf("// ── Submit (Search button"));
  assert.ok(!handleSearch.includes("select()"));
});

test("Home resets the episode when the query is cleared or too short, and on unmount", () => {
  assert.match(home, /if \(query\.length < SEARCH_MIN_LENGTH\) \{\s*searchSession\.reset\(\);/);
  assert.match(home, /useEffect\(\(\) => \(\) => searchSession\.reset\(\), \[searchSession\]\);/);
});

test("Home still runs instant as-you-type and full on submit without handling ids itself", () => {
  assert.match(home, /searchSession\.run\(query, \{ mode: "instant" \}\)/);
  assert.match(home, /searchSession\.run\(query, \{ mode: "full" \}\)/);
  assert.ok(!/interactionId|randomUUID/.test(home));
  assert.match(home, /\}, 250\);/); // the existing 250 ms debounce is untouched
});
