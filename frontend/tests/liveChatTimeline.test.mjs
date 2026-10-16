// Order of the patient's bubbles: pending and failed messages stay at the end, in send order.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline } from "../src/features/livechat/timeline.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const T = (min) => new Date(Date.UTC(2026, 9, 16, 10, min)).toISOString();
const saved = (id, sender, text, min) => ({ id, sender, text, at: T(min) });
const out = (id, text, min, status = "failed") => ({ id, text, at: T(min), status });
const keys = (items) => items.map((i) => i.key);

test("a failed message stays after every saved message, including replies that arrived after it", () => {
  const messages = [saved("m1", "ai", "Hi", 0), saved("m2", "patient", "leg pain", 1), saved("m3", "ai", "Our Joint Pain page is below.", 2), saved("m4", "system", "Notice", 3)];
  const timeline = buildTimeline(messages, [out("out-1", "what about price", 2)]);
  assert.deepEqual(keys(timeline), ["m1", "m2", "m3", "m4", "out-1"]);
  assert.equal(timeline.at(-1).kind, "outbox");
});

test("several pending or failed messages keep the order they were sent in", () => {
  const timeline = buildTimeline([saved("m1", "ai", "Hi", 0)], [out("out-1", "first", 1), out("out-2", "second", 2, "sending"), out("out-3", "third", 3)]);
  assert.deepEqual(keys(timeline), ["m1", "out-1", "out-2", "out-3"]);
});

test("a failed message sent before a later successful one stays below it until it is confirmed", () => {
  const messages = [saved("m1", "ai", "Hi", 0), saved("m2", "patient", "second try", 3), saved("m3", "ai", "Reply", 4)];
  const timeline = buildTimeline(messages, [out("out-1", "first try", 1)]);
  assert.deepEqual(keys(timeline), ["m1", "m2", "m3", "out-1"]);
});

test("retry success: the outbox entry leaves and the saved message takes its real position at the end", () => {
  const before = buildTimeline([saved("m1", "ai", "Hi", 0)], [out("out-1", "hello", 1)]);
  assert.deepEqual(keys(before), ["m1", "out-1"]);
  const after = buildTimeline([saved("m1", "ai", "Hi", 0), saved("m2", "patient", "hello", 5), saved("m3", "ai", "Hi there", 6)], []);
  assert.deepEqual(keys(after), ["m1", "m2", "m3"]);
});

test("a message the server saved before its acknowledgement was late is not shown twice", () => {
  const messages = [saved("m1", "ai", "Hi", 0), saved("m2", "patient", "hello", 2)];
  const timeline = buildTimeline(messages, [out("out-1", "hello", 1, "sending")]);
  assert.deepEqual(keys(timeline), ["m1", "m2"]);
});

test("the same text sent twice: only the saved copies are matched, one per outbox entry", () => {
  const messages = [saved("m1", "patient", "ok", 1)];
  const timeline = buildTimeline(messages, [out("out-1", "ok", 1, "sending"), out("out-2", "ok", 2, "failed")]);
  assert.deepEqual(keys(timeline), ["m1", "out-2"]);
});

test("an older saved message with the same text does not hide a failed one", () => {
  const messages = [saved("m1", "patient", "ok", 0)];
  const timeline = buildTimeline(messages, [out("out-1", "ok", 30)]);
  assert.deepEqual(keys(timeline), ["m1", "out-1"]);
});

test("the widget renders through buildTimeline, not two separate lists", () => {
  const widget = fs.readFileSync(path.join(src, "features/livechat/LiveChatWidget.jsx"), "utf8").replace(/\s+/g, " ");
  assert.match(widget, /import \{ buildTimeline \} from "\.\/timeline"/);
  assert.match(widget, /buildTimeline\(conversation\.messages, chat\.outbox\)/);
  assert.doesNotMatch(widget, /chat\.outbox\.map/);
});
