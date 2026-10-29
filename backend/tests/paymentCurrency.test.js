// Phase D1: category payments in USD / EUR / GBP.
// Stripe and PayPal are faked (no network); the database is an in-memory replica set; the routes, the payment
// verification and the booking controllers are the real ones.
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// ── Fakes, installed BEFORE the real modules load (they destructure at require time) ──
const stripeIntents = {}; // id -> PaymentIntent
const stripeCreated = []; // args of every paymentIntents.create
const fakeStripe = {
  paymentIntents: {
    create: async (args) => {
      stripeCreated.push(args);
      return { id: `pi_new_${stripeCreated.length}`, client_secret: `secret_${stripeCreated.length}`, ...args };
    },
    retrieve: async (id) => {
      if (!stripeIntents[id]) throw new Error("No such payment_intent");
      return stripeIntents[id];
    },
  },
};
require.cache[require.resolve("stripe")] = {
  id: require.resolve("stripe"),
  filename: require.resolve("stripe"),
  loaded: true,
  exports: () => fakeStripe,
};

const paypalOrders = {}; // id -> order
const paypalCreated = []; // bodies of every POST /v2/checkout/orders
const paypalCaptured = {}; // id -> capture response
require("../utils/paypal").paypalFetch = async (method, path, body) => {
  if (method === "POST" && path === "/v2/checkout/orders") {
    paypalCreated.push(body);
    return { id: `ORDER_${paypalCreated.length}` };
  }
  const capture = /^\/v2\/checkout\/orders\/([^/]+)\/capture$/.exec(path);
  if (method === "POST" && capture) return paypalCaptured[capture[1]];
  const get = /^\/v2\/checkout\/orders\/([^/]+)$/.exec(path);
  if (method === "GET" && get) {
    if (!paypalOrders[get[1]]) throw new Error("not found");
    return paypalOrders[get[1]];
  }
  throw new Error(`unexpected PayPal call ${method} ${path}`);
};

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyUserToken = (req, res, next) => {
  const id = req.headers["x-test-user"];
  if (!id) return res.status(401).json({ msg: "No token provided." });
  req.user = { id, role: "user" };
  next();
};

const invoiceCalls = [];
require("../utils/billing").recordPaymentAndInvoice = async (args) => { invoiceCalls.push(args); };
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const User = require("../models/User");
const HealthcareCategory = require("../models/HealthcareCategory");
const ServicePrice = require("../models/ServicePrice");
const { CategoryPricing } = require("../models/CategoryPricing");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ConsumedPayment = require("../models/ConsumedPayment");
const pv = require("../utils/paymentVerification");
const { createAppointment } = require("../controllers/appointmentController");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");
const paymentsRouter = require("../routes/payments");
const paypalRouter = require("../routes/paypal");

const pi = (id, { currency = "eur", amount = 3000, status = "succeeded", metadata } = {}) => {
  stripeIntents[id] = { id, status, currency, amount, ...(metadata ? { metadata } : {}) };
  return id;
};
const order = (id, { currency = "EUR", value = "30.00", status = "COMPLETED" } = {}) => {
  paypalOrders[id] = { id, status, purchase_units: [{ payments: { captures: [{ amount: { value, currency_code: currency } }] } }] };
  return id;
};
const rejects = (promise, pattern, status) =>
  assert.rejects(promise, (err) => {
    assert.ok(err instanceof pv.PaymentVerificationError, `expected PaymentVerificationError, got ${err}`);
    assert.match(err.message, pattern);
    if (status) assert.equal(err.status, status);
    return true;
  });

describe("category payments in USD / EUR / GBP", () => {
  let replSet, server, base, warnings;
  let usdUser, eurUser, gbpUser;
  const realWarn = console.warn;
  const originalFlag = process.env.MULTI_CURRENCY_ENABLED;
  const flag = (on) => { if (on) process.env.MULTI_CURRENCY_ENABLED = "true"; else delete process.env.MULTI_CURRENCY_ENABLED; };

  const mkUser = (country) => User.create({ name: country, email: `${country.replace(/\W/g, "").toLowerCase()}@x.co`, role: "user", country });
  const post = async (path, user, body) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? { "x-test-user": String(user._id) } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const fallbackLogs = () => warnings.filter((w) => w.includes("CURRENCY_FALLBACK_USED"));

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([Appointment.init(), CategoryConsultation.init(), ConsumedPayment.init(), HealthcareCategory.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/payments", paymentsRouter);
    app.use("/api/paypal", paypalRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await replSet.stop();
    console.warn = realWarn;
    if (originalFlag === undefined) delete process.env.MULTI_CURRENCY_ENABLED;
    else process.env.MULTI_CURRENCY_ENABLED = originalFlag;
  });

  beforeEach(async () => {
    flag(true);
    warnings = [];
    console.warn = (...args) => warnings.push(args.join(" "));
    stripeCreated.length = 0;
    paypalCreated.length = 0;
    invoiceCalls.length = 0;
    for (const k of Object.keys(stripeIntents)) delete stripeIntents[k];
    for (const k of Object.keys(paypalOrders)) delete paypalOrders[k];
    for (const k of Object.keys(paypalCaptured)) delete paypalCaptured[k];
    await Promise.all([
      User.deleteMany({}), HealthcareCategory.deleteMany({}), CategoryPricing.deleteMany({}), ServicePrice.deleteMany({}),
      Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ConsumedPayment.deleteMany({}),
    ]);
    // "General Care" is priced in all three currencies; "Old Care" only in USD.
    await HealthcareCategory.create({ name: "General Care", pricingSlug: "general-care", price: 10, isActive: true });
    await CategoryPricing.create({ categoryId: "general-care", label: "General Care", price: 10, priceEur: 30, priceGbp: 25 });
    await HealthcareCategory.create({ name: "Old Care", pricingSlug: "old-care", price: 12, isActive: true });
    await CategoryPricing.create({ categoryId: "old-care", label: "Old Care", price: 12 });
    await HealthcareCategory.create({ name: "Hidden Care", pricingSlug: "hidden-care", price: 5, isActive: false });
    await CategoryPricing.create({ categoryId: "hidden-care", label: "Hidden Care", price: 5, priceEur: 6, priceGbp: 7 });
    await ServicePrice.create({ name: "Fit to Fly", slug: "fit-to-fly", price: 69, icon: "i", description: "d" });
    usdUser = await mkUser("India");
    eurUser = await mkUser("Germany");
    gbpUser = await mkUser("United Kingdom");
  });
  afterEach(() => { console.warn = realWarn; });

  // ───────────────────────────────────────────────────────────────────────────
  describe("assertAllowedCurrency", () => {
    test("accepts USD / EUR / GBP in any case and returns the upper-case code", () => {
      assert.equal(pv.assertAllowedCurrency("usd"), "USD");
      assert.equal(pv.assertAllowedCurrency(" Eur "), "EUR");
      assert.equal(pv.assertAllowedCurrency("GBP"), "GBP");
    });
    test("throws for anything else", () => {
      for (const bad of ["INR", "JPY", "btc", "", null, undefined, 5, "US", "USDD"]) {
        assert.throws(() => pv.assertAllowedCurrency(bad), pv.PaymentVerificationError, String(bad));
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("Stripe: create-intent-by-amount", () => {
    const create = (user, body = { priceType: "category", priceRef: "general-care" }) =>
      post("/api/payments/create-intent-by-amount", user, body);

    test("a EUR customer gets a EUR intent for the stored EUR price: 3000 cents, metadata carries the currency", async () => {
      const r = await create(eurUser);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(stripeCreated.length, 1);
      assert.equal(stripeCreated[0].amount, 3000);
      assert.equal(stripeCreated[0].currency, "eur");
      assert.equal(stripeCreated[0].metadata.currency, "EUR");
      assert.equal(stripeCreated[0].metadata.priceRef, "general-care");
      assert.deepEqual(r.body, { clientSecret: "secret_1", amountCents: 3000, currency: "EUR" });
    });

    test("a GBP customer gets a GBP intent: 2500 pence", async () => {
      const r = await create(gbpUser);
      assert.equal(stripeCreated[0].amount, 2500);
      assert.equal(stripeCreated[0].currency, "gbp");
      assert.deepEqual([r.body.amountCents, r.body.currency], [2500, "GBP"]);
    });

    test("a USD customer gets a USD intent: 1000 cents", async () => {
      const r = await create(usdUser);
      assert.equal(stripeCreated[0].amount, 1000);
      assert.equal(stripeCreated[0].currency, "usd");
      assert.deepEqual([r.body.amountCents, r.body.currency], [1000, "USD"]);
    });

    test("NO CONVERSION: a 30 EUR category is 3000 EUR cents, never about 3260 USD", async () => {
      await create(eurUser);
      const charged = stripeCreated[0];
      assert.equal(charged.amount, 3000);
      assert.equal(charged.currency, "eur");
      const converted = Math.round((30 / 0.92) * 100); // what toCents(30, "EUR") used to produce: 3261 USD cents
      assert.notEqual(charged.amount, converted);
      assert.equal(converted, 3261);
    });

    test("FALLBACK: a category with no EUR price charges the USD price, labelled USD, and logs it", async () => {
      const r = await create(eurUser, { priceType: "category", priceRef: "old-care" });
      assert.equal(r.status, 200);
      assert.equal(stripeCreated[0].amount, 1200);
      assert.equal(stripeCreated[0].currency, "usd");
      assert.equal(stripeCreated[0].metadata.currency, "USD");
      assert.deepEqual([r.body.amountCents, r.body.currency], [1200, "USD"]);
      assert.equal(fallbackLogs().length, 1);
      assert.match(fallbackLogs()[0], /wanted=EUR used=USD/);
    });

    test("FLAG OFF: everyone is charged in USD, exactly as before", async () => {
      flag(false);
      for (const user of [eurUser, gbpUser, usdUser]) {
        stripeCreated.length = 0;
        const r = await create(user);
        assert.equal(stripeCreated[0].amount, 1000);
        assert.equal(stripeCreated[0].currency, "usd");
        assert.deepEqual([r.body.amountCents, r.body.currency], [1000, "USD"]);
      }
      assert.equal(fallbackLogs().length, 0);
    });

    test("a currency or amount sent by the browser is ignored", async () => {
      const r = await create(eurUser, { priceType: "category", priceRef: "general-care", currency: "GBP", amount: 1, amountCents: 1, price: 1 });
      assert.deepEqual([r.body.amountCents, r.body.currency], [3000, "EUR"]);
      assert.equal(stripeCreated[0].amount, 3000);
    });

    test("a service is always USD, even for a EUR customer", async () => {
      const r = await create(eurUser, { priceType: "service", priceRef: "fit-to-fly" });
      assert.equal(stripeCreated[0].amount, 6900);
      assert.equal(stripeCreated[0].currency, "usd");
      assert.equal(r.body.currency, "USD");
    });

    test("an unknown or deactivated category is refused before Stripe is called", async () => {
      for (const priceRef of ["nope", "hidden-care", "", undefined]) {
        const r = await create(eurUser, { priceType: "category", priceRef });
        assert.equal(r.status, 400, String(priceRef));
      }
      assert.equal(stripeCreated.length, 0);
    });

    test("login is required", async () => {
      assert.equal((await create(null)).status, 401);
      assert.equal(stripeCreated.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("PayPal: create-order-by-amount and capture-order", () => {
    const create = (user, body = { priceType: "category", priceRef: "general-care" }) =>
      post("/api/paypal/create-order-by-amount", user, body);

    test("the order is created with the decided currency_code and the stored price", async () => {
      let r = await create(eurUser);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(paypalCreated[0].purchase_units[0].amount, { currency_code: "EUR", value: "30.00" });
      assert.deepEqual([r.body.amountCents, r.body.currency], [3000, "EUR"]);

      r = await create(gbpUser);
      assert.deepEqual(paypalCreated[1].purchase_units[0].amount, { currency_code: "GBP", value: "25.00" });
      assert.equal(r.body.currency, "GBP");

      r = await create(usdUser);
      assert.deepEqual(paypalCreated[2].purchase_units[0].amount, { currency_code: "USD", value: "10.00" });
      assert.equal(r.body.currency, "USD");
    });

    test("FALLBACK: no EUR price -> USD order, labelled USD, logged", async () => {
      const r = await create(eurUser, { priceType: "category", priceRef: "old-care" });
      assert.deepEqual(paypalCreated[0].purchase_units[0].amount, { currency_code: "USD", value: "12.00" });
      assert.equal(r.body.currency, "USD");
      assert.equal(fallbackLogs().length, 1);
    });

    test("FLAG OFF: always a USD order", async () => {
      flag(false);
      await create(eurUser);
      assert.deepEqual(paypalCreated[0].purchase_units[0].amount, { currency_code: "USD", value: "10.00" });
    });

    test("a currency sent by the browser is ignored; a service stays USD", async () => {
      await create(eurUser, { priceType: "category", priceRef: "general-care", currency: "GBP" });
      assert.equal(paypalCreated[0].purchase_units[0].amount.currency_code, "EUR");
      await create(eurUser, { priceType: "service", priceRef: "fit-to-fly" });
      assert.deepEqual(paypalCreated[1].purchase_units[0].amount, { currency_code: "USD", value: "69.00" });
    });

    test("an unknown category is refused before PayPal is called", async () => {
      assert.equal((await create(eurUser, { priceType: "category", priceRef: "nope" })).status, 400);
      assert.equal(paypalCreated.length, 0);
    });

    test("capture-order reports the currency of the capture", async () => {
      paypalCaptured.O1 = { id: "O1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ amount: { value: "30.00", currency_code: "EUR" } }] } }] };
      let r = await post("/api/paypal/capture-order", eurUser, { orderId: "O1" });
      assert.deepEqual(r.body, { orderId: "O1", status: "COMPLETED", amountCents: 3000, currency: "EUR" });

      paypalCaptured.O2 = { id: "O2", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ amount: { value: "49.99", currency_code: "USD" } }] } }] };
      r = await post("/api/paypal/capture-order", usdUser, { orderId: "O2" });
      assert.deepEqual([r.body.amountCents, r.body.currency], [4999, "USD"]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("verifyStripePaymentIntent / verifyPaypalOrder", () => {
    test("Stripe: a matching EUR payment passes and reports its currency", async () => {
      pi("pi_ok", { currency: "eur", amount: 3000 });
      const v = await pv.verifyStripePaymentIntent({ paymentIntentId: "pi_ok", expectedCents: 3000, expectedCurrency: "EUR" });
      assert.deepEqual(v, { ref: "pi_ok", amountCents: 3000, currency: "EUR", gateway: "stripe" });
    });

    test("Stripe: with no expected currency it is USD (doctor and service paths), and a EUR payment is refused", async () => {
      pi("pi_usd", { currency: "usd", amount: 4900 });
      assert.equal((await pv.verifyStripePaymentIntent({ paymentIntentId: "pi_usd", expectedCents: 4900 })).currency, "USD");
      pi("pi_eur", { currency: "eur", amount: 4900 });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_eur", expectedCents: 4900 }), /Unsupported payment currency/);
    });

    test("Stripe: currency mismatch is refused", async () => {
      pi("pi_gbp", { currency: "gbp", amount: 3000 });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_gbp", expectedCents: 3000, expectedCurrency: "EUR" }), /currency does not match/);
      pi("pi_usd2", { currency: "usd", amount: 3000 });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_usd2", expectedCents: 3000, expectedCurrency: "EUR" }), /currency does not match/);
    });

    test("Stripe: amount mismatch is refused", async () => {
      pi("pi_cheap", { currency: "eur", amount: 100 });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_cheap", expectedCents: 3000, expectedCurrency: "EUR" }), /amount does not match/);
    });

    test("Stripe: a currency outside USD/EUR/GBP is refused whatever is expected", async () => {
      pi("pi_inr", { currency: "inr", amount: 3000 });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_inr", expectedCents: 3000, expectedCurrency: "EUR" }), /Unsupported payment currency/);
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_inr", expectedCents: 3000 }), /Unsupported payment currency/);
      await assert.rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_inr", expectedCents: 3000, expectedCurrency: "INR" }), pv.PaymentVerificationError);
    });

    test("Stripe: an unfinished payment is refused with 402; an unknown reference is refused", async () => {
      pi("pi_wait", { status: "requires_payment_method" });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_wait", expectedCents: 3000, expectedCurrency: "EUR" }), /not completed/, 402);
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_missing", expectedCents: 3000 }), /Invalid Stripe payment reference/);
    });

    test("Stripe: metadata currency that disagrees with the charge is refused", async () => {
      pi("pi_meta", { currency: "eur", amount: 3000, metadata: { currency: "GBP" } });
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_meta", expectedCents: 3000, expectedCurrency: "EUR" }), /currency does not match/);
      pi("pi_meta_ok", { currency: "eur", amount: 3000, metadata: { currency: "EUR" } });
      await pv.verifyStripePaymentIntent({ paymentIntentId: "pi_meta_ok", expectedCents: 3000, expectedCurrency: "EUR" });
    });

    test("PayPal: a matching GBP capture passes and reports its currency_code", async () => {
      order("O_ok", { currency: "GBP", value: "25.00" });
      const v = await pv.verifyPaypalOrder({ paypalOrderId: "O_ok", expectedCents: 2500, expectedCurrency: "GBP" });
      assert.deepEqual(v, { ref: "O_ok", amountCents: 2500, currency: "GBP", gateway: "paypal" });
    });

    test("PayPal: a wrong currency_code is refused; with no expected currency it must be USD", async () => {
      order("O_eur", { currency: "EUR", value: "30.00" });
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_eur", expectedCents: 3000, expectedCurrency: "GBP" }), /currency does not match/);
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_eur", expectedCents: 3000 }), /Unsupported payment currency/);
      order("O_usd", { currency: "USD", value: "30.00" });
      assert.equal((await pv.verifyPaypalOrder({ paypalOrderId: "O_usd", expectedCents: 3000 })).currency, "USD");
    });

    test("PayPal: a currency outside USD/EUR/GBP, an amount mismatch and an unfinished order are refused", async () => {
      order("O_inr", { currency: "INR", value: "30.00" });
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_inr", expectedCents: 3000, expectedCurrency: "EUR" }), /Unsupported payment currency/);
      order("O_low", { currency: "EUR", value: "1.00" });
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_low", expectedCents: 3000, expectedCurrency: "EUR" }), /amount does not match/);
      order("O_wait", { currency: "EUR", status: "APPROVED" });
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_wait", expectedCents: 3000, expectedCurrency: "EUR" }), /not completed/, 402);
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_missing", expectedCents: 3000 }), /Invalid PayPal payment reference/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("verifyCategoryPayment (booking time)", () => {
    const verify = (extra) => pv.verifyCategoryPayment({ priceRef: "general-care", ...extra });

    test("a EUR payment of the stored EUR price passes and carries EUR", async () => {
      pi("pi_e", { currency: "eur", amount: 3000 });
      assert.deepEqual(await verify({ paymentIntentId: "pi_e" }), { ref: "pi_e", amountCents: 3000, currency: "EUR", gateway: "stripe" });
    });

    test("GBP and USD payments of their stored prices pass; PayPal works the same way", async () => {
      pi("pi_g", { currency: "gbp", amount: 2500 });
      assert.equal((await verify({ paymentIntentId: "pi_g" })).currency, "GBP");
      pi("pi_u", { currency: "usd", amount: 1000 });
      assert.equal((await verify({ paymentIntentId: "pi_u" })).currency, "USD");
      order("O_e", { currency: "EUR", value: "30.00" });
      assert.deepEqual(await verify({ paypalOrderId: "O_e" }), { ref: "O_e", amountCents: 3000, currency: "EUR", gateway: "paypal" });
    });

    test("the USD amount paid in EUR is refused (no conversion)", async () => {
      pi("pi_wrong", { currency: "eur", amount: 1000 });
      await rejects(verify({ paymentIntentId: "pi_wrong" }), /amount does not match/);
    });

    test("a EUR payment for a category with no EUR price is refused, never converted", async () => {
      pi("pi_old", { currency: "eur", amount: 1200 });
      await rejects(verify({ paymentIntentId: "pi_old", priceRef: "old-care" }), /currency|Unsupported/);
    });

    test("a USD payment for that same category passes", async () => {
      pi("pi_old_usd", { currency: "usd", amount: 1200 });
      assert.equal((await verify({ paymentIntentId: "pi_old_usd", priceRef: "old-care" })).currency, "USD");
    });

    test("a currency outside USD/EUR/GBP is refused", async () => {
      pi("pi_inr", { currency: "inr", amount: 3000 });
      await rejects(verify({ paymentIntentId: "pi_inr" }), /Unsupported payment currency/);
    });

    test("an unknown category gives the caller's message with status 400", async () => {
      pi("pi_x", { currency: "eur", amount: 3000 });
      await rejects(verify({ paymentIntentId: "pi_x", priceRef: "nope", unrecognizedMessage: "Unrecognized category." }), /Unrecognized category\./, 400);
    });

    test("a deactivated category still verifies a payment that was already taken", async () => {
      pi("pi_h", { currency: "gbp", amount: 700 });
      assert.equal((await verify({ paymentIntentId: "pi_h", priceRef: "hidden-care" })).currency, "GBP");
    });

    test("an unfinished payment is refused", async () => {
      pi("pi_w", { currency: "eur", amount: 3000, status: "processing" });
      await rejects(verify({ paymentIntentId: "pi_w" }), /not completed/, 402);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("booking finalisation saves the currency", () => {
    const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    const makeRes = () => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      return res;
    };
    const reqFor = (user, body) => ({ headers: {}, body, user: { id: String(user._id) }, app: { get: () => null } });
    const consultationBody = (extra) => ({
      concern: "Cough", duration: "1 week", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
      categoryName: "General Care", categoryId: "general-care", specialtyName: "GP", conditionName: "Cough", ...extra,
    });
    const appointmentBody = (extra) => ({
      date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", categoryId: "general-care",
      specialty: "GP", condition: "Cough", consultationPrice: 50, patientDetails: { firstName: "T" }, ...extra,
    });
    const tick = () => new Promise((r) => setTimeout(r, 60));

    test("category consultation: a EUR payment is stored as eur, with the amount and the invoice currency", async () => {
      pi("pi_c1", { currency: "eur", amount: 3000 });
      const res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_c1" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.consultationPrice, stored.paymentStatus], ["eur", 3000, 30, "paid"]);
      await tick();
      assert.equal(invoiceCalls.length, 1);
      assert.deepEqual([invoiceCalls[0].currency, invoiceCalls[0].amountCents], ["eur", 3000]);
    });

    test("category consultation: GBP via PayPal, and USD", async () => {
      order("O_c2", { currency: "GBP", value: "25.00" });
      let res = makeRes();
      await createCategoryConsultation(reqFor(gbpUser, consultationBody({ paypalOrderId: "O_c2" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      let stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.paymentGateway], ["gbp", 2500, "paypal"]);

      pi("pi_c3", { currency: "usd", amount: 1000 });
      res = makeRes();
      await createCategoryConsultation(reqFor(usdUser, consultationBody({ paymentIntentId: "pi_c3" })), res);
      stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual([stored.paymentCurrency, stored.paymentAmount], ["usd", 1000]);
    });

    test("category consultation: replaying a used payment still fails (409) and creates nothing", async () => {
      pi("pi_replay", { currency: "eur", amount: 3000 });
      let res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_replay" })), res);
      assert.equal(res.statusCode, 201);
      res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_replay" })), res);
      assert.equal(res.statusCode, 409);
      assert.match(res.body.message, /already been used/);
      assert.equal(await CategoryConsultation.countDocuments({}), 1);
    });

    test("category consultation: a wrong amount or currency is refused and nothing is created", async () => {
      pi("pi_bad1", { currency: "eur", amount: 1000 }); // the USD amount, paid in EUR
      pi("pi_bad2", { currency: "inr", amount: 3000 });
      for (const id of ["pi_bad1", "pi_bad2"]) {
        const res = makeRes();
        await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: id })), res);
        assert.equal(res.statusCode, 400, id);
      }
      assert.equal(await CategoryConsultation.countDocuments({}), 0);
      assert.equal(await ConsumedPayment.countDocuments({}), 0);
    });

    test("category consultation: an unknown category gets the existing message", async () => {
      pi("pi_unk", { currency: "eur", amount: 3000 });
      const res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_unk", categoryId: "nope", categoryName: "Nope" })), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, "Unrecognized service/category. Please reselect and try again.");
    });

    test("category consultation: a service booking is checked as USD and stored as usd", async () => {
      pi("pi_svc", { currency: "usd", amount: 6900 });
      const res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_svc", serviceName: "fit-to-fly" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      assert.equal((await CategoryConsultation.findById(res.body.data._id).lean()).paymentCurrency, "usd");

      pi("pi_svc_eur", { currency: "eur", amount: 6900 });
      const bad = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_svc_eur", serviceName: "fit-to-fly" })), bad);
      assert.equal(bad.statusCode, 400);
    });

    test("category appointment: a EUR payment is stored as eur and the charged amount, not the browser price", async () => {
      pi("pi_a1", { currency: "eur", amount: 3000 });
      const res = makeRes();
      await createAppointment(reqFor(eurUser, appointmentBody({ paymentIntentId: "pi_a1" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await Appointment.findById(res.body.appointment._id).lean();
      assert.deepEqual(
        [stored.paymentCurrency, stored.paymentAmount, stored.consultationPrice, stored.paymentStatus],
        ["eur", 3000, 30, "paid"],
      );
      await tick();
      assert.deepEqual([invoiceCalls[0].currency, invoiceCalls[0].amountCents], ["eur", 3000]);
    });

    test("category appointment: USD keeps the browser price exactly as before, and is stored as usd", async () => {
      pi("pi_a2", { currency: "usd", amount: 1000 });
      const res = makeRes();
      await createAppointment(reqFor(usdUser, appointmentBody({ paymentIntentId: "pi_a2" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await Appointment.findById(res.body.appointment._id).lean();
      assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.consultationPrice], ["usd", 1000, 50]);
      await tick();
      assert.equal(invoiceCalls[0].currency, "usd");
    });

    test("category appointment: replaying a used payment still fails; a wrong currency is refused", async () => {
      pi("pi_a3", { currency: "gbp", amount: 2500 });
      let res = makeRes();
      await createAppointment(reqFor(gbpUser, appointmentBody({ paymentIntentId: "pi_a3" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      res = makeRes();
      await createAppointment(reqFor(gbpUser, appointmentBody({ paymentIntentId: "pi_a3" })), res);
      assert.equal(res.statusCode, 409);

      pi("pi_a4", { currency: "inr", amount: 2500 });
      res = makeRes();
      await createAppointment(reqFor(gbpUser, appointmentBody({ paymentIntentId: "pi_a4" })), res);
      assert.equal(res.statusCode, 400);
      assert.equal(await Appointment.countDocuments({}), 1);
    });

    test("FLAG OFF: the whole path stays USD (create and book)", async () => {
      flag(false);
      const created = await post("/api/payments/create-intent-by-amount", eurUser, { priceType: "category", priceRef: "general-care" });
      assert.deepEqual([created.body.amountCents, created.body.currency], [1000, "USD"]);
      pi("pi_off", { currency: "usd", amount: 1000 });
      const res = makeRes();
      await createCategoryConsultation(reqFor(eurUser, consultationBody({ paymentIntentId: "pi_off" })), res);
      assert.equal(res.statusCode, 201);
      assert.equal((await CategoryConsultation.findById(res.body.data._id).lean()).paymentCurrency, "usd");
    });
  });
});
