import test from "node:test";
import assert from "node:assert/strict";
import { createSlowConnectTracker, SLOW_CONNECT_MS } from "./slowConnectNotice.js";

const waiting = { joined: true, peerPresent: true, connected: false, suppressed: false };

function setup() {
  let t = 1000;
  const tracker = createSlowConnectTracker({ now: () => t });
  return { tracker, advance: (ms) => { t += ms; } };
}

test("shows only after 30s of joined + peer present + not connected", () => {
  const { tracker, advance } = setup();
  assert.equal(tracker.update(waiting), false);
  advance(SLOW_CONNECT_MS - 1);
  assert.equal(tracker.update(waiting), false);
  advance(1);
  assert.equal(tracker.update(waiting), true);
});

test("hides the moment media connects, and the clock restarts after a later drop", () => {
  const { tracker, advance } = setup();
  tracker.update(waiting);
  advance(SLOW_CONNECT_MS);
  assert.equal(tracker.update(waiting), true);
  assert.equal(tracker.update({ ...waiting, connected: true }), false);
  assert.equal(tracker.update(waiting), false, "a new drop starts a new 30s window");
  advance(SLOW_CONNECT_MS);
  assert.equal(tracker.update(waiting), true);
});

test("never shows while alone, before joining, or while another retry notice is up", () => {
  const { tracker, advance } = setup();
  for (const status of [{ ...waiting, peerPresent: false }, { ...waiting, joined: false }]) {
    tracker.update(status);
    advance(SLOW_CONNECT_MS * 2);
    assert.equal(tracker.update(status), false);
  }
  tracker.update(waiting);
  advance(SLOW_CONNECT_MS);
  assert.equal(tracker.update({ ...waiting, suppressed: true }), false);
  assert.equal(tracker.update(waiting), true);
});

test("reset (leave / unmount) clears the clock", () => {
  const { tracker, advance } = setup();
  tracker.update(waiting);
  advance(SLOW_CONNECT_MS);
  tracker.reset();
  assert.equal(tracker.update(waiting), false);
});
