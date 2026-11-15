// Admin live chat sound: the chime is separate from the toast, a chat that is open still sounds (softer) when the
// window is not in front, a message is announced once, and desktop notifications follow the focus rules.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "livechat");
const hub = fs.readFileSync(path.join(LC, "liveChatHub.js"), "utf8");
const notify = fs.readFileSync(path.join(LC, "liveChatNotify.js"), "utf8");
const banner = fs.readFileSync(path.join(LC, "NotificationsBanner.jsx"), "utf8");

const between = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));

test("pushToast no longer plays the chime; ring() does, behind the same single-tab rule", () => {
  const push = between(hub, "function pushToast", "// A toast with the normal chime");
  assert.doesNotMatch(push, /playChime/);
  const ring = between(hub, "function ring", "// `notify` is what");
  assert.match(ring, /shouldAlert\(\)/);
  assert.match(ring, /playChime\(options\)/);
});

test("the open chat: silent when the window is in front, a quiet chime and a notification when it is not", () => {
  const message = between(hub, 'case "chat:message"', 'case "chat:updated"');
  assert.match(message, /isActive\(payload\.conversationId\)/);
  assert.match(message, /!pageInFront\(\)/);
  assert.match(message, /ring\(\{ quiet: true \}\)/);
  assert.match(message, /tag: `lc-\$\{pagePath/);
  assert.match(message, /firstSighting\(payload\.message\.id\)/, "a message id is announced once");
});

test("chats that are not open still get toast + chime, and another agent's chats stay silent", () => {
  const message = between(hub, 'case "chat:message"', 'case "chat:updated"');
  assert.match(message, /assigneeId !== snapshot\.agentId\) break/);
  assert.match(message, /alertToast\(\{/);
});

test("the queue notification stays on screen until dismissed", () => {
  assert.match(between(hub, 'case "queue:new"', 'case "chat:message"'), /requireInteraction: true/);
});

test("desktop notifications show whenever the page is not in front (hidden OR unfocused) and replace per chat", () => {
  assert.match(notify, /document\.visibilityState === "visible" && \(typeof document\.hasFocus !== "function" \|\| document\.hasFocus\(\)\)/);
  assert.match(notify, /renotify: Boolean\(tag\)/);
  assert.match(notify, /requireInteraction/);
  assert.match(notify, /silent: true/, "the chime is the sound; the OS adds none");
});

test("notifications never carry message text", () => {
  const message = between(hub, 'case "chat:message"', 'case "chat:updated"');
  assert.match(message, /const notify = \{ title: "New message", body: `\$\{who\} sent a message` \}/);
  assert.doesNotMatch(message, /notify[^\n]*message\.text/);
});

test("quiet chime is softer and a failed unlock is retried; the hint follows the audio state", () => {
  assert.match(notify, /quiet \? 0\.05 : 0\.12/);
  assert.match(notify, /audio\?\.state === "running"\) done\(\)/);
  assert.match(notify, /export function subscribeAudioState/);
  assert.match(banner, /Click anywhere on this page to enable sound/);
  assert.match(banner, /sound && !unlocked/);
});
