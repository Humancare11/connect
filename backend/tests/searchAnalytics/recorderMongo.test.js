// The Phase 1/2 recorder against a REAL MongoDB (an ephemeral mongodb-memory-
// server instance, the repository's established test pattern). This closes the
// gap that earlier phases could only test the guarded upsert against an
// in-memory fake: here the filter, upsert, unique index (E11000), timestamps
// and TTL are executed by an actual server.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const SearchInteraction = require("../../models/SearchInteraction");
const { createSearchInteractionRecorder } = require("../../services/searchAnalytics/recorder");
const { buildFixtureCatalog } = require("../search/fixtures");
const { matchCatalog } = require("../../services/search/deterministicMatcher");
const { validateQuery } = require("../../services/search/queryNormalizer");
const { DEFAULT_SEARCH_TYPES } = require("../../services/search/searchConstants");

const ID_A = "6f1c2a9e-3b7d-4c58-9a1e-0d2f5b8e7c41";
const ID_B = "0b9d2c4e-8a1f-4e7b-b3c5-5d6e7f8a9b0c";
const DAY = 24 * 60 * 60 * 1000;

describe("recorder against a real MongoDB", { timeout: 240000 }, () => {
  let mongod;
  let catalog;
  let record;
  const logs = [];

  before(async () => {
    ({ catalog } = await buildFixtureCatalog());
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await SearchInteraction.createIndexes();
    record = createSearchInteractionRecorder({ logger: (m) => logs.push(m) }); // default store: the real model
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await SearchInteraction.collection.deleteMany({});
    logs.length = 0;
  });

  const dto = (overrides = {}) => {
    const q = overrides.q || "acne";
    return {
      interactionId: ID_A, q, settledBy: "idle", aiStatus: "not_requested",
      matches: matchCatalog(catalog, validateQuery(q), { types: DEFAULT_SEARCH_TYPES }), index: catalog.index, ...overrides,
    };
  };
  const submit = (overrides = {}) => dto({ settledBy: "submit", aiStatus: "not_needed", ...overrides });
  const docs = () => SearchInteraction.collection.find({}).toArray();

  test("first write inserts a document with timestamps and a 90-day expiry", async () => {
    const before = Date.now();
    assert.deepEqual(await record(dto()), { status: "recorded" });
    const [doc] = await docs();
    assert.equal(doc.interactionId, ID_A);
    assert.equal(doc.term, "acne");
    assert.equal(doc.settledBy, "idle");
    assert.ok(doc.createdAt instanceof Date && doc.updatedAt instanceof Date);
    assert.ok(Math.abs(doc.expiresAt.getTime() - (before + 90 * DAY)) < 5000);
    assert.equal(doc.__v, undefined);
    assert.deepEqual(Object.keys(doc).sort(), [
      "_id", "aiStatus", "createdAt", "dedicatedPageAvailable", "expiresAt", "interactionId", "outcome", "resultCount",
      "resultTypes", "schemaVersion", "settledBy", "term", "termKey", "topResultDedicated", "topResultPath", "topResultType",
      "topScore", "updatedAt",
    ]);
  });

  test("repeats update the same document: later settles replace the text, createdAt and expiresAt stay", async () => {
    await record(dto({ q: "diab" }));
    const [first] = await docs();
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.deepEqual(await record(dto({ q: "diabetes", settledBy: "select" })), { status: "updated" });
    const all = await docs();
    assert.equal(all.length, 1);
    assert.equal(all[0].term, "diabetes");
    assert.equal(all[0].settledBy, "select");
    assert.equal(all[0].createdAt.getTime(), first.createdAt.getTime());
    assert.equal(all[0].expiresAt.getTime(), first.expiresAt.getTime());
    assert.ok(all[0].updatedAt.getTime() > first.updatedAt.getTime());
  });

  test("a full submission upgrades a settle and is then never overwritten (real E11000 + guarded retry)", async () => {
    await record(dto());
    assert.deepEqual(await record(submit()), { status: "updated" });
    const [final] = await docs();
    assert.equal(final.settledBy, "submit");
    for (const late of [dto({ q: "migraine" }), dto({ q: "migraine", settledBy: "select" }), submit({ q: "migraine" })]) {
      assert.deepEqual(await record(late), { status: "ignored" });
    }
    const [after] = await docs();
    assert.equal(after.term, "acne");
    assert.equal(after.settledBy, "submit");
    assert.equal(after.updatedAt.getTime(), final.updatedAt.getTime());
    assert.equal((await docs()).length, 1);
    assert.deepEqual(logs, []); // the duplicate-key path is expected and silent
  });

  test("a first submission is final immediately", async () => {
    assert.deepEqual(await record(submit()), { status: "recorded" });
    assert.deepEqual(await record(dto({ q: "migraine" })), { status: "ignored" });
    assert.equal((await docs())[0].term, "acne");
  });

  test("concurrent mixed events end as exactly one submitted document", async () => {
    for (let round = 0; round < 5; round += 1) {
      await SearchInteraction.collection.deleteMany({});
      const events = [];
      for (let i = 0; i < 6; i += 1) {
        events.push(dto({ settledBy: i % 2 ? "select" : "idle" }), submit({ q: i % 3 ? "acne" : "acne" }), dto({ interactionId: ID_B }));
      }
      const results = await Promise.all(events.map((event) => record(event)));
      assert.ok(results.every((r) => ["recorded", "updated", "ignored"].includes(r.status)), JSON.stringify(results));
      const stored = await docs();
      assert.equal(stored.length, 2, `round ${round}`);
      assert.equal(stored.find((d) => d.interactionId === ID_A).settledBy, "submit");
      assert.equal(results.filter((r) => r.status === "recorded").length, 2); // one insert per interaction
    }
    assert.deepEqual(logs, []);
  });

  test("the unique index really enforces one document per interaction", async () => {
    await record(dto());
    await assert.rejects(SearchInteraction.collection.insertOne({ interactionId: ID_A }), (err) => err.code === 11000);
  });

  test("dropped events write nothing", async () => {
    for (const q of ["mail me at a@b.com", "patient 10234", "my name is raj", "dr rahul"]) {
      const result = await record(dto({ q, matches: {} }));
      assert.equal(result.status, "dropped", q);
    }
    assert.equal((await docs()).length, 0);
  });

  test("a database failure is contained and logged by name and code only", async () => {
    const failing = createSearchInteractionRecorder({
      store: { updateOne: () => SearchInteraction.collection.insertOne({ interactionId: ID_A }).then(() => SearchInteraction.collection.insertOne({ interactionId: ID_A })) },
      logger: (m) => logs.push(m),
    });
    // The second insert raises a real E11000 that the recorder treats as "already exists", retried via the same failing store.
    const result = await failing(dto());
    assert.equal(result.status, "error");
    assert.ok(logs.every((m) => /^\[search-analytics\] write failed: \w+ \w+$/.test(m)));
    assert.ok(!logs.join(" ").includes("acne") && !logs.join(" ").includes("duplicate key"));
  });
});
