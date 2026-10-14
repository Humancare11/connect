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

test("silent when not in the Live Chat tab, when the toggle is off, or when the main Sound is off", () => {
  for (const off of [{ inLiveChatTab: false }, { enabled: false }, { mainSoundOn: false }]) {
    const c = clock();
    const gate = createVisitorSoundGate({ now: c.now });
    gate.prime([]);
    assert.equal(gate.shouldPlay({ visitorId: "v", known: false, ...ON, ...off }), false, JSON.stringify(off));
    c.advance(VISITOR_SOUND_MIN_GAP_MS + 1);
    // the visitor was still noted as seen, so turning the sound on later does not announce them retroactively
    assert.equal(gate.shouldPlay({ visitorId: "v", known: false, ...ON }), false);
  }
});

test("the toggle is stored with try/catch, defaults to off, and sits next to the main Sound toggle", () => {
  const notify = fs.readFileSync(path.join(LC, "liveChatNotify.js"), "utf8");
  assert.match(notify, /export const visitorSoundEnabled = \(\) => read\(VISITOR_SOUND_KEY\) === "on"/, "off unless explicitly on");
  assert.match(notify, /const read = \(key\) => \{\s*try/, "reads are wrapped in try/catch");
  const banner = fs.readFileSync(path.join(LC, "NotificationsBanner.jsx"), "utf8");
  assert.ok(banner.indexOf("Sound on") < banner.indexOf("Visitor sound on"));
  const hub = fs.readFileSync(path.join(LC, "liveChatHub.js"), "utf8");
  assert.match(hub, /inLiveChatTab: inLiveChatTab\(\)/, "only in the Live Chat tab");
  assert.match(hub, /mainSoundOn: soundEnabled\(\)/);
});
