// /trend execution budget: bounded time, bounded database operations, bounded live
// days, bounded concurrency. No database: Stat / Interaction are counting fakes, so
// these tests also show EXACTLY how many operations a request is allowed to run.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { loadTrend } = require("../../services/searchAnalytics/adminQueries");
const { parseWindow, dayKey, addDays } = require("../../services/searchAnalytics/adminParams");
const { TREND_LIMITS, TrendBudgetError, createBudget, createGate } = require("../../services/searchAnalytics/trendBudget");

const NOW = new Date("2026-10-09T09:00:00.000Z");
const windowOf = (from, to) => parseWindow({ from, to }, { maxDays: 396, now: NOW });
const never = () => new Promise(() => {});

// Fakes that count every operation. `finalized` = days the rollup already holds;
// `withData` = days that hold raw interactions.
function fakes({ finalized = [], withData = [], hang = null } = {}) {
  const ops = { find: 0, statAggregate: 0, rawAggregate: 0, dayCounts: 0, readDay: 0, maxTimeMS: [] };
  const chain = (rows) => {
    const q = { select: () => q, lean: () => q, maxTimeMS: (ms) => { ops.maxTimeMS.push(ms); return q; }, exec: () => Promise.resolve(rows) };
    return q;
  };
  const Stat = {
    find: (filter) => {
      ops.find += 1;
      if (hang === "stat") return { select() { return this; }, lean() { return this; }, maxTimeMS() { return this; }, exec: never };
      return chain(filter.kind === "other" ? finalized.map((day) => ({ day: new Date(`${day}T00:00:00.000Z`), finalized: true })) : []);
    },
    aggregate: (_pipeline, options) => { ops.statAggregate += 1; ops.maxTimeMS.push(options.maxTimeMS); return Promise.resolve([]); },
  };
  const Interaction = {
    aggregate: (pipeline, options) => {
      ops.rawAggregate += 1;
      ops.maxTimeMS.push(options.maxTimeMS);
      if (hang === "raw") return never();
      const groupId = pipeline[1] && pipeline[1].$group && pipeline[1].$group._id;
      if (groupId && typeof groupId === "object" && groupId.$dateToString) { // the per-day presence count
        ops.dayCounts += 1;
        return Promise.resolve(withData.map((day) => ({ _id: day, n: 5 })));
      }
      if (pipeline[1].$group._id === "$termKey" && pipeline[2] && pipeline[2].$match) { // readDay pass A: one frequent term, so the day costs 4 aggregations
        ops.readDay += 1;
        return Promise.resolve([{ _id: "frequent", n: 5 }]);
      }
      return Promise.resolve([]);
    },
  };
  return { Stat, Interaction, ops };
}

const lastDays = (n, endKey = "2026-10-08") => Array.from({ length: n }, (_, i) => dayKey(addDays(new Date(`${endKey}T00:00:00.000Z`), -i)));

describe("trend execution budget", () => {
  test("the limits are the approved, documented numbers", () => {
    assert.deepEqual({ ...TREND_LIMITS }, { totalMs: 8000, queryMs: 4000, maxQueries: 20, maxLiveDays: 4, maxConcurrent: 2 });
    // 3 reads + 4 aggregations per live day must fit the operation cap.
    assert.ok(3 + 4 * TREND_LIMITS.maxLiveDays <= TREND_LIMITS.maxQueries);
  });

  test("a fully rolled-up 396-day window costs 3 operations or fewer, no live work", async () => {
    const days = lastDays(396, "2026-10-09");
    const { Stat, Interaction, ops } = fakes({ finalized: days, withData: [] });
    const points = await loadTrend({ window: windowOf("2025-09-09", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() });
    assert.equal(points.length, 396);
    assert.equal(ops.find + ops.statAggregate + ops.rawAggregate, 2); // markers + rollup sums; no raw read at all
    assert.equal(ops.readDay, 0);
  });

  test("no rollup at all and no data: one grouped count, no per-day aggregation, zero points", async () => {
    const { Stat, Interaction, ops } = fakes();
    const points = await loadTrend({ window: windowOf("2026-09-10", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() });
    assert.equal(points.length, 30);
    assert.ok(points.every((p) => p.interactions === 0 && p.final === false));
    assert.equal(ops.dayCounts, 1);
    assert.equal(ops.readDay, 0);
  });

  test("a delayed rollup with data on 30 days is refused up front, after 2 operations, not after 120", async () => {
    const { Stat, Interaction, ops } = fakes({ withData: lastDays(30) });
    await assert.rejects(
      loadTrend({ window: windowOf("2026-09-10", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() }),
      (err) => err instanceof TrendBudgetError && err.reason === "live_days",
    );
    assert.equal(ops.find + ops.statAggregate + ops.rawAggregate, 2); // markers and day counts - refused before the rollup sums and before anything live
    assert.equal(ops.readDay, 0);
  });

  test("the worst request that is still served runs at most 19 operations (4 live days), within the 20 cap", async () => {
    const { Stat, Interaction, ops } = fakes({ withData: lastDays(4, "2026-10-09") });
    const points = await loadTrend({ window: windowOf("2026-09-10", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() });
    assert.equal(points.length, 30);
    assert.equal(ops.readDay, 4);
    const total = ops.find + ops.statAggregate + ops.rawAggregate;
    assert.equal(total, 19);
    assert.ok(total <= TREND_LIMITS.maxQueries);
    // Every operation carried a server-side time limit no larger than the per-query cap.
    assert.ok(ops.maxTimeMS.length === total && ops.maxTimeMS.every((ms) => ms >= 1 && ms <= TREND_LIMITS.queryMs));
  });

  test("a fifth day with data tips it over: refused, never a partial answer", async () => {
    const { Stat, Interaction } = fakes({ withData: lastDays(5, "2026-10-09") });
    await assert.rejects(loadTrend({ window: windowOf("2026-09-10", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() }), TrendBudgetError);
  });

  test("a stalled database cannot hold the request past its total budget; the slot is freed", async () => {
    for (const hang of ["stat", "raw"]) {
      const gate = createGate();
      const { Stat, Interaction } = fakes({ hang, withData: lastDays(1, "2026-10-09") });
      const started = Date.now();
      await assert.rejects(
        loadTrend({ window: windowOf("2026-10-01", "2026-10-09"), now: NOW }, { Stat, Interaction, gate, limits: { ...TREND_LIMITS, totalMs: 120 } }),
        (err) => err instanceof TrendBudgetError && err.reason === "time",
      );
      assert.ok(Date.now() - started < 2000, `${hang} stall took ${Date.now() - started} ms`);
      assert.equal(gate.active, 0);
    }
  });

  test("the total budget spans operations: many fast operations still end at the deadline", async () => {
    let clock = 0;
    const budget = createBudget({ totalMs: 100, queryMs: 50, maxQueries: 1000, clock: () => clock });
    await budget.run(async () => { clock += 60; });
    await budget.run(async () => { clock += 30; });
    assert.equal(budget.queries, 2);
    clock += 20; // 110 ms elapsed
    await assert.rejects(budget.run(async () => "late"), TrendBudgetError);
  });

  test("the operation cap is enforced regardless of time", async () => {
    const budget = createBudget({ totalMs: 60000, queryMs: 1000, maxQueries: 3 });
    for (let i = 0; i < 3; i += 1) await budget.run(async () => i);
    await assert.rejects(budget.run(async () => 4), (err) => err.reason === "queries");
  });

  test("operations run strictly one after another within a request", async () => {
    let running = 0;
    let peak = 0;
    const { Stat, Interaction } = fakes({ withData: lastDays(3, "2026-10-09") });
    const original = Interaction.aggregate;
    Interaction.aggregate = async (...args) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return original(...args);
    };
    await loadTrend({ window: windowOf("2026-10-05", "2026-10-09"), now: NOW }, { Stat, Interaction, gate: createGate() });
    assert.equal(peak, 1);
  });

  test("at most 2 trend requests run at once; the third is refused immediately and slots are released afterwards", async () => {
    const gate = createGate(2);
    let release;
    const hold = new Promise((resolve) => { release = resolve; });
    const a = gate.run(() => hold);
    const b = gate.run(() => hold);
    await assert.rejects(gate.run(async () => "c"), (err) => err instanceof TrendBudgetError && err.reason === "busy");
    assert.equal(gate.active, 2);
    release();
    await Promise.all([a, b]);
    assert.equal(gate.active, 0);
    assert.equal(await gate.run(async () => "ok"), "ok");
    // A failing request frees its slot too.
    await assert.rejects(gate.run(async () => { throw new Error("boom"); }));
    assert.equal(gate.active, 0);
  });

  test("the module default gate is shared by loadTrend (process-wide limit)", async () => {
    const { trendGate } = require("../../services/searchAnalytics/adminQueries");
    assert.equal(trendGate.active, 0);
  });
});
