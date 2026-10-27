// The "privacy check incomplete" warning on the Search Analytics dashboard. Newly written for
// the current code (not a recovered test). The page is loaded through Vite (SSR) and the
// notice is rendered to static markup; no network. Run from frontend/:
//   node --test tests/searchAnalyticsPrivacyNotice.test.mjs
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PRIVACY_CHECK_INCOMPLETE_HELP, privacyCheckIncomplete } from "../src/pages/admin/analyticsState.js";

let vite;
let mod;
before(async () => {
  vite = await createServer({ configFile: false, logLevel: "silent", appType: "custom", server: { middlewareMode: true }, plugins: [(await import("@vitejs/plugin-react")).default()] });
  mod = await vite.ssrLoadModule("/src/pages/admin/SearchAnalytics.jsx");
});
after(async () => {
  await vite?.close();
});

const render = (meta) => renderToStaticMarkup(createElement(mod.PrivacyCheckNotice, { meta }));

test("privacyCheckIncomplete is true only for an explicit termsCheckComplete=false", () => {
  assert.equal(privacyCheckIncomplete({ termsCheckComplete: false }), true);
  for (const meta of [{ termsCheckComplete: true }, {}, null, undefined, { kThreshold: 3 }]) assert.equal(privacyCheckIncomplete(meta), false);
});

test("the warning explains that term-level results are temporarily hidden and does not imply there were no searches", () => {
  assert.match(PRIVACY_CHECK_INCOMPLETE_HELP, /temporarily hidden/);
  assert.match(PRIVACY_CHECK_INCOMPLETE_HELP, /privacy checks could not be completed/);
  assert.match(PRIVACY_CHECK_INCOMPLETE_HELP, /does not mean there were no searches/);
  assert.match(PRIVACY_CHECK_INCOMPLETE_HELP, /Refresh/);
  assert.doesNotMatch(PRIVACY_CHECK_INCOMPLETE_HELP, /error|failed|alert|danger/i, "non-alarming wording");
});

test("the notice renders as a polite status message when the check is incomplete", () => {
  const html = render({ termsCheckComplete: false });
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.match(html, /temporarily hidden/);
});

test("the notice renders nothing when the check completed or the flag is absent", () => {
  assert.equal(render({ termsCheckComplete: true }), "");
  assert.equal(render({}), "");
  assert.equal(render(undefined), "");
});

test("the page shows the notice in the page header area and in the Top terms, Daily terms and Gaps tabs", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  assert.equal(source.split("<PrivacyCheckNotice meta={body?.meta} />").length - 1, 3, "one per term-level tab");
  assert.ok(source.includes("<PrivacyCheckNotice meta={summary.body?.meta} />"), "and one for the Summary tiles");
});

test("while terms are hidden, the tabs do not claim there is nothing to show", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  for (const text of ["No search terms for this period yet.", "No listed terms for this period.", "No content opportunities found for this period."]) {
    const at = source.indexOf(text);
    assert.ok(at > 0, text);
    assert.ok(source.slice(Math.max(0, at - 160), at).includes("!privacyCheckIncomplete(body?.meta)"), `${text} is suppressed while the check is incomplete`);
  }
});
