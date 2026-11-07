import test from "node:test";
import assert from "node:assert/strict";
import {
  PRICE_CURRENCIES,
  maxPriceFor,
  minPriceFor,
  formatMoney,
  isMissingForeignPrice,
  missingCurrencies,
  checkCategoryPrices,
} from "./healthcarePrices.js";

const full = { price: "20", priceEur: "18", priceGbp: "16", priceInr: "1499" };

test("the price tabs and fields are USD, EUR, GBP and INR", () => {
  assert.deepEqual(PRICE_CURRENCIES.map((c) => [c.code, c.symbol, c.field]), [
    ["USD", "$", "price"],
    ["EUR", "€", "priceEur"],
    ["GBP", "£", "priceGbp"],
    ["INR", "₹", "priceInr"],
  ]);
});

test("the cap: 1,000,000 for INR, 100,000 for the others", () => {
  assert.equal(maxPriceFor("INR"), 1000000);
  for (const c of ["USD", "EUR", "GBP"]) assert.equal(maxPriceFor(c), 100000);
});

test("rupees show with the symbol first and Indian digit grouping; not set shows nothing", () => {
  assert.equal(formatMoney(4999, "INR"), "₹4,999");
  assert.equal(formatMoney(100000, "INR"), "₹1,00,000");
  assert.equal(formatMoney(1499.5, "INR"), "₹1,499.50");
  assert.equal(formatMoney(30, "EUR"), "€30");
  assert.equal(formatMoney(100000, "USD"), "$100,000");
  for (const empty of [null, undefined, "", "abc"]) assert.equal(formatMoney(empty, "INR"), null, String(empty));
});

test('a category is "missing" a price when EUR, GBP or INR is not set; "Not set" is null / undefined', () => {
  assert.equal(isMissingForeignPrice({ priceEur: 1, priceGbp: 1, priceInr: 1 }), false);
  assert.equal(isMissingForeignPrice({ priceEur: 1, priceGbp: 1, priceInr: null }), true);
  assert.equal(isMissingForeignPrice({ priceEur: 1, priceGbp: 1 }), true);
  assert.equal(isMissingForeignPrice({ priceEur: null, priceGbp: 1, priceInr: 1 }), true);
  assert.deepEqual(missingCurrencies({ priceEur: 1, priceGbp: null, priceInr: undefined }), ["GBP", "INR"]);
  assert.deepEqual(missingCurrencies({ priceEur: 1, priceGbp: 1, priceInr: 1 }), []);
});

test("creating: all four prices are required, INR included", () => {
  assert.equal(checkCategoryPrices(full, true), "");
  for (const [field, label] of [["price", "USD"], ["priceEur", "EUR"], ["priceGbp", "GBP"], ["priceInr", "INR"]]) {
    assert.equal(checkCategoryPrices({ ...full, [field]: "" }, true), `${label} price is required.`, field);
    assert.equal(checkCategoryPrices({ ...full, [field]: "  " }, true), `${label} price is required.`, field);
  }
});

test("INR may go up to 10,00,000; the other currencies stop at 100,000", () => {
  assert.equal(checkCategoryPrices({ ...full, priceInr: "1000000" }, true), "");
  assert.equal(checkCategoryPrices({ ...full, priceInr: "100001" }, true), "");
  assert.match(checkCategoryPrices({ ...full, priceInr: "1000001" }, true), /^INR price must not be more than 10,00,000\.$/);
  for (const field of ["price", "priceEur", "priceGbp"]) {
    assert.match(checkCategoryPrices({ ...full, [field]: "100001" }, true), /must not be more than 100,000\./, field);
    assert.equal(checkCategoryPrices({ ...full, [field]: "100000" }, true), "", field);
  }
});

test("INR: zero, negative, text, 3 decimals are refused", () => {
  assert.match(checkCategoryPrices({ ...full, priceInr: "0" }, true), /INR price must be greater than 0/);
  assert.match(checkCategoryPrices({ ...full, priceInr: "-5" }, true), /INR price must be greater than 0/);
  assert.match(checkCategoryPrices({ ...full, priceInr: "abc" }, true), /INR price must be greater than 0/);
  assert.match(checkCategoryPrices({ ...full, priceInr: "1e3" }, true), /INR price must be greater than 0/);
  assert.match(checkCategoryPrices({ ...full, priceInr: "10.005" }, true), /INR price can have at most 2 decimal places/);
  assert.equal(checkCategoryPrices({ ...full, priceInr: "10.5" }, true), "");
});

test("the minimum: 0.01 for USD / EUR / GBP, 1 rupee for INR; tiny values are refused", () => {
  assert.equal(minPriceFor("INR"), 1);
  assert.equal(minPriceFor("USD"), 0.01);
  assert.match(checkCategoryPrices({ ...full, priceInr: "0.5" }, true), /^INR price must be at least 1.$/);
  assert.match(checkCategoryPrices({ ...full, priceInr: "0.50" }, true), /at least 1./);
  assert.equal(checkCategoryPrices({ ...full, priceInr: "1" }, true), "");
  for (const field of ["price", "priceEur", "priceGbp"]) {
    assert.match(checkCategoryPrices({ ...full, [field]: "0.004" }, true), /at least 0.01./, field);
    assert.match(checkCategoryPrices({ ...full, [field]: "0.001" }, true), /at least 0.01./, field);
    assert.equal(checkCategoryPrices({ ...full, [field]: "0.01" }, true), "", field);
  }
});

test("editing: an INR price that was never set may stay empty; once set it can be changed but not cleared", () => {
  const unsetInr = { ...full, priceInr: "", priceInrLocked: false };
  assert.equal(checkCategoryPrices(unsetInr, false), "");
  const lockedInr = { ...full, priceInr: "", priceInrLocked: true };
  assert.equal(checkCategoryPrices(lockedInr, false), "INR price cannot be cleared once it is set.");
  assert.equal(checkCategoryPrices({ ...lockedInr, priceInr: "850" }, false), "");
  // USD can never be emptied
  assert.equal(checkCategoryPrices({ ...full, price: "" }, false), "USD price is required.");
  // EUR and GBP keep their own lock
  assert.equal(checkCategoryPrices({ ...full, priceEur: "", priceEurLocked: true }, false), "EUR price cannot be cleared once it is set.");
  assert.equal(checkCategoryPrices({ ...full, priceGbp: "", priceGbpLocked: true }, false), "GBP price cannot be cleared once it is set.");
  assert.equal(checkCategoryPrices({ ...full, priceEur: "", priceGbp: "" }, false), "");
});
