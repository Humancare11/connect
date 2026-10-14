// Static checks for the admin chat view: no status tags on the chat list items or in the conversation header, and the
// Original | English switch lives in the composer toolbar (and the Archive read-only bar), not in the message area.
// The data behind the tags (closed reason, handoff reason, language) stays: the Archive page, reports, transcripts and
// translation still use it. Run: node --test tests/  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "livechat");
const read = (name) => fs.readFileSync(path.join(LC, name), "utf8");
const TAG_WORDS = /Email failed|Email follow-up|handoffLabel|CLOSED_LABEL|wk-tag--(done|wait|lang|human|ai)|wk-rating|Invited|row\.language|c\.language\.name/;

test("chat list items show no tags: only name, time, preview and the unread badge", () => {
  const list = read("ChatList.jsx");
  assert.doesNotMatch(list, TAG_WORDS);
  assert.doesNotMatch(list, /function Labels|<Labels/);
  assert.match(list, /className="wk-badge"/, "the unread count stays");
  assert.doesNotMatch(list, /Archived ·/, "archived chats show their last message like any other chat");
});

test("the conversation header shows no tags, only the 'held by' text", () => {
  const chat = read("ChatConversation.jsx");
  const head = chat.slice(chat.indexOf('<div className="wk-head-t">'), chat.indexOf('<div className="wk-actions">'));
  assert.ok(head.length > 20);
  assert.doesNotMatch(head, /wk-tag|wk-rating|Email|handoff|Invited/);
  assert.match(head, /held by/);
  assert.doesNotMatch(chat, /import \{[^}]*(handoffLabel|CLOSED_LABEL)/);
});

test("the Original | English switch is in the composer toolbar, right after the Message selector, only for non-English chats", () => {
  const composer = read("Composer.jsx");
  const mode = composer.indexOf('className="cm-mode"');
  const sw = composer.indexOf("<LanguageSwitch");
  const sep = composer.indexOf('className="cm-sep"');
  assert.ok(mode > 0 && sw > mode && sw < sep, "switch sits between the Message selector and the separator");
  assert.match(composer, /\{language && <LanguageSwitch/);
  const chat = read("ChatConversation.jsx");
  assert.doesNotMatch(chat, /wk-viewswitch/, "the sticky switch is gone from the message area");
  assert.match(chat, /view=\{view\}[\s\S]*onChooseView=\{chooseView\}[\s\S]*translating=\{translating\}/);
});

test("the Archive read-only bar has the switch too", () => {
  const chat = read("ChatConversation.jsx");
  const bar = chat.slice(chat.indexOf('className="wk-readonly"'));
  assert.match(bar.slice(0, 400), /<LanguageSwitch view=\{view\} onChoose=\{chooseView\} translating=\{translating\}/);
});

test("the switch component keeps its behaviour: Original / English, pressed state, Translating…", () => {
  const sw = read("LanguageSwitch.jsx");
  assert.match(sw, /aria-pressed=\{view === "original"\}/);
  assert.match(sw, /aria-pressed=\{view === "en"\}/);
  assert.match(sw, /Translating…/);
});
