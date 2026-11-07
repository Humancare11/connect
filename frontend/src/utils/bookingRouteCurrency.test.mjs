// /appointment-booking/:category/:specialty/:condition (header "Book Appointment", search results, shared links): the Fee header and
// the payment buttons must follow the server-decided currency, like the category-confirm flow. The bug: the booking selection built
// from the appointment tree carried the Mongo _id as catId, the price table is keyed by the pricing slug, so the lookup missed and an
// Indian visitor saw "$10" (and Stripe / PayPal) instead of rupees (and Razorpay).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAppointmentTree, selectionFromUrl } from "./appointmentTree.js";
import { selectionPriceInfo, priceRecordFor, formatPrice, gatewaysForCurrency } from "./currencyDisplay.js";
import { slugify } from "./slug.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), "utf8");

// What GET /api/appointment-tree returns (note: _id is a Mongo id, pricingSlug is the price-table key).
const apiTree = [
  {
    _id: "665f1c2e9b1d4a0012ab34cd",
    pricingSlug: "children-family",
    name: "Children & Family",
    icon: "baby",
    price: 10,
    currency: "USD",
    specialties: [
      {
        _id: "665f1c2e9b1d4a0012ab34ce",
        name: "Adolescent Care",
        icon: "user",
        conditions: [{ _id: "665f1c2e9b1d4a0012ab34cf", name: "Teen Acne", icon: "face" }],
      },
    ],
  },
];
// What GET /api/pricing returns for an Indian visitor (INR active) - keyed by the pricing slug.
const prices = { "children-family": { price: 10, label: "Children & Family", currency: "USD", priceEur: 9, priceGbp: 8, priceInr: 799 } };

const route = { categorySlug: slugify("Children & Family"), specialtySlug: slugify("Adolescent Care"), conditionSlug: slugify("Teen Acne") };

test("the route's URL resolves to a selection that carries the pricing slug (not only the Mongo _id)", () => {
  assert.deepEqual(route, { categorySlug: "children-family", specialtySlug: "adolescent-care", conditionSlug: "teen-acne" });
  const selection = selectionFromUrl(normalizeAppointmentTree(apiTree), route);
  assert.equal(selection.catId, "665f1c2e9b1d4a0012ab34cd");
  assert.equal(selection.pricingSlug, "children-family");
  assert.equal(selection.catLabel, "Children & Family");
  assert.equal(selection.cost, 10);
  assert.equal(selection.condName, "Teen Acne");
});

test("an unknown segment gives no selection; General Consultation resolves", () => {
  const tree = normalizeAppointmentTree(apiTree);
  assert.equal(selectionFromUrl(tree, { ...route, conditionSlug: "nope" }), null);
  assert.equal(selectionFromUrl(tree, { ...route, specialtySlug: "nope" }), null);
  assert.equal(selectionFromUrl(tree, { ...route, categorySlug: "nope" }), null);
  assert.equal(selectionFromUrl(tree, { ...route, conditionSlug: "general-consultation" }).condName, "General Consultation");
  assert.equal(selectionFromUrl([], route), null);
});

test("INR visitor: the Fee header is rupees, and the only gateway is Razorpay", () => {
  const selection = selectionFromUrl(normalizeAppointmentTree(apiTree), route);
  const info = selectionPriceInfo({ selection, prices, currency: "INR" });
  assert.deepEqual([info.amount, info.currency, info.loading], [799, "INR", false]);
  assert.equal(formatPrice(info.amount, info.currency), "₹799");
  assert.deepEqual(gatewaysForCurrency(info.currency), ["razorpay"]);
});

test("EUR, GBP and USD visitors see their own currency on the same route, paid with Stripe / PayPal", () => {
  const selection = selectionFromUrl(normalizeAppointmentTree(apiTree), route);
  for (const [currency, amount, text] of [["EUR", 9, "€9"], ["GBP", 8, "£8"], ["USD", 10, "$10"]]) {
    const info = selectionPriceInfo({ selection, prices, currency });
    assert.deepEqual([info.amount, info.currency], [amount, currency], currency);
    assert.equal(formatPrice(info.amount, info.currency), text);
    assert.deepEqual(gatewaysForCurrency(info.currency), ["stripe", "paypal"]);
  }
});

test("the selection the picker passes (header -> specialty -> condition) is priced the same way", () => {
  const [cat] = normalizeAppointmentTree(apiTree);
  // handleSelectCond in AppointmentBooking.jsx
  const selection = { specName: "Adolescent Care", catId: cat.id, pricingSlug: cat.pricingSlug, catLabel: cat.label, cost: 10, condName: "Teen Acne" };
  const info = selectionPriceInfo({ selection, prices, currency: "INR" });
  assert.deepEqual([info.amount, info.currency], [799, "INR"]);
});

test("a selection saved before the slug was recorded (only the Mongo _id) is still found, by the category name", () => {
  const old = { catId: "665f1c2e9b1d4a0012ab34cd", catLabel: "Children & Family", cost: 10 };
  assert.equal(priceRecordFor(old, prices), prices["children-family"]);
  const info = selectionPriceInfo({ selection: old, prices, currency: "INR" });
  assert.deepEqual([info.amount, info.currency], [799, "INR"]);
});

test("the category-confirm flow (catId is the slug) is unchanged", () => {
  const selection = { catId: "children-family", catLabel: "Children & Family", cost: 10 };
  assert.equal(priceRecordFor(selection, prices), prices["children-family"]);
  assert.deepEqual(
    (({ amount, currency }) => [amount, currency])(selectionPriceInfo({ selection, prices, currency: "INR" })),
    [799, "INR"],
  );
});

test("a category with no INR price falls back to its USD price, labelled USD (and so Stripe / PayPal), never converted", () => {
  const selection = selectionFromUrl(normalizeAppointmentTree(apiTree), route);
  const noInr = { "children-family": { price: 10, label: "Children & Family", priceEur: 9, priceGbp: 8, priceInr: null } };
  const info = selectionPriceInfo({ selection, prices: noInr, currency: "INR" });
  assert.deepEqual([info.amount, info.currency], [10, "USD"]);
  assert.deepEqual(gatewaysForCurrency(info.currency), ["stripe", "paypal"]);
});

test("no matching record at all: the USD price the page loaded, labelled USD; a service stays USD", () => {
  const selection = { catId: "nothing", catLabel: "Unknown", cost: 10 };
  const info = selectionPriceInfo({ selection, prices, currency: "INR" });
  assert.deepEqual([info.amount, info.currency], [10, "USD"]);
  const service = selectionPriceInfo({ selection: { isServiceBooking: true, cost: 69 }, prices, currency: "INR" });
  assert.deepEqual([service.amount, service.currency], [69, "USD"]);
});

test("loading: nothing is shown as USD while the currency or the table is still loading", () => {
  const selection = selectionFromUrl(normalizeAppointmentTree(apiTree), route);
  assert.equal(selectionPriceInfo({ selection, prices: null, currency: "INR", currencyLoading: true }).loading, true);
  assert.equal(selectionPriceInfo({ selection, prices: null, currency: "INR", pricesLoading: true }).loading, true);
});

test("the pages are wired to it: the route resolves through selectionFromUrl, the picker passes the slug, the charge reference prefers it", () => {
  const form = read("pages", "AppointmentBookingForm.jsx");
  assert.ok(form.includes("selectionFromUrl(tree, { categorySlug, specialtySlug, conditionSlug })"));
  assert.ok(form.includes("selection?.pricingSlug || selection?.catId"));
  // the gateways follow the currency that priceInfo decided
  assert.ok(form.includes("currency={priceInfo.currency}"));
  assert.ok(/pricingSlug,\s*\n\s*catLabel: specialty\.catLabel/.test(read("pages", "AppointmentBooking.jsx")));
  assert.ok(read("utils", "appointmentTree.js").includes('pricingSlug: category.pricingSlug || ""'));
});
