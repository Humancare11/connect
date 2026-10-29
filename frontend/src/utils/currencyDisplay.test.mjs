import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPrice,
  currencySymbol,
  normalizeCurrency,
  resolveCategoryPrice,
  priceTextState,
  selectionPriceInfo,
  paypalProviderProps,
} from "./currencyDisplay.js";

test("formatPrice: symbol first, whole amounts without decimals", () => {
  assert.equal(formatPrice(30, "USD"), "$30");
  assert.equal(formatPrice(30, "EUR"), "€30");
  assert.equal(formatPrice(30, "GBP"), "£30");
  assert.equal(formatPrice(1200, "EUR"), "€1,200");
  assert.equal(formatPrice("49", "USD"), "$49");
});

test("formatPrice: fractional amounts always show two decimals", () => {
  assert.equal(formatPrice(29.5, "USD"), "$29.50");
  assert.equal(formatPrice(29.99, "EUR"), "€29.99");
  assert.equal(formatPrice(0.5, "GBP"), "£0.50");
  assert.equal(formatPrice(1234.5, "GBP"), "£1,234.50");
});

test("formatPrice: USD when no currency or an unsupported one; empty for a missing amount", () => {
  assert.equal(formatPrice(30), "$30");
  assert.equal(formatPrice(30, "inr"), "$30");
  assert.equal(formatPrice(30, "eur"), "€30");
  for (const bad of [null, undefined, "", "abc", NaN, Infinity]) assert.equal(formatPrice(bad, "USD"), "", String(bad));
  assert.equal(currencySymbol("GBP"), "£");
  assert.equal(normalizeCurrency("xyz"), "USD");
});

test("resolveCategoryPrice: the visitor currency, falling back to the USD price (labelled USD) when it is not set", () => {
  const record = { price: 49, priceEur: 45, priceGbp: 39 };
  assert.deepEqual(resolveCategoryPrice(record, "USD"), { amount: 49, currency: "USD" });
  assert.deepEqual(resolveCategoryPrice(record, "EUR"), { amount: 45, currency: "EUR" });
  assert.deepEqual(resolveCategoryPrice(record, "GBP"), { amount: 39, currency: "GBP" });
  assert.deepEqual(resolveCategoryPrice({ price: 49, priceEur: null, priceGbp: null }, "EUR"), { amount: 49, currency: "USD" });
  assert.deepEqual(resolveCategoryPrice({ price: 49 }, "GBP"), { amount: 49, currency: "USD" });
  assert.deepEqual(resolveCategoryPrice({ price: 49, priceEur: 0 }, "EUR"), { amount: 49, currency: "USD" });
  assert.equal(resolveCategoryPrice({ price: 0 }, "USD"), null);
  assert.equal(resolveCategoryPrice(undefined, "USD"), null);
});

test("priceTextState: skeleton while loading, unavailable without a price, else the formatted price - never a made-up $49", () => {
  assert.deepEqual(priceTextState({ loading: true }), { kind: "skeleton", text: "" });
  assert.deepEqual(priceTextState(null), { kind: "skeleton", text: "" });
  // a prerendered page: the USD price stays in the markup behind the skeleton (for crawlers)
  assert.deepEqual(priceTextState({ loading: true, usdAmount: 49 }), { kind: "skeleton", text: "$49" });
  assert.deepEqual(priceTextState({ loading: true, usdAmount: null }), { kind: "skeleton", text: "" });
  assert.deepEqual(priceTextState({ amount: null, currency: "USD", loading: false, unavailable: true }), { kind: "unavailable", text: "Price unavailable" });
  assert.deepEqual(priceTextState({ amount: 45, currency: "EUR", loading: false }), { kind: "price", text: "€45" });
  assert.deepEqual(priceTextState({ amount: 49, currency: "USD", loading: false }), { kind: "price", text: "$49" });
});

test("booking form price: a German profile user (flag on) sees EUR, flag off (USD) sees USD, a service stays USD", () => {
  const selection = { catId: "general", cost: 49 };
  const prices = { general: { price: 49, priceEur: 45, priceGbp: 39 } };
  const de = selectionPriceInfo({ selection, prices, currency: "EUR" });
  assert.deepEqual([de.amount, de.currency, de.loading], [45, "EUR", false]);
  assert.equal(priceTextState(de).text, "€45");
  const gb = selectionPriceInfo({ selection, prices, currency: "GBP" });
  assert.equal(priceTextState(gb).text, "£39");
  // flag off: the server says USD, and the table may not even have the other prices
  const off = selectionPriceInfo({ selection, prices: { general: { price: 49 } }, currency: "USD" });
  assert.equal(priceTextState(off).text, "$49");
  // a service booking is USD whatever the visitor currency
  const service = selectionPriceInfo({ selection: { isServiceBooking: true, cost: 60 }, prices, currency: "EUR" });
  assert.equal(priceTextState(service).text, "$60");
  // EUR price not set for this category: USD price, labelled USD
  const missing = selectionPriceInfo({ selection, prices: { general: { price: 49, priceEur: null } }, currency: "EUR" });
  assert.equal(priceTextState(missing).text, "$49");
  // currency still loading: a skeleton, not a price
  assert.equal(priceTextState(selectionPriceInfo({ selection, prices, currency: "USD", currencyLoading: true })).kind, "skeleton");
  // no price anywhere
  assert.equal(priceTextState(selectionPriceInfo({ selection: { catId: "x" }, prices: {}, currency: "USD" })).kind, "unavailable");
});

test("PayPal provider: a new currency gives a new key (so the provider re-mounts) and the SDK is loaded for that currency", () => {
  const usd = paypalProviderProps("cid", "USD");
  const eur = paypalProviderProps("cid", "EUR");
  const gbp = paypalProviderProps("cid", "GBP");
  assert.notEqual(usd.key, eur.key);
  assert.notEqual(eur.key, gbp.key);
  assert.equal(paypalProviderProps("cid", "EUR").key, eur.key, "same currency: same key, no needless re-mount");
  assert.deepEqual(eur.options, { "client-id": "cid", currency: "EUR", intent: "capture" });
  assert.equal(paypalProviderProps("cid", "bogus").options.currency, "USD");
});
