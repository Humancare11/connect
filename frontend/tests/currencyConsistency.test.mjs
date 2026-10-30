// One visitor, one currency, on every page. Checks the pieces that keep it consistent: the session remembers the currency, a failed price
// table is not shown as USD, the prerendered USD text can never be visible, a stale build reloads once, and no page carries a
// hard-coded dollar price of its own.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { selectionPriceInfo } from "../src/utils/currencyDisplay.js";
import { reloadOnceForNewBuild, installChunkReload, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS } from "../src/utils/chunkReload.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sources = () => walk(SRC).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));
const rel = (f) => path.relative(SRC, f).replace(/\\/g, "/");

// ── The provider uses the session-remembered loader ───────────────────────────────────────────────────────────────────────
test("the currency provider remembers the answer in sessionStorage (try/catch) for this browser session", () => {
  const src = read("src", "context", "CurrencyContext.jsx").replace(/\r\n/g, "\n");
  assert.ok(src.includes("storage: sessionStore(), identity: CURRENCY_IDENTITY"));
  assert.ok(/try \{\s*return typeof window !== "undefined" \? window\.sessionStorage : null;\s*\} catch/.test(src));
});

test("the provider is the one and only place that asks the server for the currency", () => {
  const askers = sources().filter((f) => fs.readFileSync(f, "utf8").includes("/api/geo/currency\"")).map(rel);
  assert.deepEqual(askers, ["context/CurrencyContext.jsx"]);
});

// ── A price table that failed to load is not the USD price ────────────────────────────────────────────────────────────────
test("booking selection: no price table (the request failed) is unavailable in the visitor's currency, never $", () => {
  const selection = { catId: "general", cost: 10, catLabel: "General" };
  const info = selectionPriceInfo({ selection, prices: null, currency: "INR" });
  assert.deepEqual([info.amount, info.currency, info.loading, info.unavailable], [null, "INR", false, true]);
  // still loading: a skeleton
  assert.equal(selectionPriceInfo({ selection, prices: null, currency: "INR", pricesLoading: true }).loading, true);
  // a USD visitor is unchanged: the price the page carries
  assert.equal(selectionPriceInfo({ selection, prices: null, currency: "USD" }).amount, 10);
  // a table that is there but has no such category is the legitimate USD fallback, labelled USD
  const known = selectionPriceInfo({ selection, prices: { other: { price: 5, priceInr: 400 } }, currency: "INR" });
  assert.deepEqual([known.amount, known.currency], [10, "USD"]);
});

// ── The prerendered USD text can never be visible ────────────────────────────────────────────────────────────────────────
let vite;
let render;
before(async () => {
  vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
}, { timeout: 120000 });
after(async () => {
  await vite?.close();
});

test("the hidden USD text is hidden by inline styles, so it is invisible even if the stylesheet never loads", { timeout: 120000 }, async () => {
  const { html, errors } = await render("/fit-to-fly-certificate", { "services:usd": { "fit-to-fly": { price: 69 } } });
  assert.deepEqual(errors, []);
  const m = /<span class="pt-hidden-text" style="([^"]*)">\$69<\/span>/.exec(html);
  assert.ok(m, "the hidden span carries an inline style");
  for (const part of ["position:absolute", "width:1px", "height:1px", "overflow:hidden", "clip:rect(0, 0, 0, 0)", "white-space:nowrap", "color:transparent"]) {
    assert.ok(m[1].includes(part), part);
  }
  // it sits inside the loading skeleton, which is announced as "Loading price"
  assert.ok(/<span class="pt-skeleton pt-skeleton--text" role="status" aria-busy="true" aria-label="Loading price"><span class="pt-hidden-text"/.test(html));
});

test("the price slot never renders the dollar text outside the skeleton while the currency is loading", { timeout: 120000 }, async () => {
  // On the server the currency is always 'loading', so every price slot must be a skeleton; the only "$69" is the hidden text.
  const { html } = await render("/fit-to-fly-certificate", { "services:usd": { "fit-to-fly": { price: 69 } } });
  const outside = html.replace(/<span class="pt-hidden-text"[^>]*>\$69<\/span>/g, "");
  const slot = /<div class="hcc-booking-price">([\s\S]*?)<\/div>/.exec(outside)?.[1] || "";
  assert.equal(/\$\s?69/.test(slot), false);
  assert.ok(/pt-skeleton/.test(slot));
});

test("the stylesheet is a second layer: it still makes the hidden text transparent", () => {
  assert.ok(/\.pt-hidden-text\s*\{[^}]*color:\s*transparent/.test(read("src", "components", "PriceText.css")));
});

// ── Old and new builds are not mixed ──────────────────────────────────────────────────────────────────────────────────────
test("a missing chunk after a deploy reloads the page once, then not again within the cooldown", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let reloads = 0;
  const reload = () => { reloads += 1; };
  assert.equal(reloadOnceForNewBuild({ storage, reload, now: 1_000_000 }), true);
  assert.equal(reloads, 1);
  assert.equal(store.get(CHUNK_RELOAD_KEY), "1000000");
  assert.equal(reloadOnceForNewBuild({ storage, reload, now: 1_000_000 + CHUNK_RELOAD_COOLDOWN_MS - 1 }), false, "no reload loop");
  assert.equal(reloads, 1);
  assert.equal(reloadOnceForNewBuild({ storage, reload, now: 1_000_000 + CHUNK_RELOAD_COOLDOWN_MS + 1 }), true, "a later deploy can reload again");
  assert.equal(reloads, 2);
});

test("without usable storage the page still reloads (the event only fires for a failed chunk)", () => {
  let reloads = 0;
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(reloadOnceForNewBuild({ storage: broken, reload: () => { reloads += 1; } }), true);
  assert.equal(reloads, 1);
});

test("installChunkReload listens for vite:preloadError, cancels Vite's default error and reloads", () => {
  const handlers = {};
  let reloads = 0;
  const win = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    location: { reload: () => { reloads += 1; } },
  };
  installChunkReload(win);
  assert.equal(typeof handlers["vite:preloadError"], "function");
  let prevented = false;
  handlers["vite:preloadError"]({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(reloads, 1);
  installChunkReload(null); // server render: nothing to install
  assert.ok(read("src", "main.jsx").includes("installChunkReload();"));
});

test("hashed files are cached for a year only when they exist (a missing chunk must not be cached as a 404)", () => {
  const conf = read("..", "deploy", "nginx-uat.conf.example");
  const line = conf.split("\n").find((l) => l.includes('add_header Cache-Control "public, max-age=31536000, immutable"'));
  assert.ok(line, "the long-cache header is there");
  assert.equal(/\balways\b/.test(line), false, "no 'always': it would also stamp 404s with 'immutable'");
});

// ── No page has a price of its own ────────────────────────────────────────────────────────────────────────────────────────
test("no made-up fallback price (|| 49, ?? 49) and no leftover self-fetching price hook", () => {
  const offenders = sources().filter((f) => /(\|\||\?\?)\s*49\b/.test(fs.readFileSync(f, "utf8"))).map(rel);
  assert.deepEqual(offenders, []);
  assert.equal(/export function useCategoryPrice\b/.test(read("src", "hooks", "useCategoryPrice.js")), false);
});

test("no page or component writes a dollar price into its copy (they all use PriceText with the shared hooks)", () => {
  // Editorial market-price ranges in a blog article are not our price; everything else must be price-neutral.
  const allowed = new Set(["pages/Blogs/TelemedicineCost.jsx"]);
  const offenders = [];
  for (const file of sources()) {
    const name = rel(file);
    if (!/\.jsx?$/.test(file) || name.startsWith("pages/admin/") || allowed.has(name)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      // a dollar sign followed by a digit (not a template placeholder, not a regex replacement like $1) in code that is not a comment
      if (/\$\d/.test(line) && !/replace\(|"\$1"|\$&/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) offenders.push(`${name}: ${line.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the currency is read through the shared hooks only", () => {
  const users = sources().filter((f) => fs.readFileSync(f, "utf8").includes("useSiteCurrency")).map(rel).sort();
  assert.deepEqual(users, [
    "context/CurrencyContext.jsx",
    "hooks/useCategoryPriceInfo.js",
    "hooks/useServicePrice.js",
    "pages/AppointmentBookingForm.jsx",
    "pages/CategoryAppointmentConfirm.jsx",
    "pages/Services.jsx",
  ]);
});
