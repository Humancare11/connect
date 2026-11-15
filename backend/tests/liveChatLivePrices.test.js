// The AI's prices come from the Super Admin pricing through the SAME resolvers the booking flow charges with (real routes and models,
// in-memory database): the mapping, the currencies and the USD fallback, the 5-minute cache and its invalidation on a save, the
// audit line for service price changes, the read-only admin list and the report.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: "64b000000000000000000c03", role };
  next();
};

const ServicePrice = require("../models/ServicePrice");
const HealthcareCategory = require("../models/HealthcareCategory");
const { CategoryPricing } = require("../models/CategoryPricing");
const { resolveServiceFeeCents, resolveCategoryFeeCents } = require("../utils/paymentVerification");
const livePricesModule = require("../services/liveChat/livePrices");
const { AI_SERVICES, createLivePrices, formatAmount, sharedLivePrices } = livePricesModule;
const { buildReport } = require("../scripts/liveChatPriceReport");
const { priceChanges } = require("../utils/priceAudit");

const SERVICE_SLUGS = AI_SERVICES.filter((s) => s.source === "service").map((s) => s.ref);

describe("live chat prices come from the Super Admin pricing", () => {
  let replSet, server, base;
  const ENV = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  const saved = {};
  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-role": "superadmin" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  before(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([ServicePrice.init(), HealthcareCategory.init(), CategoryPricing.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/services", require("../routes/services"));
    app.use("/api/pricing", require("../routes/pricing"));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await replSet.stop();
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  beforeEach(async () => {
    await Promise.all([ServicePrice.deleteMany({}), HealthcareCategory.deleteMany({}), CategoryPricing.deleteMany({})]);
    delete process.env.MULTI_CURRENCY_ENABLED;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    sharedLivePrices().invalidate();
  });

  const service = (slug, price, extra = {}) =>
    ServicePrice.create({ name: slug.replace(/-/g, " "), slug, price, icon: "x", description: "d", ...extra });
  const category = async (slug, price, extra = {}) => {
    await HealthcareCategory.create({ name: `Cat ${slug}`, pricingSlug: slug, price: 1, isActive: true });
    await CategoryPricing.create({ categoryId: slug, label: slug, price, ...extra });
  };
  const keyed = (items) => Object.fromEntries(items.map((i) => [i.key, i.text]));

  test("the mapping: service pages read ServicePrice, Mental health and Doctor notes read the category fees", async () => {
    for (const [i, slug] of SERVICE_SLUGS.entries()) await service(slug, 40 + i);
    await category("mental", 15);
    await category("general", 12.5);
    const items = await createLivePrices().forCurrency("USD");
    assert.equal(items.length, AI_SERVICES.length);
    assert.equal(keyed(items)["general-consultation"], "$40");
    assert.equal(keyed(items)["mental-health"], "$15");
    assert.equal(keyed(items)["doctor-notes"], "$12.50", "the /doctors-note page books category=general");
    assert.deepEqual(
      AI_SERVICES.map((s) => [s.key, s.source, s.ref]).filter(([, source]) => source === "category"),
      [["mental-health", "category", "mental"], ["doctor-notes", "category", "general"]],
    );
  });

  test("the numbers are exactly what the booking resolvers charge", async () => {
    await service("general-consultations", 49, { priceEur: 45 });
    await category("general", 12);
    const live = createLivePrices();
    const svc = (await live.forCurrency("EUR")).find((i) => i.key === "general-consultation");
    const fee = await resolveServiceFeeCents("general-consultations", { currency: "EUR" });
    assert.equal(svc.amount * 100, fee.amountMinor);
    assert.equal(svc.currency, fee.currency);
    const cat = (await live.forCurrency("USD")).find((i) => i.key === "doctor-notes");
    const catFee = await resolveCategoryFeeCents("general", { currency: "USD" });
    assert.equal(cat.amount * 100, catFee.amountMinor);
  });

  test("a currency without its own price falls back to USD and says USD, like checkout", async () => {
    await service("fit-to-fly", 69, { priceEur: 63 });
    await service("lab-requisitions", 49);
    const eur = keyed(await createLivePrices().forCurrency("EUR"));
    assert.equal(eur["fit-to-fly"], "€63");
    assert.equal(eur["lab-requisitions"], "$49", "no EUR price yet: the USD price, labelled USD");
  });

  test("INR is quoted only for a currency request of INR; ₹ is formatted with thousands separators", async () => {
    await service("fit-to-fly", 69, { priceInr: 5999 });
    assert.equal(keyed(await createLivePrices().forCurrency("INR"))["fit-to-fly"], "₹5,999");
    assert.equal(formatAmount(49, "USD"), "$49");
    assert.equal(formatAmount(49.5, "GBP"), "£49.50");
    assert.equal(formatAmount(1499, "INR"), "₹1,499");
  });

  test("a missing record, a switched-off category or a zero price is not quoted", async () => {
    await service("fit-to-fly", 69);
    await HealthcareCategory.create({ name: "Mental", pricingSlug: "mental", price: 1, isActive: false });
    await CategoryPricing.create({ categoryId: "mental", label: "mental", price: 15 });
    const items = keyed(await createLivePrices().forCurrency("USD"));
    assert.deepEqual(Object.keys(items), ["fit-to-fly"]);
  });

  test("5-minute cache, and a Super Admin save clears it at once (services and categories)", async () => {
    await service("fit-to-fly", 69);
    await category("general", 12);
    const sample = async () => keyed(await sharedLivePrices().forCurrency("USD"));
    assert.equal((await sample())["fit-to-fly"], "$69");
    const created = await ServicePrice.findOne({ slug: "fit-to-fly" });
    await ServicePrice.updateOne({ _id: created._id }, { $set: { price: 75 } }); // behind the cache's back
    assert.equal((await sample())["fit-to-fly"], "$69", "still cached");
    const saved = await call("PUT", `/api/services/${created._id}`, { name: created.name, icon: "x", description: "d", price: 80 });
    assert.equal(saved.status, 200);
    assert.equal((await sample())["fit-to-fly"], "$80", "the service save invalidated the cache");
    const cat = await call("PUT", "/api/pricing/general", { price: 20 });
    assert.equal(cat.status, 200);
    assert.equal((await sample())["doctor-notes"], "$20", "the category save invalidated the cache");
  });

  test("the cache expires after its time and a failed read keeps the last good list", async () => {
    let t = 0;
    let calls = 0;
    let fail = false;
    const live = createLivePrices({
      now: () => t,
      resolvers: {
        service: async () => {
          calls += 1;
          if (fail) throw new Error("db down");
          return { amountMinor: 4900, currency: "USD" };
        },
        category: async () => null,
      },
    });
    assert.equal((await live.forCurrency("USD")).length, 6);
    const first = calls;
    t += 4 * 60 * 1000;
    await live.forCurrency("USD");
    assert.equal(calls, first, "within 5 minutes: from the cache");
    t += 2 * 60 * 1000;
    fail = true;
    const after = await live.forCurrency("USD");
    assert.ok(calls > first, "after 5 minutes: read again");
    assert.equal(after.length, 6, "a failed read keeps the last good prices");
    const cold = createLivePrices({ resolvers: { service: async () => { throw new Error("db down"); }, category: async () => { throw new Error("db down"); } } });
    assert.equal((await cold.forCurrency("USD")).length, 0, "no cache and no read: nothing is quoted");
  });

  test("two questions at once share one read", async () => {
    let calls = 0;
    const live = createLivePrices({ resolvers: { service: async () => (calls += 1, { amountMinor: 100, currency: "USD" }), category: async () => null } });
    await Promise.all([live.forCurrency("USD"), live.forCurrency("USD"), live.forCurrency("USD")]);
    assert.equal(calls, 6, "6 service lookups once, not three times");
  });

  test("service price create / update / delete write an admin audit line with who and before/after per currency", async () => {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(" "));
    let id;
    try {
      const made = await call("POST", "/api/services", { name: "Fit to fly", icon: "x", description: "d", price: 69, priceEur: 63, priceGbp: 55, priceInr: 5999 });
      assert.equal(made.status, 201);
      id = made.body.service._id;
      await call("PUT", `/api/services/${id}`, { name: "Fit to fly", icon: "x", description: "d", price: 79, priceEur: 63, priceGbp: 55, priceInr: 5999 });
      await call("DELETE", `/api/services/${id}`);
    } finally {
      console.log = original;
    }
    const audit = lines.filter((l) => l.startsWith("[pricing-audit]")).map((l) => JSON.parse(l.slice("[pricing-audit] ".length)));
    assert.deepEqual(audit.map((a) => a.action), ["SERVICE_PRICE_CREATE", "SERVICE_PRICE_UPDATE", "SERVICE_PRICE_DELETE"]);
    assert.ok(audit.every((a) => a.by === "64b000000000000000000c03" && a.at && a.resource === "ServicePrice" && a.slug === "fit-to-fly"));
    assert.deepEqual(audit[0].changes.USD, { from: null, to: 69 });
    assert.deepEqual(audit[1].changes, { USD: { from: 69, to: 79 } }, "only what changed");
    assert.deepEqual(audit[2].changes.USD, { from: 79, to: null });
    assert.equal(JSON.stringify(audit).includes("@"), false, "no patient or email data in the line");
  });

  test("a category price save is logged the same way", async () => {
    await category("general", 12);
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(" "));
    try {
      await call("PUT", "/api/pricing/general", { price: 14, priceEur: 13 });
    } finally {
      console.log = original;
    }
    const entry = JSON.parse(lines.find((l) => l.startsWith("[pricing-audit]")).slice("[pricing-audit] ".length));
    assert.equal(entry.action, "PRICING_UPDATE");
    assert.deepEqual(entry.changes, { USD: { from: 12, to: 14 }, EUR: { from: null, to: 13 } });
  });

  test("priceChanges lists only the currencies that differ", () => {
    assert.deepEqual(priceChanges({ price: 1, priceEur: 2 }, { price: 1, priceEur: 3, priceGbp: 4 }), { EUR: { from: 2, to: 3 }, GBP: { from: null, to: 4 } });
  });

  test("the report: matches, differences, services with no price, services only in the old list, typed prices", () => {
    const text = (key, amount) => ({ key, amount, currency: "USD", text: `$${amount}` });
    const report = buildReport({
      live: { USD: [text("general-consultation", 49), text("prescription-refills", 65)], EUR: [], GBP: [], INR: [] },
      legacy: [{ name: "General consultation", price: 49 }, { name: "Prescription refills", price: 60 }, { name: "Telepsychiatry", price: 99 }],
      businessFacts: "Our consultation is $19.",
      quickOptions: [{ key: "refill", reply: "Refills are $60." }, { key: "live", reply: "" }],
    });
    const by = (key) => report.rows.find((r) => r.def.key === key).status;
    assert.equal(by("general-consultation"), "ok");
    assert.match(by("prescription-refills"), /DIFFERENT \(old list \$60\)/);
    assert.match(by("fit-to-fly"), /NO PRICE/);
    assert.deepEqual(report.legacyOnly.map((p) => p.name), ["Telepsychiatry"]);
    assert.deepEqual(report.typed.map((t) => t.where), ["Business facts", 'Quick option "refill" reply']);
    assert.ok(report.attention > 0);
    assert.equal(buildReport({ live: { USD: AI_SERVICES.map((s) => text(s.key, 10)) }, legacy: AI_SERVICES.map((s) => ({ name: s.name, price: 10 })) }).attention, 0);
  });

  test("the report script only reads: it contains no write or delete call", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "scripts", "liveChatPriceReport.js"), "utf8");
    assert.doesNotMatch(source, /\.(updateOne|updateMany|insertMany|insertOne|create|deleteOne|deleteMany|findOneAndUpdate|findByIdAndUpdate|findOneAndDelete|save|bulkWrite|replaceOne|drop)\s*\(/);
  });
});
