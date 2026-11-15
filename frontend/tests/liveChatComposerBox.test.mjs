// The patient chat's growing message box: the pure helpers and the wiring (no browser).
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPOSER_MAX_PX, PILL_MAX_PX, enterSends, fitTextarea, isCoarsePointer } from "../src/features/livechat/composerBox.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");

const fakeBox = (scrollHeight) => ({ style: {}, scrollHeight });

test("the box grows with its text up to the cap, then stops and scrolls inside", () => {
  const one = fakeBox(42);
  assert.equal(fitTextarea(one, COMPOSER_MAX_PX), 42);
  assert.equal(one.style.height, "42px");
  assert.equal(one.style.overflowY, "hidden");
  const tall = fakeBox(300);
  assert.equal(fitTextarea(tall, COMPOSER_MAX_PX), COMPOSER_MAX_PX);
  assert.equal(tall.style.height, `${COMPOSER_MAX_PX}px`);
  assert.equal(tall.style.overflowY, "auto");
  assert.equal(fitTextarea(null, COMPOSER_MAX_PX), 0, "no box, no crash");
});

test("after sending (empty text) the box returns to one line", () => {
  const box = fakeBox(300);
  fitTextarea(box, COMPOSER_MAX_PX);
  box.scrollHeight = 42; // the browser reports the one-line height once the text is gone
  assert.equal(fitTextarea(box, COMPOSER_MAX_PX), 42);
  assert.equal(box.style.overflowY, "hidden");
});

test("caps: about 120 px for the chat box, a little taller for the pill's extra padding", () => {
  assert.equal(COMPOSER_MAX_PX, 120);
  assert.ok(PILL_MAX_PX > COMPOSER_MAX_PX && PILL_MAX_PX <= 140);
});

test("Enter sends; Shift+Enter, IME composition and touch keyboards do not", () => {
  assert.equal(enterSends({ key: "Enter" }), true);
  assert.equal(enterSends({ key: "Enter", shiftKey: true }), false);
  assert.equal(enterSends({ key: "Enter", isComposing: true }), false);
  assert.equal(enterSends({ key: "Enter" }, true), false, "coarse pointer: Enter is a new line");
  assert.equal(enterSends({ key: "a" }), false);
});

test("isCoarsePointer reads (pointer: coarse) and survives a missing matchMedia", () => {
  const saved = globalThis.window;
  try {
    globalThis.window = { matchMedia: (q) => ({ matches: q === "(pointer: coarse)" }) };
    assert.equal(isCoarsePointer(), true);
    globalThis.window = {};
    assert.equal(isCoarsePointer(), false);
  } finally {
    globalThis.window = saved;
  }
});

test("the chat window uses a textarea with the 1000 character limit, Enter handling and a 16px font", () => {
  const widget = read("features", "livechat", "LiveChatWidget.jsx");
  assert.match(widget, /<textarea[\s\S]*?ref=\{inputRef\}[\s\S]*?rows=\{1\}/);
  assert.match(widget, /const MAX_CHARS = 1000/);
  assert.match(widget, /maxLength=\{MAX_CHARS\}/);
  assert.match(widget, /enterSends\(/);
  assert.match(widget, /data-lenis-prevent\s+enterKeyHint="send"/);
  assert.doesNotMatch(widget, /<input\s+ref=\{inputRef\}/);
  const css = read("features", "livechat", "LiveChatWidget.css");
  const rule = css.slice(css.indexOf(".lcw-composer textarea {"), css.indexOf("}", css.indexOf(".lcw-composer textarea {")));
  assert.match(rule, /font-size: 16px/);
  assert.match(rule, /max-height: 120px/);
  assert.match(css, /\.lcw-composer \{[^}]*align-items: flex-end/);
});

test("the list stays at the bottom while the box grows or shrinks", () => {
  const widget = read("features", "livechat", "LiveChatWidget.jsx");
  assert.match(widget, /useLayoutEffect\(\(\) => \{[\s\S]*?fitTextarea\(box, COMPOSER_MAX_PX\)[\s\S]*?body\.scrollTop = body\.scrollHeight/);
});

test("the greeter pill is a textarea too, still 500 characters, Enter opens the chat", () => {
  const greeter = read("features", "livechat", "DoctorGreeter.jsx");
  assert.match(greeter, /<textarea[\s\S]*?maxLength=\{MAX_PILL_CHARS\}/);
  assert.match(greeter, /requestSubmit\(\)/);
  assert.match(greeter, /fitTextarea\(inputRef\.current, PILL_MAX_PX\)/);
  assert.match(read("features", "livechat", "greeterConfig.js"), /MAX_PILL_CHARS = 500/);
  const css = read("features", "livechat", "LiveChatWidget.css");
  assert.match(css, /\.lcw-gr-minif \{[\s\S]*?min-height: 60px;[\s\S]*?align-self: flex-end/);
  assert.match(css, /\.lcw-gr-minif textarea \{[\s\S]*?font-size: 16px/);
});

test("admin: the reply box already grows (textarea, 150 px); the list is re-pinned when the box makes it shorter", () => {
  const composer = read("pages", "admin", "livechat", "Composer.jsx");
  assert.match(composer, /<textarea/);
  const conversation = read("pages", "admin", "livechat", "ChatConversation.jsx");
  assert.match(conversation, /new ResizeObserver\(/);
  assert.match(conversation, /el\.clientHeight !== height && atBottom\.current\) el\.scrollTop = el\.scrollHeight/);
});
