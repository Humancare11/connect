// The app gate, wired into the places that decide a currency: resolveRequestCurrency, the payment path (decidePaymentCurrency) and
// GET /api/geo/currency. Web must be untouched; old / undeclared apps stay on USD; the flag-off world is USD for everyone.
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const geoIp = require("../utils/geoIp");
const geoRouter = require("../routes/geo");
const { resolveRequestCurrency, gatewayAllowsCurrency } = require("../utils/currencyConfig");
const { decidePaymentCurrency } = require("../utils/paymentVerification");

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DART = "Dart/3.5 (dart:io)";

const KEYS = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "APP_MIN_CURRENCY_BUILD_ANDROID", "APP_MIN_CURRENCY_BUILD_IOS"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const readerFor = (iso) => ({ get: () => ({ country: { iso_code: iso }, subdivisions: [], city: { names: { en: "Somewhere" } } }) });
const from = (country) => async () => ({ country });

const appHeaders = (build, extra = {}) => ({
  "user-agent": DART,
  "x-client-platform": "android",
  "x-app-version": `1.0.0+${build}`,
  ...extra,
});
const reqOf = (headers) => ({ headers, originalUrl: "/api/test" });

describe("app gate wiring", () => {
  let warnings;
  let originalWarn;

  beforeEach(() => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.APP_MIN_CURRENCY_BUILD_ANDROID = "18";
    process.env.APP_MIN_CURRENCY_BUILD_IOS = "18";
    warnings = [];
    originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
  });
  afterEach(() => {
    console.warn = originalWarn;
    for (const k of KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
  });

  const resolve = (headers, country = "Germany") => resolveRequestCurrency({ ip: "1.2.3.4", lookupLocation: from(country), req: reqOf(headers) });
  const gateLogs = () => warnings.filter((w) => w.startsWith("[APP_GATE_USED]"));

  test("web: unchanged (EUR in Germany, INR in India), nothing logged", async () => {
    const eur = await resolve({ "user-agent": CHROME }, "Germany");
    assert.deepEqual([eur.currency, eur.source], ["EUR", "ip"]);
    const inr = await resolve({ "user-agent": CHROME }, "India");
    assert.deepEqual([inr.currency, inr.source], ["INR", "ip"]);
    assert.equal(gateLogs().length, 0);
  });

  test("no req at all (internal callers): unchanged", async () => {
    const r = await resolveRequestCurrency({ ip: "1.2.3.4", lookupLocation: from("Germany") });
    assert.equal(r.currency, "EUR");
  });

  test("old app with no headers (Dart User-Agent): USD, whatever the country", async () => {
    for (const country of ["Germany", "United Kingdom", "India"]) {
      const r = await resolve({ "user-agent": DART }, country);
      assert.deepEqual([r.currency, r.source], ["USD", "app-gate"], country);
    }
    assert.equal(gateLogs().length, 3);
    assert.match(gateLogs()[0], /reason=inferred from=local to=USD/);
  });

  test("+16 and +17: USD", async () => {
    for (const build of [16, 17]) {
      const r = await resolve(appHeaders(build), "Germany");
      assert.deepEqual([r.currency, r.source], ["USD", "app-gate"], `+${build}`);
    }
    assert.match(gateLogs()[0], /reason=below-min .*build=16/);
  });

  test("+18: EUR / GBP allowed", async () => {
    assert.equal((await resolve(appHeaders(18), "Germany")).currency, "EUR");
    assert.equal((await resolve(appHeaders(18), "United Kingdom")).currency, "GBP");
    assert.equal(gateLogs().length, 0);
  });

  test("+18 in India: USD without the Razorpay capability, INR with it", async () => {
    const plain = await resolve(appHeaders(18), "India");
    assert.deepEqual([plain.currency, plain.source, plain.country], ["USD", "app-gate", "IN"]);
    assert.match(gateLogs()[0], /from=INR to=USD/);

    const rupees = await resolve(appHeaders(18, { "x-client-capabilities": "razorpay" }), "India");
    assert.deepEqual([rupees.currency, rupees.source], ["INR", "ip"]);
  });

  test("APP_MIN_CURRENCY_BUILD unset: every app is USD, web still EUR", async () => {
    delete process.env.APP_MIN_CURRENCY_BUILD_ANDROID;
    assert.equal((await resolve(appHeaders(99), "Germany")).currency, "USD");
    assert.equal((await resolve({ "user-agent": CHROME }, "Germany")).currency, "EUR");
  });

  test("spoofed app headers on a browser: web rules apply (no cheaper USD), and it is logged as suspect", async () => {
    const r = await resolve({ "user-agent": CHROME, "x-client-platform": "android", "x-app-version": "1.0.0+17" }, "Germany");
    assert.deepEqual([r.currency, r.source], ["EUR", "ip"]);
    const logs = gateLogs();
    assert.equal(logs.length, 1);
    assert.match(logs[0], /reason=suspect-web from=app-headers to=web-rules .*suspect=true .*ua="Mozilla/);
  });

  test("flag OFF: USD for everyone, the gate is not consulted or logged", async () => {
    delete process.env.MULTI_CURRENCY_ENABLED;
    for (const headers of [{ "user-agent": CHROME }, { "user-agent": DART }, appHeaders(18), appHeaders(17)]) {
      const r = await resolve(headers, "Germany");
      assert.deepEqual([r.currency, r.source], ["USD", "disabled"]);
    }
    assert.equal(gateLogs().length, 0);
  });

  test("gateways are not restricted for USD: old apps keep Stripe and PayPal exactly as today", () => {
    assert.equal(gatewayAllowsCurrency("stripe", "USD"), true);
    assert.equal(gatewayAllowsCurrency("paypal", "USD"), true);
    assert.equal(gatewayAllowsCurrency("razorpay", "USD"), false);
  });

  test("payment path (decidePaymentCurrency): what is charged follows the gate", async () => {
    geoIp._setReader(readerFor("DE"));
    try {
      const withIp = (headers) => ({ headers: { "x-forwarded-for": "88.64.0.10", ...headers }, ip: "88.64.0.10", originalUrl: "/api/payments/create-intent-by-amount" });
      assert.equal(await decidePaymentCurrency(withIp({ "user-agent": CHROME })), "EUR");
      assert.equal(await decidePaymentCurrency(withIp({ "user-agent": DART })), "USD"); // old app
      assert.equal(await decidePaymentCurrency(withIp(appHeaders(17))), "USD");
      assert.equal(await decidePaymentCurrency(withIp(appHeaders(18))), "EUR");
    } finally {
      geoIp._setReader(null);
    }
  });
});

describe("GET /api/geo/currency and the app gate", () => {
  let server, base;

  before(async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use("/api/geo", geoRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    geoIp._setReader(null);
    await new Promise((r) => server.close(r));
    for (const k of KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
  });
  beforeEach(() => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    process.env.APP_MIN_CURRENCY_BUILD_ANDROID = "18";
    geoIp._setReader(readerFor("DE"));
  });

  const get = async (headers) => {
    const res = await fetch(`${base}/api/geo/currency`, { headers: { "x-forwarded-for": "88.64.0.10", ...headers } });
    return res.json();
  };

  test("browser gets EUR; old app and +17 get USD; +18 gets EUR", async () => {
    assert.equal((await get({ "user-agent": CHROME })).currency, "EUR");
    assert.deepEqual(await get({ "user-agent": DART }), { currency: "USD", country: "", source: "app-gate" });
    assert.equal((await get(appHeaders(17))).currency, "USD");
    assert.equal((await get(appHeaders(18))).currency, "EUR");
  });
});
