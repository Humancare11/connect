import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractClickCode, sendClickReport, reportEmailClick } from "./emailClickReport.js";
import { getRouteSeo } from "../seo/routes.js";

test("extracts the code and gives back the address without it; other parameters and the fragment stay", () => {
  assert.deepEqual(extractClickCode("https://humancareconnect.co/doctors?r=AbC123xYz9"), { code: "AbC123xYz9", cleanedUrl: "/doctors" });
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p?a=1&r=AbC123xYz9&b=2#pricing"), { code: "AbC123xYz9", cleanedUrl: "/p?a=1&b=2#pricing" });
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p?r=AbC123xYz9#x"), { code: "AbC123xYz9", cleanedUrl: "/p#x" });
});

test("no r parameter: nothing to do. A malformed r is removed but never reported", () => {
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p?a=1"), { code: "", cleanedUrl: "" });
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p"), { code: "", cleanedUrl: "" });
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p?r=<script>"), { code: "", cleanedUrl: "/p" });
  assert.deepEqual(extractClickCode("https://humancareconnect.co/p?r=x"), { code: "", cleanedUrl: "/p" });
});

test("report: sendBeacon first, fetch as the fallback; failures never throw", () => {
  const calls = [];
  assert.equal(sendClickReport("AbC123xYz9", { nav: { sendBeacon: (p) => (calls.push(p), true) }, doFetch: null }), "beacon");
  assert.deepEqual(calls, ["/api/r/AbC123xYz9"]);

  const fetched = [];
  const doFetch = (path, init) => (fetched.push([path, init.method]), Promise.reject(new Error("offline")));
  assert.equal(sendClickReport("AbC123xYz9", { nav: { sendBeacon: () => false }, doFetch }), "fetch");
  assert.equal(sendClickReport("AbC123xYz9", { nav: {}, doFetch }), "fetch");
  assert.deepEqual(fetched[0], ["/api/r/AbC123xYz9", "POST"]);
  assert.equal(sendClickReport("AbC123xYz9", { nav: { sendBeacon: () => { throw new Error("blocked"); } }, doFetch: null }), "none");
});

function fakeWindow(href) {
  const url = new URL(href);
  const win = {
    location: { href, search: url.search },
    history: { state: { k: 1 }, replaced: [], replaceState(state, _title, to) { this.replaced.push(to); } },
    idle: [],
    requestIdleCallback(fn) { this.idle.push(fn); },
  };
  return win;
}

test("on page load the address is cleaned at once and the report is deferred to idle time (never blocks rendering)", () => {
  const win = fakeWindow("https://humancareconnect.co/doctors?a=1&r=AbC123xYz9");
  reportEmailClick(win);
  assert.deepEqual(win.history.replaced, ["/doctors?a=1"]);
  assert.equal(win.idle.length, 1, "report is queued, not sent synchronously");
});

test("a page without r is left completely alone", () => {
  for (const href of ["https://humancareconnect.co/", "https://humancareconnect.co/p?a=1"]) {
    const win = fakeWindow(href);
    reportEmailClick(win);
    assert.deepEqual(win.history.replaced, []);
    assert.equal(win.idle.length, 0);
  }
  assert.doesNotThrow(() => reportEmailClick(null));
  assert.doesNotThrow(() => reportEmailClick({}));
});

test("SEO: the canonical comes from the path only, so ?r= can never reach it; the sitemap and prerender do not read the code", () => {
  const withR = getRouteSeo("/doctors?r=AbC123xYz9");
  const without = getRouteSeo("/doctors");
  assert.equal(withR.canonical, without.canonical);
  assert.doesNotMatch(String(withR.canonical), /[?&]r=/);
  // The reporter is only wired into the browser entry point; build-time scripts and the SEO helpers do not touch it.
  for (const f of ["../seo/routes.js", "../components/Seo.jsx"]) {
    assert.doesNotMatch(fs.readFileSync(new URL(f, import.meta.url), "utf8"), /emailClickReport|location\.search/, f);
  }
  const main = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
  assert.ok(main.indexOf("reportEmailClick();") < main.indexOf("hydrateRoot(rootElement, app)"), "cleaned before the app renders");
});
