import test from "node:test";
import assert from "node:assert/strict";
import { createPinActionRunner } from "./directPinRunner.js";

// Manual fake clock so the test controls time.
function clock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
      }
      now = target;
    },
  };
}

const make = (extra = {}) => {
  const c = clock();
  const sent = [];
  let gaveUp = 0;
  const runner = createPinActionRunner({
    emit: (a) => sent.push(a),
    onGiveUp: () => { gaveUp += 1; },
    delaysMs: [100, 200, 400],
    responseTimeoutMs: 1000,
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
    ...extra,
  });
  return { c, sent, runner, gaveUp: () => gaveUp };
};

test("a definitive answer stops everything", () => {
  const { c, sent, runner, gaveUp } = make();
  runner.start({ type: "verify", pin: "123456" });
  assert.equal(sent.length, 1);
  runner.done();
  c.advance(60_000);
  assert.equal(sent.length, 1);
  assert.equal(gaveUp(), 0);
  assert.equal(runner.active, false);
});

test("server_error retries with backoff, keeping the same request", () => {
  const { c, sent, runner, gaveUp } = make();
  const action = { type: "verify", pin: "123456" };
  runner.start(action);
  assert.equal(runner.serverError(), true);
  c.advance(99);
  assert.equal(sent.length, 1);
  c.advance(1);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1], action);
  assert.equal(gaveUp(), 0);
});

test("no response within the timeout also retries, then gives up after the budget", () => {
  const { c, sent, runner, gaveUp } = make();
  runner.start({ type: "verify", pin: "123456" });
  c.advance(1000 + 100); // timeout -> retry after 100
  assert.equal(sent.length, 2);
  c.advance(1000 + 200);
  assert.equal(sent.length, 3);
  c.advance(1000 + 400);
  assert.equal(sent.length, 4);
  c.advance(1000); // final timeout, retries exhausted
  assert.equal(gaveUp(), 1);
  assert.equal(runner.active, false);
  c.advance(60_000);
  assert.equal(sent.length, 4);
});

test("server_error answers exhaust the budget and give up exactly once", () => {
  const { c, sent, runner, gaveUp } = make();
  runner.start({ type: "takeover", pin: "654321", role: "doctor" });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(runner.serverError(), true);
    c.advance(1000);
  }
  assert.equal(runner.serverError(), false);
  assert.equal(gaveUp(), 1);
  assert.equal(runner.serverError(), false);
  assert.equal(gaveUp(), 1);
});

test("starting a new request cancels the previous one", () => {
  const { c, sent, runner } = make();
  runner.start({ type: "verify", pin: "111111" });
  runner.start({ type: "verify", pin: "222222" });
  c.advance(1000 + 100);
  assert.deepEqual(sent.map((a) => a.pin), ["111111", "222222", "222222"]);
});
