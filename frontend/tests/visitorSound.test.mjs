// The "new website visitor" sound: when it plays and when it must not. Pure logic from visitorSound.js.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVisitorSoundGate, VISITOR_SEEN_MS, VISITOR_SOUND_MIN_GAP_MS } from "../src/pages/admin/livechat/visitorSound.js";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "livechat");
const ON = { inLiveChatTab: true, enabled: true, mainSoundOn: true };

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("a new visitor plays once; page changes and heartbeats of the same visitor do not", () => {
  const c = clock();
  const gate = createVisitorSoundGate({ now: c.now });
  gate.prime([]);
  assert.equal(gate.shouldPlay({ visitorId: "v1", known: false, ...ON }), true);
  c.advance(60_000);
  assert.equal(gate.shouldPlay({ visitorId: "v1", known: true, ...ON }), false, "already in the list");
  c.advance(60_000);
  assert.equal(gate.shouldPlay({ visitorId: "v1", known: false, ...ON }), false, "seen a moment ago");
});

test("nothing before the first snapshot, and visitors in a snapshot are never announced", () => {
  const c = clock();
  const gate = createVisitorSoundGate({ now: c.now });
  assert.equal(gate.shouldPlay({ visitorId: "early", known: false, ...ON }), false, "not primed yet");
  gate.prime(["here"]);
  c.advance(60_000);
  assert.equal(gate.shouldPlay({ visitorId: "here", known: false, ...ON }), false, "was in the snapshot");
  gate.unprime(); // connection dropped
  assert.equal(gate.shouldPlay({ visitorId: "during-outage", known: false, ...ON }), false);
  gate.prime(["during-outage"]);
  c.advance(60_000);
  assert.equal(gate.shouldPlay({ visitorId: "later", known: false, ...ON }), true);
});

test("at most one sound every 10 seconds; the dropped visitors are not queued", () => {
  const c = clock();
  const gate = createVisitorSoundGate({ now: c.now });
  gate.prime([]);
  assert.equal(gate.shouldPlay({ visitorId: "a", known: false, ...ON }), true);
  c.advance(VISITOR_SOUND_MIN_GAP_MS - 1);
  assert.equal(gate.shouldPlay({ visitorId: "b", known: false, ...ON }), false);
  c.advance(1);
  assert.equal(gate.shouldPlay({ visitorId: "c", known: false, ...ON }), true);
  c.advance(VISITOR_SOUND_MIN_GAP_MS);
  assert.equal(gate.shouldPlay({ visitorId: "b", known: false, ...ON }), false, "b was dropped, and is not announced later");
});

test("a visitor who leaves and returns within 30 minutes does not chime again; after 30 minutes of silence they do", () => {
  const c = clock();
  const gate = createVisitorSoundGate({ now: c.now });
  gate.prime([]);
  assert.equal(gate.shouldPlay({ visitorId: "v", known: false, ...ON }), true);
  c.advance(29 * 60_000); // gone from the list, back after 29 minutes
  assert.equal(gate.shouldPlay({ visitorId: "v", known: false, ...ON }), false);
  c.advance(VISITOR_SEEN_MS + 1); // then nothing for over 30 minutes
  assert.equal(gate.shouldPlay({ visitorId: "v", known: false, ...ON }), true);
});

test("the new visitor sound and voice are always on: no tab or switch condition", () => {
  const c = clock();
  const gate = createVisitorSoundGate({ now: c.now });
  gate.prime([]);
  // no inLiveChatTab / enabled / mainSoundOn arguments at all: a new visitor is still announced
  assert.equal(gate.shouldPlay({ visitorId: "v", known: false }), true);
});

test("there is no toggle any more; the hub no longer passes a tab or switch to the gate", () => {
  const notify = fs.readFileSync(path.join(LC, "liveChatNotify.js"), "utf8");
  assert.match(notify, /export const visitorSoundEnabled = \(\) => true;/);
  assert.match(notify, /const read = \(key\) => \{\s*try/, "reads are wrapped in try/catch");
  const banner = fs.readFileSync(path.join(LC, "NotificationsBanner.jsx"), "utf8");
  assert.doesNotMatch(banner, /Visitor sound/);
  const hub = fs.readFileSync(path.join(LC, "liveChatHub.js"), "utf8");
  assert.doesNotMatch(hub, /enabled: visitorSoundEnabled\(\)|mainSoundOn: soundEnabled\(\)/);
  assert.match(hub, /if \(inLiveChatTab\(\)\) playVisitorSound\(\);/, "the soft note stays in the Live Chat tab");
});
