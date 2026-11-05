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

test("the currency provider wraps the pricing provider in the provider tree (one tree, with or without Google)", () => {
  const src = read("AppProviders.jsx");
  assert.equal((src.match(/<CurrencyProvider>/g) || []).length, 1);
  assert.equal((src.match(/<PricingProvider>/g) || []).length, 1);
  assert.ok(src.indexOf("<CurrencyProvider>") < src.indexOf("<PricingProvider>"));
});

test("the currency provider asks the server once per page load (the IP decides, so login changes nothing), never a third-party IP service", () => {
  const src = read("context", "CurrencyContext.jsx");
  assert.ok(src.includes("/api/geo/currency"));
  assert.equal(/useAuth|authLoading/.test(src), false, "the currency does not depend on who is logged in");
  assert.equal(/user\?\.country|profile country/.test(src.replace(/\/\/.*$/gm, "")), false, "and not on the profile country");
  assert.ok(/\}, \[\]\);/.test(src), "the loader is created once");
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
  assert.ok(/<PayPalScriptProvider key=\{props\.key\} options=\{props\.options\}>/.test(src));
  assert.ok(src.includes("paypalProviderProps(clientId, currency)"));
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

test("without a currency provider nothing waits for a currency (default context is USD, not loading)", () => {
  assert.ok(read("context", "CurrencyContext.jsx").includes("createContext({ currency: DEFAULT_CURRENCY, loading: false"));
});

test("rupees: Razorpay only - Stripe, PayPal and the PayPal script are not offered or loaded for INR", () => {
  const src = read("pages", "AppointmentBookingForm.jsx");
  // The PayPal SDK is never loaded for INR (PayPal does not take rupees).
  assert.ok(/function PayPalScope[\s\S]*?=== "INR"\) return children;/.test(src));
  // One Razorpay button replaces the Stripe and PayPal buttons.
  assert.ok(/\{isInr \? \(\s*<button[\s\S]*?onClick=\{payWithRazorpay\}[\s\S]*?\) : \(\s*<>/.test(src));
  assert.ok(src.includes("/api/razorpay/create-order"));
  // The order request carries only what is booked: never an amount or a currency.
  assert.ok(/api\.post\("\/api\/razorpay\/create-order", \{ priceType, priceRef \}\)/.test(src));
  // The Razorpay script is loaded only from the click (a rupee payment about to start), not at page load.
  assert.equal(src.includes("checkout.razorpay.com"), false);
  assert.ok(read("utils", "razorpayCheckout.js").includes("https://checkout.razorpay.com/v1/checkout.js"));
});

test("the booking requests carry the payment through paymentFields (Razorpay sends order id, payment id and signature)", () => {
  assert.ok(read("pages", "AppointmentBookingForm.jsx").includes("paymentFields(gateway, paymentRef)"));
  const confirm = read("pages", "CategoryAppointmentConfirm.jsx");
  assert.equal((confirm.match(/paymentFields\(gateway, paymentRef\)/g) || []).length, 2);
  assert.equal(confirm.includes("body.paymentIntentId = paymentRef"), false);
  // The doctor-fee booking is USD only and is untouched.
  assert.equal(read("pages", "BookAppointment.jsx").includes("razorpay"), false);
});

test("the page CSP lets Razorpay Checkout load (script and frame)", () => {
  const html = fs.readFileSync(path.join(SRC, "..", "index.html"), "utf8");
  const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)[1];
  const directive = (name) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) || "";
  assert.ok(directive("script-src").includes("https://checkout.razorpay.com"));
  assert.ok(directive("frame-src").includes("https://api.razorpay.com"));
  assert.ok(directive("frame-src").includes("https://checkout.razorpay.com"));
});

test("Super Admin categories: an INR tab, an INR field and the missing banner includes INR", () => {
  const page = read("pages", "admin", "HealthcareManagement.jsx");
  assert.ok(page.includes("PRICE_CURRENCIES.map"), "the tabs and the fields come from the currency list");
  assert.ok(page.includes("missing EUR/GBP/INR prices"));
  assert.ok(page.includes("priceInr"));
  assert.ok(read("pages", "admin", "healthcarePrices.js").includes('code: "INR"'));
});
