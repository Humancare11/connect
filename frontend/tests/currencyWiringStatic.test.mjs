// Source checks for the multi-currency wiring on the customer side (no browser needed):
// the provider is mounted, pages use the shared hook instead of their own fetch / 49 fallback,
// the PayPal provider is keyed by currency, and the marketing / prerender prices are untouched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pageFiles = walk(path.join(SRC, "pages")).filter((f) => f.endsWith(".jsx"));

test("the currency provider wraps the pricing provider in both provider trees", () => {
  const src = read("AppProviders.jsx");
  assert.equal((src.match(/<CurrencyProvider>/g) || []).length, 2);
  assert.equal((src.match(/<PricingProvider>/g) || []).length, 2);
  assert.ok(src.indexOf("<CurrencyProvider>") < src.indexOf("<PricingProvider>"));
});

test("the currency provider reloads when the login state changes and asks the server, never a third-party IP service", () => {
  const src = read("context", "CurrencyContext.jsx");
  assert.ok(src.includes("/api/geo/currency"));
  assert.ok(/\[authLoading, identity\]/.test(src), "reloads when the user or the profile country changes");
  assert.equal(/country\.is|ipwho|ipapi/.test(src), false);
});

test("no condition, specialty or category page fetches prices itself or falls back to a made-up 49", () => {
  const offenders = [];
  for (const f of pageFiles) {
    const rel = path.relative(path.join(SRC, "pages"), f);
    if (!/^(Conditions|Specialty|Categories)[\\/]|^PCP\.jsx$/.test(rel)) continue;
    const s = fs.readFileSync(f, "utf8");
    if (/api\.get\("\/api\/(pricing|appointment-tree)"\)/.test(s) || /\?\? 49/.test(s) || /useCategoryPrice\(/.test(s)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test("the condition pages show the price through PriceText", () => {
  let n = 0;
  for (const f of pageFiles) {
    const s = fs.readFileSync(f, "utf8");
    if (!s.includes("useCategoryPriceInfo")) continue;
    n += 1;
    assert.ok(s.includes("<PriceText") || s.includes("priceInfo={priceInfo}") || s.includes(".usdAmount"), path.relative(SRC, f));
  }
  assert.ok(n >= 250, `expected the codemod to reach 250+ pages, found ${n}`);
});

test("the booking form: PayPal provider is keyed by currency, no hard-coded USD, no client-sent currency", () => {
  const src = read("pages", "AppointmentBookingForm.jsx");
  assert.ok(/<PayPalScriptProvider key=\{paypalProps\.key\} options=\{paypalProps\.options\}>/.test(src));
  assert.equal(/currency:\s*"USD"/.test(src), false);
  // the intent / order requests carry what is being booked, never a currency or an amount
  assert.ok(/create-intent-by-amount", \{\s*priceType,\s*priceRef,\s*\}\)/.test(src));
  assert.ok(/create-order-by-amount", \{\s*priceType,\s*priceRef,\s*\}\)/.test(src));
});

test("the doctor-fee booking page stays USD", () => {
  const src = read("pages", "BookAppointment.jsx");
  assert.ok(/currency:\s*"USD"/.test(src));
});

test("marketing and prerendered prices are untouched", () => {
  assert.equal(/useSiteCurrency|CurrencyContext/.test(read("pages", "Blogs", "TelemedicineCost.jsx")), false);
  assert.equal(/useSiteCurrency|CurrencyContext/.test(read("seo", "routes.js")), false);
});

test("the Entries table header no longer says ($); Manage Users has a plain-text Country changed badge", () => {
  const table = read("pages", "admin", "entries", "EntriesTable.jsx");
  assert.ok(table.includes("<th className=\"en-ed en-r\">Doctor fee</th>"));
  assert.equal(table.includes("Doctor fee ($)"), false);
  const users = read("pages", "admin", "ManageUsers.jsx");
  assert.ok(/>\s*Country changed\s*</.test(users));
  assert.equal(users.includes("🌍"), false);
});

test("prerender: the USD category prices are embedded in every prerendered page and read back by the price hook", () => {
  const script = fs.readFileSync(path.join(SRC, "..", "scripts", "prerender.mjs"), "utf8");
  assert.ok(script.includes("fetchUsdPricing") && script.includes('"pricing:usd"'));
  const data = fs.readFileSync(path.join(SRC, "..", "scripts", "prerender-data.mjs"), "utf8");
  assert.ok(/export async function fetchUsdPricing/.test(data));
  assert.equal(/priceEur|priceGbp/.test(data.slice(data.indexOf("fetchUsdPricing"))), false, "only USD goes into the static HTML");
  assert.ok(read("hooks", "useCategoryPriceInfo.js").includes('usePrerendered("pricing:usd")'));
});

test("CategoryConsultant has no made-up 49 and no price fetch of its own for a category", () => {
  const src = read("pages", "CategoryConsultant.jsx");
  assert.equal(/49/.test(src), false);
  assert.equal(src.includes("/api/appointment-tree"), false);
  assert.ok(src.includes("useCategoryPriceInfo(categoryId)"));
});
