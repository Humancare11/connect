// Static checks for the widget's End chat dialog and "chats never end by themselves" wording.
// Run: node --test tests/  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");
const squash = (text) => text.replace(/\s+/g, " ");

test("the dialog asks 'End this chat?', has End chat and Cancel, and an unchecked 'clear' box", () => {
  const dialog = squash(read("features/livechat/EndChatDialog.jsx"));
  assert.match(dialog, /End this chat\?/);
  assert.match(dialog, />\s*End chat\s*</);
  assert.match(dialog, />\s*Cancel\s*</);
  assert.match(dialog, /Also clear this chat from this device/);
  assert.match(dialog, /useState\(false\)/, "the box starts unchecked");
  assert.match(dialog, /onEnd\(clear\)/);
});

test("'–' minimizes; X opens the dialog (and only closes when there is no chat)", () => {
  const widget = squash(read("features/livechat/LiveChatWidget.jsx"));
  assert.match(widget, /onClick=\{\(\) => setOpen\(false\)\} aria-label="Minimize chat"/);
  assert.match(widget, /setConfirmEnd\(true\)/);
  assert.match(widget, /aria-label="End chat"/);
  assert.match(widget, /<EndChatDialog/);
  assert.match(widget, /await chat\.endChat\(clear\)/);
});

test("End chat sends chat:end, closes the widget; 'clear' forgets the token, visitor id and chat on this device", () => {
  const hook = squash(read("features/livechat/useLiveChat.js"));
  assert.match(hook, /emit\("chat:end", \{ clear: Boolean\(clear\) \}\)/);
  const body = hook.slice(hook.indexOf("const endChat = useCallback"));
  assert.match(body, /if \(clear\) \{ store\.remove\(TOKEN_KEY\); store\.remove\(ID_KEY\);/);
  assert.match(body, /setConversation\(null\)/);
  assert.match(body, /setPhase\("form"\)/, "the contact form shows again");
  assert.match(body, /setOpen\(false\)/);
});

test("a patient never sees 'This chat has ended' and there is no 'Start a new chat' dead end", () => {
  const all = ["features/livechat/useLiveChat.js", "features/livechat/LiveChatWidget.jsx", "features/livechat/RatingCard.jsx"].map((f) => read(f)).join("\n");
  assert.doesNotMatch(all, /This chat has ended/);
  assert.doesNotMatch(all, /Start a new chat/);
  assert.doesNotMatch(all, /chat\.startNew/);
});

test("a send waits for the socket to reconnect and starts a chat if the server has none", () => {
  const hook = squash(read("features/livechat/useLiveChat.js"));
  assert.match(hook, /await waitOnline\(\)/);
  assert.match(hook, /res\.error === "no_conversation"/);
  assert.match(hook, /emit\("chat:start", startDetails\(\)\)/);
});
