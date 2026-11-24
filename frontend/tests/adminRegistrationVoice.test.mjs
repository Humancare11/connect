// "New patient registered" voice: the pure rules from registrationVoice.js, plus static checks that it is wired as
// specified and the live chat files are not involved. Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRegistrationVoice, REGISTRATION_PHRASE, CLAIM_WINDOW_MS, VOICE_GAP_MS, MAX_QUEUE } from "../src/pages/admin/registrationVoice.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin");
const read = (name) => fs.readFileSync(path.join(SRC, name), "utf8");

// A fake clock with timers, so the claim window and the gap run instantly.
function world() {
  let t = 1_000_000;
  let seq = 0;
  const timers = new Map();
  const spoken = [];
  const enders = [];
  const api = {
    now: () => t,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: (id) => timers.delete(id),
    speak: (text, { onEnd }) => { spoken.push(text); enders.push(onEnd); return true; },
    spoken,
    endSpeaking: () => enders.shift()?.(),
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
const make = (w, extra = {}) => createRegistrationVoice({ speak: w.speak, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer, ...extra });

test("the phrase is exactly the one asked for", () => {
  assert.equal(REGISTRATION_PHRASE, "New patient registered");
});

test("a single tab speaks once after the claim window", () => {
  const w = world();
  const v = make(w);
  assert.equal(v.handleEvent({ id: "p1", name: "A" }), true);
  assert.equal(w.spoken.length, 0);
  w.advance(CLAIM_WINDOW_MS);
  assert.deepEqual(w.spoken, [REGISTRATION_PHRASE]);
});

test("the same patient is never spoken twice in a tab; bad payloads are ignored", () => {
  const w = world();
  const v = make(w);
  v.handleEvent({ id: "p1" });
  assert.equal(v.handleEvent({ id: "p1" }), false);
  assert.equal(v.handleEvent({}), false);
  assert.equal(v.handleEvent(null), false);
  assert.equal(v.handleEvent({ id: 5 }), false);
  w.advance(CLAIM_WINDOW_MS);
  w.endSpeaking();
  w.advance(5000);
  assert.equal(w.spoken.length, 1);
});

test("two tabs: exactly one speaks (the clicked, visible one)", () => {
  const w1 = world();
  const w2 = world();
  const bus = { a: null, b: null };
  const a = make(w1, { tabId: "a", isActivated: () => false, isVisible: () => true, post: (m) => bus.b?.handleTabMessage(m) });
  const b = make(w2, { tabId: "b", isActivated: () => true, isVisible: () => true, post: (m) => bus.a?.handleTabMessage(m) });
  bus.a = a;
  bus.b = b;
  a.handleEvent({ id: "p1" });
  b.handleEvent({ id: "p1" });
  w1.advance(CLAIM_WINDOW_MS);
  w2.advance(CLAIM_WINDOW_MS);
  assert.equal(w1.spoken.length, 0);
  assert.equal(w2.spoken.length, 1);
});

test("three tabs with equal state: a random number picks exactly one", () => {
  const tabs = ["a", "b", "c"].map((id, i) => ({ id, w: world(), r: [0.2, 0.9, 0.5][i] }));
  const voices = {};
  tabs.forEach(({ id, w, r }) => {
    voices[id] = make(w, { tabId: id, random: () => r, post: (m) => tabs.forEach((o) => o.id !== id && voices[o.id]?.handleTabMessage(m)) });
  });
  tabs.forEach(({ id }) => voices[id].handleEvent({ id: "p1" }));
  tabs.forEach(({ w }) => w.advance(CLAIM_WINDOW_MS));
  assert.deepEqual(tabs.map((t) => t.w.spoken.length), [0, 1, 0]);
});

test("a claim that arrives before this tab's own event still counts", () => {
  const w = world();
  const v = make(w, { tabId: "a", isActivated: () => false });
  v.handleTabMessage({ type: "reg:claim", id: "p1", claim: { tabId: "z", activated: 1, visible: 1, random: 0.1 } });
  v.handleEvent({ id: "p1" });
  w.advance(CLAIM_WINDOW_MS);
  assert.equal(w.spoken.length, 0);
});

test("a burst is spoken one at a time with a gap, never overlapping", () => {
  const w = world();
  const v = make(w);
  ["p1", "p2", "p3"].forEach((id) => v.handleEvent({ id }));
  w.advance(CLAIM_WINDOW_MS);
  assert.equal(w.spoken.length, 1, "only the first starts");
  w.advance(5000);
  assert.equal(w.spoken.length, 1, "the next waits for the first to end");
  w.endSpeaking();
  w.advance(VOICE_GAP_MS - 1);
  assert.equal(w.spoken.length, 1, "and for the gap");
  w.advance(1);
  assert.equal(w.spoken.length, 2);
  w.endSpeaking();
  w.advance(VOICE_GAP_MS);
  assert.equal(w.spoken.length, 3);
});

test("a voice that never reports its end is released by the safety timer", () => {
  const w = world();
  const v = make(w);
  v.handleEvent({ id: "p1" });
  v.handleEvent({ id: "p2" });
  w.advance(CLAIM_WINDOW_MS);
  w.advance(6000 + VOICE_GAP_MS);
  assert.equal(w.spoken.length, 2);
});

test("the waiting queue is capped", () => {
  const w = world();
  const v = make(w);
  for (let i = 0; i < 20; i += 1) v.handleEvent({ id: `p${i}` });
  w.advance(CLAIM_WINDOW_MS);
  const { queued, speaking } = v._state();
  assert.equal(speaking, true);
  assert.ok(queued <= MAX_QUEUE);
});

test("speech that is unavailable or throws does not break anything", () => {
  const w = world();
  const v1 = createRegistrationVoice({ speak: () => false, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
  v1.handleEvent({ id: "p1" });
  w.advance(CLAIM_WINDOW_MS);
  const v2 = createRegistrationVoice({ speak: () => { throw new Error("no speech"); }, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
  v2.handleEvent({ id: "p2" });
  w.advance(CLAIM_WINDOW_MS);
  assert.equal(v1._state().speaking, false);
  assert.equal(v2._state().speaking, false);
});

test("wiring: always speaks (no Sound/Voice switch), admin + superadmin only, mounted in AdminLayout, no toast", () => {
  const hook = read("useAdminRegistrationVoice.js");
  const logic = read("registrationVoice.js");
  assert.ok(!/soundEnabled|voiceEnabled|liveChatNotify|liveChatHub/.test(hook + logic), "must not read the live chat switches or hub");
  assert.match(hook, /\["admin", "superadmin"\]\.includes\(user\.role\)/);
  assert.match(hook, /admin-alerts-watch/);
  assert.match(hook, /admin-user-registered/);
  assert.ok(!/toast/i.test(hook + logic.replace(/\/\/.*$/gm, "")), "no toast");
  const layout = read("AdminLayout.jsx");
  assert.match(layout, /import \{ useAdminRegistrationVoice \} from "\.\/useAdminRegistrationVoice";/);
  assert.match(layout, /useAdminRegistrationVoice\(user\);/);
});
