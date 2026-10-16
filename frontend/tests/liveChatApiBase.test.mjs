// The widget must not build "//api/livechat/..." URLs when VITE_API_URL ends in a slash (production does).
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiBaseOf } from "../src/features/livechat/apiBase.js";

const LC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "features", "livechat");
const read = (name) => fs.readFileSync(path.join(LC, name), "utf8");

test("apiBaseOf removes trailing slashes and tolerates empty values", () => {
  assert.equal(apiBaseOf("https://humancareconnect.co/"), "https://humancareconnect.co");
  assert.equal(apiBaseOf("https://humancareconnect.co//"), "https://humancareconnect.co");
  assert.equal(apiBaseOf("https://humancareconnect.co"), "https://humancareconnect.co");
  assert.equal(apiBaseOf(""), "");
  assert.equal(apiBaseOf(undefined), "");
});

test("the production API URL gives a single-slash config URL", () => {
  const env = fs.readFileSync(path.resolve(LC, "..", "..", "..", ".env.production"), "utf8");
  const raw = /^VITE_API_URL=(.*)$/m.exec(env)?.[1]?.trim();
  assert.ok(raw, "VITE_API_URL is set in .env.production");
  const url = `${apiBaseOf(raw)}/api/livechat/config`;
  assert.ok(!url.replace("https://", "").includes("//"), url);
});

test("the widget loader and the chat hook both use apiBaseOf for VITE_API_URL", () => {
  for (const file of ["LiveChatWidgetLoader.jsx", "useLiveChat.js"]) {
    const src = read(file);
    assert.match(src, /apiBaseOf\(import\.meta\.env\.VITE_API_URL\)/, file);
    assert.doesNotMatch(src, /VITE_API_URL \|\| ""/, file);
  }
});
