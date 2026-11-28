import test from "node:test";
import assert from "node:assert/strict";
import { createHeldCallWatch, restartRecovered, shouldHoldCall } from "./keepLiveCall.js";

test("a restart counts as recovered only when the whole connection is up", () => {
  assert.equal(restartRecovered({ connectionState: "connected", iceConnectionState: "connected" }), true);
  assert.equal(restartRecovered({ connectionState: "failed", iceConnectionState: "connected" }), false);
  assert.equal(restartRecovered({ connectionState: "disconnected", iceConnectionState: "disconnected" }), false);
  assert.equal(restartRecovered({ iceConnectionState: "completed" }), true, "no connectionState in this browser");
});

test("a call is held only for grace_expired while the connection works", () => {
  const base = { enabled: true, reason: "grace_expired", connected: true };
  assert.equal(shouldHoldCall(base), true);
  assert.equal(shouldHoldCall({ ...base, reason: "explicit" }), false);
  assert.equal(shouldHoldCall({ ...base, reason: undefined }), false, "an older server sends no reason");
  assert.equal(shouldHoldCall({ ...base, connected: false }), false);
  assert.equal(shouldHoldCall({ ...base, enabled: false }), false);
});

// Samples every 2s; returns the seconds at which the watch said "end".
const endsAt = (sample, seconds = 60) => {
  const watch = createHeldCallWatch(0);
  for (let t = 2; t <= seconds; t += 2) if (watch.update(t * 1000, sample(t)) === "end") return t;
  return null;
};

test("media that keeps arriving keeps the call", () => {
  assert.equal(endsAt((t) => ({ connected: true, bytes: t * 100 })), null);
});

test("the call ends 10s after data stops arriving, or the connection is lost", () => {
  assert.equal(endsAt((t) => ({ connected: true, bytes: Math.min(t, 20) * 100 })), 30);
  assert.equal(endsAt(() => ({ connected: false, bytes: 500 })), 10);
});

test("unknown byte counts do not end a connected call", () => {
  assert.equal(endsAt(() => ({ connected: true, bytes: null })), null);
});
