// Spoken alerts: when they speak and when they must not. Pure logic from voiceAlerts.js and voiceElection.js, plus
// static checks that the hub is wired as specified and that nothing can switch the voice off.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createVoiceGate,
  speakPhrase,
  VOICE_GAP_MS,
  VOICE_MAX_QUEUE,
  VOICE_MAX_SPEAK_MS,
  VOICE_PHRASES,
  VOICE_REPEAT_MS,
  VOICE_VISITOR_MIN_GAP_MS,
} from "../src/pages/admin/livechat/voiceAlerts.js";
import { createSpeakerElection, ELECTION_WINDOW_MS } from "../src/pages/admin/livechat/voiceElection.js";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "livechat");
const read = (name) => fs.readFileSync(path.join(LC, name), "utf8");

// A fake clock with timers, and a fake speaker that stays "speaking" until the test ends it.
function world() {
  let t = 1_000_000;
  let seq = 0;
  const timers = new Map();
  const spoken = [];
  const enders = [];
  const api = {
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    speak: (text, options) => {
      spoken.push({ text, interrupt: Boolean(options.interrupt) });
      enders.push(options.onEnd);
      return true;
    },
    spoken,
    texts: () => spoken.map((s) => s.text),
    end: () => enders.shift()?.(),
    advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].fn();
      }
      t = target;
    },
  };
  return api;
}
const gateOf = (w) => createVoiceGate({ now: w.now, speak: w.speak, setTimer: w.setTimer, clearTimer: w.clearTimer });
const ask = (gate, kind, key = "", unlocked = true) => gate.request({ kind, key, unlocked });

test("the phrases are exactly the ones asked for", () => {
  assert.deepEqual(VOICE_PHRASES, {
    visitor: "New visitor",
    form: "New chat form submitted",
    ai: "AI chat started",
    queue: "Patient wants a live agent",
  });
});

test("each alert speaks its own phrase", () => {
  for (const [kind, text] of Object.entries(VOICE_PHRASES)) {
    const w = world();
    const gate = gateOf(w);
    ask(gate, kind, "k1");
    assert.deepEqual(w.texts(), [text], kind);
  }
});

test("nothing is spoken before the admin's first click, and an unknown kind is never spoken", () => {
  const w = world();
  const gate = gateOf(w);
  assert.equal(ask(gate, "queue", "c1", false), "dropped");
  assert.equal(ask(gate, "visitor", "v1", false), "dropped");
  assert.equal(ask(gate, "other", "x"), "dropped");
  assert.equal(w.spoken.length, 0);
});

test("a first-time visitor is heard in order: form, then AI chat, one at a time with a gap", () => {
  const w = world();
  const gate = gateOf(w);
  ask(gate, "form", "v1");
  ask(gate, "ai", "c1");
  assert.deepEqual(w.texts(), ["New chat form submitted"], "the second waits for the first to end");
  w.advance(5000);
  assert.equal(w.spoken.length, 1);
  w.end();
  w.advance(VOICE_GAP_MS - 1);
  assert.equal(w.spoken.length, 1, "and for the gap");
  w.advance(1);
  assert.deepEqual(w.texts(), ["New chat form submitted", "AI chat started"]);
});

test("then the live agent alert follows the same way", () => {
  const w = world();
  const gate = gateOf(w);
  ask(gate, "form", "v1");
  ask(gate, "ai", "c1");
  ask(gate, "queue", "c1");
  for (let i = 0; i < 3; i += 1) {
    w.end();
    w.advance(VOICE_GAP_MS);
  }
  assert.deepEqual(w.texts(), ["New chat form submitted", "AI chat started", "Patient wants a live agent"]);
});

test("New visitor never waits and never interrupts: dropped while anything speaks or waits", () => {
  const w = world();
  const gate = gateOf(w);
  ask(gate, "ai", "c1");
  assert.equal(ask(gate, "visitor", "v9"), "dropped");
  ask(gate, "form", "v1");
  w.end();
  w.advance(VOICE_GAP_MS - 1);
  assert.equal(ask(gate, "visitor", "v8"), "dropped", "something is still waiting");
});

test("at most one New visitor every 10 seconds", () => {
  const w = world();
  const gate = gateOf(w);
  assert.equal(ask(gate, "visitor", "a"), "spoken");
  w.end();
  w.advance(VOICE_VISITOR_MIN_GAP_MS - 2000);
  assert.equal(ask(gate, "visitor", "b"), "dropped", "inside the gap");
  w.advance(2000);
  assert.equal(ask(gate, "visitor", "c"), "spoken", "after the gap");
});

test("a live agent alert replaces a New visitor that is still speaking; the old end is ignored", () => {
  const w = world();
  const gate = gateOf(w);
  ask(gate, "visitor", "v1");
  assert.equal(ask(gate, "queue", "c1"), "spoken");
  assert.deepEqual(w.spoken, [
    { text: "New visitor", interrupt: false },
    { text: "Patient wants a live agent", interrupt: true },
  ]);
  w.end(); // the cancelled New visitor reports its end: it must not free the new one
  assert.equal(gate._state().speaking, "queue");
  ask(gate, "ai", "c2");
  assert.equal(w.spoken.length, 2, "still waiting for the live agent voice");
});

test("the same alert for the same chat or visitor is not repeated within a minute", () => {
  const w = world();
  const gate = gateOf(w);
  assert.equal(ask(gate, "ai", "c1"), "spoken");
  w.end();
  w.advance(VOICE_GAP_MS);
  assert.equal(ask(gate, "ai", "c1"), "dropped");
  assert.equal(ask(gate, "ai", "c2"), "spoken", "another chat is fine");
  w.end();
  w.advance(VOICE_REPEAT_MS + 1);
  assert.equal(ask(gate, "ai", "c1"), "spoken", "after a minute it may speak again");
});

test("the waiting queue is capped", () => {
  const w = world();
  const gate = gateOf(w);
  for (let i = 0; i < 20; i += 1) ask(gate, "ai", `c${i}`);
  assert.ok(gate._state().queued <= VOICE_MAX_QUEUE);
});

test("a browser that never reports the end of an utterance does not silence the alerts for good", () => {
  const w = world();
  const gate = gateOf(w);
  ask(gate, "ai", "c1");
  ask(gate, "queue", "c2");
  w.advance(VOICE_MAX_SPEAK_MS + VOICE_GAP_MS);
  assert.deepEqual(w.texts(), ["AI chat started", "Patient wants a live agent"]);
});

test("speech that is unavailable or throws does not break the gate", () => {
  const w = world();
  const none = createVoiceGate({ now: w.now, speak: () => false, setTimer: w.setTimer, clearTimer: w.clearTimer });
  const boom = createVoiceGate({
    now: w.now,
    speak: () => {
      throw new Error("no speech");
    },
    setTimer: w.setTimer,
    clearTimer: w.clearTimer,
  });
  ask(none, "ai", "c1");
  ask(boom, "ai", "c1");
  assert.equal(none._state().speaking, "");
  assert.equal(boom._state().speaking, "");
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
    getVoices: () => [
      { lang: "de-DE", name: "Hans" },
      { lang: "en-GB", name: "Daniel" },
    ],
    cancel: () => (cancelled += 1),
    speak: (u) => spoken.push(u),
  };
  assert.equal(speakPhrase("New visitor", { synth, Utterance }), true);
  assert.equal(cancelled, 0);
  assert.equal(speakPhrase("Patient wants a live agent", { synth, Utterance, interrupt: true }), true);
  assert.equal(cancelled, 1);
  assert.equal(spoken.length, 2);
  for (const u of spoken) assert.deepEqual([u.volume, u.rate, u.lang, u.voice.name], [1, 1, "en-US", "Daniel"]);
  assert.equal(speakPhrase("x", { synth: null, Utterance: null }), false, "no speech support: silently false");
});

// ── which tab speaks ─────────────────────────────────────────────────────────────────────────────────────────────
function tabs(specs) {
  const w = world();
  const election = {};
  const wins = {};
  for (const spec of specs) {
    wins[spec.id] = 0;
    election[spec.id] = createSpeakerElection({
      tabId: spec.id,
      random: () => spec.r ?? 0.5,
      rank: () => ({ lc: spec.lc ?? 0, activated: spec.activated ?? 1, visible: spec.visible ?? 1 }),
      setTimer: w.setTimer,
      post: (m) => specs.forEach((o) => o.id !== spec.id && election[o.id]?.handleTabMessage(m)),
    });
  }
  const run = (key) => specs.forEach((spec) => election[spec.id].run(key, () => (wins[spec.id] += 1)));
  return { w, run, wins };
}

test("election: a single tab speaks after the claim window", () => {
  const { w, run, wins } = tabs([{ id: "a" }]);
  run("queue:c1");
  assert.equal(wins.a, 0);
  w.advance(ELECTION_WINDOW_MS);
  assert.equal(wins.a, 1);
});

test("election: exactly one of several tabs speaks; Live Chat tab, then clicked, then visible, then random", () => {
  let t = tabs([{ id: "a", lc: 0 }, { id: "b", lc: 1 }, { id: "c", lc: 0 }]);
  t.run("k");
  t.w.advance(ELECTION_WINDOW_MS);
  assert.deepEqual(t.wins, { a: 0, b: 1, c: 0 });
  t = tabs([{ id: "a", activated: 0 }, { id: "b", activated: 1, visible: 0 }, { id: "c", activated: 1, visible: 1 }]);
  t.run("k");
  t.w.advance(ELECTION_WINDOW_MS);
  assert.deepEqual(t.wins, { a: 0, b: 0, c: 1 });
  t = tabs([{ id: "a", r: 0.2 }, { id: "b", r: 0.9 }, { id: "c", r: 0.5 }]);
  t.run("k");
  t.w.advance(ELECTION_WINDOW_MS);
  assert.deepEqual(t.wins, { a: 0, b: 1, c: 0 });
});

test("election: ignores messages of other kinds and its own claims", () => {
  const e = createSpeakerElection({ tabId: "a", setTimer: world().setTimer });
  e.handleTabMessage({ type: "reg:claim", key: "k", claim: { tabId: "z" } });
  e.handleTabMessage({ type: "lcv:claim", key: "k", claim: { tabId: "a" } });
  e.handleTabMessage(null);
});

// ── wiring ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("wiring: the hub speaks form, AI chat, live agent and new visitor through the election and the gate", () => {
  const hub = read("liveChatHub.js");
  assert.match(hub, /case "contact:submitted":\s*announceVoice\("form", payload\.visitorId\)/);
  assert.match(hub, /if \(payload\.mode === "ai"\) announceVoice\("ai", payload\.conversationId\)/);
  assert.match(hub, /case "queue:new":[\s\S]*?announceVoice\("queue", payload\.conversationId\)/);
  assert.match(hub, /announceVoice\("visitor", id\)/);
  assert.match(hub, /"contact:submitted"/, "the event is subscribed");
  assert.match(hub, /voiceElection\.run\(/);
  assert.match(hub, /voiceGate\.request\(\{ kind, key, unlocked: audioUnlocked\(\) \}\)/);
  assert.match(hub, /if \(!shouldAlert\(\)\) return;/, "the single-tab rule of the chime still applies");
});

test("wiring: nothing can switch the sound or voice off any more", () => {
  const notify = read("liveChatNotify.js");
  assert.match(notify, /export const soundEnabled = \(\) => true;/);
  assert.match(notify, /export const visitorSoundEnabled = \(\) => true;/);
  assert.match(notify, /export const voiceEnabled = \(\) => true;/);
  assert.doesNotMatch(notify, /setSoundEnabled|setVoiceEnabled|setVisitorSoundEnabled|hcLiveChatSound|hcLiveChatVoice|hcLiveChatVisitorSound/);
  const banner = read("NotificationsBanner.jsx");
  assert.doesNotMatch(banner, /Sound on|Sound off|Voice alerts|Visitor sound|setSoundEnabled|setVoiceEnabled|lcn-sound/);
  assert.match(banner, /Turn on notifications/, "the browser notifications button stays");
  assert.match(banner, /Click anywhere on this page to enable sound/, "the click-to-enable hint stays");
  const hub = read("liveChatHub.js");
  assert.doesNotMatch(hub, /soundEnabled|voiceEnabled|visitorSoundEnabled/);
});

test("wiring: the new-patient voice and the chime logic are untouched by this change", () => {
  const patient = fs.readFileSync(path.join(LC, "..", "registrationVoice.js"), "utf8");
  assert.match(patient, /REGISTRATION_PHRASE = "New patient registered"/);
  const hub = read("liveChatHub.js");
  assert.match(hub, /function ring\(options\) \{\s*if \(!shouldAlert\(\)\) return;\s*playChime\(options\);/);
});
