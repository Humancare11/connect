// Service and category pages state their USD price as schema.org JSON-LD (a Service with one Offer, priceCurrency USD) next to the
// hidden text in the static HTML. The JSON-LD must be valid JSON and must equal the USD price the page itself shows.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildSchema, schemaScriptContent } from "../src/seo/schema.js";
import { SITE_ORIGIN } from "../src/seo/routes.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const ctx = { path: "/fit-to-fly-certificate", canonical: `${SITE_ORIGIN}/fit-to-fly-certificate`, title: "Fit to Fly Certificate Online | Humancare Connect", description: "d" };

// ── The builder ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("a page with a USD price gets one Service node with one USD Offer, linked to the page and the organization", () => {
  const nodes = buildSchema({ ...ctx, offer: { price: 69 } });
  const service = nodes.find((n) => n["@type"] === "Service");
  assert.ok(service);
  assert.equal(service["@id"], `${ctx.canonical}#service`);
  assert.equal(service.name, "Fit to Fly Certificate Online", "the site suffix is not part of the name");
  assert.equal(service.url, ctx.canonical);
  assert.deepEqual(service.mainEntityOfPage, { "@id": `${ctx.canonical}#webpage` });
  assert.deepEqual(service.offers, {
    "@type": "Offer",
    price: "69.00",
    priceCurrency: "USD",
    url: ctx.canonical,
    availability: "https://schema.org/InStock",
    seller: { "@id": `${SITE_ORIGIN}/#organization` },
  });
  // the page and the breadcrumb are still there, unchanged
  assert.deepEqual(nodes.filter((n) => n["@type"] !== "Service").map((n) => n["@type"]), ["MedicalWebPage", "BreadcrumbList"]);
});

test("the price is written with two decimals, whatever the number", () => {
  const price = (p) => buildSchema({ ...ctx, offer: { price: p } }).find((n) => n["@type"] === "Service").offers.price;
  assert.equal(price(69), "69.00");
  assert.equal(price("49"), "49.00");
  assert.equal(price(12.5), "12.50");
});

test("no price, a zero or invalid price, or no offer at all: no Service node (a price is never invented)", () => {
  for (const offer of [undefined, null, {}, { price: 0 }, { price: -5 }, { price: "x" }, { price: NaN }, { price: null }]) {
    const nodes = buildSchema({ ...ctx, offer });
    assert.equal(nodes.some((n) => n["@type"] === "Service"), false, JSON.stringify(offer));
  }
});

test("the script content is valid JSON with a single @context and the Service in the graph", () => {
  const content = schemaScriptContent(buildSchema({ ...ctx, offer: { price: 69 } }));
  const parsed = JSON.parse(content);
  assert.equal(parsed["@context"], "https://schema.org");
  assert.ok(parsed["@graph"].some((n) => n["@type"] === "Service" && n.offers.priceCurrency === "USD"));
});

test("a page name with markup characters cannot break out of the script tag", () => {
  const content = schemaScriptContent(buildSchema({ ...ctx, title: "</script><b>x</b> | Humancare Connect", offer: { price: 5 } }));
  assert.equal(content.includes("</script>"), false);
  assert.equal(JSON.parse(content)["@graph"].find((n) => n["@type"] === "Service").name, "</script><b>x</b>");
});

// ── Where the price comes from ───────────────────────────────────────────────────────────────────────────────────────────
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test("every page that shows a price passes the SAME USD value to <SEO/> (priceInfo.usdAmount), so the markup cannot disagree with the page", () => {
  const pages = walk(path.join(ROOT, "src", "pages")).filter((f) => f.endsWith(".jsx"));
  let priced = 0;
  for (const file of pages) {
    const src = fs.readFileSync(file, "utf8");
    if (!/const (?:priceInfo|\{ priceInfo \}) = use(?:CategoryPriceInfo|ServicePrice)\(/.test(src)) continue;
    priced += 1;
    assert.ok(src.includes("<SEO usdPrice={priceInfo.usdAmount} />"), path.relative(ROOT, file));
    assert.equal(/<SEO \/>/.test(src), false, path.relative(ROOT, file));
  }
  assert.ok(priced > 250, `found ${priced} priced pages`);
});

// ── The real thing: render the pages the way the build does and compare the JSON-LD with the page text ─────────────────────
let vite;
let render;
before(async () => {
  vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
}, { timeout: 120000 });
after(async () => {
  await vite?.close();
});

const DATA = {
  "pricing:usd": { family: { price: 30 }, general: { price: 25 }, chronic: { price: 55 }, weight: { price: 40 } },
  "services:usd": { "fit-to-fly": { price: 69 }, "lab-requisitions": { price: 49 } },
};
const scripts = (html) => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const hiddenPrices = (html) => [...html.matchAll(/<span class="pt-hidden-text">([^<]*)<\/span>/g)].map((m) => m[1]);
const serviceNodes = (html) => scripts(html).flatMap((s) => JSON.parse(s)["@graph"]).filter((n) => n["@type"] === "Service");

for (const [route, kind, usd] of [
  ["/fit-to-fly-certificate", "service page", 69],
  ["/lab-requisitions", "service page", 49],
  ["/child-and-family-care", "category page", 30],
  ["/child-and-family-care/pediatrics", "specialty page", 30],
  ["/dehydration", "condition page (its route says category chronic)", 55],
  ["/weight-and-nutrition/weight-management/obesity", "condition page", 40],
]) {
  test(`${kind} ${route}: the JSON-LD is valid JSON, is USD, and equals the price shown in the page`, { timeout: 120000 }, async () => {
    const { html, errors } = await render(route, DATA);
    assert.deepEqual(errors, []);
    const blocks = scripts(html);
    assert.equal(blocks.length, 1, "one JSON-LD script");
    for (const block of blocks) JSON.parse(block); // valid JSON
    const nodes = serviceNodes(html);
    assert.equal(nodes.length, 1, "exactly one Service node");
    const offer = nodes[0].offers;
    assert.equal(offer.priceCurrency, "USD");
    assert.equal(offer["@type"], "Offer");
    assert.equal(Number(offer.price), usd);
    // the hidden text the page carries is the same USD price, in dollars
    const shown = hiddenPrices(html);
    assert.ok(shown.length > 0, "the page carries the hidden USD price");
    for (const text of shown) assert.equal(text, `$${usd}`);
    assert.equal(nodes[0].url, offer.url);
    assert.equal(nodes[0].url, `${SITE_ORIGIN}${route}`);
  });
}

test("a page without a price in the build data has no Service node (and the hidden text is absent too)", { timeout: 120000 }, async () => {
  const { html, errors } = await render("/fit-to-fly-certificate", null);
  assert.deepEqual(errors, []);
  assert.equal(serviceNodes(html).length, 0);
  assert.equal(hiddenPrices(html).length, 0);
  for (const block of scripts(html)) JSON.parse(block);
});

test("a page that shows no price (the home page, a blog) gets no Offer", { timeout: 120000 }, async () => {
  for (const route of ["/", "/blogs"]) {
    const { html, errors } = await render(route, DATA);
    assert.deepEqual(errors, []);
    assert.equal(serviceNodes(html).length, 0, route);
    assert.equal(/"price"/.test(scripts(html).join("")), false, route);
  }
});
