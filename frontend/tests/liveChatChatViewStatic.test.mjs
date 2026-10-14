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

test("the Original | English switch is in the composer toolbar: Message selector, divider, switch, To button, divider; only for non-English chats", () => {
  const composer = read("Composer.jsx");
  const mode = composer.indexOf('className="cm-mode"');
  const sw = composer.indexOf("<LanguageSwitch");
  const sep = composer.indexOf('className="cm-sep"');
  assert.ok(mode > 0 && sep > mode && sw > sep, "the divider follows the Message selector, then the switch");
  assert.match(composer, /\{language && \(\s*<>\s*<LanguageSwitch/);
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

// ── Composer language controls (rendered for real with Vite SSR) ──────────────────────────────────────────────────

async function renderChat({ language, languageUnknown = false, readOnly = false, archivedJoinable, closedArchived, messages }) {
  const { createServer } = await import("vite");
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const server = await createServer({ root: path.resolve(LC, "..", "..", "..", ".."), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { default: ChatConversation } = await server.ssrLoadModule("/src/pages/admin/livechat/ChatConversation.jsx");
    const now = new Date().toISOString();
    const noop = async () => false;
    const detail = {
      conversation: { conversationId: "HC12345678", mode: readOnly || archivedJoinable || closedArchived ? "archived" : "live", joinable: Boolean(archivedJoinable), closedReason: archivedJoinable || closedArchived ? "inactive" : "", everLive: true, assignee: archivedJoinable ? null : { id: "u1", name: "Sam" }, name: "Hans", language, languageUnknown, startedAt: now, lastMessageAt: now },
      messages: messages || [{ id: "m1", sender: "patient", text: "Hallo, ich habe Schmerzen", at: now }],
      view: "original",
      panel: {},
    };
    return renderToStaticMarkup(
      React.createElement(ChatConversation, {
        detail, me: "u1", role: "admin", typing: false, canned: { agentName: "", replies: [] }, busy: false, error: "", panelOpen: true, readOnly,
        onTogglePanel() {}, onTakeOver: noop, onHandBack: noop, onResolve: noop, onSend: noop, onNote: noop, onSuggest: noop, onTyping() {},
        onBlockIp() {}, onSendFile: noop, onTranslateReply: noop, onTranslate: noop, onSetView() {}, onOpenFile() {}, onDownload() {}, onDetect: noop,
      })
    );
  } finally {
    await server.close();
  }
}

test("a non-English chat renders the Original | English switch and the 'To <language>' button; an English chat renders neither", async () => {
  const german = await renderChat({ language: { code: "de", name: "German" } });
  assert.match(german, /aria-label="Message language"/);
  assert.match(german, />Original</);
  assert.match(german, />English</);
  assert.match(german, /To German/);
  assert.doesNotMatch(german, /Language not detected/);
  // toolbar order: Message selector, divider, switch, To button, divider, then the # button
  const at = (needle) => german.indexOf(needle);
  assert.ok(at("Message ") < at("cm-sep") && at("cm-sep") < at('aria-label="Message language"') && at('aria-label="Message language"') < at("To German"));
  assert.ok(at("To German") < at("Saved replies"));

  const english = await renderChat({ language: null, messages: [{ id: "m1", sender: "ai", text: "Welcome", at: new Date().toISOString() }] });
  assert.doesNotMatch(english, /Message language/);
  assert.doesNotMatch(english, /To German|>Original</);
  assert.doesNotMatch(english, /Language not detected/, "no patient text: no hint");
});

test("'Language not detected' shows only when the server says the language is unknown; never for an English chat", async () => {
  const html = await renderChat({ language: null, languageUnknown: true });
  assert.match(html, /Language not detected/);
  assert.match(html, /Detect language/);
  assert.doesNotMatch(html, /Message language|To German/);
  // an English chat with patient text (language null, not unknown) gets no hint
  const english = await renderChat({ language: null, languageUnknown: false });
  assert.doesNotMatch(english, /Language not detected|Detect language/);
});

test("the Archive viewer's read-only bar shows only the switch, no 'To <language>'", async () => {
  const html = await renderChat({ language: { code: "mr", name: "Marathi" }, readOnly: true });
  assert.match(html, /Read-only/);
  assert.match(html, /aria-label="Message language"/);
  assert.doesNotMatch(html, /To Marathi|Language not detected/);
});

test("the chat list sorts every group newest first with no Oldest / Newest toggle", () => {
  const list = read("ChatList.jsx");
  assert.doesNotMatch(list, /Oldest|Change sort order|sortBy/);
  assert.match(list, /activityAt\(b\) - activityAt\(a\)/);
  assert.match(list, /Asia|IST_OFFSET_MS/, "Archive temp drops yesterday's chats at midnight India time");
});

test("an archived chat that came from the Queue today can be joined from Archive temp; other archived chats stay closed", async () => {
  const joinable = await renderChat({ language: null, archivedJoinable: true });
  assert.match(joinable, /Take over chat/);
  assert.match(joinable, /Enter message/, "the composer is open for a reply");
  assert.doesNotMatch(joinable, /Read-only/);
  const closed = await renderChat({ language: null, closedArchived: true });
  assert.doesNotMatch(closed, /Take over chat/);
});
