const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFixtureCatalog } = require("../search/fixtures");
const { matchCatalog } = require("../../services/search/deterministicMatcher");
const { validateQuery } = require("../../services/search/queryNormalizer");
const { DEFAULT_SEARCH_TYPES } = require("../../services/search/searchConstants");
const { createSearchInteractionRecorder } = require("../../services/searchAnalytics/recorder");

const ID_A = "6f1c2a9e-3b7d-4c58-9a1e-0d2f5b8e7c41";
const ID_B = "0b9d2c4e-8a1f-4e7b-b3c5-5d6e7f8a9b0c";
const NOW = new Date("2026-10-09T08:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

let catalog;
test.before(async () => {
  ({ catalog } = await buildFixtureCatalog());
});

const matchesFor = (q, types = DEFAULT_SEARCH_TYPES) => matchCatalog(catalog, validateQuery(q), { types });
// Matches default to a real search for the same text (when the text is searchable at all).
const defaultMatches = (q) => {
  try {
    return matchesFor(q);
  } catch {
    return {};
  }
};
const dto = (overrides = {}) => ({
  interactionId: ID_A,
  q: "acne",
  settledBy: "idle",
  aiStatus: "not_requested",
  matches: defaultMatches(typeof overrides.q === "string" ? overrides.q : "acne"),
  index: catalog.index,
  ...overrides,
});
const fullDto = (overrides = {}) => dto({ settledBy: "submit", aiStatus: "not_needed", ...overrides });

const duplicateKeyError = () => Object.assign(new Error("E11000 duplicate key error { interactionId: \"secret-term\" }"), { name: "MongoServerError", code: 11000 });

// In-memory stand-in for the model's updateOne. It reproduces the pieces of
// MongoDB the recorder relies on: the { settledBy: { $ne: "submit" } } filter,
// upsert-insert, and the unique interactionId (E11000).
function createFakeStore({ yieldBeforeInsert = false, failWith = null } = {}) {
  const docs = new Map();
  const calls = [];
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return {
    docs,
    calls,
    async updateOne(filter, update, options) {
      calls.push({ filter, update, options });
      const failure = failWith && failWith(calls.length);
      if (failure) throw failure;
      const existing = docs.get(filter.interactionId);
      const matches = existing && existing.settledBy !== "submit"; // the only operator used: $ne "submit"
      if (matches) {
        Object.assign(existing, update.$set);
        return { matchedCount: 1, upsertedCount: 0 };
      }
      if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
      if (yieldBeforeInsert) await tick(); // both racers have checked before either inserts
      if (docs.has(filter.interactionId)) throw duplicateKeyError();
      docs.set(filter.interactionId, { interactionId: filter.interactionId, ...update.$set, ...update.$setOnInsert });
      return { matchedCount: 0, upsertedCount: 1 };
    },
  };
}

const makeRecorder = (store, extra = {}) =>
  createSearchInteractionRecorder({ store, now: () => NOW, logger: () => {}, ...extra });

// ── What gets stored ──────────────────────────────────────────────────────
test("records one allowlisted document with recomputed facts and a 90-day expiry", async () => {
  const store = createFakeStore();
  const result = await makeRecorder(store)(dto());
  assert.deepEqual(result, { status: "recorded" });
  const doc = store.docs.get(ID_A);
  assert.deepEqual(Object.keys(doc).sort(), [
    "aiStatus", "dedicatedPageAvailable", "expiresAt", "interactionId", "outcome", "resultCount", "resultTypes",
    "schemaVersion", "settledBy", "term", "termKey", "topResultDedicated", "topResultPath", "topResultType", "topScore",
  ]);
  assert.equal(doc.term, "acne");
  assert.equal(doc.termKey, "acne");
  assert.equal(doc.outcome, "dedicated_page_found");
  assert.equal(doc.topResultPath, "/skin-and-hair-care/dermatology/acne");
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.expiresAt.getTime(), NOW.getTime() + 90 * DAY);
  assert.equal(store.calls[0].options.upsert, true);
  assert.deepEqual(store.calls[0].filter, { interactionId: ID_A, settledBy: { $ne: "submit" } });
});

test("expiresAt is only set on insert, never moved by a later update", async () => {
  const store = createFakeStore();
  await makeRecorder(store)(dto());
  assert.ok(!("expiresAt" in store.calls[0].update.$set));
  assert.ok("expiresAt" in store.calls[0].update.$setOnInsert);
});

test("the term is normalised and grouped by termKey", async () => {
  const store = createFakeStore();
  await makeRecorder(store)(dto({ q: "  Migraines  ", matches: matchesFor("migraines") }));
  const doc = store.docs.get(ID_A);
  assert.equal(doc.term, "migraines");
  assert.equal(doc.termKey, "migraine");
});

test("no-result and fallback searches are recorded with their outcome", async () => {
  const store = createFakeStore();
  await makeRecorder(store)(dto({ q: "zzzzqqq", matches: matchesFor("zzzzqqq") }));
  const doc = store.docs.get(ID_A);
  assert.equal(doc.outcome, "no_results");
  assert.equal(doc.resultCount, 0);
  assert.deepEqual(doc.resultTypes, []);
  assert.equal(doc.topResultPath, null);
});

// ── Dropped events ────────────────────────────────────────────────────────
test("identifying text drops the whole event: nothing is written", async () => {
  for (const [q, reason] of [
    ["mail me at a@b.com", "contact"], ["patient 10234", "number"], ["my name is raj", "selfid"],
    ["apt-2024-0073", "identifier"], ["dr rahul", "doctor"], ["i have had a really bad cough for about three weeks", "length"],
  ]) {
    const store = createFakeStore();
    const result = await makeRecorder(store)(dto({ q, matches: {} }));
    assert.equal(result.status, "dropped", q);
    assert.ok(result.reasons.includes(reason), `${q}: ${result.reasons}`);
    assert.equal(store.calls.length, 0, q);
  }
});

test("an event with a doctor result is dropped", async () => {
  const store = createFakeStore();
  const matches = matchesFor("rahul", ["doctor"]);
  assert.ok(matches.doctor.length > 0);
  const result = await makeRecorder(store)(dto({ q: "rahul", matches }));
  assert.deepEqual(result, { status: "dropped", reasons: ["doctor"] });
  assert.equal(store.calls.length, 0);
});

test("unusable text is invalid, not stored", async () => {
  const store = createFakeStore();
  for (const q of ["", "a", "x".repeat(2000), "!!"]) {
    const result = await makeRecorder(store)(dto({ q, matches: {} }));
    assert.ok(["invalid", "dropped"].includes(result.status), q);
  }
  assert.equal(store.calls.length, 0);
});

// ── Plain DTO only ────────────────────────────────────────────────────────
test("only the exact allowlisted plain object is accepted", async () => {
  const store = createFakeStore();
  const record = makeRecorder(store);

  class FakeRequest {
    constructor() {
      Object.assign(this, dto());
      this.ip = "203.0.113.9";
      this.headers = { "user-agent": "x" };
    }
  }
  const extras = ["ip", "headers", "user", "cookies", "patientId", "userAgent", "doctorId"];
  const rejected = [
    new FakeRequest(),
    ...extras.map((key) => ({ ...dto(), [key]: "x" })),
    (({ index, ...rest }) => rest)(dto()), // missing key
    dto({ interactionId: "nope" }),
    dto({ interactionId: ID_A.toUpperCase() }),
    dto({ settledBy: "instant" }),
    dto({ aiStatus: "maybe" }),
    dto({ matches: [] }),
    dto({ q: 42 }),
    null, undefined, "string", [], 5,
  ];
  for (const bad of rejected) assert.deepEqual(await record(bad), { status: "invalid" });
  assert.equal(store.calls.length, 0);
});

// ── Upsert, dedupe, full-wins ─────────────────────────────────────────────
test("the same interaction is stored once however often it is recorded", async () => {
  const store = createFakeStore();
  const record = makeRecorder(store);
  assert.equal((await record(dto())).status, "recorded");
  assert.equal((await record(dto())).status, "updated");
  assert.equal((await record(dto({ settledBy: "select" }))).status, "updated");
  assert.equal(store.docs.size, 1);
  await record(dto({ interactionId: ID_B }));
  assert.equal(store.docs.size, 2);
});

test("a later settled search in the same episode replaces the earlier idle one", async () => {
  const store = createFakeStore();
  const record = makeRecorder(store);
  await record(dto({ q: "diab", matches: matchesFor("diab") }));
  await record(dto({ q: "diabetes", matches: matchesFor("diabetes") }));
  assert.equal(store.docs.size, 1);
  assert.equal(store.docs.get(ID_A).term, "diabetes");
});

test("a submitted (full) event upgrades an earlier idle one", async () => {
  const store = createFakeStore();
  const record = makeRecorder(store);
  await record(dto());
  assert.equal((await record(fullDto())).status, "updated");
  assert.equal(store.docs.get(ID_A).settledBy, "submit");
});

test("a full event is never overwritten by a later idle, select or second submit", async () => {
  const store = createFakeStore();
  const record = makeRecorder(store);
  assert.equal((await record(fullDto({ q: "acne", matches: matchesFor("acne") }))).status, "recorded");
  const before = JSON.stringify(store.docs.get(ID_A));

  for (const late of [
    dto({ q: "migraine", matches: matchesFor("migraine") }),
    dto({ q: "migraine", settledBy: "select", matches: matchesFor("migraine") }),
    fullDto({ q: "migraine", matches: matchesFor("migraine") }),
  ]) {
    assert.deepEqual(await record(late), { status: "ignored" });
  }
  assert.equal(JSON.stringify(store.docs.get(ID_A)), before);
  assert.equal(store.docs.size, 1);
});

test("concurrent idle/select/submit requests end as one final submit document", async () => {
  for (const order of [["idle", "submit"], ["submit", "idle"], ["select", "submit", "idle"], ["idle", "idle", "submit", "select"]]) {
    const store = createFakeStore({ yieldBeforeInsert: true });
    const record = makeRecorder(store);
    const results = await Promise.all(order.map((settledBy) =>
      record(settledBy === "submit" ? fullDto() : dto({ settledBy }))));
    assert.ok(results.every((r) => ["recorded", "updated", "ignored"].includes(r.status)), JSON.stringify(results));
    assert.equal(results.filter((r) => r.status === "recorded").length, 1, order.join());
    assert.equal(store.docs.size, 1);
    assert.equal(store.docs.get(ID_A).settledBy, "submit", order.join());
    // Every racer past the first hit the unique index and fell back to the guarded update.
    assert.equal(store.calls.filter((c) => c.options.upsert === false).length, order.length - 1, order.join());
  }
});

test("duplicate submissions racing each other record exactly one document", async () => {
  const store = createFakeStore({ yieldBeforeInsert: true });
  const record = makeRecorder(store);
  const results = await Promise.all([record(fullDto()), record(fullDto()), record(fullDto())]);
  assert.equal(store.docs.size, 1);
  assert.equal(results.filter((r) => r.status === "recorded").length, 1);
  assert.ok(results.every((r) => r.status !== "error"));
});

// ── Duplicate-key retry ───────────────────────────────────────────────────
test("E11000 on the upsert is retried once as a plain guarded update", async () => {
  const store = createFakeStore({ failWith: (n) => (n === 1 ? duplicateKeyError() : null) });
  store.docs.set(ID_A, { interactionId: ID_A, settledBy: "idle", term: "old" });
  const result = await makeRecorder(store)(dto());
  assert.deepEqual(result, { status: "updated" });
  assert.equal(store.calls.length, 2);
  assert.equal(store.calls[0].options.upsert, true);
  assert.equal(store.calls[1].options.upsert, false);
  assert.deepEqual(store.calls[1].filter, store.calls[0].filter);
});

test("E11000 against a final submit is ignored", async () => {
  const store = createFakeStore();
  store.docs.set(ID_A, { interactionId: ID_A, settledBy: "submit", term: "kept" });
  assert.deepEqual(await makeRecorder(store)(dto()), { status: "ignored" });
  assert.equal(store.docs.get(ID_A).term, "kept");
  assert.equal(store.calls.length, 2); // upsert attempt, then one non-upsert retry - never a third
});

test("a second E11000 on the retry is reported as an error, without throwing", async () => {
  const store = createFakeStore({ failWith: () => duplicateKeyError() });
  const result = await makeRecorder(store)(dto());
  assert.deepEqual(result, { status: "error" });
  assert.equal(store.calls.length, 2);
});

// ── Failure isolation / safe logging ──────────────────────────────────────
test("storage failures never throw and log only a safe name and code", async () => {
  const secret = "my-secret-search-term";
  const logs = [];
  const failing = {
    updateOne: async () => {
      throw Object.assign(new Error(`write failed for ${secret} {"term":"${secret}"}`), { name: "MongoNetworkError", code: "ECONNRESET" });
    },
  };
  const result = await createSearchInteractionRecorder({ store: failing, now: () => NOW, logger: (...args) => logs.push(args) })(
    dto({ q: secret, matches: {} }),
  );
  assert.deepEqual(result, { status: "error" });
  assert.equal(logs.length, 1);
  const logged = logs[0].join(" ");
  assert.equal(logged, "[search-analytics] write failed: MongoNetworkError ECONNRESET");
  assert.ok(!logged.includes(secret) && !logged.includes("write failed for") && !logged.includes("term"));
});

test("an unexpected non-error rejection and a throwing logger are both contained", async () => {
  const store = { updateOne: async () => Promise.reject("boom text") }; // eslint-disable-line prefer-promise-reject-errors
  const record = createSearchInteractionRecorder({
    store, now: () => NOW,
    logger: () => { throw new Error("logger down"); },
  });
  assert.deepEqual(await record(dto()), { status: "error" });
});

test("a broken clock or catalog data is contained as well", async () => {
  const store = createFakeStore();
  const record = createSearchInteractionRecorder({ store, now: () => { throw new Error("clock"); }, logger: () => {} });
  assert.deepEqual(await record(dto()), { status: "error" });
  const badIndex = dto({ index: { categoryById: {}, specialtyById: {} } });
  assert.deepEqual(await makeRecorder(store)(badIndex), { status: "error" });
  assert.equal(store.calls.length, 0);
});

test("the default recorder is wired to the real model without touching the database", () => {
  const SearchInteraction = require("../../models/SearchInteraction");
  const { recordSearchInteraction } = require("../../services/searchAnalytics/recorder");
  assert.equal(typeof recordSearchInteraction, "function");
  assert.equal(typeof SearchInteraction.updateOne, "function");
});

// ── Awaited document validation ───────────────────────────────────────────
test("valid settled combinations pass validation and are written", async () => {
  for (const [settledBy, aiStatus] of [
    ["idle", "not_requested"], ["select", "not_requested"],
    ["submit", "not_needed"], ["submit", "used"], ["submit", "no_match"], ["submit", "unavailable"],
  ]) {
    const store = createFakeStore();
    const result = await makeRecorder(store)(dto({ settledBy, aiStatus }));
    assert.equal(result.status, "recorded", `${settledBy}/${aiStatus}`);
    assert.equal(store.calls.length, 1);
  }
});

test("cross-field invalid combinations are rejected before any write", async () => {
  for (const [settledBy, aiStatus] of [
    ["submit", "not_requested"], // a full search always has an AI status
    ["idle", "used"], ["idle", "not_needed"], ["select", "no_match"], ["select", "unavailable"], // settle never uses AI
  ]) {
    const store = createFakeStore();
    const result = await makeRecorder(store)(dto({ settledBy, aiStatus }));
    assert.deepEqual(result, { status: "invalid" }, `${settledBy}/${aiStatus}`);
    assert.equal(store.calls.length, 0, `${settledBy}/${aiStatus}`);
  }
});

test("a non-validation failure before the write is an error, not invalid", async () => {
  const store = createFakeStore();
  const logs = [];
  // A catalog index that makes classification throw a TypeError: contained as an error.
  const result = await createSearchInteractionRecorder({ store, now: () => NOW, logger: (m) => logs.push(m) })(
    dto({ index: { categoryById: {}, specialtyById: {} } }),
  );
  assert.deepEqual(result, { status: "error" });
  assert.equal(store.calls.length, 0);
  assert.deepEqual(logs, ["[search-analytics] write failed: TypeError none"]);
});

test("the recorder awaits document validation and never uses validateSync", () => {
  const src = require("node:fs").readFileSync(require.resolve("../../services/searchAnalytics/recorder"), "utf8");
  assert.ok(/await new SearchInteraction\(built\.doc\)\.validate\(\)/.test(src));
  assert.ok(!/validateSync/.test(src));
});
