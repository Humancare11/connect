// Service pages carry the USD service price in their static HTML (hidden behind the loading skeleton), like the categories, so crawlers
// read it. The build fetches the prices (fetchUsdServices), prerender.mjs embeds them in every page, and the hook uses them.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { fetchUsdServices } from "../scripts/prerender-data.mjs";
import { servicePriceInfo, priceTextState } from "../src/utils/currencyDisplay.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

test("fetchUsdServices keeps the USD price of each service by slug, whatever else the API returns", async () => {
  const body = [
    { slug: "fit-to-fly", name: "Fit to Fly", price: 69, priceEur: 63, priceGbp: 55, priceInr: 5999 },
    { slug: "lab-requisitions", price: "49" },
    { slug: "no-price", price: 0 },
    { slug: "bad", price: "x" },
    { price: 10 }, // no slug
  ];
  let requested = "";
  const server = http.createServer((req, res) => {
    requested = req.url;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const out = await fetchUsdServices({ VITE_API_URL: `http://127.0.0.1:${server.address().port}` });
    assert.equal(requested, "/api/services");
    assert.deepEqual(out, { "fit-to-fly": { price: 69 }, "lab-requisitions": { price: 49 } });
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("without an API address the fetch fails loudly (prerender.mjs then warns and ships a placeholder)", async () => {
  await assert.rejects(fetchUsdServices({}), /not set/);
});

test("the build embeds the service prices in every page, next to the category prices, and warns instead of failing", () => {
  const src = read("scripts", "prerender.mjs");
  assert.ok(src.includes("fetchUsdServices"));
  assert.ok(src.includes('"services:usd": usdServices'));
  assert.ok(/could not fetch service prices[\s\S]{0,80}prerendered without a price/.test(src));
});

test("the slot keeps the USD price as hidden text behind the skeleton until the visitor's currency price is known", () => {
  const info = servicePriceInfo({ record: null, loading: true, currency: "EUR", usdFallback: 69 });
  assert.equal(info.loading, true);
  assert.deepEqual(priceTextState(info), { kind: "skeleton", text: "$69" });
  // no embedded price (a normal page load, or the fetch failed): an empty skeleton, never a made-up price
  assert.deepEqual(priceTextState(servicePriceInfo({ record: null, loading: true, currency: "EUR" })), { kind: "skeleton", text: "" });
  // once the record is there the record wins
  const loaded = servicePriceInfo({ record: { price: 70, priceEur: 63 }, currency: "EUR", usdFallback: 69 });
  assert.deepEqual([loaded.amount, loaded.currency, loaded.usdAmount], [63, "EUR", 70]);
});

// ── The real thing: render a service page the way the build does ─────────────────────────────────────────────────────────
let vite;
let render;
before(async () => {
  vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
}, { timeout: 120000 });
after(async () => {
  await vite?.close();
});

const hiddenPrice = (html) => /<div class="hcc-booking-price"><span class="pt-skeleton pt-skeleton--text"[^>]*><span class="pt-hidden-text"[^>]*>([^<]*)<\/span>/.exec(html)?.[1];

test("a prerendered service page has its USD price in the static HTML (hidden behind the skeleton)", { timeout: 120000 }, async () => {
  const data = { "services:usd": { "fit-to-fly": { price: 69 }, "lab-requisitions": { price: 49 }, "general-consultation": { price: 49 } } };
  const fly = await render("/fit-to-fly-certificate", data);
  assert.deepEqual(fly.errors, []);
  assert.equal(hiddenPrice(fly.html), "$69");
  assert.ok(/aria-label="Loading price"/.test(fly.html), "the visitor sees the skeleton, not the dollar price");
  const lab = await render("/lab-requisitions", data);
  assert.deepEqual(lab.errors, []);
  assert.equal(hiddenPrice(lab.html), "$49");
});

test("without the embedded prices the page still renders, with an empty skeleton and no made-up price", { timeout: 120000 }, async () => {
  const page = await render("/fit-to-fly-certificate", null);
  assert.deepEqual(page.errors, []);
  assert.equal(hiddenPrice(page.html), undefined);
  assert.ok(/<div class="hcc-booking-price"><span class="pt-skeleton"[^>]*><\/span><\/div>/.test(page.html));
  assert.equal(/\$49/.test(page.html.match(/hcc-booking-price[\s\S]{0,300}/)?.[0] || ""), false);
});
