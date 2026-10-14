// Spoken alerts: when they speak and when they must not. Pure logic from voiceAlerts.js, plus static checks that the
// hub, the toggle and the stored default are wired as specified.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVoiceGate, speakPhrase, VOICE_MAX_SPEAK_MS, VOICE_PHRASES, VOICE_VISITOR_MIN_GAP_MS } from "../src/pages/admin/livechat/voiceAlerts.js";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "livechat");
const read = (name) => fs.readFileSync(path.join(LC, name), "utf8");
const ALL_ON = { inLiveChatTab: true, voiceOn: true, mainSoundOn: true, visitorSoundOn: true, unlocked: true };

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("the phrases are exactly the ones asked for", () => {
  assert.equal(VOICE_PHRASES.visitor, "New visitor");
  assert.equal(VOICE_PHRASES.queue, "Patient wants a live agent");
});

test("both alerts speak when everything is on", () => {
  const gate = createVoiceGate({ now: clock().now });
  assert.deepEqual(gate.decide({ kind: "queue", ...ALL_ON }), { speak: true, interrupt: false, text: "Patient wants a live agent" });
  gate.finished();
  assert.deepEqual(gate.decide({ kind: "visitor", ...ALL_ON }), { speak: true, interrupt: false, text: "New visitor" });
});

test("nothing is spoken outside the Live Chat tab, with Voice alerts off, with the main Sound off, or before the first click", () => {
  for (const off of [{ inLiveChatTab: false }, { voiceOn: false }, { mainSoundOn: false }, { unlocked: false }]) {
    const gate = createVoiceGate({ now: clock().now });
    assert.equal(gate.decide({ kind: "queue", ...ALL_ON, ...off }).speak, false, JSON.stringify(off));
    assert.equal(gate.decide({ kind: "visitor", ...ALL_ON, ...off }).speak, false, JSON.stringify(off));
  }
});

test("the visitor voice also needs the Visitor sound toggle; the Queue voice does not", () => {
  const gate = createVoiceGate({ now: clock().now });
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON, visitorSoundOn: false }).speak, false);
  assert.equal(gate.decide({ kind: "queue", ...ALL_ON, visitorSoundOn: false }).speak, true);
});

test("at most one 'New visitor' every 10 seconds", () => {
  const c = clock();
  const gate = createVoiceGate({ now: c.now });
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, true);
  gate.finished();
  c.advance(VOICE_VISITOR_MIN_GAP_MS - 1);
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, false, "inside the gap");
  c.advance(1);
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, true, "after the gap");
});

test("never more than one utterance at a time: new requests are dropped while one is speaking", () => {
  const c = clock();
  const gate = createVoiceGate({ now: c.now });
  assert.equal(gate.decide({ kind: "queue", ...ALL_ON }).speak, true);
  c.advance(1000);
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, false, "dropped, not queued");
  gate.finished();
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, true, "free again once it ended");
});

test("a Queue alert replaces a 'New visitor' that is still speaking, and is not repeated while it speaks", () => {
  const gate = createVoiceGate({ now: clock().now });
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, true);
  assert.deepEqual(gate.decide({ kind: "queue", ...ALL_ON }), { speak: true, interrupt: true, text: "Patient wants a live agent" });
  assert.equal(gate.decide({ kind: "queue", ...ALL_ON }).speak, false, "already speaking the same alert");
  assert.equal(gate.decide({ kind: "visitor", ...ALL_ON }).speak, false, "a visitor never interrupts");
});

test("a browser that never reports the end of an utterance does not silence the alerts for good", () => {
  const c = clock();
  const gate = createVoiceGate({ now: c.now });
  assert.equal(gate.decide({ kind: "queue", ...ALL_ON }).speak, true);
  c.advance(VOICE_MAX_SPEAK_MS + 1);
  assert.equal(gate.decide({ kind: "queue", ...ALL_ON }).speak, true);
});

test("an unknown kind is never spoken", () => {
  assert.equal(createVoiceGate({ now: clock().now }).decide({ kind: "other", ...ALL_ON }).speak, false);
});

test("speakPhrase: English voice, volume 1.0, rate 1.0, one utterance, cancel only when interrupting", () => {
  const spoken = [];
  let cancelled = 0;
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  const synth = {
    getVoices: () => [{ lang: "de-DE", name: "Hans" }, { lang: "en-GB", name: "Daniel" }],
    cancel: () => (cancelled += 1),
    speak: (u) => spoken.push(u),
  };
  assert.equal(speakPhrase("New visitor", { synth, Utterance }), true);
  assert.equal(cancelled, 0);
  assert.equal(speakPhrase("Patient wants a live agent", { synth, Utterance, interrupt: true }), true);
  assert.equal(cancelled, 1);
  assert.equal(spoken.length, 2);
  for (const u of spoken) {
    assert.deepEqual([u.volume, u.rate, u.lang, u.voice.name], [1, 1, "en-US", "Daniel"]);
  }
  assert.equal(speakPhrase("x", { synth: null, Utterance: null }), false, "no speech support: silently false");
});

test("wiring: the hub speaks on a new visitor and on queue:new, only through the gate; the toggle is default ON with safe storage", () => {
  const hub = read("liveChatHub.js");
  assert.match(hub, /announceVoice\("visitor"\)/);
  assert.match(hub, /case "queue:new":[\s\S]*?announceVoice\("queue"\)/);
  assert.match(hub, /inLiveChatTab: inLiveChatTab\(\)/);
  assert.match(hub, /voiceOn: voiceEnabled\(\)/);
  assert.match(hub, /mainSoundOn: soundEnabled\(\)/);
  assert.match(hub, /unlocked: audioUnlocked\(\)/);
  const notify = read("liveChatNotify.js");
  assert.match(notify, /voiceEnabled = \(\) => read\(VOICE_KEY\) !== "off"/, "default ON");
  assert.match(notify, /try \{\s*return localStorage\.getItem/, "reads are wrapped in try/catch");
  assert.match(notify, /try \{\s*localStorage\.setItem/, "writes are wrapped in try/catch");
  const banner = read("NotificationsBanner.jsx");
  assert.match(banner, /Voice alerts on/);
  assert.match(banner, /setVoiceEnabled\(!voice\)/);
});
