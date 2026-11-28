import test from "node:test";
import assert from "node:assert/strict";
import { createRestartRequestBackoff } from "./retryBackoff.js";

// Ticks every 500ms and records when a request was allowed.
const sendTimes = (backoff, from, to) => {
  const times = [];
  for (let t = from; t <= to; t += 500) if (backoff.tryAcquire(t)) times.push(t - from);
  return times;
};

test("immediate first request, then 5s, 10s and 15s at most", () => {
  assert.deepEqual(sendTimes(createRestartRequestBackoff(), 1_000_000, 1_060_000), [0, 5000, 15000, 30000, 45000, 60000]);
});

test("a reset makes the next request immediate and starts the pacing again", () => {
  const backoff = createRestartRequestBackoff();
  assert.equal(backoff.tryAcquire(10_000), true);
  assert.equal(backoff.tryAcquire(15_000), true);
  assert.equal(backoff.tryAcquire(16_000), false);
  backoff.reset();
  assert.deepEqual(sendTimes(backoff, 16_000, 31_000), [0, 5000, 15000]);
});
