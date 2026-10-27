import test from "node:test";
import assert from "node:assert/strict";
import { createLocalMediaRecovery, hasEndedTrack } from "./localMediaRecovery.js";

const stream = (...states) => ({ getTracks: () => states.map((readyState) => ({ readyState })) });
const noSleep = () => Promise.resolve();
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("hasEndedTrack", () => {
  assert.equal(hasEndedTrack(null), false);
  assert.equal(hasEndedTrack(stream("live", "live")), false);
  assert.equal(hasEndedTrack(stream("live", "ended")), true);
});

test("recovers on the first attempt, reports recovering then clears", async () => {
  let broken = true;
  const states = [];
  const r = createLocalMediaRecovery({
    hasProblem: () => broken,
    recover: async () => { broken = false; },
    onState: (s) => states.push(s),
    sleep: noSleep,
  });
  r.check("poll");
  await flush();
  assert.deepEqual(states, [{ phase: "recovering" }, null]);
  assert.equal(r.failed, false);
});

test("retries with each delay, then gives up with phase=failed", async () => {
  const waited = [];
  let attempts = 0;
  const states = [];
  const r = createLocalMediaRecovery({
    hasProblem: () => true,
    recover: async () => { attempts += 1; throw new Error("NotAllowedError"); },
    onState: (s) => states.push(s),
    sleep: async (ms) => { waited.push(ms); },
    delaysMs: [10, 20, 30],
  });
  r.check("poll");
  await flush();
  assert.deepEqual(waited, [10, 20, 30]);
  assert.equal(attempts, 3);
  assert.deepEqual(states.at(-1), { phase: "failed" });
  assert.equal(r.failed, true);
});

test("after giving up the poll stays quiet; devicechange re-arms; retryNow works", async () => {
  let broken = true;
  let attempts = 0;
  const r = createLocalMediaRecovery({
    hasProblem: () => broken,
    recover: async () => { attempts += 1; },
    sleep: noSleep,
    delaysMs: [1],
  });
  r.check("poll");
  await flush();
  assert.equal(r.failed, true);
  assert.equal(attempts, 1);

  r.check("poll");
  await flush();
  assert.equal(attempts, 1, "poll must not retry a dead device forever");

  r.check("devicechange", { force: true });
  await flush();
  assert.equal(attempts, 2);

  broken = false;
  r.retryNow();
  await flush();
  assert.equal(r.failed, false);
});

test("a manual fix between polls clears the failed state without recovering", async () => {
  let broken = true;
  const states = [];
  const r = createLocalMediaRecovery({
    hasProblem: () => broken,
    recover: async () => {},
    onState: (s) => states.push(s),
    sleep: noSleep,
    delaysMs: [1],
  });
  r.check("poll");
  await flush();
  broken = false;
  r.check("poll");
  assert.deepEqual(states.at(-1), null);
  assert.equal(r.failed, false);
});

test("never runs twice at once and stops when the page is no longer active", async () => {
  let active = true;
  let attempts = 0;
  const r = createLocalMediaRecovery({
    hasProblem: () => true,
    recover: async () => { attempts += 1; },
    isActive: () => active,
    sleep: async () => { active = false; },
    delaysMs: [1, 1],
  });
  r.check("poll");
  r.check("poll");
  await flush();
  assert.equal(attempts, 0, "left the call before the first attempt");
  assert.equal(r.running, false);
});
