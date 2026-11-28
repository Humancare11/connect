import test from "node:test";
import assert from "node:assert/strict";
import { createRemoteVideoWatch, presentedFrames } from "./remoteVideoWatch.js";

// One check a second; returns [second, action] for every action that is not "ok"/"stalled".
const actions = (frames, seconds = 25, eligible = () => true) => {
  const watch = createRemoteVideoWatch();
  const out = [];
  for (let s = 0; s <= seconds; s += 1) {
    const result = watch.update(s * 1000, { eligible: eligible(s), frames: frames(s) });
    if (result === "reattach" || result === "restart") out.push([s, result]);
  }
  return out;
};

test("advancing frames need nothing", () => {
  assert.deepEqual(actions((s) => s * 5), []);
});

test("a frozen picture is re-attached after 5s and restarted once after 5 more", () => {
  assert.deepEqual(actions(() => 100), [[5, "reattach"], [10, "restart"]]);
});

test("a picture that never appears is treated the same", () => {
  assert.deepEqual(actions(() => 0), [[5, "reattach"], [10, "restart"]]);
});

test("a counter restarted by the re-attach is not mistaken for progress", () => {
  assert.deepEqual(actions((s) => (s < 6 ? 100 : 0)), [[5, "reattach"], [10, "restart"]]);
});

test("frames coming back start a new episode", () => {
  const frames = (s) => (s < 12 ? 100 : s < 14 ? 100 + s : 200);
  assert.deepEqual(actions(frames, 25), [[5, "reattach"], [10, "restart"], [19, "reattach"], [24, "restart"]]);
});

test("nothing happens while not eligible (camera off, hidden tab, not connected)", () => {
  assert.deepEqual(actions(() => 100, 25, () => false), []);
  assert.deepEqual(actions(() => null), []);
});

test("presentedFrames is null where the browser cannot say", () => {
  assert.equal(presentedFrames(null), null);
  assert.equal(presentedFrames({}), null);
  assert.equal(presentedFrames({ getVideoPlaybackQuality: () => ({ totalVideoFrames: 7 }) }), 7);
});
