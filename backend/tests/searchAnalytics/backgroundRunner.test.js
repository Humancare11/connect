const test = require("node:test");
const assert = require("node:assert/strict");
const { createBackgroundRunner, runInBackground, DEFAULT_MAX_IN_FLIGHT } = require("../../services/searchAnalytics/backgroundRunner");
const { createSearchInteractionRecorder } = require("../../services/searchAnalytics/recorder");
const { buildFixtureCatalog } = require("../search/fixtures");
const { matchCatalog } = require("../../services/search/deterministicMatcher");

// A manual scheduler: nothing runs until flush() is called.
function manualScheduler() {
  const queue = [];
  return {
    schedule: (fn) => queue.push(fn),
    flush: async () => { while (queue.length) await queue.shift()(); },
    size: () => queue.length,
  };
}
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("run() returns immediately and the task starts only later", async () => {
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ schedule: sched.schedule, logger: () => {} });
  let started = false;
  assert.equal(runner.run(async () => { started = true; }), "scheduled");
  assert.equal(started, false); // not started inside run()
  assert.equal(sched.size(), 1);
  await sched.flush();
  assert.equal(started, true);
  assert.deepEqual(runner.stats(), { inFlight: 0, dropped: 0, limit: DEFAULT_MAX_IN_FLIGHT });
});

test("with the real scheduler the task runs after the caller continues", async () => {
  const runner = createBackgroundRunner({ logger: () => {} });
  const order = [];
  runner.run(async () => order.push("task"));
  order.push("caller");
  await tick();
  await tick();
  assert.deepEqual(order, ["caller", "task"]);
});

test("a slow task never blocks run() or the caller", async () => {
  const runner = createBackgroundRunner({ logger: () => {} });
  const slow = deferred();
  const startedAt = Date.now();
  runner.run(() => slow.promise);
  assert.ok(Date.now() - startedAt < 50);
  assert.equal(runner.stats().inFlight, 1);
  slow.resolve();
  await tick();
  await tick();
  assert.equal(runner.stats().inFlight, 0);
});

test("a rejected promise is contained and logs only the error name", async () => {
  const logs = [];
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ schedule: sched.schedule, logger: (m) => logs.push(m) });
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    runner.run(async () => { throw Object.assign(new Error("secret search text"), { name: "MongoNetworkError", code: 9 }); });
    await sched.flush();
    await tick();
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(unhandled, []);
  assert.deepEqual(logs, ["[search-analytics] background task failed: MongoNetworkError"]);
  assert.equal(runner.stats().inFlight, 0); // the slot is released after a failure
});

test("synchronous throws, non-error rejections and a throwing logger are contained", async () => {
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ schedule: sched.schedule, logger: () => { throw new Error("logger down"); } });
  runner.run(() => { throw new TypeError("sync"); });
  runner.run(() => Promise.reject("plain string")); // eslint-disable-line prefer-promise-reject-errors
  runner.run(() => Promise.reject(null)); // eslint-disable-line prefer-promise-reject-errors
  await sched.flush();
  assert.equal(runner.stats().inFlight, 0);
});

test("a scheduler that throws is contained and counted as dropped", () => {
  const logs = [];
  const runner = createBackgroundRunner({ schedule: () => { throw new RangeError("no scheduler"); }, logger: (m) => logs.push(m) });
  assert.equal(runner.run(async () => {}), "dropped");
  assert.deepEqual(runner.stats(), { inFlight: 0, dropped: 1, limit: DEFAULT_MAX_IN_FLIGHT });
  assert.deepEqual(logs, ["[search-analytics] background task failed: RangeError"]);
});

test("beyond the cap new tasks are dropped, never queued, and slots are reused afterwards", async () => {
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ maxInFlight: 2, schedule: sched.schedule, logger: () => {} });
  const gate = deferred();
  let ran = 0;
  const task = async () => { ran += 1; await gate.promise; };
  assert.equal(runner.run(task), "scheduled");
  assert.equal(runner.run(task), "scheduled");
  assert.equal(runner.run(task), "dropped");
  assert.equal(runner.run(task), "dropped");
  assert.equal(sched.size(), 2); // dropped tasks were not queued
  assert.deepEqual(runner.stats(), { inFlight: 2, dropped: 2, limit: 2 });
  const flushing = sched.flush();
  await tick();
  gate.resolve();
  await flushing;
  assert.equal(ran, 2); // the dropped ones never run, and nothing is retried
  assert.equal(runner.stats().inFlight, 0);
  assert.equal(runner.run(task), "scheduled"); // capacity is back
});

test("a stuck task keeps its slot (bounded) rather than being abandoned", async () => {
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ maxInFlight: 1, schedule: sched.schedule, logger: () => {} });
  const forever = deferred();
  runner.run(() => forever.promise);
  const flushing = sched.flush();
  await tick();
  assert.equal(runner.run(async () => {}), "dropped");
  assert.equal(runner.stats().inFlight, 1);
  forever.resolve();
  await flushing;
});

test("failed tasks are never retried", async () => {
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ schedule: sched.schedule, logger: () => {} });
  let attempts = 0;
  runner.run(async () => { attempts += 1; throw new Error("x"); });
  await sched.flush();
  await tick();
  assert.equal(attempts, 1);
  assert.equal(sched.size(), 0);
});

test("invalid tasks and invalid limits are handled safely", () => {
  const runner = createBackgroundRunner({ maxInFlight: -3, schedule: () => {}, logger: () => {} });
  assert.equal(runner.stats().limit, DEFAULT_MAX_IN_FLIGHT);
  for (const bad of [undefined, null, 5, "task", {}]) assert.equal(runner.run(bad), "dropped");
  assert.equal(runner.stats().dropped, 5);
  assert.equal(createBackgroundRunner({ maxInFlight: 1.5 }).stats().limit, DEFAULT_MAX_IN_FLIGHT);
});

test("the default runner function is exported", () => {
  assert.equal(typeof runInBackground, "function");
});

test("recorder + runner: a failing database neither throws nor reaches the caller, and logs no query", async () => {
  const logs = [];
  const failingStore = {
    updateOne: async () => { throw Object.assign(new Error("db down for acne"), { name: "MongoNetworkError", code: "ECONNRESET" }); },
  };
  const recorder = createSearchInteractionRecorder({ store: failingStore, logger: (m) => logs.push(m) });
  const sched = manualScheduler();
  const runner = createBackgroundRunner({ schedule: sched.schedule, logger: (m) => logs.push(m) });

  const { catalog } = await buildFixtureCatalog();
  const dto = {
    interactionId: "6f1c2a9e-3b7d-4c58-9a1e-0d2f5b8e7c41", q: "acne", settledBy: "idle", aiStatus: "not_requested",
    matches: matchCatalog(catalog, "acne", {}), index: catalog.index,
  };
  assert.equal(runner.run(() => recorder(dto)), "scheduled"); // returns before any write is attempted
  assert.equal(logs.length, 0);
  await sched.flush();
  assert.deepEqual(logs, ["[search-analytics] write failed: MongoNetworkError ECONNRESET"]);
  assert.ok(!logs.join(" ").includes("acne"));
});
