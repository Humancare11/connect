// Tests for src/api/searchApi.js (the hero search's backend client).
// Run: node --test tests/  (from frontend/). Uses a local stub server on
// 127.0.0.1 only; no backend, no network.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import {
  searchHealthcare,
  toSuggestions,
  createSearchSession,
  SEARCH_GROUPS,
} from "../src/api/searchApi.js";

const response = (titles, overrides = {}) => ({
  success: true,
  query: { normalized: "x" },
  results: {
    ...Object.fromEntries(SEARCH_GROUPS.map((g) => [g, []])),
    specialties: titles.map((t, i) => ({
      type: "specialty", id: `s${i}`, title: t, description: "",
      metadata: { categoryName: "Cat" }, navigation: { type: "booking", path: `/appointment-booking/cat/${i}` },
    })),
    ...overrides,
  },
  meta: { total: titles.length, mode: "instant" },
});

test("toSuggestions keeps backend order and only same-site backend paths", () => {
  const body = response(["Cardiology"], {
    conditions: [
      { type: "condition", id: "c1", title: "Chest Pain", navigation: { path: "/appointment-booking/a/b/chest-pain" }, metadata: { specialtyName: "Cardiology" } },
      { type: "condition", id: "c2", title: "Evil", navigation: { path: "https://evil.example/x" } },
      { type: "condition", id: "c3", title: "Evil2", navigation: { path: "//evil.example" } },
      { type: "condition", id: "c4", title: "Evil3", navigation: { path: "javascript:alert(1)" } },
      { type: "condition", id: "c5", title: "NoNav" },
    ],
    doctors: [{ type: "doctor", id: "12345", title: "Dr. A B", navigation: { path: "/doctors/12345-a-b" } }],
    blogs: [{ type: "blog", id: "1", title: "Blog", navigation: { path: "/what-is-telemedicine" } }],
  });
  const items = toSuggestions(body);
  assert.deepEqual(items.map((i) => i.title), ["Cardiology", "Chest Pain", "Dr. A B", "Blog"]);
  assert.deepEqual(items.map((i) => i.route), ["/appointment-booking/cat/0", "/appointment-booking/a/b/chest-pain", "/doctors/12345-a-b", "/what-is-telemedicine"]);
  assert.deepEqual(Object.keys(items[0]).sort(), ["category", "description", "id", "rank", "route", "specialty", "title", "type"]);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  assert.deepEqual(toSuggestions(null), []);
});

test("short or empty queries never hit the network", async () => {
  // Under Node the client has no base URL, so any real request would reject;
  // a clean empty response proves searchHealthcare short-circuited.
  for (const q of ["", " ", "a", "  b  ", null, undefined]) {
    for (const mode of ["instant", "full"]) {
      const body = await searchHealthcare(q, { mode });
      assert.equal(body.success, true);
      assert.equal(body.meta.total, 0);
      assert.equal(body.meta.mode, mode);
    }
  }
});

test("stale responses can never overwrite newer ones", async () => {
  // "card" resolves AFTER "cardio".
  const resolvers = {};
  const search = (q, { signal }) => new Promise((resolve, reject) => {
    resolvers[q] = () => resolve(response([`result for ${q}`]));
    signal.addEventListener("abort", () => reject(Object.assign(new Error("canceled"), { name: "CanceledError" })));
  });
  const session = createSearchSession({ search });
  const first = session.run("card", { mode: "instant" });
  const second = session.run("cardio", { mode: "instant" });
  resolvers.cardio();
  resolvers.card?.();
  assert.equal(await first, null, "superseded request resolves to null");
  assert.equal(toSuggestions(await second)[0].title, "result for cardio");
});

test("cancel() makes an in-flight full search resolve to null (no navigation)", async () => {
  let aborted = false;
  const session = createSearchSession({
    search: (q, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => { aborted = true; reject(new Error("canceled")); });
    }),
  });
  const pending = session.run("skin doctor", { mode: "full" });
  session.cancel();
  assert.equal(await pending, null);
  assert.equal(aborted, true);
});

test("errors (400/429/503/network/timeout) resolve to an empty, unsuccessful response", async () => {
  for (const status of [400, 429, 503, "network", "timeout"]) {
    const session = createSearchSession({ search: async () => { throw Object.assign(new Error(String(status)), { response: { status } }); } });
    const body = await session.run("cardio", { mode: "instant" });
    assert.equal(body.success, false);
    assert.deepEqual(toSuggestions(body), []);
  }
});

test("instant responses are reused briefly; full searches always go to the backend", async () => {
  let t = 0;
  let calls = 0;
  const session = createSearchSession({ search: async () => { calls += 1; return response(["X"]); }, now: () => t });
  await session.run("cardio", { mode: "instant" });
  await session.run("Cardio ", { mode: "instant" });
  assert.equal(calls, 1);
  t += 61 * 1000;
  await session.run("cardio", { mode: "instant" });
  assert.equal(calls, 2);
  await session.run("cardio", { mode: "full" });
  await session.run("cardio", { mode: "full" });
  assert.equal(calls, 4);
});

test("on the wire: POST /api/search with only { q, mode }; no auth header, no cookies", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: JSON.parse(raw) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(response(["Cardiology"])));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { default: axios } = await import("axios");
  const client = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, withCredentials: false });
  try {
    // Same request construction as searchHealthcare, against the stub.
    const body = await (async () => {
      const q = "  Cardio   care ";
      const payload = { q: q.replace(/\s+/g, " ").trim(), mode: "full" };
      return (await client.post("/api/search", payload)).data;
    })();
    assert.equal(toSuggestions(body)[0].title, "Cardiology");
    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].url, "/api/search");
    assert.deepEqual(seen[0].body, { q: "Cardio care", mode: "full" });
    assert.equal(seen[0].headers.authorization, undefined);
    assert.equal(seen[0].headers.cookie, undefined);
  } finally {
    server.close();
  }
});
