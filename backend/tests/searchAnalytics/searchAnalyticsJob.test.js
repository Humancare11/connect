// The scheduler around the rollup: flag gating, startup/hourly timers, overlap
// protection and failure isolation. No database: the rollup itself is injected.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSearchAnalyticsJob, scheduleSearchAnalyticsRollup } = require("../../jobs/searchAnalyticsJobs");

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};

test("with the flag off (the default) nothing runs", async () => {
  let runs = 0;
  const job = createSearchAnalyticsJob({ isEnabled: () => false, run: async () => { runs += 1; } });
  assert.equal(await job.tick(), "disabled");
  assert.equal(runs, 0);
});

test("the flag is re-checked on every tick; a throwing check counts as off", async () => {
  let enabled = false;
  let runs = 0;
  const job = createSearchAnalyticsJob({ isEnabled: () => enabled, run: async () => { runs += 1; } });
  assert.equal(await job.tick(), "disabled");
  enabled = true;
  assert.equal(await job.tick(), "done");
  enabled = false;
  assert.equal(await job.tick(), "disabled");
  assert.equal(runs, 1);
  const broken = createSearchAnalyticsJob({ isEnabled: () => { throw new Error("env"); }, run: async () => { runs += 1; } });
  assert.equal(await broken.tick(), "disabled");
  assert.equal(runs, 1);
});

test("only the exact flag value enables it (default reading of process.env)", async () => {
  const saved = process.env.SEARCH_ANALYTICS_ENABLED;
  let runs = 0;
  try {
    const job = createSearchAnalyticsJob({ run: async () => { runs += 1; } });
    delete process.env.SEARCH_ANALYTICS_ENABLED;
    assert.equal(await job.tick(), "disabled");
    process.env.SEARCH_ANALYTICS_ENABLED = "TRUE";
    assert.equal(await job.tick(), "disabled");
    process.env.SEARCH_ANALYTICS_ENABLED = "true";
    assert.equal(await job.tick(), "done");
    assert.equal(runs, 1);
  } finally {
    if (saved === undefined) delete process.env.SEARCH_ANALYTICS_ENABLED; else process.env.SEARCH_ANALYTICS_ENABLED = saved;
  }
});

test("a tick never overlaps a run that is still going", async () => {
  const gate = deferred();
  let runs = 0;
  const job = createSearchAnalyticsJob({ isEnabled: () => true, run: async () => { runs += 1; await gate.promise; } });
  const first = job.tick();
  assert.equal(await job.tick(), "busy");
  assert.equal(await job.tick(), "busy");
  gate.resolve();
  assert.equal(await first, "done");
  assert.equal(runs, 1);
  assert.equal(await job.tick(), "done"); // free again
  assert.equal(runs, 2);
});

test("a failing run is contained, logged by error name only, and does not block the next one", async () => {
  const logs = [];
  let fail = true;
  const job = createSearchAnalyticsJob({
    isEnabled: () => true,
    logger: (m) => logs.push(m),
    run: async () => {
      if (fail) throw Object.assign(new Error("secret query a@b.com 5551234567 {doc}"), { name: "MongoNetworkError" });
    },
  });
  assert.equal(await job.tick(), "error");
  assert.deepEqual(logs, ["[search-analytics] rollup job failed: MongoNetworkError"]);
  fail = false;
  assert.equal(await job.tick(), "done");
});

test("a throwing logger and non-error throws are contained", async () => {
  const job = createSearchAnalyticsJob({ isEnabled: () => true, logger: () => { throw new Error("logger down"); }, run: async () => { throw "plain"; } }); // eslint-disable-line no-throw-literal
  assert.equal(await job.tick(), "error");
  assert.equal(await job.tick(), "error");
});

test("start(): the first run is deferred, an hourly timer is set, and both are unref'd", () => {
  const timeouts = [];
  const intervals = [];
  let runs = 0;
  const handle = (list, fn, ms) => { const h = { fn, ms, unrefed: false, unref() { h.unrefed = true; } }; list.push(h); return h; };
  const job = createSearchAnalyticsJob({
    isEnabled: () => true,
    run: async () => { runs += 1; },
    setTimer: (fn, ms) => handle(timeouts, fn, ms),
    setRepeating: (fn, ms) => handle(intervals, fn, ms),
  });
  const started = job.start();
  assert.ok(started);
  assert.equal(runs, 0); // start() itself runs nothing: it never blocks startup
  assert.equal(timeouts.length, 1);
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].ms, 60 * 60 * 1000);
  assert.equal(timeouts[0].unrefed && intervals[0].unrefed, true);
  timeouts[0].fn();
  intervals[0].fn();
  assert.equal(runs, 1); // the second call found the first still running (or finished); either way no overlap
});

test("start() never throws, even if the timers cannot be created", () => {
  const job = createSearchAnalyticsJob({ isEnabled: () => true, setTimer: () => { throw new Error("no timers"); } });
  assert.doesNotThrow(() => job.start());
  assert.equal(job.start(), null);
});

test("the exported schedule function exists and is safe to call with the flag off", () => {
  const saved = process.env.SEARCH_ANALYTICS_ENABLED;
  delete process.env.SEARCH_ANALYTICS_ENABLED;
  try {
    const started = scheduleSearchAnalyticsRollup();
    assert.ok(started);
    // Timers are unref'd, so they cannot keep the test process alive; clear them anyway.
    clearTimeout(started.first);
    clearInterval(started.repeating);
  } finally {
    if (saved !== undefined) process.env.SEARCH_ANALYTICS_ENABLED = saved;
  }
});

test("server.js starts the job once, without awaiting it, after the database is connected", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "server.js"), "utf8");
  const calls = [...src.matchAll(/scheduleSearchAnalyticsRollup\(\)/g)];
  assert.equal(calls.length, 1);
  assert.ok(!/await\s+scheduleSearchAnalyticsRollup/.test(src));
  assert.ok(src.indexOf("await connectDB()") < src.indexOf("scheduleSearchAnalyticsRollup()"));
  assert.ok(src.indexOf("scheduleRetentionCleanup();") < src.indexOf("scheduleSearchAnalyticsRollup()"));
});
