// The payment step must always use the CURRENT server-decided currency and price: rupees -> Razorpay, nothing else -> Stripe + PayPal;
// no buttons until the currency is known; a stored selection from an earlier booking never replaces what the URL names; a currency
// remembered by the session is re-checked and the page follows the server.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { createServer } from "vite";
import {
  paymentStepState,
  paymentStepKey,
  selectionPriceInfo,
  gatewaysForCurrency,
} from "../src/utils/currencyDisplay.js";
import { normalizeAppointmentTree, selectionFromUrl, selectionMatchesRoute } from "../src/utils/appointmentTree.js";
import { createCurrencyLoader, CURRENCY_CACHE_KEY } from "../src/utils/currencyLoader.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");

// ── What the step may show ────────────────────────────────────────────────────────────────────────────────────────────────
test("no payment buttons while the currency or price is loading, or when there is no price", () => {
  assert.equal(paymentStepState({ loading: true, amount: null, currency: "USD" }), "loading");
  assert.equal(paymentStepState(null), "loading");
  assert.equal(paymentStepState({ loading: false, amount: null, currency: "INR", unavailable: true }), "unavailable");
  assert.equal(paymentStepState({ loading: false, amount: 0, currency: "INR" }), "unavailable");
  assert.equal(paymentStepState({ loading: false, amount: 799, currency: "INR" }), "ready");
});

test("the step is keyed by currency and amount: a change of either starts it over", () => {
  const usd = paymentStepKey({ amount: 10, currency: "USD" });
  assert.notEqual(usd, paymentStepKey({ amount: 799, currency: "INR" }));
  assert.notEqual(usd, paymentStepKey({ amount: 9, currency: "EUR" }));
  assert.notEqual(paymentStepKey({ amount: 10, currency: "USD" }), paymentStepKey({ amount: 11, currency: "USD" }));
  assert.equal(paymentStepKey({ amount: 10, currency: "usd" }), usd);
});

test("both payment pages use the step, not the raw stage, and the step is keyed", () => {
  const form = read("src", "pages", "AppointmentBookingForm.jsx");
  const confirm = read("src", "pages", "CategoryAppointmentConfirm.jsx");
  assert.ok(form.includes("<PaymentStep\n            priceInfo={priceInfo}"));
  assert.ok(confirm.includes("<PaymentStep\n            priceInfo={priceInfo}"));
  assert.equal(/<PaymentStage\b/.test(confirm), false);
  assert.ok(form.includes("<PaymentStage key={paymentStepKey(priceInfo)}"));
});

// ── Rendering the real step ──────────────────────────────────────────────────────────────────────────────────────────────
let vite;
let renderStep;
before(async () => {
  vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  const [{ default: AppProviders }, form] = await Promise.all([
    vite.ssrLoadModule("/src/AppProviders.jsx"),
    vite.ssrLoadModule("/src/pages/AppointmentBookingForm.jsx"),
  ]);
  renderStep = (priceInfo) =>
    renderToStaticMarkup(
      React.createElement(
        AppProviders,
        null,
        React.createElement(
          StaticRouter,
          { location: "/appointment-booking/children-family/adolescent-care/teen-acne" },
          React.createElement(form.PaymentStep, {
            priceInfo,
            selection: { catId: "children-family", catLabel: "Children & Family", specName: "Adolescent Care", condName: "Teen Acne" },
            formData: { notes: "", date: "2026-11-02", time: "10:00 AM" },
            uploadedReports: [],
            onBack: () => {},
            onComplete: () => {},
          }),
        ),
      ),
    );
}, { timeout: 120000 });
after(async () => {
  await vite?.close();
});

test("INR: the fee is in rupees and the only way to pay is Razorpay - no Stripe card, no PayPal", { timeout: 60000 }, () => {
  const html = renderStep({ amount: 799, currency: "INR", loading: false });
  assert.ok(html.includes("₹799"), "the fee in rupees");
  assert.ok(html.includes("with Razorpay"));
  assert.equal(html.includes("Stripe"), false);
  assert.equal(html.includes("Credit / Debit Card"), false);
  assert.equal(/PayPal/.test(html.replace(/<style[\s\S]*?<\/style>/g, "")), false);
  assert.equal(html.includes("$10"), false);
});

test("USD, EUR and GBP: their own symbol, Stripe and PayPal, never Razorpay", { timeout: 60000 }, () => {
  for (const [currency, amount, text] of [["USD", 10, "$10"], ["EUR", 9, "€9"], ["GBP", 8, "£8"]]) {
    const html = renderStep({ amount, currency, loading: false });
    assert.ok(html.includes(text), currency);
    assert.ok(html.includes("Credit / Debit Card"), currency);
    assert.ok(html.includes("PayPal"), currency);
    assert.equal(html.includes("Razorpay"), false, currency);
  }
});

test("while the price is loading: a loading line and no payment method at all", { timeout: 60000 }, () => {
  const html = renderStep({ amount: null, currency: "USD", loading: true });
  assert.ok(html.includes("Loading your price"));
  for (const word of ["Razorpay", "Stripe", "PayPal", "Credit / Debit Card", "$10"]) assert.equal(html.includes(word), false, word);
});

test("no price in the visitor's currency: a message and a way back, no payment method", { timeout: 60000 }, () => {
  const html = renderStep({ amount: null, currency: "INR", loading: false, unavailable: true });
  assert.ok(html.includes("The price is not available right now"));
  assert.ok(html.includes("Back"));
  for (const word of ["Razorpay", "Stripe", "PayPal"]) assert.equal(html.includes(word), false, word);
});

// ── A stored selection never overrules the URL ────────────────────────────────────────────────────────────────────────────
const apiTree = [
  {
    _id: "665f1c2e9b1d4a0012ab34cd",
    pricingSlug: "children-family",
    name: "Children & Family",
    price: 10,
    specialties: [{ _id: "s1", name: "Adolescent Care", conditions: [{ _id: "c1", name: "Teen Acne" }] }],
  },
  {
    _id: "665f1c2e9b1d4a0012ab34ce",
    pricingSlug: "skin",
    name: "Skin & Hair",
    price: 20,
    specialties: [{ _id: "s2", name: "Dermatology", conditions: [{ _id: "c2", name: "Acne" }] }],
  },
];
const route = { categorySlug: "children-family", specialtySlug: "adolescent-care", conditionSlug: "teen-acne" };

test("a stored selection is used only when it is the one the URL names", () => {
  const tree = normalizeAppointmentTree(apiTree);
  const mine = selectionFromUrl(tree, route);
  assert.equal(selectionMatchesRoute(mine, route), true);
  const other = selectionFromUrl(tree, { categorySlug: "skin-hair", specialtySlug: "dermatology", conditionSlug: "acne" });
  assert.equal(selectionMatchesRoute(other, route), false, "another booking left in the session");
  assert.equal(selectionMatchesRoute(null, route), false);
  assert.equal(selectionMatchesRoute({ ...mine, condName: "Other" }, route), false);
  assert.equal(selectionMatchesRoute({ isServiceBooking: true, catLabel: "Children & Family" }, route), false);
  // General Consultation
  const general = { ...mine, condName: "General Consultation" };
  assert.equal(selectionMatchesRoute(general, { ...route, conditionSlug: "general-consultation" }), true);
  // a page that is not URL-addressed accepts what it is given
  assert.equal(selectionMatchesRoute(mine, {}), true);
});

test("the form takes the router state / stored selection only through that check, and the resume path too", () => {
  const form = read("src", "pages", "AppointmentBookingForm.jsx");
  assert.ok(form.includes("usableSelection(state?.selection) || usableSelection(readPendingBooking()?.selection)"));
  assert.ok(form.includes("if (usableSelection(state?.selection) || usableSelection(readPendingBooking()?.selection)) return false;"));
  assert.ok(form.includes("!usableSelection(pending.selection)) return;"));
});

test("an old stored selection (USD cost, no pricing slug, currency USD) is priced in today's currency", () => {
  const old = { catId: "665f1c2e9b1d4a0012ab34cd", catLabel: "Children & Family", specName: "Adolescent Care", condName: "Teen Acne", cost: 10, currency: "USD" };
  const prices = { "children-family": { price: 10, label: "Children & Family", priceEur: 9, priceGbp: 8, priceInr: 799 } };
  const info = selectionPriceInfo({ selection: old, prices, currency: "INR" });
  assert.deepEqual([info.amount, info.currency, paymentStepState(info)], [799, "INR", "ready"]);
  assert.deepEqual(gatewaysForCurrency(info.currency), ["razorpay"]);
});

// ── The session's remembered currency follows the server ───────────────────────────────────────────────────────────────
const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};
const remembered = (currency, source = "ip", identity = "ip") => ({ [CURRENCY_CACHE_KEY]: JSON.stringify({ identity, currency, source, at: 1 }) });

async function run(storage, answer, identity = "ip") {
  const states = [];
  const loader = createCurrencyLoader({
    fetchCurrency: () => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)),
    onChange: (s) => states.push(s),
    storage,
    identity,
    wait: () => Promise.resolve(),
    warn: () => {},
  });
  await loader.load();
  return { loader, states };
}

test("a USD remembered earlier in the session is replaced when the server now says INR (the stale-session bug)", async () => {
  const storage = memory(remembered("USD"));
  const { loader, states } = await run(storage, { currency: "INR", country: "IN", source: "ip" });
  assert.equal(states[0].currency, "USD", "shown at once from the session, no skeleton");
  assert.equal(states[0].loading, false);
  assert.deepEqual(loader.getState(), { currency: "INR", loading: false, source: "ip" });
  assert.equal(JSON.parse(storage.data[CURRENCY_CACHE_KEY]).currency, "INR", "and remembered");
});

test("the same answer changes nothing; a failed or unplaceable re-check keeps what the session shows", async () => {
  let r = await run(memory(remembered("INR")), { currency: "INR", source: "ip" });
  assert.equal(r.states.length, 1, "no second state when nothing changed");
  r = await run(memory(remembered("INR")), new Error("429"));
  assert.equal(r.loader.getState().currency, "INR");
  r = await run(memory(remembered("INR")), { currency: "USD", country: "", source: "default" });
  assert.equal(r.loader.getState().currency, "INR", "a 'could not place you' answer never overrules a real one");
});

test("logging in or out changes nothing: the provider uses one fixed key, so the same answer is used and nothing waits for the login", () => {
  const src = read("src", "context", "CurrencyContext.jsx");
  assert.ok(src.includes('const CURRENCY_IDENTITY = "ip";'));
  assert.ok(src.includes("identity: CURRENCY_IDENTITY"));
  assert.equal(/useAuth|authLoading/.test(src), false);
});

test("a remembered answer from the old profile-country rule is not used", async () => {
  const storage = memory(remembered("USD", "profile"));
  const { loader, states } = await run(storage, { currency: "INR", country: "IN", source: "ip" });
  assert.equal(states[0].loading, true, "not served from the old entry: the server is asked first");
  assert.equal(loader.getState().currency, "INR");
});
