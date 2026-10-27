// Static check: the server's "Talk to a live agent" reply link is a button that reuses the header handler and is hidden
// once the chat is no longer with the AI. Reads source only. Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "features", "livechat");
const widget = fs.readFileSync(path.join(DIR, "LiveChatWidget.jsx"), "utf8");

test("the agent link renders as a button that calls talkToAgent, styled like the other cards", () => {
  assert.match(widget, /const AGENT_LINK = "#talk-to-live-agent"/);
  assert.match(widget, /<button key=\{link\.url\} type="button" className="lcw-link" onClick=\{onAgent\}>/);
  assert.match(widget, /onAgent=\{chat\.talkToAgent\}/);
});

test("the agent link is hidden when the chat can no longer request an agent", () => {
  assert.match(widget, /link\.url !== AGENT_LINK \|\| canRequestAgent/);
  assert.match(widget, /canRequestAgent=\{Boolean\(conversation\?\.canRequestAgent\)\}/);
});
