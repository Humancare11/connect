// Live Chat settings: the "Prices the AI may quote" card is read only and follows the Super Admin pricing (no browser).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const page = fs.readFileSync(path.join(src, "pages", "admin", "livechat", "AdminLiveSettings.jsx"), "utf8");

test("the prices are loaded from the read-only endpoint, not from the editable settings", () => {
  assert.match(page, /api\s*\.get\(`\$\{BASE\}\/prices`\)/);
  const editable = page.slice(page.indexOf("const EDITABLE"), page.indexOf("const MAX_CUSTOM_FIELDS"));
  assert.doesNotMatch(editable, /"prices"/, "the manual list is no longer sent back");
});

test("the card has no inputs: no add, remove or edit of a price", () => {
  const card = page.slice(page.indexOf('id="ai-prices"'), page.indexOf("<h3>Agents and limits</h3>"));
  assert.ok(card.length > 200);
  assert.doesNotMatch(card, /<input|<textarea|<select|onChange=|Add a price|Remove/);
  assert.match(card, /href="\/services-prices"/, "links to Services Prices");
  assert.match(card, /Healthcare Management/, "and to Healthcare Management");
  assert.match(card, /\/superadmin-dashboard/);
  assert.match(card, /no price/, "a service without a price says so");
});

test("a typed price in Business facts or a quick reply shows the server's warning, and the placeholder is explained", () => {
  assert.match(page, /warnings\.map/);
  assert.match(page, /\{price:general-consultation\}/);
});
