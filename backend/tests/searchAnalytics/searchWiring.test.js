// Phase 2: backend wiring of search analytics (feature flag, POST /api/search
// full submissions, POST /api/search/settle). Everything runs against a local
// Express app with an in-memory store: no database, no AI provider.
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { startHarness, createFakeStore, createFakeAi, sleep } = require("./wiringHarness");
const { executeSearch } = require("../../services/search/searchService");
const { parseRequest, parseSettleRequest } = require("../../controllers/searchController");
const { createSearchEvents, isSearchAnalyticsEnabled } = require("../../services/searchAnalytics/searchEvents");
const searchRouter = require("../../routes/search");
const { searchLimiter, searchSettleLimiter } = require("../../middleware/rateLimiters");
const { search, settle } = require("../../controllers/searchController");

const ID_A = "6f1c2a9e-3b7d-4c58-9a1e-0d2f5b8e7c41";
const ID_B = "0b9d2c4e-8a1f-4e7b-b3c5-5d6e7f8a9b0c";

// Intent the fake AI returns for "head pounding badly" (no literal match).
const MIGRAINE_INTENT = {
  confidence: 0.9, categoryNames: [], specialtyNames: [], conditionNames: ["Migraine"],
  wantsDoctor: false, doctorNameText: null, wantsArticle: false, blogTopicText: null,
};

const withHarness = (options, fn) => async () => {
  const h = await startHarness(options);
  try { await fn(h); } finally { await h.close(); }
};

// ── Feature flag ──────────────────────────────────────────────────────────
test("the flag is on only for the exact string \"true\"", () => {
  assert.equal(isSearchAnalyticsEnabled({ SEARCH_ANALYTICS_ENABLED: "true" }), true);
  for (const off of [undefined, "", "false", "TRUE", "True", "1", "yes", "on", " true", "true ", "enabled"]) {
    assert.equal(isSearchAnalyticsEnabled({ SEARCH_ANALYTICS_ENABLED: off }), false, String(off));
  }
  assert.equal(isSearchAnalyticsEnabled({}), false);
});

test("the default (process.env) reading is off when the variable is not set", () => {
  const saved = process.env.SEARCH_ANALYTICS_ENABLED;
  try {
    delete process.env.SEARCH_ANALYTICS_ENABLED;
    assert.equal(isSearchAnalyticsEnabled(), false);
    process.env.SEARCH_ANALYTICS_ENABLED = "true";
    assert.equal(isSearchAnalyticsEnabled(), true);
  } finally {
    if (saved === undefined) delete process.env.SEARCH_ANALYTICS_ENABLED; else process.env.SEARCH_ANALYTICS_ENABLED = saved;
  }
});

test("flag off: a full search is answered normally and nothing is scheduled or written", withHarness({ flag: "false" }, async (h) => {
  const res = await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  assert.equal(res.status, 200);
  await h.drain();
  assert.equal(h.store.calls.length, 0);
  assert.equal(h.dtos.length, 0);
  assert.deepEqual(h.runner.stats(), { inFlight: 0, dropped: 0, limit: 50 });
}));

test("flag off: settle answers 204, never loads the catalog and writes nothing", withHarness({ flag: "false" }, async (h) => {
  const res = await h.settle({ interactionId: ID_A, q: "acne", reason: "idle" });
  assert.equal(res.status, 204);
  assert.equal(res.text, "");
  await h.drain();
  assert.equal(h.counters.catalog, 0);
  assert.equal(h.store.calls.length, 0);
}));

test("flag off adds no listener to the response and does not call the runner", () => {
  let runs = 0;
  const events = createSearchEvents({ isEnabled: () => false, run: () => { runs += 1; }, record: async () => {} });
  const response = new EventEmitter();
  response.writableFinished = false;
  assert.equal(events.afterFullSearch(response, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts: {} }), "disabled");
  assert.equal(events.afterSettle(response, { interactionId: ID_A, q: "acne", reason: "idle" }, async () => ({})), "disabled");
  assert.equal(response.listenerCount("finish"), 0);
  assert.equal(runs, 0);
});

// ── Public response is unchanged ──────────────────────────────────────────
test("the public search response is byte-for-byte unchanged (flag off, on, with and without an id)", withHarness({}, async (h) => {
  const bodies = [
    { q: "acne" }, { q: "acne", mode: "full" }, { q: "  Migraines ", mode: "full" }, { q: "diabetes", mode: "instant" },
    { q: "skin", types: ["category", "specialty"] }, { q: "head pounding badly", mode: "full" }, { q: "zzzzqqq", mode: "full" },
    { q: "note", mode: "full", types: ["service"] },
  ];
  const ai = createFakeAi({ status: "ok", intent: MIGRAINE_INTENT });
  const legacy = [];
  for (const body of bodies) {
    const direct = await executeSearch(parseRequest(body), { getCatalog: async () => h.catalog, ai });
    legacy.push(JSON.stringify(direct));
  }
  h.ai.outcome = { status: "ok", intent: MIGRAINE_INTENT };
  for (const flag of ["false", "true"]) {
    h.env.SEARCH_ANALYTICS_ENABLED = flag;
    for (const withId of [false, true]) {
      for (const [i, body] of bodies.entries()) {
        const res = await h.search(withId ? { ...body, interactionId: ID_A } : body);
        assert.equal(res.status, 200);
        assert.equal(res.text, legacy[i], `${flag}/${withId}/${JSON.stringify(body)}`);
      }
    }
  }
  const keys = Object.keys((await h.search({ q: "acne", mode: "full", interactionId: ID_A })).json);
  assert.deepEqual(keys, ["success", "query", "results", "meta"]);
}));

test("the response never carries analytics or internal fields", withHarness({}, async (h) => {
  const { text } = await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  for (const forbidden of ["interactionId", ID_A, "settledBy", "aiStatus", "dedicated", "\"score\"", "topResult", "analytics"]) {
    assert.ok(!text.includes(forbidden), forbidden);
  }
}));

test("unknown body keys are still rejected exactly as before", withHarness({}, async (h) => {
  const res = await h.search({ q: "acne", extra: 1 });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json, { success: false, error: { code: "INVALID_REQUEST", field: "body", message: "Only q, mode and types are accepted." } });
}));

// ── Full submissions: when they qualify ───────────────────────────────────
test("a qualifying full submission is recorded after the response (settledBy submit)", withHarness({}, async (h) => {
  const res = await h.search({ q: "Acne", mode: "full", interactionId: ID_A });
  assert.equal(res.status, 200);
  await h.drain();
  assert.equal(h.store.docs.size, 1);
  const doc = h.store.docs.get(ID_A);
  assert.equal(doc.settledBy, "submit");
  assert.equal(doc.term, "acne");
  assert.equal(doc.aiStatus, "not_needed"); // exact literal hit: AI not consulted
  assert.equal(doc.outcome, "dedicated_page_found");
  assert.equal(h.ai.calls, 0);
}));

test("only the six allowlisted fields are handed to analytics, never request details", withHarness({}, async (h) => {
  await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  await h.settle({ interactionId: ID_B, q: "acne", reason: "idle" });
  await h.drain();
  assert.equal(h.dtos.length, 2);
  for (const dto of h.dtos) {
    assert.deepEqual(Object.keys(dto).sort(), ["aiStatus", "index", "interactionId", "matches", "q", "settledBy"]);
    assert.ok(!JSON.stringify(dto.matches).includes("127.0.0.1"));
  }
  for (const doc of h.store.docs.values()) assert.ok(!JSON.stringify(doc).includes("127.0.0.1"));
}));

test("AI status: consulted-and-used, consulted-without-effect and unavailable", withHarness({}, async (h) => {
  h.ai.outcome = { status: "ok", intent: MIGRAINE_INTENT };
  await h.search({ q: "head pounding badly", mode: "full", interactionId: ID_A });
  h.ai.outcome = { status: "ok", intent: { ...MIGRAINE_INTENT, conditionNames: [] } };
  await h.search({ q: "something odd happening", mode: "full", interactionId: ID_B });
  h.ai.outcome = { status: "failed" };
  const ID_C = "11111111-1111-4111-8111-111111111111";
  await h.search({ q: "another strange thing", mode: "full", interactionId: ID_C });
  await h.drain();
  assert.equal(h.store.docs.get(ID_A).aiStatus, "used");
  assert.equal(h.store.docs.get(ID_A).outcome, "dedicated_page_found"); // found through the AI-resolved intent
  assert.equal(h.store.docs.get(ID_B).aiStatus, "no_match");
  assert.equal(h.store.docs.get(ID_C).aiStatus, "unavailable");
  assert.equal(h.ai.calls, 3);
}));

test("instant requests, explicit types, missing and malformed ids never record", withHarness({}, async (h) => {
  const cases = [
    { q: "acne", mode: "instant", interactionId: ID_A },
    { q: "acne", interactionId: ID_A },
    { q: "acne", mode: "full", interactionId: ID_A, types: ["condition"] },
    { q: "acne", mode: "full" },
    { q: "acne", mode: "full", interactionId: "not-a-uuid" },
    { q: "acne", mode: "full", interactionId: ID_A.toUpperCase() },
    { q: "acne", mode: "full", interactionId: `${ID_A} ` },
    { q: "acne", mode: "full", interactionId: 12345 },
    { q: "acne", mode: "full", interactionId: null },
    { q: "acne", mode: "full", interactionId: { $ne: "x" } },
    { q: "acne", mode: "full", interactionId: [ID_A] },
  ];
  for (const body of cases) {
    const res = await h.search(body);
    assert.equal(res.status, 200, JSON.stringify(body)); // a bad id never breaks the search
    assert.equal(res.json.success, true);
  }
  await h.drain();
  assert.equal(h.store.calls.length, 0);
  assert.equal(h.runner.stats().dropped, 0);
}));

test("invalid searches (400) and an unavailable catalog (503) record nothing", withHarness({ getCatalogError: new Error("catalog down") }, async (h) => {
  assert.equal((await h.search({ q: "a", mode: "full", interactionId: ID_A })).status, 400);
  const unavailable = await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  assert.equal(unavailable.status, 503);
  await h.drain();
  assert.equal(h.store.calls.length, 0);
}));

test("text the privacy filter rejects is answered normally but never stored", withHarness({}, async (h) => {
  for (const q of ["mail me at a@b.com", "patient 10234", "my name is raj", "dr rahul", "call 5551234567"]) {
    const res = await h.search({ q, mode: "full", interactionId: ID_A });
    assert.equal(res.status, 200, q);
  }
  await h.drain();
  assert.equal(h.store.calls.length, 0);
  assert.deepEqual(h.logs, []);
}));

// ── POST /api/search/settle: validation ───────────────────────────────────
test("settle validation: exact shape, fixed messages, input never echoed", withHarness({}, async (h) => {
  const secret = "very-secret-health-text";
  const bad = [
    [{ q: "acne" }, "interactionId"],
    [{ interactionId: "nope", q: "acne", reason: "idle" }, "interactionId"],
    [{ interactionId: ID_A.toUpperCase(), q: "acne", reason: "idle" }, "interactionId"],
    [{ interactionId: 5, q: "acne", reason: "idle" }, "interactionId"],
    [{ interactionId: ID_A, reason: "idle" }, "q"],
    [{ interactionId: ID_A, q: "a", reason: "idle" }, "q"],
    [{ interactionId: ID_A, q: "x".repeat(101), reason: "idle" }, "q"],
    [{ interactionId: ID_A, q: 42, reason: "idle" }, "q"],
    [{ interactionId: ID_A, q: { $ne: "" }, reason: "idle" }, "q"],
    [{ interactionId: ID_A, q: secret }, "reason"],
    [{ interactionId: ID_A, q: secret, reason: "instant" }, "reason"],
    [{ interactionId: ID_A, q: secret, reason: "submit" }, "reason"],
    [{ interactionId: ID_A, q: secret, reason: ["idle"] }, "reason"],
    [{ interactionId: ID_A, q: secret, reason: "idle", mode: "full" }, "body"],
    [{ interactionId: ID_A, q: secret, reason: "idle", types: ["condition"] }, "body"],
    [{ interactionId: ID_A, q: secret, reason: "idle", ip: "1.2.3.4" }, "body"],
    [[{ interactionId: ID_A, q: secret, reason: "idle" }], "body"],
    // Bare null / strings never reach the controller: the JSON parser rejects them (no field).
    [null, undefined],
    ["text", undefined],
  ];
  for (const [payload, field] of bad) {
    const res = await h.settle(payload);
    assert.equal(res.status, 400, JSON.stringify(payload));
    assert.equal(res.json.success, false);
    assert.equal(res.json.error.code, "INVALID_REQUEST");
    assert.equal(res.json.error.field, field, JSON.stringify(payload));
    assert.ok(!res.text.includes(secret));
  }
  await h.drain();
  assert.equal(h.store.calls.length, 0);
  assert.equal(h.counters.catalog, 0);
}));

test("malformed JSON on settle is rejected by the search error handler without echo", withHarness({}, async (h) => {
  const res = await h.post("/api/search/settle", '{"q": "secret health text"', true);
  assert.equal(res.status, 400);
  assert.ok(!res.text.includes("secret"));
}));

test("parseSettleRequest accepts only idle and select", () => {
  for (const reason of ["idle", "select"]) {
    assert.deepEqual(parseSettleRequest({ interactionId: ID_A, q: "  Knee Pain ", reason }), { interactionId: ID_A, q: "knee pain", reason });
  }
});

// ── Settle: recording ─────────────────────────────────────────────────────
test("a valid settle returns 204 with an empty body and is recorded in the background", withHarness({}, async (h) => {
  const res = await h.settle({ interactionId: ID_A, q: "Knee   Pain", reason: "idle" });
  assert.equal(res.status, 204);
  assert.equal(res.text, "");
  await h.drain();
  const doc = h.store.docs.get(ID_A);
  assert.equal(doc.settledBy, "idle");
  assert.equal(doc.aiStatus, "not_requested");
  assert.equal(doc.term, "knee pain");
  assert.equal(h.ai.calls, 0); // deterministic matching only
}));

test("settle recomputes everything on the server: client-supplied results are rejected", withHarness({}, async (h) => {
  for (const extra of [{ resultCount: 99 }, { outcome: "dedicated_page_found" }, { aiStatus: "used" }, { settledBy: "submit" }, { dedicatedPageAvailable: true }]) {
    const res = await h.settle({ interactionId: ID_A, q: "zzzzqqq", reason: "select", ...extra });
    assert.equal(res.status, 400);
  }
  await h.settle({ interactionId: ID_A, q: "zzzzqqq", reason: "select" });
  await h.drain();
  const doc = h.store.docs.get(ID_A);
  assert.equal(doc.outcome, "no_results");
  assert.equal(doc.resultCount, 0);
}));

test("settle answers 204 even when the privacy filter drops the text", withHarness({}, async (h) => {
  const res = await h.settle({ interactionId: ID_A, q: "mail me at a@b.com", reason: "idle" });
  assert.equal(res.status, 204);
  await h.drain();
  assert.equal(h.store.calls.length, 0);
  assert.deepEqual(h.logs, []);
}));

// ── Deduplication and precedence ──────────────────────────────────────────
test("duplicate settles of one interaction stay one document; the latest text wins until submit", withHarness({}, async (h) => {
  await h.settle({ interactionId: ID_A, q: "diab", reason: "idle" });
  await h.drain();
  await h.settle({ interactionId: ID_A, q: "diabetes", reason: "idle" });
  await h.settle({ interactionId: ID_A, q: "diabetes", reason: "select" });
  await h.drain();
  assert.equal(h.store.docs.size, 1);
  assert.equal(h.store.docs.get(ID_A).term, "diabetes");
  await h.settle({ interactionId: ID_B, q: "diabetes", reason: "idle" });
  await h.drain();
  assert.equal(h.store.docs.size, 2);
}));

test("a full submission upgrades an earlier settle of the same interaction", withHarness({}, async (h) => {
  await h.settle({ interactionId: ID_A, q: "acne", reason: "idle" });
  await h.drain();
  await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  await h.drain();
  assert.equal(h.store.docs.size, 1);
  assert.equal(h.store.docs.get(ID_A).settledBy, "submit");
}));

test("a full submission is never overwritten by a later settle or a second submit", withHarness({}, async (h) => {
  await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  await h.drain();
  const before = JSON.stringify(h.store.docs.get(ID_A));
  await h.settle({ interactionId: ID_A, q: "migraine", reason: "select" });
  await h.settle({ interactionId: ID_A, q: "migraine", reason: "idle" });
  await h.search({ q: "migraine", mode: "full", interactionId: ID_A });
  await h.drain();
  assert.equal(JSON.stringify(h.store.docs.get(ID_A)), before);
  assert.equal(h.store.docs.size, 1);
  assert.deepEqual(h.logs, []);
}));

test("concurrent mixed requests for one interaction end as a single submitted document", withHarness({}, async (h) => {
  await Promise.all([
    h.settle({ interactionId: ID_A, q: "acne", reason: "idle" }),
    h.search({ q: "acne", mode: "full", interactionId: ID_A }),
    h.settle({ interactionId: ID_A, q: "acne", reason: "select" }),
    h.search({ q: "acne", mode: "full", interactionId: ID_A }),
  ]);
  await h.drain();
  assert.equal(h.store.docs.size, 1);
  assert.equal(h.store.docs.get(ID_A).settledBy, "submit");
  assert.deepEqual(h.logs, []);
}));

// ── Error isolation ───────────────────────────────────────────────────────
test("a failing store never changes a response and logs only error names", withHarness({
  store: createFakeStore({ onCall: () => { throw Object.assign(new Error("db down for knee pain"), { name: "MongoNetworkError", code: "ECONNRESET" }); } }),
}, async (h) => {
  const search = await h.search({ q: "knee pain", mode: "full", interactionId: ID_A });
  const settle = await h.settle({ interactionId: ID_B, q: "knee pain", reason: "idle" });
  assert.equal(search.status, 200);
  assert.equal(search.json.success, true);
  assert.equal(settle.status, 204);
  await h.drain();
  assert.equal(h.logs.length, 2);
  assert.ok(h.logs.every((m) => m === "[search-analytics] write failed: MongoNetworkError ECONNRESET"));
  assert.ok(!h.logs.join(" ").includes("knee"));
  assert.equal(h.runner.stats().inFlight, 0);
}));

test("an unavailable catalog during settle is contained and logged by name only", withHarness({ getCatalogError: Object.assign(new Error("secret"), { name: "MongoServerSelectionError" }) }, async (h) => {
  const res = await h.settle({ interactionId: ID_A, q: "acne", reason: "idle" });
  assert.equal(res.status, 204);
  await h.drain();
  assert.deepEqual(h.logs, ["[search-analytics] background task failed: MongoServerSelectionError"]);
  assert.equal(h.store.calls.length, 0);
}));

test("a hanging or very slow store cannot delay either response", withHarness({
  record: () => new Promise(() => {}), // never settles
  maxInFlight: 1,
}, async (h) => {
  const started = Date.now();
  const first = await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  const second = await h.settle({ interactionId: ID_B, q: "acne", reason: "idle" });
  const third = await h.search({ q: "acne", mode: "full", interactionId: ID_B });
  assert.equal(first.status, 200);
  assert.equal(second.status, 204);
  assert.equal(third.status, 200);
  assert.ok(Date.now() - started < 2000);
  await sleep(30);
  // One stuck task holds the single slot; later events are dropped, not queued.
  const stats = h.runner.stats();
  assert.equal(stats.inFlight, 1);
  assert.ok(stats.dropped >= 1);
}));

test("synchronous failures inside analytics never reach the client", withHarness({
  analytics: {
    afterFullSearch() { throw new Error("secret analytics failure"); },
    afterSettle() { throw new Error("secret analytics failure"); },
  },
}, async (h) => {
  const search = await h.search({ q: "acne", mode: "full", interactionId: ID_A });
  const settle = await h.settle({ interactionId: ID_A, q: "acne", reason: "idle" });
  assert.equal(search.status, 200);
  assert.equal(search.json.success, true);
  assert.ok(!search.text.includes("secret"));
  assert.equal(settle.status, 204);
}));

test("a throwing scheduler or flag check is contained inside the glue", () => {
  const response = new EventEmitter();
  response.writableFinished = true;
  const facts = { matches: {}, index: {}, ai: { requested: true, consulted: false, used: false, status: undefined } };
  const throwingRun = createSearchEvents({ isEnabled: () => true, run: () => { throw new RangeError("x"); }, record: async () => {} });
  assert.equal(throwingRun.afterFullSearch(response, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts }), "scheduled");
  assert.equal(throwingRun.afterSettle(response, { interactionId: ID_A, q: "acne", reason: "idle" }, async () => ({})), "scheduled");
  const throwingFlag = createSearchEvents({ isEnabled: () => { throw new Error("env"); }, run: () => {}, record: async () => {} });
  assert.equal(throwingFlag.afterFullSearch(response, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts }), "disabled");
  const brokenResponse = createSearchEvents({ isEnabled: () => true, run: () => {}, record: async () => {} });
  assert.equal(brokenResponse.afterFullSearch(null, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts }), "error");
});

// ── Scheduling happens only after the response has finished ───────────────
test("work starts only once the response has finished", () => {
  const scheduled = [];
  const events = createSearchEvents({ isEnabled: () => true, run: (task) => scheduled.push(task), record: async () => {} });
  const response = new EventEmitter();
  response.writableFinished = false;
  const facts = { matches: {}, index: {}, ai: { requested: true, consulted: false, used: false, status: undefined } };
  assert.equal(events.afterFullSearch(response, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts }), "scheduled");
  assert.equal(scheduled.length, 0); // nothing yet: the response is still being sent
  response.emit("finish");
  assert.equal(scheduled.length, 1);

  const settleResponse = new EventEmitter();
  settleResponse.writableFinished = false;
  events.afterSettle(settleResponse, { interactionId: ID_A, q: "acne", reason: "select" }, async () => ({}));
  assert.equal(scheduled.length, 1);
  settleResponse.emit("finish");
  assert.equal(scheduled.length, 2);

  const done = new EventEmitter();
  done.writableFinished = true; // already sent
  events.afterSettle(done, { interactionId: ID_A, q: "acne", reason: "select" }, async () => ({}));
  assert.equal(scheduled.length, 3);
});

test("the glue reads nothing from the response except its finish signal", () => {
  const touched = new Set();
  const emitter = new EventEmitter();
  const response = new Proxy({}, {
    get(_target, prop) {
      touched.add(String(prop));
      if (prop === "writableFinished") return false;
      if (prop === "once") return emitter.once.bind(emitter);
      throw new Error(`unexpected access: ${String(prop)}`);
    },
  });
  const events = createSearchEvents({ isEnabled: () => true, run: () => {}, record: async () => {} });
  const facts = { matches: {}, index: {}, ai: { requested: true, consulted: false, used: false, status: undefined } };
  assert.equal(events.afterFullSearch(response, { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts }), "scheduled");
  assert.equal(events.afterSettle(response, { interactionId: ID_A, q: "acne", reason: "idle" }, async () => ({})), "scheduled");
  assert.deepEqual([...touched].sort(), ["once", "writableFinished"]);
});

test("qualification rules in the glue", () => {
  const scheduled = [];
  const events = createSearchEvents({ isEnabled: () => true, run: (t) => scheduled.push(t), record: async () => {} });
  const response = new EventEmitter();
  response.writableFinished = true;
  const facts = { matches: {}, index: {}, ai: { requested: true, consulted: false, used: false, status: undefined } };
  const base = { mode: "full", interactionId: ID_A, typesExplicit: false, q: "acne", facts };
  for (const override of [{ mode: "instant" }, { interactionId: null }, { typesExplicit: true }, { facts: undefined }]) {
    assert.equal(events.afterFullSearch(response, { ...base, ...override }), "skipped");
  }
  assert.equal(scheduled.length, 0);
  assert.equal(events.afterFullSearch(response, base), "scheduled");
  assert.equal(scheduled.length, 1);
});

// ── Rate limiting ─────────────────────────────────────────────────────────
test("the settle route sits behind its own 30/min limiter; search keeps its own", () => {
  const layer = (path) => searchRouter.stack.find((l) => l.route && l.route.path === path);
  const settleLayer = layer("/settle");
  assert.ok(settleLayer && settleLayer.route.methods.post);
  assert.deepEqual(settleLayer.route.stack.map((l) => l.handle), [searchSettleLimiter, settle]);
  assert.deepEqual(layer("/").route.stack.map((l) => l.handle), [searchLimiter, search]);
  assert.notEqual(searchSettleLimiter, searchLimiter);
});

test("settle allows 30 requests per minute per IP, then answers 429", withHarness({ flag: "false", limiter: searchSettleLimiter }, async (h) => {
  const body = { interactionId: ID_A, q: "very-secret-health-text", reason: "idle" };
  for (let i = 1; i <= 30; i += 1) assert.equal((await h.settle(body)).status, 204, `request ${i}`);
  const limited = await h.settle(body);
  assert.equal(limited.status, 429);
  assert.ok(!limited.text.includes("very-secret-health-text"));
  assert.ok(Number(limited.json.retryAfterSeconds) > 0);
}));
