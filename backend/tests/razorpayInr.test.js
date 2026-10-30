// INR (India only) through Razorpay. Razorpay, Stripe and PayPal are faked (no network); the database is an in-memory replica set;
// the routes, the payment verification, the webhook and the booking controllers are the real ones.
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const KEY_ID = "rzp_test_unitkey";
const KEY_SECRET = "unit_test_key_secret";
const WEBHOOK_SECRET = "unit_test_webhook_secret";

// ── Who a payment was created for ──
// A real Stripe intent / PayPal order carries the user it was created for (metadata.userId / custom_id). These fakes give every
// stored intent or order the customer who is currently booking (lastUser) as its owner, so the existing fixtures stay "their own
// payment". A fixture can say otherwise: __owner: "<another user id>" is somebody else's payment, __owner: null has no owner (an
// intent made before the owner was recorded). Direct pv.* calls (wrapped at the bottom of the requires) default to DIRECT_USER.
const DIRECT_USER = "000000000000000000000abc";
let lastUser = DIRECT_USER;
function ownerOf(stored) {
  return stored.__owner === undefined ? lastUser : stored.__owner;
}
function stripeView(stored) {
  const { __owner, ...intent } = stored;
  const owner = ownerOf(stored);
  return { ...intent, metadata: { ...(intent.metadata || {}), ...(owner ? { userId: String(owner) } : {}) } };
}
function paypalView(stored) {
  const { __owner, ...order } = stored;
  const owner = ownerOf(stored);
  return { ...order, purchase_units: order.purchase_units.map((u, i) => (i === 0 && owner ? { ...u, custom_id: `category:general-care:${owner}` } : u)) };
}

// ── Fakes, installed BEFORE the real modules load (they destructure at require time) ──
const stripeCreated = [];
const stripeIntents = {};
const fakeStripe = {
  paymentIntents: {
    create: async (args) => {
      stripeCreated.push(args);
      return { id: `pi_new_${stripeCreated.length}`, client_secret: `secret_${stripeCreated.length}`, ...args };
    },
    retrieve: async (id) => {
      if (!stripeIntents[id]) throw new Error("No such payment_intent");
      return stripeView(stripeIntents[id]);
    },
  },
};
require.cache[require.resolve("stripe")] = {
  id: require.resolve("stripe"),
  filename: require.resolve("stripe"),
  loaded: true,
  exports: () => fakeStripe,
};

const paypalCreated = [];
const paypalOrders = {};
require("../utils/paypal").paypalFetch = async (method, path, body) => {
  if (method === "POST" && path === "/v2/checkout/orders") {
    paypalCreated.push(body);
    return { id: `ORDER_${paypalCreated.length}` };
  }
  const get = /^\/v2\/checkout\/orders\/([^/]+)$/.exec(path);
  if (method === "GET" && get) {
    if (!paypalOrders[get[1]]) throw new Error("not found");
    return paypalView(paypalOrders[get[1]]);
  }
  throw new Error(`unexpected PayPal call ${method} ${path}`);
};

const rpCreated = []; // args of every Razorpay orders.create
const rpOrders = {}; // id -> order
const rpPayments = {}; // id -> payment
const fakeRazorpay = {
  orders: {
    create: async (args) => {
      rpCreated.push(args);
      const id = `order_NEW${String(rpCreated.length).padStart(6, "0")}`;
      rpOrders[id] = { id, status: "created", ...args };
      return rpOrders[id];
    },
    fetch: async (id) => {
      if (!rpOrders[id]) throw new Error("not found");
      return rpOrders[id];
    },
  },
  payments: {
    fetch: async (id) => {
      if (!rpPayments[id]) throw new Error("not found");
      return rpPayments[id];
    },
  },
};
require("../utils/razorpay").setRazorpayClientForTests(fakeRazorpay);

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyUserToken = (req, res, next) => {
  const id = req.headers["x-test-user"];
  if (!id) return res.status(401).json({ msg: "No token provided." });
  req.user = { id, role: "user" };
  lastUser = id;
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
const Payment = require("../models/Payment");
const RazorpayEvent = require("../models/RazorpayEvent");
const pv = require("../utils/paymentVerification");
const rz = require("../utils/razorpay");
const cfg = require("../utils/currencyConfig");
const { createAppointment } = require("../controllers/appointmentController");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");
const paymentsRouter = require("../routes/payments");
const paypalRouter = require("../routes/paypal");
const razorpayRouter = require("../routes/razorpay");
const geoRouter = require("../routes/geo");

// Direct calls to the verifiers get the default customer, as the controllers pass theirs. (Installed after the controllers have loaded
// their own references, so a controller that forgets to pass patientId still fails.)
for (const name of ["verifyStripePaymentIntent", "verifyPaypalOrder", "verifyCategoryPayment"]) {
  const original = pv[name];
  pv[name] = (args) => {
    lastUser = args.patientId ? String(args.patientId) : DIRECT_USER;
    return original({ ...args, patientId: lastUser });
  };
}

const { ipFor, installIpReader, removeIpReader } = require("./helpers/ipCountry");
const sign = (orderId, paymentId, secret = KEY_SECRET) => crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

// A paid Razorpay order + payment, as Razorpay would report them. Returns what Checkout hands the browser.
function paid(user, o = {}) {
  const orderId = o.orderId || "order_TEST0001";
  const paymentId = o.paymentId || "pay_TEST0001";
  const amount = o.amount ?? 99900;
  rpOrders[orderId] = {
    id: orderId,
    amount: o.orderAmount ?? amount,
    currency: o.orderCurrency || "INR",
    status: "paid",
    notes: { userId: String(o.ownerId ?? user._id) },
  };
  rpPayments[paymentId] = {
    id: paymentId,
    order_id: o.paymentOrderId || orderId,
    amount,
    currency: o.currency || "INR",
    status: o.status || "captured",
    amount_refunded: 0,
    ...(o.extra || {}),
  };
  return { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: "signature" in o ? o.signature : sign(orderId, paymentId) };
}

const rejects = (promise, pattern, status) =>
  assert.rejects(promise, (err) => {
    assert.ok(err instanceof pv.PaymentVerificationError, `expected PaymentVerificationError, got ${err}`);
    assert.match(err.message, pattern);
    if (status) assert.equal(err.status, status);
    return true;
  });

describe("INR through Razorpay (India only)", () => {
  let replSet, server, base, warnings;
  let inUser, deUser, gbUser, usUser;
  const realWarn = console.warn;
  const realError = console.error;
  const saved = {};
  const ENV = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
  const flag = (on) => { if (on) process.env.MULTI_CURRENCY_ENABLED = "true"; else delete process.env.MULTI_CURRENCY_ENABLED; };
  const keys = (on) => {
    if (on) { process.env.RAZORPAY_KEY_ID = KEY_ID; process.env.RAZORPAY_KEY_SECRET = KEY_SECRET; }
    else { delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; }
  };

  const mkUser = (country) => User.create({ name: country, email: `${country.replace(/\W/g, "").toLowerCase()}@x.co`, role: "user", country });
  const post = async (path, user, body, ip) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      // the currency follows the IP the request comes from: a user appears to be in the country on their profile unless a test says otherwise
      headers: { "content-type": "application/json", "x-forwarded-for": ip ?? ipFor(user?.country), ...(user ? { "x-test-user": String(user._id) } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  // GET /api/geo/currency as seen from `ip` (default: the country on the user's profile); a login token changes nothing
  const geo = async (user, ip) => {
    const token = user ? jwt.sign({ id: String(user._id), role: "user" }, process.env.JWT_SECRET) : null;
    const res = await fetch(`${base}/api/geo/currency`, {
      headers: { "x-forwarded-for": ip ?? ipFor(user?.country), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    return res.json();
  };
  const webhook = async (event, { secret = WEBHOOK_SECRET, id = "evt_1", signature, raw } = {}) => {
    const body = raw ?? JSON.stringify(event);
    const res = await fetch(`${base}/api/razorpay/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature ?? crypto.createHmac("sha256", secret).update(body).digest("hex"),
        ...(id ? { "x-razorpay-event-id": id } : {}),
      },
      body,
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([Appointment.init(), CategoryConsultation.init(), ConsumedPayment.init(), HealthcareCategory.init(), Payment.init(), RazorpayEvent.init()]);
    installIpReader();
    const app = express();
    app.set("trust proxy", 1);
    app.post("/api/razorpay/webhook", express.raw({ type: "*/*", limit: "1mb" }), razorpayRouter.webhookHandler);
    app.use(express.json());
    app.use("/api/payments", paymentsRouter);
    app.use("/api/paypal", paypalRouter);
    app.use("/api/razorpay", razorpayRouter);
    app.use("/api/geo", geoRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    removeIpReader();
    await mongoose.disconnect();
    await replSet.stop();
    console.warn = realWarn;
    console.error = realError;
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  beforeEach(async () => {
    flag(true);
    keys(true);
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    warnings = [];
    console.warn = (...args) => warnings.push(args.join(" "));
    console.error = () => {};
    stripeCreated.length = 0;
    paypalCreated.length = 0;
    rpCreated.length = 0;
    invoiceCalls.length = 0;
    for (const store of [stripeIntents, paypalOrders, rpOrders, rpPayments]) for (const k of Object.keys(store)) delete store[k];
    await Promise.all([
      User.deleteMany({}), HealthcareCategory.deleteMany({}), CategoryPricing.deleteMany({}), ServicePrice.deleteMany({}),
      Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ConsumedPayment.deleteMany({}),
      Payment.deleteMany({}), RazorpayEvent.deleteMany({}),
    ]);
    // "General Care" is priced in all four currencies; "Old Care" has no INR price.
    await HealthcareCategory.create({ name: "General Care", pricingSlug: "general-care", price: 10, isActive: true });
    await CategoryPricing.create({ categoryId: "general-care", label: "General Care", price: 10, priceEur: 30, priceGbp: 25, priceInr: 999 });
    await HealthcareCategory.create({ name: "Old Care", pricingSlug: "old-care", price: 12, isActive: true });
    await CategoryPricing.create({ categoryId: "old-care", label: "Old Care", price: 12, priceEur: 11, priceGbp: 10 });
    await ServicePrice.create({ name: "Fit to Fly", slug: "fit-to-fly", price: 69, icon: "i", description: "d" });
    inUser = await mkUser("India");
    deUser = await mkUser("Germany");
    gbUser = await mkUser("United Kingdom");
    usUser = await mkUser("United States");
  });
  afterEach(() => { console.warn = realWarn; console.error = realError; });

  // ───────────────────────────────────────────────────────────────────────────
  describe("which currency, and which gateway follows it", () => {
    test("IN -> INR; DE -> EUR; GB -> GBP; US -> USD (flag on, Razorpay keys set)", async () => {
      assert.equal((await geo(inUser)).currency, "INR");
      assert.equal((await geo(deUser)).currency, "EUR");
      assert.equal((await geo(gbUser)).currency, "GBP");
      assert.equal((await geo(usUser)).currency, "USD");
      assert.deepEqual(await geo(inUser), { currency: "INR", country: "IN", source: "ip" });
    });

    test("only India is rupees: no other country, and the ISO code works the same", () => {
      assert.equal(cfg.currencyForCountryCode("IN"), "INR");
      assert.equal(cfg.currencyForCountryCode("in"), "INR");
      for (const code of ["PK", "BD", "LK", "NP", "AE", "US", "DE", "GB", "", "ZZ"]) {
        assert.notEqual(cfg.currencyForCountryCode(code), "INR", code);
      }
    });

    test("Razorpay keys missing -> an Indian user gets exactly today's behaviour (USD, Stripe / PayPal), never Razorpay", async () => {
      keys(false);
      assert.deepEqual(await geo(inUser), { currency: "USD", country: "IN", source: "ip" });
      const stripe = await post("/api/payments/create-intent-by-amount", inUser, { priceType: "category", priceRef: "general-care" });
      assert.deepEqual([stripe.status, stripe.body.currency, stripe.body.amountCents], [200, "USD", 1000]);
      assert.equal(stripeCreated[0].currency, "usd");
      const rp = await post("/api/razorpay/create-order", inUser, { priceType: "category", priceRef: "general-care" });
      assert.equal(rp.status, 503);
      assert.equal(rpCreated.length, 0);
    });

    test("only ONE Razorpay key set is the same as none", async () => {
      delete process.env.RAZORPAY_KEY_SECRET;
      assert.equal((await geo(inUser)).currency, "USD");
      process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
      delete process.env.RAZORPAY_KEY_ID;
      assert.equal((await geo(inUser)).currency, "USD");
      process.env.RAZORPAY_KEY_SECRET = "   ";
      process.env.RAZORPAY_KEY_ID = KEY_ID;
      assert.equal((await geo(inUser)).currency, "USD");
    });

    test("MULTI_CURRENCY_ENABLED off -> USD for everyone, even with Razorpay keys set", async () => {
      flag(false);
      assert.equal((await geo(inUser)).currency, "USD");
      assert.equal((await geo(deUser)).currency, "USD");
      const rp = await post("/api/razorpay/create-order", inUser, { priceType: "category", priceRef: "general-care" });
      assert.equal(rp.status, 400);
      assert.equal(rpCreated.length, 0);
    });

    test("the gateway/currency table: INR only on Razorpay, the others never on Razorpay", () => {
      for (const gw of ["stripe", "paypal"]) {
        for (const cur of ["USD", "EUR", "GBP"]) assert.equal(cfg.gatewayAllowsCurrency(gw, cur), true, `${gw} ${cur}`);
        assert.equal(cfg.gatewayAllowsCurrency(gw, "INR"), false, `${gw} INR`);
      }
      assert.equal(cfg.gatewayAllowsCurrency("razorpay", "INR"), true);
      for (const cur of ["USD", "EUR", "GBP", "JPY", ""]) assert.equal(cfg.gatewayAllowsCurrency("razorpay", cur), false, `razorpay ${cur}`);
      assert.equal(cfg.gatewayAllowsCurrency("nope", "USD"), false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/razorpay/create-order", () => {
    const create = (user, body = { priceType: "category", priceRef: "general-care" }) => post("/api/razorpay/create-order", user, body);

    test("an Indian customer gets an INR order for the stored INR price, in paise, with the public key id", async () => {
      const r = await create(inUser);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { orderId: "order_NEW000001", amountCents: 99900, currency: "INR", keyId: KEY_ID });
      assert.equal(rpCreated.length, 1);
      const sent = rpCreated[0];
      assert.equal(sent.amount, 99900);
      assert.equal(sent.currency, "INR");
      assert.equal(sent.payment_capture, 1);
      assert.deepEqual(sent.notes, { priceType: "category", priceRef: "general-care", userId: String(inUser._id) });
      assert.match(sent.receipt, /^hc_[a-f0-9]{8}_[a-z0-9]+$/);
      assert.ok(sent.receipt.length <= 40);
    });

    test("the key SECRET is never returned", async () => {
      const r = await create(inUser);
      assert.equal(JSON.stringify(r.body).includes(KEY_SECRET), false);
    });

    test("a client-sent amount or currency is ignored: the server's INR price is used", async () => {
      const r = await create(inUser, { priceType: "category", priceRef: "general-care", amount: 1, amountCents: 1, currency: "USD", priceInr: 1 });
      assert.equal(r.status, 200);
      assert.equal(rpCreated[0].amount, 99900);
      assert.equal(rpCreated[0].currency, "INR");
    });

    test("Razorpay with a non-Indian customer is refused (EUR, GBP, USD), and Razorpay is never called", async () => {
      for (const user of [deUser, gbUser, usUser]) {
        const r = await create(user);
        assert.equal(r.status, 400, user.country);
        assert.match(r.body.msg, /only takes INR/);
      }
      assert.equal(rpCreated.length, 0);
    });

    test("a category with no INR price: Razorpay is refused (the customer would be charged USD, which Razorpay never takes)", async () => {
      const r = await create(inUser, { priceType: "category", priceRef: "old-care" });
      assert.equal(r.status, 400);
      assert.equal(rpCreated.length, 0);
      assert.ok(warnings.some((w) => w.includes("CURRENCY_FALLBACK_USED") && w.includes("wanted=INR")));
    });

    test("a service with no INR price cannot be paid with Razorpay (it is charged in USD)", async () => {
      const r = await create(inUser, { priceType: "service", priceRef: "fit-to-fly" });
      assert.equal(r.status, 400);
      assert.equal(rpCreated.length, 0);
    });

    test("unknown or malformed categories, objects and long strings are refused without a Razorpay call", async () => {
      for (const priceRef of ["nope", { $gt: "" }, ["general-care"], "x".repeat(5000), "", null, 42, { $ne: null }]) {
        const r = await create(inUser, { priceType: "category", priceRef });
        assert.equal(r.status, 400, JSON.stringify(priceRef).slice(0, 30));
        assert.equal(rpCreated.length, 0);
      }
      for (const priceType of ["service", undefined, { $gt: "" }, "CATEGORY", ""]) {
        const r = await create(inUser, { priceType, priceRef: "general-care" });
        assert.equal(r.status, 400, JSON.stringify(priceType));
      }
      assert.equal(rpCreated.length, 0);
    });

    test("not logged in -> 401", async () => {
      const r = await create(null);
      assert.equal(r.status, 401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("gateway mismatch is rejected both ways", () => {
    test("Stripe create-intent for an Indian customer (INR) is refused before Stripe is called", async () => {
      const r = await post("/api/payments/create-intent-by-amount", inUser, { priceType: "category", priceRef: "general-care" });
      assert.equal(r.status, 400);
      assert.match(r.body.msg, /through Razorpay/);
      assert.equal(stripeCreated.length, 0);
    });

    test("PayPal create-order for an Indian customer (INR) is refused before PayPal is called", async () => {
      const r = await post("/api/paypal/create-order-by-amount", inUser, { priceType: "category", priceRef: "general-care" });
      assert.equal(r.status, 400);
      assert.match(r.body.msg, /through Razorpay/);
      assert.equal(paypalCreated.length, 0);
    });

    test("an Indian customer can still pay a service that has no INR price (charged in USD) with Stripe (the gateway follows the currency of the charge)", async () => {
      const r = await post("/api/payments/create-intent-by-amount", inUser, { priceType: "service", priceRef: "fit-to-fly" });
      assert.deepEqual([r.status, r.body.currency, r.body.amountCents], [200, "USD", 6900]);
    });

    test("EUR / GBP / USD customers still get Stripe and PayPal exactly as before", async () => {
      const eur = await post("/api/payments/create-intent-by-amount", deUser, { priceType: "category", priceRef: "general-care" });
      assert.deepEqual([eur.status, eur.body.currency, eur.body.amountCents], [200, "EUR", 3000]);
      const gbp = await post("/api/paypal/create-order-by-amount", gbUser, { priceType: "category", priceRef: "general-care" });
      assert.deepEqual([gbp.status, gbp.body.currency, gbp.body.amountCents], [200, "GBP", 2500]);
      const usd = await post("/api/payments/create-intent-by-amount", usUser, { priceType: "category", priceRef: "general-care" });
      assert.deepEqual([usd.status, usd.body.currency, usd.body.amountCents], [200, "USD", 1000]);
    });

    test("verification: a Stripe intent or a PayPal order taken in INR is rejected, whatever it is for", async () => {
      stripeIntents.pi_inr = { id: "pi_inr", status: "succeeded", currency: "inr", amount: 99900 };
      await rejects(pv.verifyCategoryPayment({ paymentIntentId: "pi_inr", priceRef: "general-care" }), /through Razorpay/);
      await rejects(pv.verifyStripePaymentIntent({ paymentIntentId: "pi_inr", expectedCents: 99900, expectedCurrency: "INR" }), /through Razorpay/);
      paypalOrders.O_inr = { id: "O_inr", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ amount: { value: "999.00", currency_code: "INR" } }] } }] };
      await rejects(pv.verifyCategoryPayment({ paypalOrderId: "O_inr", priceRef: "general-care" }), /through Razorpay/);
      await rejects(pv.verifyPaypalOrder({ paypalOrderId: "O_inr", expectedCents: 99900, expectedCurrency: "INR" }), /through Razorpay/);
    });

    test("verification: a Razorpay payment can never fund a USD / EUR / GBP price", async () => {
      const p = paid(inUser);
      await rejects(pv.verifyRazorpayPayment({ ...p, expectedCents: 1000, expectedCurrency: "USD", patientId: inUser._id }), /only takes INR/);
      await rejects(pv.verifyRazorpayPayment({ ...p, expectedCents: 3000, expectedCurrency: "EUR", patientId: inUser._id }), /only takes INR/);
      await rejects(pv.verifyRazorpayPayment({ ...p, expectedCents: 2500, expectedCurrency: "gbp", patientId: inUser._id }), /only takes INR/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("verifyCategoryPayment with Razorpay", () => {
    const verify = (user, extra) =>
      pv.verifyCategoryPayment({ priceRef: "general-care", patientId: user._id, ...extra });

    test("a valid, captured, signed payment for the right amount passes", async () => {
      const p = paid(inUser);
      const v = await verify(inUser, p);
      assert.deepEqual(v, {
        ref: "pay_TEST0001",
        amountCents: 99900,
        currency: "INR",
        gateway: "razorpay",
        razorpayOrderId: "order_TEST0001",
        razorpayPaymentId: "pay_TEST0001",
      });
    });

    test("a tampered signature is rejected (changed digit, wrong secret, uppercase is still just the same signature)", async () => {
      const good = sign("order_TEST0001", "pay_TEST0001");
      const flipped = (good[0] === "a" ? "b" : "a") + good.slice(1);
      for (const signature of [flipped, sign("order_TEST0001", "pay_TEST0001", "another-secret"), good.slice(0, -1), good + "0", "", "not-hex", "0".repeat(64)]) {
        const p = paid(inUser, { signature });
        await rejects(verify(inUser, p), /signature is invalid/, 400);
      }
      const ok = paid(inUser, { signature: good.toUpperCase() });
      assert.equal((await verify(inUser, ok)).gateway, "razorpay");
    });

    test("a missing, non-string or object signature is rejected", async () => {
      for (const signature of [undefined, null, 123, { $gt: "" }, ["x"]]) {
        const p = paid(inUser, { signature });
        await rejects(verify(inUser, p), /signature is invalid/);
      }
    });

    test("a signature made for another order or another payment does not validate this one", async () => {
      const p = paid(inUser);
      await rejects(verify(inUser, { ...p, razorpaySignature: sign("order_OTHER001", "pay_TEST0001") }), /signature is invalid/);
      await rejects(verify(inUser, { ...p, razorpaySignature: sign("order_TEST0001", "pay_OTHER001") }), /signature is invalid/);
    });

    test("wrong order id: the payment belongs to a different order than the one signed", async () => {
      const p = paid(inUser, { paymentOrderId: "order_ELSE0001" });
      await rejects(verify(inUser, p), /does not belong to this order/);
    });

    test("an order id that does not exist at Razorpay is rejected", async () => {
      const p = paid(inUser);
      delete rpOrders.order_TEST0001;
      await rejects(verify(inUser, p), /Invalid Razorpay payment reference/);
    });

    test("wrong amount: a payment (and order) for less than the INR price is rejected", async () => {
      await rejects(verify(inUser, paid(inUser, { amount: 50000 })), /amount does not match/);
      await rejects(verify(inUser, paid(inUser, { paymentId: "pay_TEST0002", orderId: "order_TEST0002", amount: 1 })), /amount does not match/);
      // order says one amount, payment another
      await rejects(verify(inUser, paid(inUser, { paymentId: "pay_TEST0003", orderId: "order_TEST0003", amount: 99900, orderAmount: 100 })), /amount does not match/);
    });

    test("wrong currency: a USD / EUR payment is rejected", async () => {
      await rejects(verify(inUser, paid(inUser, { currency: "USD" })), /only takes INR/);
      await rejects(verify(inUser, paid(inUser, { paymentId: "pay_TEST0002", orderId: "order_TEST0002", currency: "EUR" })), /only takes INR/);
      await rejects(verify(inUser, paid(inUser, { paymentId: "pay_TEST0003", orderId: "order_TEST0003", orderCurrency: "USD" })), /only takes INR/);
    });

    test("unpaid / failed / merely authorized payments are rejected", async () => {
      for (const [i, status] of ["created", "authorized", "failed", "refunded"].entries()) {
        const p = paid(inUser, { paymentId: `pay_STATUS0${i}`, orderId: `order_STATUS0${i}`, status });
        await rejects(verify(inUser, p), /not completed/, 402);
      }
    });

    test("a payment that was refunded is rejected", async () => {
      await rejects(verify(inUser, paid(inUser, { extra: { amount_refunded: 99900, refund_status: "full" } })), /refunded/);
      await rejects(verify(inUser, paid(inUser, { paymentId: "pay_TEST0002", orderId: "order_TEST0002", extra: { amount_refunded: 100 } })), /refunded/);
    });

    test("another user's payment is rejected, even though it is real, signed and for the right amount", async () => {
      const theirs = paid(deUser, { ownerId: deUser._id });
      await rejects(verify(inUser, theirs), /different account/, 403);
      // and a payment whose order carries no owner at all
      const p = paid(inUser);
      delete rpOrders.order_TEST0001.notes;
      await rejects(verify(inUser, p), /different account/, 403);
    });

    test("references that are not Razorpay ids (objects, arrays, long strings, other prefixes) are rejected before any call", async () => {
      const p = paid(inUser);
      const bad = [{ $gt: "" }, ["pay_TEST0001"], "pay_" + "x".repeat(500), "x_TEST0001", "", "pay_TEST0001; drop", 42];
      for (const value of bad) {
        await rejects(verify(inUser, { ...p, razorpayPaymentId: value }), /Invalid Razorpay payment reference|exactly one/);
        await rejects(verify(inUser, { ...p, razorpayOrderId: value }), /Invalid Razorpay payment reference|exactly one/);
      }
    });

    test("an unknown payment id at Razorpay is rejected", async () => {
      const p = paid(inUser);
      delete rpPayments.pay_TEST0001;
      await rejects(verify(inUser, p), /Invalid Razorpay payment reference/);
    });

    test("a category with no INR price cannot be verified with Razorpay", async () => {
      const p = paid(inUser);
      // The category is charged in USD (its INR price is not set), which Razorpay never takes: refused, never converted.
      await rejects(pv.verifyCategoryPayment({ ...p, priceRef: "old-care", patientId: inUser._id }), /only takes INR/, 400);
      await rejects(pv.verifyCategoryPayment({ ...p, priceRef: "no-such-category", patientId: inUser._id }), /Unrecognized category/, 400);
    });

    test("Razorpay keys missing -> 503, and nothing is fetched", async () => {
      const p = paid(inUser);
      keys(false);
      await rejects(verify(inUser, p), /not available/, 503);
    });

    test("exactly one payment reference: Razorpay + Stripe, Razorpay + PayPal, or none, is rejected", async () => {
      const p = paid(inUser);
      stripeIntents.pi_x = { id: "pi_x", status: "succeeded", currency: "usd", amount: 1000 };
      await rejects(verify(inUser, { ...p, paymentIntentId: "pi_x" }), /exactly one/);
      await rejects(verify(inUser, { ...p, paypalOrderId: "O_x" }), /exactly one/);
      await rejects(verify(inUser, {}), /exactly one/);
    });

    test("a Stripe USD payment still verifies for a USD category booking (nothing changed for the other gateways)", async () => {
      stripeIntents.pi_ok = { id: "pi_ok", status: "succeeded", currency: "usd", amount: 1000 };
      const v = await pv.verifyCategoryPayment({ paymentIntentId: "pi_ok", priceRef: "general-care" });
      assert.deepEqual([v.gateway, v.currency, v.amountCents], ["stripe", "USD", 1000]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("booking finalisation with Razorpay", () => {
    const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    const makeRes = () => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      return res;
    };
    const reqFor = (user, body) => { lastUser = String(user._id); return { headers: {}, body, user: { id: lastUser }, app: { get: () => null } }; };
    const consultationBody = (extra) => ({
      concern: "Cough", duration: "1 week", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
      categoryName: "General Care", categoryId: "general-care", specialtyName: "GP", conditionName: "Cough", ...extra,
    });
    const appointmentBody = (extra) => ({
      date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", categoryId: "general-care",
      specialty: "GP", condition: "Cough", consultationPrice: 50, patientDetails: { firstName: "T" }, ...extra,
    });
    const tick = () => new Promise((r) => setTimeout(r, 60));

    test("category consultation: stored as razorpay / inr / 99900 with both Razorpay ids, price in rupees, and the invoice gets them", async () => {
      const res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultationBody(paid(inUser))), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual(
        [stored.paymentGateway, stored.paymentCurrency, stored.paymentAmount, stored.consultationPrice, stored.paymentStatus, stored.paymentIntentId],
        ["razorpay", "inr", 99900, 999, "paid", "pay_TEST0001"],
      );
      assert.deepEqual([stored.razorpayOrderId, stored.razorpayPaymentId], ["order_TEST0001", "pay_TEST0001"]);
      await tick();
      assert.equal(invoiceCalls.length, 1);
      const call = invoiceCalls[0];
      assert.deepEqual(
        [call.gateway, call.currency, call.amountCents, call.gatewayReference, call.razorpayOrderId, call.razorpayPaymentId],
        ["razorpay", "inr", 99900, "pay_TEST0001", "order_TEST0001", "pay_TEST0001"],
      );
    });

    test("one payment = one booking: reusing it is a 409 and creates nothing", async () => {
      const p = paid(inUser);
      let res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultationBody(p)), res);
      assert.equal(res.statusCode, 201);
      res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultationBody(p)), res);
      assert.equal(res.statusCode, 409);
      res = makeRes();
      await createAppointment(reqFor(inUser, appointmentBody(p)), res);
      assert.equal(res.statusCode, 409);
      assert.equal(await CategoryConsultation.countDocuments(), 1);
      assert.equal(await Appointment.countDocuments(), 0);
      assert.equal(await ConsumedPayment.countDocuments({ gateway: "razorpay" }), 1);
    });

    test("another user's payment cannot be used for a booking (403), and is not consumed", async () => {
      const theirs = paid(deUser, { ownerId: deUser._id });
      const res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultationBody(theirs)), res);
      assert.equal(res.statusCode, 403);
      assert.equal(await CategoryConsultation.countDocuments(), 0);
      assert.equal(await ConsumedPayment.countDocuments(), 0);
    });

    test("tampered signature / wrong amount / wrong currency / unpaid -> rejected with no booking", async () => {
      const cases = [
        [paid(inUser, { signature: "0".repeat(64) }), 400],
        [paid(inUser, { orderId: "order_B0000002", paymentId: "pay_B0000002", amount: 100 }), 400],
        [paid(inUser, { orderId: "order_B0000003", paymentId: "pay_B0000003", currency: "USD" }), 400],
        [paid(inUser, { orderId: "order_B0000004", paymentId: "pay_B0000004", status: "failed" }), 402],
      ];
      for (const [p, status] of cases) {
        const res = makeRes();
        await createCategoryConsultation(reqFor(inUser, consultationBody(p)), res);
        assert.equal(res.statusCode, status, JSON.stringify(res.body));
      }
      assert.equal(await CategoryConsultation.countDocuments(), 0);
      assert.equal(await ConsumedPayment.countDocuments(), 0);
    });

    test("category appointment: stored as razorpay / inr with the charged amount, not the browser price", async () => {
      const res = makeRes();
      await createAppointment(reqFor(inUser, appointmentBody(paid(inUser))), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await Appointment.findById(res.body.appointment._id).lean();
      assert.deepEqual(
        [stored.paymentGateway, stored.paymentCurrency, stored.paymentAmount, stored.consultationPrice, stored.paymentIntentId],
        ["razorpay", "inr", 99900, 999, "pay_TEST0001"],
      );
      assert.deepEqual([stored.razorpayOrderId, stored.razorpayPaymentId], ["order_TEST0001", "pay_TEST0001"]);
      await tick();
      assert.deepEqual([invoiceCalls[0].gateway, invoiceCalls[0].currency, invoiceCalls[0].razorpayOrderId], ["razorpay", "inr", "order_TEST0001"]);
    });

    test("a service booking with no INR price cannot be paid with Razorpay", async () => {
      const res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultationBody({ ...paid(inUser), serviceName: "fit-to-fly" })), res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /only takes INR/);
      assert.equal(await CategoryConsultation.countDocuments(), 0);
    });

    test("a doctor-fee booking (USD) cannot be paid with Razorpay", async () => {
      const res = makeRes();
      await createAppointment(reqFor(inUser, appointmentBody({ ...paid(inUser), doctorId: String(new mongoose.Types.ObjectId()) })), res);
      assert.ok([400, 404].includes(res.statusCode), String(res.statusCode));
      assert.equal(await Appointment.countDocuments(), 0);
      assert.equal(await ConsumedPayment.countDocuments(), 0);
    });

    test("a Stripe USD booking is unchanged and has no Razorpay ids", async () => {
      stripeIntents.pi_u = { id: "pi_u", status: "succeeded", currency: "usd", amount: 1000 };
      const res = makeRes();
      await createCategoryConsultation(reqFor(usUser, consultationBody({ paymentIntentId: "pi_u" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual([stored.paymentGateway, stored.paymentCurrency, stored.razorpayOrderId, stored.razorpayPaymentId], ["stripe", "usd", "", ""]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/razorpay/webhook", () => {
    const captured = (paymentId = "pay_WH000001") => ({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: "order_WH000001", amount: 99900, currency: "INR", status: "captured" } } },
    });
    const refundEvent = (paymentId = "pay_WH000001", amount = 99900) => ({
      event: "refund.processed",
      payload: {
        payment: { entity: { id: paymentId, order_id: "order_WH000001", amount: 99900, currency: "INR" } },
        refund: { entity: { id: "rfnd_WH0001", payment_id: paymentId, amount, currency: "INR" } },
      },
    });

    test("a correctly signed payment.captured is accepted and stored; unclaimed captures are logged for follow-up", async () => {
      const r = await webhook(captured(), { id: "evt_a" });
      assert.deepEqual([r.status, r.body], [200, { received: true }]);
      const row = await RazorpayEvent.findOne({ eventId: "evt_a" }).lean();
      assert.deepEqual([row.event, row.paymentId, row.orderId, row.amount, row.currency, row.claimed], ["payment.captured", "pay_WH000001", "order_WH000001", 99900, "INR", false]);
      assert.ok(warnings.some((w) => w.includes("RAZORPAY_UNCLAIMED_CAPTURE") && w.includes("pay_WH000001")));
    });

    test("a capture that a booking already used is recorded as claimed, with no warning", async () => {
      await ConsumedPayment.create({ gateway: "razorpay", ref: "pay_WH000001", consumedFor: "categoryConsultation" });
      await webhook(captured(), { id: "evt_b" });
      assert.equal((await RazorpayEvent.findOne({ eventId: "evt_b" }).lean()).claimed, true);
      assert.equal(warnings.some((w) => w.includes("RAZORPAY_UNCLAIMED_CAPTURE")), false);
    });

    test("an invalid signature is rejected and nothing is stored", async () => {
      for (const signature of ["0".repeat(64), "", "abc", crypto.createHmac("sha256", "wrong").update(JSON.stringify(captured())).digest("hex")]) {
        const r = await webhook(captured(), { signature, id: "evt_bad" });
        assert.equal(r.status, 400, signature);
      }
      assert.equal(await RazorpayEvent.countDocuments(), 0);
    });

    test("a body altered after signing is rejected", async () => {
      const body = JSON.stringify(captured());
      const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
      const r = await webhook(null, { raw: body.replace("99900", "1"), signature, id: "evt_alt" });
      assert.equal(r.status, 400);
      assert.equal(await RazorpayEvent.countDocuments(), 0);
    });

    test("no webhook secret configured -> 503 (never accepts unsigned events)", async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const r = await webhook(captured(), { id: "evt_c", signature: "x" });
      assert.equal(r.status, 503);
      assert.equal(await RazorpayEvent.countDocuments(), 0);
    });

    test("a signed body that is not JSON, or has no event, is rejected", async () => {
      assert.equal((await webhook(null, { raw: "not json", id: "evt_d" })).status, 400);
      assert.equal((await webhook({ nothing: true }, { id: "evt_e" })).status, 400);
      assert.equal(await RazorpayEvent.countDocuments(), 0);
    });

    test("duplicate delivery of the same event is idempotent: acknowledged, handled once", async () => {
      await Payment.create({ user: inUser._id, gateway: "razorpay", gatewayReference: "pay_WH000001", amountCents: 99900, currency: "inr", razorpayPaymentId: "pay_WH000001" });
      const first = await webhook(refundEvent(), { id: "evt_r1" });
      const second = await webhook(refundEvent(), { id: "evt_r1" });
      const third = await webhook(refundEvent(), { id: "evt_r1" });
      assert.deepEqual(first.body, { received: true });
      assert.deepEqual(second.body, { received: true, duplicate: true });
      assert.deepEqual(third.body, { received: true, duplicate: true });
      assert.equal(await RazorpayEvent.countDocuments({ eventId: "evt_r1" }), 1);
      const payment = await Payment.findOne({ gatewayReference: "pay_WH000001" }).lean();
      assert.equal(payment.refundedAmountCents, 99900, "counted once, not three times");
      assert.ok(payment.refundedAt);
    });

    test("without an event-id header the body hash makes it idempotent too", async () => {
      await webhook(captured("pay_WH000002"), { id: null });
      const again = await webhook(captured("pay_WH000002"), { id: null });
      assert.equal(again.body.duplicate, true);
      assert.equal(await RazorpayEvent.countDocuments(), 1);
    });

    test("refund.processed updates the matching Payment (partial refunds add up); an unknown payment is just recorded", async () => {
      await Payment.create({ user: inUser._id, gateway: "razorpay", gatewayReference: "pay_WH000001", amountCents: 99900, currency: "inr" });
      await webhook(refundEvent("pay_WH000001", 30000), { id: "evt_p1" });
      await webhook(refundEvent("pay_WH000001", 20000), { id: "evt_p2" });
      assert.equal((await Payment.findOne({ gatewayReference: "pay_WH000001" }).lean()).refundedAmountCents, 50000);
      const r = await webhook(refundEvent("pay_UNKNOWN1"), { id: "evt_p3" });
      assert.equal(r.status, 200);
      assert.equal((await RazorpayEvent.findOne({ eventId: "evt_p3" }).lean()).applied, false);
    });

    test("payment.failed and other events are recorded and change nothing", async () => {
      const event = { event: "payment.failed", payload: { payment: { entity: { id: "pay_WH000009", order_id: "order_WH000009", amount: 99900, currency: "INR", status: "failed" } } } };
      const r = await webhook(event, { id: "evt_f" });
      assert.equal(r.status, 200);
      assert.equal((await RazorpayEvent.findOne({ eventId: "evt_f" }).lean()).event, "payment.failed");
      assert.equal(await Payment.countDocuments(), 0);
      assert.equal(await CategoryConsultation.countDocuments(), 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe("signature helpers", () => {
    test("verifyPaymentSignature is HMAC-SHA256 of order_id|payment_id, constant-time", () => {
      const good = sign("order_A1", "pay_B2");
      assert.equal(rz.verifyPaymentSignature({ orderId: "order_A1", paymentId: "pay_B2", signature: good }), true);
      assert.equal(rz.verifyPaymentSignature({ orderId: "order_A1", paymentId: "pay_B2", signature: good.replace(/.$/, "x") }), false);
      assert.equal(rz.verifyPaymentSignature({ orderId: "order_A1", paymentId: "pay_B3", signature: good }), false);
      assert.equal(rz.verifyPaymentSignature({ orderId: "", paymentId: "pay_B2", signature: good }), false);
      assert.equal(rz.verifyPaymentSignature({ orderId: "order_A1", paymentId: "pay_B2", signature: 5 }), false);
    });

    test("without the key secret nothing validates", () => {
      const good = sign("order_A1", "pay_B2");
      keys(false);
      assert.equal(rz.verifyPaymentSignature({ orderId: "order_A1", paymentId: "pay_B2", signature: good }), false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Service bookings (Fit to fly, Lab requisitions, ...) follow the same currency / gateway / ownership / replay rules as categories.
  // "Lab Requisitions" is priced in all four currencies; "Fit to Fly" (see beforeEach) has only its USD price.
  describe("service bookings in four currencies", () => {
    const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    const makeRes = () => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      return res;
    };
    const reqFor = (user, body) => { lastUser = String(user._id); return { headers: {}, body, user: { id: lastUser }, app: { get: () => null } }; };
    const bookingBody = (extra) => ({
      concern: "Letter", duration: "1 day", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
      serviceName: "lab-requisitions", categoryName: "Lab Requisitions", ...extra,
    });
    const book = async (user, extra) => {
      const res = makeRes();
      await createCategoryConsultation(reqFor(user, bookingBody(extra)), res);
      return res;
    };
    const stripePi = (id, currency, amount, extra = {}) => { stripeIntents[id] = { id, status: "succeeded", currency, amount, ...extra }; return id; };
    const paypal = (id, currency, value, extra = {}) => {
      paypalOrders[id] = { id, status: "COMPLETED", ...extra, purchase_units: [{ payments: { captures: [{ amount: { value, currency_code: currency } }] } }] };
      return id;
    };
    const svc = { priceType: "service", priceRef: "lab-requisitions" };

    beforeEach(async () => {
      await ServicePrice.create({ name: "Lab Requisitions", slug: "lab-requisitions", price: 40, priceEur: 36, priceGbp: 32, priceInr: 1499, icon: "i", description: "d" });
    });

    describe("what each customer is charged, and on which gateway", () => {
      test("IN -> ₹1,499 (149900 paise) through Razorpay; the order is for the service and the user", async () => {
        const r = await post("/api/razorpay/create-order", inUser, svc);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual([r.body.amountCents, r.body.currency, r.body.keyId], [149900, "INR", KEY_ID]);
        assert.equal(rpCreated[0].amount, 149900);
        assert.equal(rpCreated[0].currency, "INR");
        assert.deepEqual([rpCreated[0].notes.priceType, rpCreated[0].notes.priceRef, rpCreated[0].notes.userId], ["service", "lab-requisitions", String(inUser._id)]);
      });

      test("IN: Stripe and PayPal are refused for the service (INR must go through Razorpay), and nothing is created", async () => {
        for (const path of ["/api/payments/create-intent-by-amount", "/api/paypal/create-order-by-amount"]) {
          const r = await post(path, inUser, svc);
          assert.equal(r.status, 400, path);
          assert.match(r.body.msg, /through Razorpay/);
        }
        assert.equal(stripeCreated.length + paypalCreated.length, 0);
      });

      test("DE -> €36 and GB -> £32 on Stripe and PayPal; US -> $40; Razorpay is refused for all three", async () => {
        for (const [user, currency, cents, stripeCur] of [[deUser, "EUR", 3600, "eur"], [gbUser, "GBP", 3200, "gbp"], [usUser, "USD", 4000, "usd"]]) {
          const s = await post("/api/payments/create-intent-by-amount", user, svc);
          assert.deepEqual([s.status, s.body.currency, s.body.amountCents], [200, currency, cents], currency);
          assert.equal(stripeCreated.at(-1).currency, stripeCur);
          const p = await post("/api/paypal/create-order-by-amount", user, svc);
          assert.deepEqual([p.status, p.body.currency, p.body.amountCents], [200, currency, cents], currency);
          assert.equal(paypalCreated.at(-1).purchase_units[0].amount.currency_code, currency);
          const rp = await post("/api/razorpay/create-order", user, svc);
          assert.equal(rp.status, 400, currency);
        }
        assert.equal(rpCreated.length, 0);
      });

      test("a service with no EUR / GBP / INR price is charged its USD price, labelled USD, with [CURRENCY_FALLBACK_USED]; Razorpay is refused", async () => {
        const fly = { priceType: "service", priceRef: "fit-to-fly" };
        for (const user of [deUser, gbUser, inUser]) {
          const r = await post("/api/payments/create-intent-by-amount", user, fly);
          assert.deepEqual([r.status, r.body.currency, r.body.amountCents], [200, "USD", 6900]);
        }
        assert.equal(warnings.filter((w) => /CURRENCY_FALLBACK_USED/.test(w) && /fit-to-fly/.test(w)).length, 3);
        assert.ok(warnings.some((w) => /wanted=INR used=USD/.test(w)));
        assert.equal((await post("/api/razorpay/create-order", inUser, fly)).status, 400);
        assert.equal(rpCreated.length, 0);
      });

      test("flag off: every customer, Indian included, is charged USD on Stripe / PayPal and never sent to Razorpay", async () => {
        flag(false);
        for (const user of [inUser, deUser, gbUser]) {
          const r = await post("/api/payments/create-intent-by-amount", user, svc);
          assert.deepEqual([r.body.currency, r.body.amountCents], ["USD", 4000]);
        }
        assert.equal((await post("/api/razorpay/create-order", inUser, svc)).status, 400);
      });

      test("Razorpay keys missing: an Indian customer pays USD on Stripe", async () => {
        keys(false);
        const r = await post("/api/payments/create-intent-by-amount", inUser, svc);
        assert.deepEqual([r.status, r.body.currency, r.body.amountCents], [200, "USD", 4000]);
        assert.equal((await post("/api/razorpay/create-order", inUser, svc)).status, 503);
      });

      test("the doctor-fee Razorpay path is not opened: only category and service are accepted", async () => {
        for (const priceType of ["doctor", "fee", undefined]) {
          assert.equal((await post("/api/razorpay/create-order", inUser, { priceType, priceRef: "lab-requisitions" })).status, 400, String(priceType));
        }
      });
    });

    describe("booking: the payment must match the service price in its own currency", () => {
      test("IN pays through Razorpay: stored as inr / razorpay with the paise and the ids, and invoiced in inr", async () => {
        const res = await book(inUser, paid(inUser, { amount: 149900 }));
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        const stored = await CategoryConsultation.findById(res.body.data._id).lean();
        assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.paymentGateway], ["inr", 149900, "razorpay"]);
        assert.deepEqual([stored.razorpayOrderId, stored.razorpayPaymentId], ["order_TEST0001", "pay_TEST0001"]);
        await new Promise((r) => setTimeout(r, 60));
        assert.deepEqual([invoiceCalls[0].currency, invoiceCalls[0].amountCents], ["inr", 149900]);
      });

      test("DE Stripe EUR, GB PayPal GBP and US Stripe USD are stored in their own currency", async () => {
        let res = await book(deUser, { paymentIntentId: stripePi("pi_de", "eur", 3600) });
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        let stored = await CategoryConsultation.findById(res.body.data._id).lean();
        assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.paymentGateway], ["eur", 3600, "stripe"]);

        res = await book(gbUser, { paypalOrderId: paypal("O_gb", "GBP", "32.00") });
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        stored = await CategoryConsultation.findById(res.body.data._id).lean();
        assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.paymentGateway], ["gbp", 3200, "paypal"]);

        res = await book(usUser, { paymentIntentId: stripePi("pi_us", "usd", 4000) });
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        assert.equal((await CategoryConsultation.findById(res.body.data._id).lean()).paymentCurrency, "usd");
      });

      test("a service with no foreign price is booked in USD by anyone (the fallback), and not with the foreign amount", async () => {
        let res = await book(deUser, { serviceName: "fit-to-fly", paymentIntentId: stripePi("pi_fly", "usd", 6900) });
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        assert.equal((await CategoryConsultation.findById(res.body.data._id).lean()).paymentCurrency, "usd");
        res = await book(deUser, { serviceName: "fit-to-fly", paymentIntentId: stripePi("pi_fly_eur", "eur", 6900) });
        assert.equal(res.statusCode, 400, "no EUR price exists, so a EUR payment cannot be valid");
        // and Razorpay cannot pay for it: it has no INR price
        res = await book(inUser, { serviceName: "fit-to-fly", ...paid(inUser, { amount: 6900, paymentId: "pay_FLY00001", orderId: "order_FLY00001" }) });
        assert.equal(res.statusCode, 400);
      });

      test("a wrong amount or the USD amount paid in another currency is refused, and nothing is created or consumed", async () => {
        const cases = [
          { paymentIntentId: stripePi("pi_low", "eur", 1000) }, // the USD-ish amount in EUR
          { paymentIntentId: stripePi("pi_usd_for_de", "usd", 3600) }, // right number, but USD has price 4000
          { paymentIntentId: stripePi("pi_jpy", "jpy", 3600) },
          { paypalOrderId: paypal("O_low", "GBP", "1.00") },
        ];
        for (const extra of cases) assert.equal((await book(deUser, extra)).statusCode, 400, JSON.stringify(extra));
        assert.equal((await book(inUser, paid(inUser, { amount: 99900 }))).statusCode, 400, "Razorpay wrong amount");
        assert.equal(await CategoryConsultation.countDocuments({}), 0);
        assert.equal(await ConsumedPayment.countDocuments({}), 0);
      });

      test("gateway mismatch: INR on Stripe / PayPal and a non-INR Razorpay payment are refused", async () => {
        let res = await book(inUser, { paymentIntentId: stripePi("pi_inr", "inr", 149900) });
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /through Razorpay/);
        res = await book(inUser, { paypalOrderId: paypal("O_inr", "INR", "1499.00") });
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /through Razorpay/);
        res = await book(deUser, paid(deUser, { amount: 3600, currency: "USD", orderCurrency: "USD" }));
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /only takes INR/);
        assert.equal(await CategoryConsultation.countDocuments({}), 0);
      });

      test("another user's paid payment is refused (403): Stripe, PayPal and Razorpay", async () => {
        let res = await book(deUser, { paymentIntentId: stripePi("pi_theirs", "eur", 3600, { __owner: String(gbUser._id) }) });
        assert.equal(res.statusCode, 403, JSON.stringify(res.body));
        res = await book(deUser, { paypalOrderId: paypal("O_theirs", "EUR", "36.00", { __owner: String(gbUser._id) }) });
        assert.equal(res.statusCode, 403);
        res = await book(inUser, paid(inUser, { amount: 149900, ownerId: String(deUser._id) }));
        assert.equal(res.statusCode, 403);
        res = await book(deUser, { paymentIntentId: stripePi("pi_noowner", "eur", 3600, { __owner: null }) });
        assert.equal(res.statusCode, 403, "no owner recorded");
        assert.equal(await CategoryConsultation.countDocuments({}), 0);
        assert.equal(await ConsumedPayment.countDocuments({}), 0);
      });

      test("a payment cannot be used twice (409), for Stripe and Razorpay", async () => {
        const stripeRef = stripePi("pi_once", "eur", 3600);
        assert.equal((await book(deUser, { paymentIntentId: stripeRef })).statusCode, 201);
        const again = await book(deUser, { paymentIntentId: stripeRef });
        assert.equal(again.statusCode, 409);
        const rp = paid(inUser, { amount: 149900, paymentId: "pay_ONCE0001", orderId: "order_ONCE0001" });
        assert.equal((await book(inUser, rp)).statusCode, 201);
        assert.equal((await book(inUser, rp)).statusCode, 409);
        assert.equal(await CategoryConsultation.countDocuments({}), 2);
      });

      test("a Razorpay payment for a category cannot fund a service (and the other way round): the amount decides", async () => {
        // General Care costs ₹999; the service costs ₹1,499.
        const res = await book(inUser, paid(inUser, { amount: 99900, paymentId: "pay_CAT00001", orderId: "order_CAT00001" }));
        assert.equal(res.statusCode, 400);
      });

      test("flag off: an Indian customer pays USD on Stripe, as before", async () => {
        flag(false);
        const res = await book(inUser, { paymentIntentId: stripePi("pi_off", "usd", 4000) });
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        assert.equal((await CategoryConsultation.findById(res.body.data._id).lean()).paymentCurrency, "usd");
      });

      test("an unknown service is refused with the existing message", async () => {
        const res = await book(deUser, { serviceName: "nope", paymentIntentId: stripePi("pi_unk", "eur", 3600) });
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /Unrecognized service/);
      });
    });

    describe("resolveServiceFeeCents", () => {
      test("returns { amountMinor, currency } in the wanted currency, by slug or name, with no conversion", async () => {
        assert.deepEqual(await pv.resolveServiceFeeCents("lab-requisitions"), { amountMinor: 4000, currency: "USD" });
        assert.deepEqual(await pv.resolveServiceFeeCents("lab-requisitions", { currency: "EUR" }), { amountMinor: 3600, currency: "EUR" });
        assert.deepEqual(await pv.resolveServiceFeeCents("Lab Requisitions", { currency: "GBP" }), { amountMinor: 3200, currency: "GBP" });
        assert.deepEqual(await pv.resolveServiceFeeCents("lab-requisitions", { currency: "INR" }), { amountMinor: 149900, currency: "INR" });
        assert.equal(await pv.resolveServiceFeeCents("nope", { currency: "EUR" }), null);
        assert.equal(await pv.resolveServiceFeeCents("", { currency: "EUR" }), null);
      });

      test("a missing price falls back to USD, labelled USD, and is logged", async () => {
        warnings.length = 0;
        assert.deepEqual(await pv.resolveServiceFeeCents("fit-to-fly", { currency: "INR" }), { amountMinor: 6900, currency: "USD" });
        assert.ok(warnings.some((w) => /\[CURRENCY_FALLBACK_USED\] wanted=INR used=USD/.test(w)));
        assert.deepEqual(await pv.resolveServiceFeeCents("fit-to-fly"), { amountMinor: 6900, currency: "USD" });
        assert.equal(warnings.length, 1, "USD logs nothing");
      });

      test("an unsupported currency is treated as USD", async () => {
        assert.deepEqual(await pv.resolveServiceFeeCents("lab-requisitions", { currency: "JPY" }), { amountMinor: 4000, currency: "USD" });
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The currency follows the IP the request comes from - not the profile country. A patient from India who is in the UK consults a UK
  // doctor and pays the UK price; a UK patient who is in India pays in rupees.
  describe("the IP decides the currency, at payment time too", () => {
    const UK_IP = ipFor("United Kingdom");
    const IN_IP = ipFor("India");
    const DE_IP = ipFor("Germany");
    const cat = { priceType: "category", priceRef: "general-care" };
    const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    const makeRes = () => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      return res;
    };
    const reqFor = (user, body) => { lastUser = String(user._id); return { headers: {}, body, user: { id: lastUser }, app: { get: () => null } }; };
    const consultation = (extra) => ({
      concern: "Cough", duration: "1 week", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
      categoryName: "General Care", categoryId: "general-care", specialtyName: "GP", conditionName: "Cough", ...extra,
    });

    test("profile India, request from a UK IP -> GBP, and only Stripe / PayPal (never Razorpay)", async () => {
      // inUser's profile country is India
      assert.deepEqual(await geo(inUser, UK_IP), { currency: "GBP", country: "GB", source: "ip" });
      const stripe = await post("/api/payments/create-intent-by-amount", inUser, cat, UK_IP);
      assert.deepEqual([stripe.status, stripe.body.currency, stripe.body.amountCents], [200, "GBP", 2500]);
      assert.equal(stripeCreated.at(-1).currency, "gbp");
      assert.equal(stripeCreated.at(-1).metadata.currency, "GBP", "the currency is stored on the intent");
      const paypal = await post("/api/paypal/create-order-by-amount", inUser, cat, UK_IP);
      assert.deepEqual([paypal.status, paypal.body.currency, paypal.body.amountCents], [200, "GBP", 2500]);
      assert.equal(paypalCreated.at(-1).purchase_units[0].amount.currency_code, "GBP");
      const rp = await post("/api/razorpay/create-order", inUser, cat, UK_IP);
      assert.equal(rp.status, 400);
      assert.match(rp.body.msg, /only takes INR/);
      assert.equal(rpCreated.length, 0);
    });

    test("profile United Kingdom, request from an Indian IP -> INR, and only Razorpay", async () => {
      assert.deepEqual(await geo(gbUser, IN_IP), { currency: "INR", country: "IN", source: "ip" });
      const rp = await post("/api/razorpay/create-order", gbUser, cat, IN_IP);
      assert.equal(rp.status, 200, JSON.stringify(rp.body));
      assert.deepEqual([rp.body.currency, rp.body.amountCents], ["INR", 99900]);
      assert.equal(rpCreated[0].currency, "INR");
      assert.equal(rpCreated[0].notes.userId, String(gbUser._id));
      for (const path of ["/api/payments/create-intent-by-amount", "/api/paypal/create-order-by-amount"]) {
        const r = await post(path, gbUser, cat, IN_IP);
        assert.equal(r.status, 400, path);
        assert.match(r.body.msg, /through Razorpay/);
      }
      assert.equal(stripeCreated.length + paypalCreated.length, 0);
    });

    test("the profile country is not consulted at all: the same IP gives the same charge whatever the profile says", async () => {
      for (const user of [inUser, deUser, gbUser, usUser]) {
        const r = await post("/api/payments/create-intent-by-amount", user, cat, DE_IP);
        assert.deepEqual([r.body.currency, r.body.amountCents], ["EUR", 3000], user.country);
      }
    });

    test("a service is decided the same way (profile India from the UK -> GBP)", async () => {
      await ServicePrice.create({ name: "Lab Requisitions", slug: "lab-requisitions", price: 40, priceEur: 36, priceGbp: 32, priceInr: 1499, icon: "i", description: "d" });
      const r = await post("/api/payments/create-intent-by-amount", inUser, { priceType: "service", priceRef: "lab-requisitions" }, UK_IP);
      assert.deepEqual([r.body.currency, r.body.amountCents], ["GBP", 3200]);
    });

    test("an unknown, private or unplaceable IP is USD (Stripe / PayPal), even for a profile in India", async () => {
      for (const ip of ["10.0.0.5", "192.168.1.9", "203.0.113.44", "127.0.0.1", "8.8.4.4" /* the reader has no data for it */]) {
        assert.deepEqual(await geo(inUser, ip), { currency: "USD", country: "", source: "default" }, ip);
        const r = await post("/api/payments/create-intent-by-amount", inUser, cat, ip);
        assert.deepEqual([r.status, r.body.currency, r.body.amountCents], [200, "USD", 1000], ip);
        assert.equal((await post("/api/razorpay/create-order", inUser, cat, ip)).status, 400, ip);
      }
    });

    test("a spoofed address cannot buy a cheaper or different currency: only the proxy-reported client address counts", async () => {
      // one trusted proxy hop: the proxy appended the real client (the UK); the client put an Indian address in front
      const spoofed = `${IN_IP}, ${UK_IP}`;
      const r = await post("/api/payments/create-intent-by-amount", usUser, cat, spoofed);
      assert.deepEqual([r.body.currency, r.body.amountCents], ["GBP", 2500]);
      const res = await fetch(`${base}/api/payments/create-intent-by-amount`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": UK_IP,
          "cf-connecting-ip": IN_IP,
          "x-real-ip": IN_IP,
          "x-client-ip": IN_IP,
          forwarded: `for=${IN_IP}`,
          "x-test-user": String(usUser._id),
        },
        body: JSON.stringify(cat),
      });
      assert.equal((await res.json()).currency, "GBP", "Cloudflare / other client-IP headers are not trusted by default");
    });

    test("the client cannot name a currency, a country or an amount: the body is not read", async () => {
      const r = await post("/api/payments/create-intent-by-amount", inUser, { ...cat, currency: "INR", country: "IN", amount: 1, countryCode: "IN" }, UK_IP);
      assert.deepEqual([r.body.currency, r.body.amountCents], ["GBP", 2500]);
    });

    test("flag off: every IP is USD, even an Indian one, and Razorpay is never offered", async () => {
      flag(false);
      for (const ip of [IN_IP, UK_IP, DE_IP]) {
        const r = await post("/api/payments/create-intent-by-amount", inUser, cat, ip);
        assert.deepEqual([r.body.currency, r.body.amountCents], ["USD", 1000], ip);
      }
      assert.equal((await post("/api/razorpay/create-order", inUser, cat, IN_IP)).status, 400);
    });

    test("booking finalisation verifies against the currency stored on the payment and does not look at the IP again", async () => {
      // created while the patient was in the UK (GBP)...
      stripeIntents.pi_uk = { id: "pi_uk", status: "succeeded", currency: "gbp", amount: 2500, metadata: { currency: "GBP" } };
      // ...and the patient is in India by the time the booking is sent: the geo answer for them is now INR
      assert.equal((await geo(inUser, IN_IP)).currency, "INR");
      const res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultation({ paymentIntentId: "pi_uk" })), res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await CategoryConsultation.findById(res.body.data._id).lean();
      assert.deepEqual([stored.paymentCurrency, stored.paymentAmount, stored.paymentGateway], ["gbp", 2500, "stripe"]);
    });

    test("a payment in the wrong amount for its own currency is still refused at finalisation", async () => {
      stripeIntents.pi_bad = { id: "pi_bad", status: "succeeded", currency: "gbp", amount: 1000, metadata: { currency: "GBP" } };
      const res = makeRes();
      await createCategoryConsultation(reqFor(inUser, consultation({ paymentIntentId: "pi_bad" })), res);
      assert.equal(res.statusCode, 400);
      assert.equal(await CategoryConsultation.countDocuments({}), 0);
    });
  });
});
