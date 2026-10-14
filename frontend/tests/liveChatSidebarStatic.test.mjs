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

test("the tab name is humancare-livechat", () => {
  assert.match(read("pages/admin/livechat/liveChatTabs.js"), /LIVECHAT_TAB_NAME = "humancare-livechat"/);
});

test("old sidebar: Live Chat is a plain named-target anchor, with no NEW tag, no unread badge and no script", () => {
  const layout = read("pages/admin/AdminLayout.jsx");
  const start = layout.indexOf("function LiveChatNavLink");
  assert.ok(start > 0);
  const link = layout.slice(start, layout.indexOf("\n}\n", start));
  assert.match(link, /<a\s+href=\{item\.path\}\s+target=\{LIVECHAT_TAB_NAME\}/);
  assert.doesNotMatch(link, /_blank/);
  assert.doesNotMatch(link, /rel=/, "no noopener: it would put the tab in its own browsing-context group");
  assert.doesNotMatch(link, /preventDefault|window\.open|openLiveChat/);
  assert.doesNotMatch(link, /badge|unread|Unread/i);
  assert.doesNotMatch(layout, /badge:\s*"NEW"/);
  assert.doesNotMatch(layout, /UnreadBadge|useLiveChatAdmin/);
  assert.doesNotMatch(layout, /window\.open/);
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

test("toasts are anchors to the named tab", () => {
  const toasts = read("pages/admin/livechat/LiveChatToasts.jsx");
  assert.match(toasts, /target=\{toast\.path \? LIVECHAT_TAB_NAME : undefined\}/);
  assert.doesNotMatch(toasts, /<button/);
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
