// Static checks for the Live Chat entry points: the old admin sidebar item and the toast links open the one named
// Live Chat tab through plain anchors (a named target is always a tab, never a window), and the Archive page is wired
// into the Live Chat menu and router.
// Run: node --test tests/  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");
const LC = path.join(src, "pages", "admin", "livechat");

test("there is no named Live Chat tab any more: every click opens a new tab", () => {
  const tabs = read("pages/admin/livechat/liveChatTabs.js");
  assert.doesNotMatch(tabs, /LIVECHAT_TAB_NAME|humancare-livechat|window\.name/);
  assert.match(tabs, /window\.open\(target, "_blank"\)/);
  for (const file of fs.readdirSync(LC).filter((f) => /\.(jsx?|mjs)$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(path.join(LC, file), "utf8"), /LIVECHAT_TAB_NAME|humancare-livechat/, file);
  }
});

test("old sidebar: Live Chat is a plain target=_blank rel=noopener anchor with no onClick, NEW tag, unread badge or script", () => {
  const layout = read("pages/admin/AdminLayout.jsx");
  const start = layout.indexOf("function LiveChatNavLink");
  assert.ok(start > 0);
  const end = layout.slice(start).search(/\r?\n\}\r?\n/); // line-ending safe (CRLF or LF checkouts)
  assert.ok(end > 0);
  const link = layout.slice(start, start + end);
  assert.match(link, /<a\s+href=\{item\.path\}\s+target="_blank"\s+rel="noopener"/);
  assert.doesNotMatch(link, /onClick|onNavigate/);
  assert.doesNotMatch(link, /preventDefault|window\.open|openLiveChat|navigate\(/);
  assert.doesNotMatch(link, /badge|unread|Unread/i);
  assert.doesNotMatch(layout, /badge:\s*"NEW"/);
  assert.doesNotMatch(layout, /UnreadBadge|useLiveChatAdmin/);
  assert.doesNotMatch(layout, /window\.open/);
  // the only place the entry is rendered
  assert.equal((layout.match(/<LiveChatNavLink/g) || []).length, 1);
});

test("no window.open with window features anywhere in Live Chat or the sidebar", () => {
  const files = fs
    .readdirSync(LC)
    .filter((f) => /\.(jsx?|mjs)$/.test(f))
    .map((f) => path.join(LC, f))
    .concat(path.join(src, "pages", "admin", "AdminLayout.jsx"));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/window\.open\(([^)]*)\)/g)) {
      const args = match[1].split(",").length;
      assert.ok(args <= 2, `${path.basename(file)}: window.open with a features argument: ${match[0]}`);
    }
  }
});

test("toasts are _blank anchors; a browser notification click opens a new tab", () => {
  const toasts = read("pages/admin/livechat/LiveChatToasts.jsx");
  assert.match(toasts, /target=\{toast\.path \? "_blank" : undefined\}/);
  assert.match(toasts, /rel=\{toast\.path \? "noopener" : undefined\}/);
  assert.doesNotMatch(toasts, /<button/);
  const provider = read("pages/admin/livechat/LiveChatAdminProvider.jsx");
  assert.match(provider, /inLiveChatTab\(\)/, "inside the Live Chat tab the chat is followed in place");
  assert.match(read("pages/admin/livechat/liveChatNotify.js"), /openLiveChat\(path\)/);
});

test("the Archive page: menu item under Live agent chats, route, and a read-only viewer", () => {
  const shell = read("pages/admin/livechat/LiveChatShell.jsx");
  const agent = shell.indexOf('label: "Live agent chats"');
  const archive = shell.indexOf('label: "Archive"');
  const team = shell.indexOf('label: "Team"');
  assert.ok(agent > 0 && archive > agent && archive < team, "Archive sits directly under Live agent chats");
  assert.match(read("App.jsx"), /path="\/admin-dashboard\/live-chat\/archive\/:conversationId\?"/);
  const page = read("pages/admin/livechat/AdminLiveArchive.jsx");
  assert.match(page, /<ChatConversation[\s\S]*readOnly/);
  assert.match(page, /archive: 1/, "viewing does not mark the chat read");
});

test('the chat lists call the group "Archive temp"', () => {
  const list = read("pages/admin/livechat/ChatList.jsx");
  assert.equal((list.match(/"Archive temp"/g) || []).length, 2);
  assert.doesNotMatch(list, /\["Archived",/);
});
