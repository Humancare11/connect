// Static checks for the AI notice on the contact form and the AI Review wiring.
// Run: node --test tests/  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");
const squash = (text) => text.replace(/\s+/g, " ");

test("contact form: the notice sits above Start chat, the agreement line below it, no checkbox, both link to the policy section", () => {
  const form = squash(read("features/livechat/ContactForm.jsx"));
  assert.match(form, /is an automated assistant, not a doctor\. It can't diagnose or give medical advice\. Your messages may be processed by our service providers under HIPAA agreements\. See our/);
  assert.match(form, /By starting the chat, you agree to this notice and our/);
  assert.match(form, /PRIVACY_URL = "\/privacy-policy#website-chat"/);
  assert.ok(form.indexOf("automated assistant") < form.indexOf('type="submit"'), "notice above the button");
  assert.ok(form.indexOf("By starting the chat") > form.indexOf('type="submit"'), "agreement line below the button");
  assert.doesNotMatch(form, /type="checkbox"/);
});

test("the notice and the acceptance flag only appear while the Super Admin setting is on", () => {
  const form = read("features/livechat/ContactForm.jsx");
  assert.match(form, /showNotice = false/);
  assert.match(form, /\{showNotice && \(/);
  assert.match(form, /aiNoticeAccepted: showNotice/);
  assert.match(read("features/livechat/useLiveChat.js"), /aiNoticeAccepted \? \{ aiNoticeAccepted: true \} : \{\}/);
  assert.match(read("features/livechat/LiveChatWidgetLoader.jsx"), /setShowAiNotice\(config\.showAiNotice === true\)/);
});

test("AI Review: menu item for reviewers only, route, and a note hint without patient details", () => {
  const shell = read("pages/admin/livechat/LiveChatShell.jsx");
  assert.match(shell, /ai-review/);
  assert.match(shell, /!item\.reviewOnly \|\| canReview/);
  assert.match(read("App.jsx"), /path="\/admin-dashboard\/live-chat\/ai-review"/);
  const page = read("pages/admin/livechat/AdminLiveReview.jsx");
  assert.match(page, /Don't include patient names or health details\./);
  assert.match(page, /Unreviewed/);
  assert.doesNotMatch(page, /api\.(put|patch|delete)\(/);
});
