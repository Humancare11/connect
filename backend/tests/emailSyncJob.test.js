const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { runEmailSync, syncIntervalMs, CONCURRENCY } = require("../jobs/emailSyncJob");

const boxes = (n) => Array.from({ length: n }, (_, i) => ({ _id: `m${i}`, address: `box${i}@x.co` }));
const quiet = async (fn) => {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = err;
  }
};

describe("sync interval", () => {
  test("20 s by default, clamped to 10-60 s", () => {
    assert.equal(syncIntervalMs({}), 20_000);
    assert.equal(syncIntervalMs({ EMAIL_SYNC_INTERVAL_MS: "45000" }), 45_000);
    assert.equal(syncIntervalMs({ EMAIL_SYNC_INTERVAL_MS: "1000" }), 10_000);
    assert.equal(syncIntervalMs({ EMAIL_SYNC_INTERVAL_MS: "999999" }), 60_000);
    assert.equal(syncIntervalMs({ EMAIL_SYNC_INTERVAL_MS: "abc" }), 20_000);
  });
});

describe("parallel mailbox sync", () => {
  test("every mailbox is synced, several at once, never more than the limit", async () => {
    let active = 0;
    let peak = 0;
    const done = [];
    const sync = async (id) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
      done.push(id);
      return { skipped: false, created: 0, updated: 0, mode: "history" };
    };
    await quiet(() => runEmailSync("o", { sync, listMailboxes: async () => boxes(10), notify: () => {} }));
    assert.equal(done.length, 10);
    assert.ok(peak > 1, "ran in parallel");
    assert.ok(peak <= CONCURRENCY, `at most ${CONCURRENCY} at a time (was ${peak})`);
  });

  test("one failing mailbox does not stop the others", async () => {
    const done = [];
    const sync = async (id) => {
      if (id === "m1") throw new Error("gmail 500");
      done.push(id);
      return { skipped: false, created: 0, updated: 0 };
    };
    await quiet(() => runEmailSync("o", { sync, listMailboxes: async () => boxes(4), notify: () => {} }));
    assert.deepEqual(done.sort(), ["m0", "m2", "m3"]);
  });

  test("open dashboards are told only for a mailbox that really changed", async () => {
    const told = [];
    const results = { m0: { created: 2, updated: 0, mode: "history" }, m1: { created: 0, updated: 0 }, m2: { skipped: true }, m3: { created: 0, updated: 1, mode: "history" } };
    await quiet(() => runEmailSync("o", { sync: async (id) => results[id], listMailboxes: async () => boxes(4), notify: (id) => told.push(id) }));
    assert.deepEqual(told.sort(), ["m0", "m3"]);
  });

  test("a tick that starts while the previous one is still running is skipped; no mailboxes is fine", async () => {
    let calls = 0;
    const slow = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 40));
      return { skipped: true };
    };
    const first = runEmailSync("o", { sync: slow, listMailboxes: async () => boxes(1), notify: () => {} });
    await runEmailSync("o", { sync: slow, listMailboxes: async () => boxes(1), notify: () => {} });
    await first;
    assert.equal(calls, 1);
    await runEmailSync("o", { sync: slow, listMailboxes: async () => [], notify: () => {} });
  });
});
