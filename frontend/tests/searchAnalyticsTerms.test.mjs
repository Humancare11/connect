// Regression: analytics terms are shown exactly as recorded. The shared Axios
// client rewrites upload-looking strings into API URLs; the analytics API must
// opt out. Loads the real src/api.js through Vite (SSR) and talks to a stub
// server on 127.0.0.1 only. Run from frontend/:
//   node --test tests/searchAnalyticsTerms.test.mjs
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createServer } from "vite";

const TERMS = ["uploads/doctors/cv.pdf", "/uploads/a.png", "/api/uploads/x", "doctors/profile.jpg", "patients/reports secret", "acne"];
let vite, server, base, mod, rawApi;

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ terms: TERMS.map((term) => ({ term, topResultPath: "/doctors/dr-x" })) }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  vite = await createServer({ configFile: false, logLevel: "silent", appType: "custom", server: { middlewareMode: true } });
  mod = await vite.ssrLoadModule("/src/api/searchAnalyticsApi.js");
  rawApi = (await vite.ssrLoadModule("/src/api.js")).default;
});
after(async () => {
  await vite?.close();
  await new Promise((r) => server?.close(r));
});

test("analytics requests carry skipUrlNormalize and terms come back unchanged", async () => {
  let seen;
  const id = rawApi.interceptors.request.use((c) => { seen = c; c.baseURL = base; return c; });
  try {
    const res = await mod.getSearchAnalytics("/terms", { window: 7 });
    assert.equal(seen.skipUrlNormalize, true);
    assert.deepEqual(res.data.terms.map((t) => t.term), TERMS);
  } finally {
    rawApi.interceptors.request.eject(id);
  }
});

test("control: without the opt-out the shared client does rewrite those terms", async () => {
  const id = rawApi.interceptors.request.use((c) => { c.baseURL = base; return c; });
  try {
    const res = await rawApi.get("/api/admin/search-analytics/terms");
    assert.notEqual(res.data.terms[0].term, TERMS[0]);
  } finally {
    rawApi.interceptors.request.eject(id);
  }
});
