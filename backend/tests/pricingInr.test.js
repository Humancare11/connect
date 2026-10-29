// INR price (India, Razorpay): admin validation, the lock-once-set rule, the higher INR maximum, the public price table,
// the effective-price fallback, and the coverage script. Real routes and models, in-memory database.
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: String(new mongoose.Types.ObjectId()), role };
  next();
};

const { CategoryPricing } = require("../models/CategoryPricing");
const HealthcareCategory = require("../models/HealthcareCategory");
const { resolveEffectiveCategoryPrice } = require("../utils/categoryPricing");
const { findCategoriesMissingCurrencyPrices } = require("../scripts/checkCategoryCurrencyCoverage");
const { parsePrice, maxPriceFor } = require("../utils/currencyConfig");
const pricingRouter = require("../routes/pricing");
const healthcareRouter = require("../routes/healthcareManagement");

describe("INR category price", () => {
  let replSet, server, base;
  const ENV = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  const saved = {};

  const call = async (method, path, body, role = "superadmin") => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const put = (id, body, role) => call("PUT", `/api/pricing/${id}`, body, role);
  const stored = (id) => CategoryPricing.findOne({ categoryId: id }).lean();

  before(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await HealthcareCategory.init();
    await CategoryPricing.init();
    const app = express();
    app.use(express.json());
    app.use("/api/pricing", pricingRouter);
    app.use("/api/superadmin/healthcare", healthcareRouter);
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
    for (const k of ENV) delete process.env[k];
    await CategoryPricing.deleteMany({});
    await HealthcareCategory.deleteMany({});
    // No INR yet / INR already set / EUR and GBP set but no INR.
    await CategoryPricing.create({ categoryId: "usd-only", label: "Usd only", price: 10 });
    await CategoryPricing.create({ categoryId: "all-four", label: "All four", price: 10, priceEur: 9, priceGbp: 8, priceInr: 799 });
    await CategoryPricing.create({ categoryId: "three", label: "Three", price: 10, priceEur: 9, priceGbp: 8 });
  });

  describe("PUT /api/pricing/:categoryId with priceInr", () => {
    test("an INR price can be set on a category that has none, alone or with the others", async () => {
      let r = await put("three", { priceInr: 4999.5 });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await stored("three")).priceInr, 4999.5);
      r = await put("usd-only", { price: 11, priceEur: 10, priceGbp: 9, priceInr: "899" });
      assert.equal(r.status, 200);
      const row = await stored("usd-only");
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [11, 10, 9, 899]);
    });

    test("an INR price already set can be changed but never cleared (null, empty, spaces, 0)", async () => {
      assert.equal((await put("all-four", { priceInr: 850 })).status, 200);
      assert.equal((await stored("all-four")).priceInr, 850);
      for (const bad of [null, "", "   ", 0, "0"]) {
        const r = await put("all-four", { priceInr: bad });
        assert.equal(r.status, 400, JSON.stringify(bad));
      }
      assert.equal((await stored("all-four")).priceInr, 850);
      const r = await put("all-four", { priceInr: null });
      assert.match(r.body.msg, /INR price cannot be cleared once it is set/);
    });

    test("an INR price that is not set yet may be left blank (ignored), like EUR and GBP", async () => {
      let r = await put("three", { price: 12, priceInr: null });
      assert.equal(r.status, 200);
      let row = await stored("three");
      assert.deepEqual([row.price, row.priceInr], [12, undefined]);
      r = await put("three", { priceInr: "" });
      assert.equal(r.status, 400, "nothing to update");
    });

    test("INR allows up to 10,00,000; every other currency stays capped at 100,000", async () => {
      assert.equal((await put("three", { priceInr: 1000000 })).status, 200);
      assert.equal((await stored("three")).priceInr, 1000000);
      const tooBig = await put("three", { priceInr: 1000001 });
      assert.equal(tooBig.status, 400);
      assert.match(tooBig.body.msg, /INR price must not be more than 10,00,000|INR price must not be more than 1,000,000/);
      assert.equal((await put("three", { priceInr: 100001 })).status, 200, "above the USD cap but fine in rupees");
      for (const key of ["price", "priceEur", "priceGbp"]) {
        assert.equal((await put("all-four", { [key]: 100001 })).status, 400, key);
        assert.equal((await put("all-four", { [key]: 100000 })).status, 200, key);
      }
    });

    test("negatives, text, booleans, arrays, objects, NoSQL operators and 3 decimals are rejected for INR", async () => {
      for (const bad of [-1, "abc", true, [5], {}, { $gt: "" }, { $ne: null }, 1.005, "1e3", "0x10", "12,5", "٣٤٥", "9".repeat(400)]) {
        const r = await put("three", { priceInr: bad });
        assert.equal(r.status, 400, JSON.stringify(bad));
      }
      assert.equal((await stored("three")).priceInr, undefined);
    });

    test("a rejected request writes nothing (all-or-nothing), including the other prices", async () => {
      const r = await put("all-four", { price: 99, priceEur: 98, priceInr: -5 });
      assert.equal(r.status, 400);
      const row = await stored("all-four");
      assert.deepEqual([row.price, row.priceEur, row.priceInr], [10, 9, 799]);
    });

    test("only a super admin may change an INR price", async () => {
      assert.equal((await put("three", { priceInr: 500 }, null)).status, 401);
      assert.equal((await put("three", { priceInr: 500 }, "admin")).status, 403);
      assert.equal((await put("three", { priceInr: 500 }, "user")).status, 403);
      assert.equal((await stored("three")).priceInr, undefined);
    });
  });

  describe("POST /api/superadmin/healthcare/categories needs all four prices", () => {
    const create = (body) => call("POST", "/api/superadmin/healthcare/categories", body);
    const valid = { name: "Dental", icon: "", description: "", price: 20, priceEur: 18, priceGbp: 16, priceInr: 1499 };

    test("creates the category with USD, EUR, GBP and INR", async () => {
      const r = await create(valid);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const category = await HealthcareCategory.findOne({ name: "Dental" }).lean();
      const row = await stored(category.pricingSlug);
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr, row.currency], [20, 18, 16, 1499, "USD"]);
    });

    test("each of the four prices is required (INR included), and nothing is created without it", async () => {
      for (const [key, label] of [["price", "USD price"], ["priceEur", "EUR price"], ["priceGbp", "GBP price"], ["priceInr", "INR price"]]) {
        const body = { ...valid, name: `Missing ${key}` };
        delete body[key];
        const r = await create(body);
        assert.equal(r.status, 400, key);
        assert.ok(r.body.msg.startsWith(label), r.body.msg);
      }
      assert.equal(await HealthcareCategory.countDocuments({}), 0);
    });

    test("zero, negative, text and 3 decimals are rejected for INR; the cap is 10,00,000", async () => {
      for (const bad of [0, "0", -3, "x", "", null, 1.005, 1000001, true, { $gt: "" }]) {
        const r = await create({ ...valid, name: "Bad inr", priceInr: bad });
        assert.equal(r.status, 400, JSON.stringify(bad));
      }
      assert.equal((await create({ ...valid, name: "Big inr", priceInr: 1000000 })).status, 201);
      assert.equal((await create({ ...valid, name: "Big usd", price: 100001 })).status, 400);
      assert.equal(await HealthcareCategory.countDocuments({}), 1);
    });

    test("the admin category list returns priceInr, null where not set", async () => {
      await HealthcareCategory.create({ name: "Legacy", price: 10, pricingSlug: "three" });
      await HealthcareCategory.create({ name: "Modern", price: 10, pricingSlug: "all-four" });
      const r = await call("GET", "/api/superadmin/healthcare/categories");
      assert.equal(r.status, 200);
      assert.equal(r.body.find((c) => c.name === "Legacy").priceInr, null);
      assert.equal(r.body.find((c) => c.name === "Modern").priceInr, 799);
    });

    test("only a super admin may create", async () => {
      assert.equal((await call("POST", "/api/superadmin/healthcare/categories", valid, "admin")).status, 403);
    });
  });

  describe("model validator", () => {
    test("a zero, negative or null INR price cannot be stored", async () => {
      await assert.rejects(CategoryPricing.create({ categoryId: "z1", label: "Z", price: 5, priceInr: 0 }), /INR price/);
      await assert.rejects(CategoryPricing.create({ categoryId: "z2", label: "Z", price: 5, priceInr: -1 }), /INR price/);
      await assert.rejects(CategoryPricing.create({ categoryId: "z3", label: "Z", price: 5, priceInr: null }), /INR price/);
    });
  });

  describe("GET /api/pricing: INR appears only when INR is active", () => {
    const get = () => call("GET", "/api/pricing", undefined, null);
    const keys = () => { process.env.RAZORPAY_KEY_ID = "rzp_test_k"; process.env.RAZORPAY_KEY_SECRET = "s"; };

    test("flag off: the old shape, even with Razorpay keys", async () => {
      keys();
      const r = await get();
      assert.deepEqual(Object.keys(r.body["all-four"]).sort(), ["currency", "label", "price"]);
    });

    test("flag on, no Razorpay keys: EUR / GBP only, no priceInr (an Indian visitor is a USD visitor)", async () => {
      process.env.MULTI_CURRENCY_ENABLED = "true";
      const r = await get();
      assert.deepEqual(Object.keys(r.body["all-four"]).sort(), ["currency", "label", "price", "priceEur", "priceGbp"]);
    });

    test("flag on and Razorpay keys set: priceInr is added, null where not set", async () => {
      process.env.MULTI_CURRENCY_ENABLED = "true";
      keys();
      const r = await get();
      assert.equal(r.body["all-four"].priceInr, 799);
      assert.equal(r.body.three.priceInr, null);
      assert.equal(r.body["usd-only"].priceInr, null);
      assert.equal(r.body["all-four"].price, 10);
    });

    test("the super admin list always carries priceInr", async () => {
      const r = await call("GET", "/api/pricing/all");
      assert.equal(r.body.find((x) => x.categoryId === "all-four").priceInr, 799);
    });
  });

  describe("resolveEffectiveCategoryPrice with INR", () => {
    let warnings;
    const realWarn = console.warn;
    beforeEach(() => { warnings = []; console.warn = (...args) => warnings.push(args.join(" ")); });
    afterEach(() => { console.warn = realWarn; });
    const cat = (slug) => ({ _id: "c1", name: slug, pricingSlug: slug, price: 3, currency: "USD" });

    test("INR returns the rupee price with its own currency, no conversion", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("all-four"), undefined, "INR"), { price: 799, currency: "INR" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("all-four"), undefined, "inr"), { price: 799, currency: "INR" });
      assert.equal(warnings.filter((w) => w.includes("CURRENCY_FALLBACK_USED")).length, 0);
    });

    test("a missing INR price falls back to the USD price, labelled USD, and logs it", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("three"), undefined, "INR"), { price: 10, currency: "USD" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("usd-only"), undefined, "INR"), { price: 10, currency: "USD" });
      const logs = warnings.filter((w) => w.includes("CURRENCY_FALLBACK_USED"));
      assert.equal(logs.length, 2);
      assert.match(logs[0], /wanted=INR used=USD/);
    });

    test("EUR and GBP are unaffected", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("all-four"), undefined, "EUR"), { price: 9, currency: "EUR" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("all-four"), undefined, "GBP"), { price: 8, currency: "GBP" });
    });
  });

  describe("parsePrice cap per currency", () => {
    test("maxPriceFor: 1,000,000 for INR, 100,000 for everything else", () => {
      assert.equal(maxPriceFor("INR"), 1000000);
      assert.equal(maxPriceFor("inr"), 1000000);
      for (const c of ["USD", "EUR", "GBP", "", undefined]) assert.equal(maxPriceFor(c), 100000);
    });
    test("without a cap argument the old 100,000 limit still applies", () => {
      assert.deepEqual(parsePrice(100000), { value: 100000 });
      assert.match(parsePrice(100001).error, /not be more than 100,000/);
      assert.deepEqual(parsePrice(100001, maxPriceFor("INR")), { value: 100001 });
    });
  });

  describe("coverage script", () => {
    test("a category with no INR price is reported as missing INR", async () => {
      await HealthcareCategory.create({ name: "Complete", pricingSlug: "all-four", price: 10, isActive: true });
      await HealthcareCategory.create({ name: "No inr", pricingSlug: "three", price: 10, isActive: true });
      await HealthcareCategory.create({ name: "Only usd", pricingSlug: "usd-only", price: 10, isActive: true });
      const result = await findCategoriesMissingCurrencyPrices();
      assert.equal(result.total, 3);
      assert.equal(result.complete, 1);
      const by = Object.fromEntries(result.missing.map((m) => [m.name, [m.missingEur, m.missingGbp, m.missingInr]]));
      assert.deepEqual(by, { "No inr": [false, false, true], "Only usd": [true, true, true] });
    });
  });
});
