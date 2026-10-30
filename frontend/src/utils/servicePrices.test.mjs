// Service prices (Fit to fly, Lab requisitions, ...) in the visitor's currency: the pure rules, and a source check that every place that
// shows or charges a service price uses them (no hard-coded $ or 49 any more).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { servicePriceInfo, selectionPriceInfo, priceTextState, gatewaysForCurrency, formatPrice } from "./currencyDisplay.js";
import { PRICE_CURRENCIES, formatMoney, isMissingForeignPrice, missingCurrencies, checkCategoryPrices } from "../pages/admin/healthcarePrices.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const full = { price: 40, priceEur: 36, priceGbp: 32, priceInr: 1499 };

test("a service shows the visitor's currency price: $40, €36, £32, ₹1,499", () => {
  for (const [currency, amount, text] of [["USD", 40, "$40"], ["EUR", 36, "€36"], ["GBP", 32, "£32"], ["INR", 1499, "₹1,499"]]) {
    const info = servicePriceInfo({ record: full, currency });
    assert.deepEqual([info.amount, info.currency, info.loading, info.unavailable], [amount, currency, false, false], currency);
    assert.equal(priceTextState(info).text, text);
  }
});

test("a service with no EUR / GBP / INR price shows its USD price, labelled USD (never converted)", () => {
  const usdOnly = { price: 69 };
  for (const currency of ["EUR", "GBP", "INR"]) {
    const info = servicePriceInfo({ record: usdOnly, currency });
    assert.deepEqual([info.amount, info.currency], [69, "USD"], currency);
  }
  assert.deepEqual(servicePriceInfo({ record: { price: 69, priceEur: null, priceGbp: 0, priceInr: undefined }, currency: "INR" }).currency, "USD");
});

test("while the currency or the service is loading: a skeleton, with the USD price kept only as hidden markup", () => {
  const a = servicePriceInfo({ record: null, loading: true, currency: "INR" });
  assert.deepEqual([a.loading, a.amount], [true, null]);
  assert.equal(priceTextState(a).kind, "skeleton");
  const b = servicePriceInfo({ record: full, currency: "INR", currencyLoading: true });
  assert.equal(b.loading, true, "never $ first and then ₹");
  assert.equal(priceTextState(b).kind, "skeleton");
  assert.equal(priceTextState(b).text, "$40", "the USD price stays in the markup behind the skeleton");
});

test("no price at all: 'Price unavailable', not a made-up 49", () => {
  for (const record of [null, {}, { price: 0 }, { price: "x" }]) {
    const info = servicePriceInfo({ record, currency: "EUR" });
    assert.equal(info.unavailable, true);
    assert.equal(priceTextState(info).text, "Price unavailable");
  }
});

test("a service booking is priced from the service record in the visitor's currency", () => {
  const selection = { isServiceBooking: true, catId: "lab-requisitions", cost: 40 };
  const price = (currency, extra = {}) => selectionPriceInfo({ selection, currency, serviceRecord: full, ...extra });
  assert.deepEqual([price("EUR").amount, price("EUR").currency], [36, "EUR"]);
  assert.deepEqual([price("GBP").amount, price("GBP").currency], [32, "GBP"]);
  assert.deepEqual([price("INR").amount, price("INR").currency], [1499, "INR"]);
  assert.deepEqual([price("USD").amount, price("USD").currency], [40, "USD"]);
  assert.equal(formatPrice(price("INR").amount, price("INR").currency), "₹1,499");
});

test("the gateway follows the service's currency: ₹ -> Razorpay only; $ € £ -> Stripe and PayPal", () => {
  const selection = { isServiceBooking: true, catId: "lab-requisitions", cost: 40 };
  const gateways = (currency, serviceRecord = full) => gatewaysForCurrency(selectionPriceInfo({ selection, currency, serviceRecord }).currency);
  assert.deepEqual(gateways("INR"), ["razorpay"]);
  for (const c of ["EUR", "GBP", "USD"]) assert.deepEqual(gateways(c), ["stripe", "paypal"], c);
  // no INR price: charged in USD, so Stripe / PayPal
  assert.deepEqual(gateways("INR", { price: 40 }), ["stripe", "paypal"]);
});

test("a service booking waits (loading) for the record when the visitor is not priced in USD; a USD visitor does not wait", () => {
  const selection = { isServiceBooking: true, catId: "lab-requisitions", cost: 40 };
  assert.equal(selectionPriceInfo({ selection, currency: "INR", serviceRecord: null, serviceLoading: true }).loading, true);
  assert.equal(selectionPriceInfo({ selection, currency: "USD", serviceRecord: null, serviceLoading: true }).loading, false);
  assert.equal(selectionPriceInfo({ selection, currency: "EUR", currencyLoading: true }).loading, true);
  // the record failed to load: the USD price the page carried, labelled USD
  const failed = selectionPriceInfo({ selection, currency: "INR", serviceRecord: null, serviceLoading: false });
  assert.deepEqual([failed.amount, failed.currency], [40, "USD"]);
});

// ── Admin > Services Price: the same price helpers as the categories ──────────────────────────────────────────────────────
test("admin tabs are USD | EUR | GBP | INR, USD first; a missing price shows nothing to format ('Not set')", () => {
  assert.deepEqual(PRICE_CURRENCIES.map((c) => c.code), ["USD", "EUR", "GBP", "INR"]);
  const old = { price: 10, priceEur: null, priceGbp: null, priceInr: null };
  for (const { field, code } of PRICE_CURRENCIES.slice(1)) assert.equal(formatMoney(old[field], code), null, code);
  assert.equal(formatMoney(1499, "INR"), "₹1,499");
  assert.equal(formatMoney(36, "EUR"), "€36");
});

test("a service is 'missing' a price when EUR, GBP or INR is not set", () => {
  assert.equal(isMissingForeignPrice(full), false);
  assert.equal(isMissingForeignPrice({ ...full, priceInr: null }), true);
  assert.equal(isMissingForeignPrice({ price: 10 }), true);
  assert.deepEqual(missingCurrencies({ price: 10, priceEur: 9 }), ["GBP", "INR"]);
});

test("service form: all four prices required on create; USD never empty on edit; set EUR/GBP/INR cannot be cleared; minimums apply", () => {
  const form = { price: "40", priceEur: "36", priceGbp: "32", priceInr: "1499" };
  assert.equal(checkCategoryPrices(form, true), "");
  for (const [field, code] of [["price", "USD"], ["priceEur", "EUR"], ["priceGbp", "GBP"], ["priceInr", "INR"]]) {
    assert.equal(checkCategoryPrices({ ...form, [field]: "" }, true), `${code} price is required.`, field);
  }
  assert.equal(checkCategoryPrices({ ...form, price: "" }, false), "USD price is required.");
  assert.equal(checkCategoryPrices({ ...form, priceEur: "", priceEurLocked: true }, false), "EUR price cannot be cleared once it is set.");
  assert.equal(checkCategoryPrices({ ...form, priceInr: "", priceInrLocked: false }, false), "", "never set: may stay empty");
  assert.match(checkCategoryPrices({ ...form, priceInr: "0.5" }, true), /INR price must be at least 1\./);
  assert.match(checkCategoryPrices({ ...form, priceEur: "0.004" }, true), /EUR price must be at least 0\.01\./);
  assert.match(checkCategoryPrices({ ...form, priceInr: "1000001" }, true), /must not be more than 10,00,000/);
});

// ── Source checks: every place that shows or charges a service price ─────────────────────────────────────────────────────
test("every service page asks useServicePrice for the visitor-currency price and passes priceInfo to the card", () => {
  const dir = path.join(SRC, "pages", "NewServices");
  const pages = walk(dir).filter((f) => f.endsWith(".jsx") && fs.readFileSync(f, "utf8").includes("useServicePrice"));
  assert.ok(pages.length >= 6, "the six service pages");
  for (const file of pages) {
    const src = fs.readFileSync(file, "utf8");
    assert.ok(src.includes("const { priceInfo } = useServicePrice("), file);
    assert.ok(/ServiceBookingCard[\s\S]{0,200}priceInfo=\{priceInfo\}/.test(src), file);
    assert.equal(/priceLoading|price=\{price\}/.test(src), false, file);
  }
});

test("no hard-coded dollar or 49 fallback is left in the service price display", () => {
  const card = read("components", "booking", "BookingCard.jsx");
  assert.equal(/`\$\$\{|`\$49`|\$49/.test(card), false);
  assert.ok(card.includes("<PriceText info={priceInfo} />"));
  const hook = read("hooks", "useServicePrice.js");
  assert.equal(/\|\|\s*49/.test(hook), false);
  assert.ok(hook.includes("useSiteCurrency"));
  const list = read("pages", "Services.jsx");
  assert.equal(/\|\|\s*49|toFixed\(2\)/.test(list), false);
  assert.ok(list.includes("servicePriceInfo(") && list.includes("<PriceText"));
});

test("the booking form and the category-confirm page price a service from its own record", () => {
  for (const file of [["pages", "AppointmentBookingForm.jsx"], ["pages", "CategoryAppointmentConfirm.jsx"]]) {
    const src = read(...file);
    assert.ok(src.includes("useServiceRecord(selection?.isServiceBooking ? selection.catId : \"\")"), file.join("/"));
    assert.ok(src.includes("serviceRecord: service.record") && src.includes("serviceLoading: service.loading"), file.join("/"));
  }
});

test("Super Admin Services Price: USD | EUR | GBP | INR tabs, 'Not set', all four fields, the missing banner and filter", () => {
  const src = read("pages", "admin", "ServicesPrices.jsx");
  assert.ok(src.includes("/api/services/admin"), "loads the list that always carries the four prices");
  assert.ok(src.includes("PRICE_CURRENCIES.map(({ code }) =>"), "the tabs");
  assert.ok(src.includes('useState("USD")'), "USD is the default tab");
  assert.ok(src.includes("Not set"));
  assert.ok(src.includes("PRICE_CURRENCIES.map(({ code, symbol, field, lockField }) =>"), "one field per currency");
  assert.ok(src.includes("missing EUR/GBP/INR prices"));
  assert.ok(src.includes("Show only these") && src.includes("Show all services"));
  assert.ok(src.includes("checkCategoryPrices(form, !editingId)"), "the same rules as the server");
  assert.equal(src.includes("$${Number(service.price"), false, "no hard-coded dollar column");
});
