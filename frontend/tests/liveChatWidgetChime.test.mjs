// The patient widget's notification sound: what chimes, the burst gate, the one-tab claim, and the wiring.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHIME_MIN_GAP_MS, CLAIM_MS, claimChime, createChimeGate, isChimeMessage } from "../src/features/livechat/chime.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const fakeStorage = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)) };
};

test("replies from the AI and agents chime; the patient's own messages never do", () => {
  assert.equal(isChimeMessage({ sender: "ai", text: "Hi" }), true);
  assert.equal(isChimeMessage({ sender: "agent", text: "Hello" }), true);
  assert.equal(isChimeMessage({ sender: "patient", text: "Hello" }), false);
  assert.equal(isChimeMessage(null), false);
});

test("system lines: only 'joined the chat' and 'Chat resolved' chime", () => {
  assert.equal(isChimeMessage({ sender: "system", text: "Sam joined the chat" }), true);
  assert.equal(isChimeMessage({ sender: "system", text: "Chat resolved" }), true);
  assert.equal(isChimeMessage({ sender: "system", text: "Handed back to the AI assistant" }), false);
  assert.equal(isChimeMessage({ sender: "system", text: "You're now chatting with Connect AI." }), false);
  assert.equal(isChimeMessage({ sender: "system", text: "Our assistant is unavailable right now." }), false);
});

test("the burst gate lets one chime through per 1.5 s and does not queue the rest", () => {
  let t = 10_000;
  const gate = createChimeGate({ now: () => t });
  assert.equal(gate.allow(), true);
  t += 100;
  assert.equal(gate.allow(), false);
  t += CHIME_MIN_GAP_MS - 100;
  assert.equal(gate.allow(), true);
});

test("one tab claims a message; another tab with the same message stays quiet, a new message is free", () => {
  const storage = fakeStorage();
  let t = 1000;
  const opts = { storage, now: () => t };
  assert.equal(claimChime("m1", opts), true, "first tab");
  assert.equal(claimChime("m1", opts), false, "second tab, same message");
  assert.equal(claimChime("m2", opts), true, "a different message");
  t += CLAIM_MS + 1;
  assert.equal(claimChime("m2", opts), true, "an old claim expires");
});

test("a broken storage never blocks the sound", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(claimChime("m1", { storage: broken }), true);
});

test("the sound is always on: no stored mute key and no read of one", () => {
  const chime = read("features", "livechat", "chime.js");
  const hook = read("features", "livechat", "useLiveChat.js");
  assert.doesNotMatch(chime + hook, /hcLiveChatWidgetSound|readSoundOn|writeSoundOn|soundOn/);
});

test("wiring: the chime is driven by chat:message and a reconnect catch-up, never by the history load", () => {
  const hook = read("features", "livechat", "useLiveChat.js");
  assert.match(hook, /isChimeMessage\(message\)\) chime\(message\.id\)/, "live messages chime");
  assert.match(hook, /resume\(true\)/, "only a reconnect asks for the catch-up chime");
  assert.match(hook, /announce && before/, "the catch-up needs a chat already on screen");
  assert.match(hook, /!shown\.messages\.some\(\(m\) => m\.id === message\.id\)/, "a repeat of a known message is silent");
});

test("wiring: the header has no bell or mute button", () => {
  const widget = read("features", "livechat", "LiveChatWidget.jsx");
  const css = read("features", "livechat", "LiveChatWidget.css");
  assert.doesNotMatch(widget, /toggleSound|Mute message sound|lcw-sound|🔔|🔕/);
  assert.doesNotMatch(css, /lcw-sound/);
});
