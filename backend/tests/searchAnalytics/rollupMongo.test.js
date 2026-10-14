// Rollup tests against a REAL MongoDB (mongodb-memory-server, the repository's
// established pattern): an ephemeral in-memory instance with its own data,
// started and stopped by this file. Nothing here touches any configured
// database. The instance runs with a 1 s TTL monitor so TTL deletion can be
// observed for real.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const SearchInteraction = require("../../models/SearchInteraction");
const SearchTermDailyStat = require("../../models/SearchTermDailyStat");
const { runRollup, rollupDay, selectDays, startOfUtcDay, addDays, dayKey, expiryFor } = require("../../services/searchAnalytics/rollup");
const { interaction, many } = require("./rawInteractions");

const DAY = 24 * 60 * 60 * 1000;
const D = new Date("2026-10-08T00:00:00.000Z"); // the closed day most tests roll up
const NOW = new Date("2026-10-09T09:00:00.000Z"); // 09:00 UTC the next day
const at = (day, time) => `${dayKey(day)}T${time}Z`;
const quiet = () => {};

describe("search analytics rollup (real MongoDB)", { timeout: 240000 }, () => {
  let mongod;

  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { args: ["--setParameter", "ttlMonitorSleepSecs=1"] } });
    await mongoose.connect(mongod.getUri());
    await Promise.all([SearchInteraction.createIndexes(), SearchTermDailyStat.createIndexes()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await SearchInteraction.collection.deleteMany({});
    await SearchTermDailyStat.collection.deleteMany({});
  });

  const seed = (docs) => SearchInteraction.collection.insertMany(docs);
  const stats = (filter = {}) => SearchTermDailyStat.collection.find(filter).sort({ _id: 1 }).toArray();
  const roll = (options = {}) => runRollup({ now: NOW, logger: quiet, ...options });
  // Rows without the run-dependent timestamp, for exact comparisons.
  const stable = (rows) => rows.map(({ computedAt, ...rest }) => rest);

  // ── Real indexes and TTL ────────────────────────────────────────────────
  test("real indexes: rollup TTL on expiresAt, raw unique id and raw TTL", async () => {
    const rollupIndexes = await SearchTermDailyStat.collection.indexes();
    const ttl = rollupIndexes.find((index) => index.key.expiresAt === 1);
    assert.equal(ttl.expireAfterSeconds, 0);
    assert.ok(rollupIndexes.some((index) => JSON.stringify(index.key) === JSON.stringify({ day: 1, kind: 1 })));
    assert.ok(rollupIndexes.some((index) => JSON.stringify(index.key) === JSON.stringify({ termKey: 1, day: -1 })));

    const rawIndexes = await SearchInteraction.collection.indexes();
    assert.equal(rawIndexes.find((index) => index.key.interactionId === 1).unique, true);
    assert.equal(rawIndexes.find((index) => index.key.expiresAt === 1).expireAfterSeconds, 0);
    assert.equal(rawIndexes.length, 6); // _id + 5
  });

  test("real TTL deletion: expired rollup rows and expired raw interactions are removed, live ones stay", async () => {
    const past = new Date(Date.now() - 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await seed([interaction({ term: "gone", expiresAt: past }), interaction({ term: "kept", expiresAt: future })]);
    const base = {
      kind: "other", termKey: null, term: null, interactions: 0,
      bySettledBy: { idle: 0, select: 0, submit: 0 }, outcomes: { dedicated_page_found: 0, fallback_only: 0, no_results: 0 },
      aiStatuses: { not_requested: 0, not_needed: 0, used: 0, no_match: 0, unavailable: 0 }, dedicatedPageAvailableCount: 0,
      distinctTerms: 0, finalized: true, computedAt: new Date(), schemaVersion: 1, day: D,
    };
    await SearchTermDailyStat.collection.insertMany([
      { ...base, _id: "2020-01-01|other|", expiresAt: past }, { ...base, _id: "2026-10-08|other|", expiresAt: future },
    ]);
    const deadline = Date.now() + 30000;
    let rawLeft;
    let statLeft;
    do {
      await new Promise((resolve) => setTimeout(resolve, 500));
      [rawLeft, statLeft] = await Promise.all([SearchInteraction.collection.countDocuments(), SearchTermDailyStat.collection.countDocuments()]);
    } while ((rawLeft !== 1 || statLeft !== 1) && Date.now() < deadline);
    assert.equal(rawLeft, 1);
    assert.equal(statLeft, 1);
    assert.equal((await SearchInteraction.collection.findOne({})).term, "kept");
    assert.equal((await SearchTermDailyStat.collection.findOne({}))._id, "2026-10-08|other|");
  });

  test("rollup rows expire 13 calendar months after their day", async () => {
    assert.equal(expiryFor(D).toISOString(), "2027-11-08T00:00:00.000Z");
    // Calendar-month arithmetic: Jan 31 + 13 months has no Feb 31, so it rolls over into March.
    assert.equal(expiryFor(new Date("2026-01-31T00:00:00.000Z")).toISOString(), "2027-03-03T00:00:00.000Z");
    await seed(many(3, { createdAt: at(D, "10:00:00.000") }));
    await roll();
    const [term] = await stats({ kind: "term" });
    assert.equal(term.expiresAt.toISOString(), "2027-11-08T00:00:00.000Z");
  });

  // ── Aggregation ─────────────────────────────────────────────────────────
  test("counts a day by settledBy, outcome, aiStatus and top result path", async () => {
    await seed([
      ...many(2, { term: "acne", settledBy: "idle", createdAt: at(D, "08:00:00.000") }),
      ...many(1, { term: "acne", settledBy: "select", createdAt: at(D, "09:00:00.000") }),
      ...many(2, { term: "acne", settledBy: "submit", aiStatus: "used", createdAt: at(D, "10:00:00.000") }),
      ...many(1, { term: "acne", settledBy: "submit", aiStatus: "unavailable", outcome: "fallback_only", createdAt: at(D, "11:00:00.000") }),
      ...many(1, { term: "acne", settledBy: "idle", outcome: "no_results", createdAt: at(D, "12:00:00.000") }),
    ]);
    const summary = await roll();
    assert.deepEqual(summary.failed, []);
    const [row] = await stats({ _id: "2026-10-08|term|acne" });
    assert.equal(row.interactions, 7);
    assert.deepEqual(row.bySettledBy, { idle: 3, select: 1, submit: 3 });
    assert.deepEqual(row.outcomes, { dedicated_page_found: 5, fallback_only: 1, no_results: 1 });
    assert.deepEqual(row.aiStatuses, { not_requested: 4, not_needed: 0, used: 2, no_match: 0, unavailable: 1 });
    assert.equal(row.dedicatedPageAvailableCount, 5);
    assert.equal(row.topResultPath, "/skin-and-hair-care/dermatology/acne");
    assert.equal(row.topResultPathCount, 5);
    assert.equal(row.topResultDedicated, true);
    assert.equal(row.term, "acne");
    assert.equal(row.kind, "term");
    assert.equal(row.day.toISOString(), "2026-10-08T00:00:00.000Z");
    assert.equal(row.finalized, true); // NOW is 9 h after the day ended (the grace period is 2 h)
    assert.equal(row.distinctTerms, null);
  });

  test("the representative spelling and top path are deterministic (most common, ties to the smallest)", async () => {
    await seed([
      ...many(2, { term: "knee pain", termKey: "knee pain", topResultPath: "/b-page", createdAt: at(D, "08:00:00.000") }),
      ...many(2, { term: "knee pains", termKey: "knee pain", topResultPath: "/a-page", createdAt: at(D, "08:30:00.000") }),
      ...many(1, { term: "knee pain", termKey: "knee pain", topResultPath: "/c-page", topResultDedicated: false, createdAt: at(D, "09:00:00.000") }),
    ]);
    await roll();
    const row = await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|knee pain" });
    assert.equal(row.term, "knee pain"); // 3 vs 2
    assert.equal(row.topResultPath, "/a-page"); // 2 vs 2 vs 1: tie goes to the smaller path
    assert.equal(row.topResultPathCount, 2);
  });

  test("a term with no top result path stores null path fields", async () => {
    await seed(many(3, { term: "zzzz", outcome: "no_results", createdAt: at(D, "08:00:00.000") }));
    await roll();
    const row = await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|zzzz" });
    assert.equal(row.topResultPath, null);
    assert.equal(row.topResultPathCount, null);
    assert.equal(row.topResultDedicated, null);
    assert.equal(row.outcomes.no_results, 3);
  });

  // ── UTC boundaries ──────────────────────────────────────────────────────
  test("a day is exactly [00:00:00.000, 24:00:00.000) UTC", async () => {
    const next = addDays(D, 1);
    const prev = addDays(D, -1);
    await seed([
      ...many(3, { term: "edge", createdAt: at(D, "00:00:00.000") }), // first instant of the day
      ...many(3, { term: "edge", createdAt: at(D, "23:59:59.999") }), // last instant of the day
      ...many(1, { term: "before", createdAt: at(prev, "23:59:59.999") }),
      ...many(1, { term: "after", createdAt: at(next, "00:00:00.000") }),
    ]);
    await rollupDay(D, { Interaction: SearchInteraction, Stat: SearchTermDailyStat, now: NOW });
    const rows = await stats();
    assert.deepEqual(rows.map((row) => row._id), ["2026-10-08|other|", "2026-10-08|term|edge"]);
    assert.equal(rows[1].interactions, 6);
    assert.equal(rows[0].interactions, 0); // 'before' and 'after' belong to other days
    assert.equal(rows[0].distinctTerms, 0);
  });

  test("days are UTC regardless of the process time zone", async () => {
    assert.equal(startOfUtcDay(new Date("2026-10-08T23:59:59.999Z")).toISOString(), "2026-10-08T00:00:00.000Z");
    assert.equal(startOfUtcDay(new Date("2026-10-09T00:00:00.000Z")).toISOString(), "2026-10-09T00:00:00.000Z");
    assert.equal(dayKey(new Date("2026-03-29T23:30:00.000Z")), "2026-03-29");
    // A late-evening UTC interaction is not pulled into the next local day.
    await seed(many(3, { term: "late", createdAt: "2026-10-08T23:30:00.000Z" }));
    await roll();
    assert.ok(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|late" }));
    assert.equal(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-09|term|late" }), null);
  });

  // ── k = 3 suppression and the "other" bucket ────────────────────────────
  test("terms below 3 interactions are folded into 'other' as counts, with no term text", async () => {
    await seed([
      ...many(3, { term: "diabetes", createdAt: at(D, "08:00:00.000") }),
      ...many(2, { term: "rare thing alpha", settledBy: "submit", aiStatus: "used", createdAt: at(D, "09:00:00.000") }),
      ...many(1, { term: "rare thing beta", outcome: "no_results", createdAt: at(D, "10:00:00.000") }),
      ...many(1, { term: "rare thing gamma", outcome: "fallback_only", settledBy: "select", createdAt: at(D, "11:00:00.000") }),
    ]);
    await roll();
    const rows = await stats({ day: D });
    assert.deepEqual(rows.map((row) => row._id), ["2026-10-08|other|", "2026-10-08|term|diabetes"]);
    const other = rows[0];
    assert.equal(other.interactions, 4);
    assert.equal(other.distinctTerms, 3);
    assert.deepEqual(other.bySettledBy, { idle: 1, select: 1, submit: 2 });
    assert.deepEqual(other.outcomes, { dedicated_page_found: 2, fallback_only: 1, no_results: 1 });
    assert.deepEqual(other.aiStatuses, { not_requested: 2, not_needed: 0, used: 2, no_match: 0, unavailable: 0 });
    assert.equal(other.term, null);
    assert.equal(other.termKey, null);
    assert.equal(other.topResultPath, null);
    // The folded text appears nowhere in the rollup collection.
    const everything = JSON.stringify(await stats());
    for (const secret of ["rare thing", "alpha", "beta", "gamma"]) assert.ok(!everything.includes(secret), secret);
    assert.ok(everything.includes("diabetes"));
  });

  test("the threshold is exactly 3: 3 qualifies, 2 does not", async () => {
    await seed([...many(3, { term: "three", createdAt: at(D, "08:00:00.000") }), ...many(2, { term: "two", createdAt: at(D, "08:00:00.000") })]);
    await roll();
    assert.ok(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|three" }));
    assert.equal(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|two" }), null);
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|other|" })).interactions, 2);
  });

  test("k is applied per day: 2 + 2 on two different days never combine", async () => {
    const prev = addDays(D, -1);
    await seed([...many(2, { term: "slow burn", createdAt: at(prev, "12:00:00.000") }), ...many(2, { term: "slow burn", createdAt: at(D, "12:00:00.000") })]);
    await roll();
    assert.equal((await stats({ kind: "term" })).length, 0);
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|other|" })).interactions, 2);
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-07|other|" })).interactions, 2);
  });

  test("every processed day gets an 'other' row, even with no interactions", async () => {
    await roll();
    const rows = await stats();
    assert.deepEqual(rows.map((row) => row._id), ["2026-10-07|other|", "2026-10-08|other|"]); // the two most recent closed days
    for (const row of rows) {
      assert.equal(row.interactions, 0);
      assert.equal(row.distinctTerms, 0);
    }
  });

  // ── Finalization ────────────────────────────────────────────────────────
  test("a day is finalized only 2 hours after it ended", async () => {
    await seed(many(3, { term: "acne", createdAt: at(D, "20:00:00.000") }));
    await roll({ now: new Date("2026-10-09T01:59:59.999Z") });
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|other|" })).finalized, false);
    await roll({ now: new Date("2026-10-09T02:00:00.000Z") });
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|other|" })).finalized, true);
  });

  // ── Idempotency and reruns ──────────────────────────────────────────────
  test("running again never duplicates or adds to the counts", async () => {
    await seed([
      ...many(4, { term: "acne", createdAt: at(D, "08:00:00.000") }),
      ...many(3, { term: "migraine", settledBy: "submit", createdAt: at(D, "09:00:00.000") }),
      ...many(2, { term: "rare", createdAt: at(D, "10:00:00.000") }),
      ...many(3, { term: "acne", createdAt: at(addDays(D, -1), "08:00:00.000") }),
    ]);
    await roll();
    const first = stable(await stats());
    for (let i = 0; i < 3; i += 1) assert.deepEqual((await roll()).failed, []);
    const again = stable(await stats());
    assert.deepEqual(again, first);
    assert.equal(again.length, 5); // 2 days x other + acne(D-1) + acne(D) + migraine(D)
    assert.equal(new Set(again.map((row) => row._id)).size, again.length);
  });

  test("concurrent runs (two instances) produce the same single set of rows", async () => {
    await seed([...many(5, { term: "acne", createdAt: at(D, "08:00:00.000") }), ...many(2, { term: "rare", createdAt: at(D, "09:00:00.000") })]);
    const results = await Promise.all([roll(), roll(), roll()]);
    for (const result of results) assert.deepEqual(result.failed, []);
    const rows = await stats({ day: D });
    assert.deepEqual(rows.map((row) => row._id), ["2026-10-08|other|", "2026-10-08|term|acne"]);
    assert.equal(rows[1].interactions, 5);
    assert.equal(rows[0].interactions, 2);
  });

  test("a rerun picks up late changes by replacing, not adding: counts follow the raw data", async () => {
    await seed(many(3, { term: "acne", settledBy: "idle", createdAt: at(D, "23:50:00.000") }));
    await roll({ now: new Date("2026-10-09T00:30:00.000Z") });
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" })).bySettledBy.submit, 0);
    // Late upgrade of two interactions from idle to submit, plus one new interaction.
    for (let i = 0; i < 2; i += 1) {
      await SearchInteraction.collection.updateOne({ term: "acne", settledBy: "idle" }, { $set: { settledBy: "submit", aiStatus: "not_needed" } });
    }
    await seed(many(1, { term: "acne", settledBy: "submit", createdAt: at(D, "23:55:00.000") }));
    await roll({ now: new Date("2026-10-09T03:00:00.000Z") });
    const row = await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" });
    assert.equal(row.interactions, 4); // not 3 + 4
    assert.deepEqual(row.bySettledBy, { idle: 1, select: 0, submit: 3 });
    assert.deepEqual(row.aiStatuses, { not_requested: 1, not_needed: 3, used: 0, no_match: 0, unavailable: 0 });
    assert.equal(row.finalized, true);
  });

  test("a term that stops qualifying loses its row and is folded into 'other'", async () => {
    await seed(many(3, { term: "acne", createdAt: at(D, "08:00:00.000") }));
    await roll({ now: new Date("2026-10-09T01:00:00.000Z") });
    assert.ok(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" }));
    await SearchInteraction.collection.deleteOne({ term: "acne" }); // e.g. the TTL removed one
    await roll({ now: new Date("2026-10-09T01:30:00.000Z") });
    assert.equal(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" }), null);
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|other|" })).interactions, 2);
  });

  test("finalized older days are left alone; only the two most recent closed days are recomputed", async () => {
    const old = addDays(D, -4); // 2026-10-04
    await seed(many(3, { term: "acne", createdAt: at(old, "08:00:00.000") }));
    await seed(many(3, { term: "acne", createdAt: at(D, "08:00:00.000") }));
    await roll();
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: `${dayKey(old)}|term|acne` })).interactions, 3);
    await seed(many(2, { term: "acne", createdAt: at(old, "09:00:00.000") })); // changes a finalized old day
    await seed(many(2, { term: "acne", createdAt: at(D, "09:00:00.000") })); // changes a recent day
    await roll();
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: `${dayKey(old)}|term|acne` })).interactions, 3); // untouched
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" })).interactions, 5); // recomputed
  });

  test("after downtime, every missed closed day is caught up in one run", async () => {
    for (let back = 1; back <= 6; back += 1) {
      await seed(many(3, { term: `topic ${back}`, createdAt: at(addDays(startOfUtcDay(NOW), -back), "12:00:00.000") }));
    }
    const summary = await roll();
    assert.equal(summary.processed.length, 6);
    assert.equal((await stats({ kind: "term" })).length, 6);
    assert.equal((await stats({ kind: "other" })).length, 6);
  });

  // ── Partial failures ────────────────────────────────────────────────────
  test("one failing day does not stop the others, and the next run completes it", async () => {
    const bad = addDays(D, -1);
    await seed([
      ...many(3, { term: "good", createdAt: at(D, "08:00:00.000") }),
      ...many(3, { term: "bad", createdAt: at(bad, "08:00:00.000") }),
    ]);
    const logs = [];
    let failing = true;
    const flaky = {
      findOne: (...args) => SearchInteraction.findOne(...args),
      aggregate: (pipeline, options) => {
        const range = pipeline[0].$match.createdAt;
        if (failing && range && range.$gte.getTime() === bad.getTime()) {
          return Promise.reject(Object.assign(new Error("boom: secret term bad a@b.com 5551234567"), { name: "MongoNetworkError" }));
        }
        return SearchInteraction.aggregate(pipeline, options);
      },
    };
    const first = await runRollup({ now: NOW, Interaction: flaky, logger: (m) => logs.push(m) });
    assert.deepEqual(first.failed, ["2026-10-07"]);
    assert.deepEqual(first.processed, ["2026-10-08"]);
    assert.ok(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|good" }));
    assert.equal(await SearchTermDailyStat.collection.findOne({ _id: "2026-10-07|other|" }), null); // nothing half-written
    assert.deepEqual(logs, ["[search-analytics] rollup failed for 2026-10-07: MongoNetworkError"]);

    failing = false;
    const second = await runRollup({ now: NOW, Interaction: flaky, logger: (m) => logs.push(m) });
    assert.deepEqual(second.failed, []);
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-07|term|bad" })).interactions, 3);
    assert.equal(logs.length, 1);
  });

  test("a failing write is contained and leaves no partial day behind that counts as done", async () => {
    await seed(many(3, { term: "acne", createdAt: at(D, "08:00:00.000") }));
    const logs = [];
    const failingStat = Object.assign(function Stat(row) { return new SearchTermDailyStat(row); }, {
      find: (...args) => SearchTermDailyStat.find(...args),
      bulkWrite: () => Promise.reject(Object.assign(new Error("write failed for acne"), { name: "MongoServerError", code: 13 })),
      deleteMany: (...args) => SearchTermDailyStat.deleteMany(...args),
    });
    const summary = await runRollup({ now: NOW, Stat: failingStat, logger: (m) => logs.push(m) });
    assert.deepEqual(summary.processed, []);
    assert.equal(summary.failed.length, 2);
    assert.ok(logs.every((m) => /^\[search-analytics\] rollup failed for \d{4}-\d{2}-\d{2}: MongoServerError$/.test(m)));
    assert.ok(!logs.join(" ").includes("acne"));
    assert.equal((await stats()).length, 0);
  });

  test("planning failures never throw and are logged by name only", async () => {
    const logs = [];
    const broken = { findOne: () => { throw Object.assign(new Error("secret doc {term: 'acne'}"), { name: "MongoServerSelectionError" }); } };
    const summary = await runRollup({ now: NOW, Interaction: broken, logger: (m) => logs.push(m) });
    assert.deepEqual(summary, { processed: [], failed: ["plan"], backlogAlarm: false });
    assert.deepEqual(logs, ["[search-analytics] rollup planning failed: MongoServerSelectionError"]);
  });

  test("unexpected raw data fails only its day (by error name) and is retried later", async () => {
    await seed([...many(3, { term: "fine", createdAt: at(D, "08:00:00.000") }), ...many(3, { term: "weird", outcome: "no_results", createdAt: at(addDays(D, -1), "08:00:00.000") })]);
    await SearchInteraction.collection.updateMany({ term: "weird" }, { $set: { outcome: "something_else" } });
    const logs = [];
    const summary = await runRollup({ now: NOW, logger: (m) => logs.push(m) });
    assert.deepEqual(summary.processed, ["2026-10-08"]);
    assert.deepEqual(summary.failed, ["2026-10-07"]);
    assert.deepEqual(logs, ["[search-analytics] rollup failed for 2026-10-07: RollupDataError"]);
  });

  test("logging is safe in every failure mode: no text, documents, addresses or messages", async () => {
    await seed(many(3, { term: "secretterm", createdAt: at(D, "08:00:00.000") }));
    const logs = [];
    const leaky = {
      findOne: (...a) => SearchInteraction.findOne(...a),
      aggregate: () => Promise.reject(Object.assign(new Error("secretterm 203.0.113.9 patient 10234 {\"term\":\"secretterm\"}"), { name: "MongoServerError" })),
    };
    await runRollup({ now: NOW, Interaction: leaky, logger: (m) => logs.push(m) });
    await runRollup({ now: NOW, Interaction: { findOne: () => { throw new Error("secretterm"); } }, logger: (m) => logs.push(m) });
    await runRollup({ now: NOW, logger: () => { throw new Error("logger down"); } }); // a throwing logger is contained too
    assert.ok(logs.length >= 3);
    for (const message of logs) {
      assert.match(message, /^\[search-analytics\] rollup (failed for \d{4}-\d{2}-\d{2}|planning failed): \w+$/);
      for (const forbidden of ["secretterm", "203.0.113.9", "10234", "{"]) assert.ok(!message.includes(forbidden), message);
    }
  });

  // ── Isolation ───────────────────────────────────────────────────────────
  test("the rollup only reads raw interactions and stores only counts and public paths", async () => {
    await seed([...many(3, { term: "acne", createdAt: at(D, "08:00:00.000") }), ...many(2, { term: "rare", createdAt: at(D, "08:00:00.000") })]);
    const before = JSON.stringify(await SearchInteraction.collection.find({}).sort({ interactionId: 1 }).toArray());
    await roll();
    await roll();
    assert.equal(JSON.stringify(await SearchInteraction.collection.find({}).sort({ interactionId: 1 }).toArray()), before);
    const allowed = new Set([
      "_id", "day", "kind", "termKey", "term", "interactions", "bySettledBy", "outcomes", "aiStatuses", "dedicatedPageAvailableCount",
      "topResultPath", "topResultPathCount", "topResultDedicated", "distinctTerms", "finalized", "computedAt", "schemaVersion", "expiresAt",
    ]);
    for (const row of await stats()) for (const key of Object.keys(row)) assert.ok(allowed.has(key), key);
    const raw = JSON.stringify(await stats());
    assert.ok(!raw.includes("interactionId") && !/0000-4000-8000/.test(raw), "no interaction ids in the rollup");
  });

  test("the scheduled job end to end: flag off writes nothing, flag on rolls the data up", async () => {
    const { createSearchAnalyticsJob } = require("../../jobs/searchAnalyticsJobs");
    await seed(many(3, { term: "acne", createdAt: at(D, "08:00:00.000") }));
    let enabled = false;
    const job = createSearchAnalyticsJob({ isEnabled: () => enabled, run: () => runRollup({ now: NOW, logger: quiet }), logger: quiet });
    assert.equal(await job.tick(), "disabled");
    assert.equal((await stats()).length, 0); // off by default: no marker rows, no writes at all
    enabled = true;
    assert.equal(await job.tick(), "done");
    assert.equal((await SearchTermDailyStat.collection.findOne({ _id: "2026-10-08|term|acne" })).interactions, 3);
    const rows = stable(await stats());
    assert.equal(await job.tick(), "done"); // the next hourly tick changes nothing
    assert.deepEqual(stable(await stats()), rows);
  });

  test("days older than 89 days and days in the future are never written", async () => {
    await seed([...many(3, { term: "ancient", createdAt: "2026-05-01T12:00:00.000Z" }), ...many(3, { term: "today", createdAt: "2026-10-09T08:00:00.000Z" })]);
    await roll();
    const ids = (await stats()).map((row) => row._id);
    assert.ok(!ids.some((id) => id.startsWith("2026-05-01")));
    assert.ok(!ids.some((id) => id.startsWith("2026-10-09"))); // today is not closed yet
  });
});

// ── Pure day selection (no database) ─────────────────────────────────────────
describe("selectDays", () => {
  const now = new Date("2026-10-09T09:00:00.000Z");
  const keys = (result) => result.days.map(dayKey);
  const finalized = (...days) => new Map(days.map((day) => [day, true]));

  test("with no raw data only the two most recent closed days are processed", () => {
    assert.deepEqual(keys(selectDays({ now, oldestRawAt: null, finalizedByDay: new Map() })), ["2026-10-07", "2026-10-08"]);
  });

  test("recent days are always recomputed, older finalized days are skipped, unfinalized ones are caught up", () => {
    const result = selectDays({
      now, oldestRawAt: new Date("2026-10-03T05:00:00.000Z"),
      finalizedByDay: finalized("2026-10-03", "2026-10-04", "2026-10-07", "2026-10-08"),
    });
    assert.deepEqual(keys(result), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
    const withUnfinalized = selectDays({ now, oldestRawAt: new Date("2026-10-03T05:00:00.000Z"), finalizedByDay: new Map([["2026-10-04", false]]) });
    assert.ok(keys(withUnfinalized).includes("2026-10-04"));
  });

  test("never today, never older than 89 days, oldest first", () => {
    const result = selectDays({ now, oldestRawAt: new Date("2026-01-01T00:00:00.000Z"), finalizedByDay: new Map() });
    const list = keys(result);
    assert.equal(list.at(-1), "2026-10-08");
    assert.ok(!list.includes("2026-10-09"));
    assert.equal(list[0], "2026-07-12"); // today - 89 days
    assert.deepEqual([...list].sort(), list);
  });

  test("a backlog older than 80 days raises the alarm; recent or finalized days do not", () => {
    const old = selectDays({ now, oldestRawAt: new Date("2026-07-12T00:00:00.000Z"), finalizedByDay: new Map() });
    assert.equal(old.backlogAlarm, true);
    const fine = selectDays({ now, oldestRawAt: new Date("2026-10-01T00:00:00.000Z"), finalizedByDay: new Map() });
    assert.equal(fine.backlogAlarm, false);
    const allDone = selectDays({
      now, oldestRawAt: new Date("2026-07-12T00:00:00.000Z"),
      finalizedByDay: new Map(Array.from({ length: 90 }, (_, i) => [dayKey(addDays(startOfUtcDay(now), -i - 1)), true])),
    });
    assert.equal(allDone.backlogAlarm, false);
  });

  test("at most 100 days per run", () => {
    const wide = selectDays({ now: new Date("2030-01-01T00:00:00.000Z"), oldestRawAt: new Date("2029-10-05T00:00:00.000Z"), finalizedByDay: new Map() });
    assert.ok(wide.days.length <= 100);
  });
});
