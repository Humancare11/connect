const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Replace the token check with a header-driven fake BEFORE the routes load (they
// pick the middleware up at require time). The role checks stay the real ones.
const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: String(new mongoose.Types.ObjectId()), role };
  next();
};

const { CategoryPricing } = require("../models/CategoryPricing");
const HealthcareCategory = require("../models/HealthcareCategory");
const {
  resolveEffectiveCategoryPrice,
  buildCategoryPricingLookup,
} = require("../utils/categoryPricing");

const pricingRouter = require("../routes/pricing");
const healthcareRouter = require("../routes/healthcareManagement");

describe("multi-currency category pricing", () => {
  let replSet, server, base;
  const originalFlag = process.env.MULTI_CURRENCY_ENABLED;

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
    if (originalFlag === undefined) delete process.env.MULTI_CURRENCY_ENABLED;
    else process.env.MULTI_CURRENCY_ENABLED = originalFlag;
  });
  beforeEach(async () => {
    delete process.env.MULTI_CURRENCY_ENABLED;
    await CategoryPricing.deleteMany({});
    await HealthcareCategory.deleteMany({});
    // An "old" category: only a USD price. And one that is fully priced.
    await CategoryPricing.create({ categoryId: "old-cat", label: "Old", price: 10 });
    await CategoryPricing.create({ categoryId: "full-cat", label: "Full", price: 10, priceEur: 9, priceGbp: 8 });
  });

  describe("PUT /api/pricing/:categoryId", () => {
    test("an old row can get EUR and GBP set (partial edit)", async () => {
      const r = await put("old-cat", { priceEur: 9.5 });
      assert.equal(r.status, 200);
      let row = await stored("old-cat");
      assert.equal(row.priceEur, 9.5);
      assert.equal(row.priceGbp, undefined);
      assert.equal(row.price, 10);

      await put("old-cat", { priceGbp: "8" });
      row = await stored("old-cat");
      assert.equal(row.priceGbp, 8);
    });

    test("an old row can be saved with only the USD price, leaving EUR/GBP unset", async () => {
      const r = await put("old-cat", { price: 12 });
      assert.equal(r.status, 200);
      const row = await stored("old-cat");
      assert.equal(row.price, 12);
      assert.equal(row.priceEur, undefined);
      assert.equal(row.priceGbp, undefined);
    });

    test("null or empty for a price that is not set yet means 'still not set' and is ignored", async () => {
      const r = await put("old-cat", { price: 11, priceEur: null, priceGbp: "" });
      assert.equal(r.status, 200);
      const row = await stored("old-cat");
      assert.equal(row.price, 11);
      assert.equal(row.priceEur, undefined);
      assert.equal(row.priceGbp, undefined);
    });

    test("only blanks for unset prices means nothing to update (400)", async () => {
      const r = await put("old-cat", { priceEur: null, priceGbp: "" });
      assert.equal(r.status, 400);
      assert.match(r.body.msg, /at least one price/i);
    });

    test("a price that is already set can be changed", async () => {
      const r = await put("full-cat", { priceEur: 19.99, priceGbp: 17, price: 21 });
      assert.equal(r.status, 200);
      const row = await stored("full-cat");
      assert.deepEqual([row.price, row.priceEur, row.priceGbp], [21, 19.99, 17]);
      assert.equal(r.body.record.priceEur, 19.99);
    });

    test("a price that is already set cannot be cleared (null, empty string)", async () => {
      for (const bad of [null, "", "   "]) {
        const eur = await put("full-cat", { priceEur: bad });
        assert.equal(eur.status, 400, `EUR ${JSON.stringify(bad)}`);
        assert.match(eur.body.msg, /EUR price cannot be cleared/);
        const gbp = await put("full-cat", { priceGbp: bad });
        assert.equal(gbp.status, 400, `GBP ${JSON.stringify(bad)}`);
        assert.match(gbp.body.msg, /GBP price cannot be cleared/);
      }
      const row = await stored("full-cat");
      assert.deepEqual([row.priceEur, row.priceGbp], [9, 8]);
    });

    test("nothing in a rejected request is written (all-or-nothing)", async () => {
      const r = await put("full-cat", { price: 50, priceEur: null });
      assert.equal(r.status, 400);
      assert.equal((await stored("full-cat")).price, 10);
    });

    test("the USD price can never be emptied", async () => {
      for (const bad of [null, ""]) {
        const r = await put("old-cat", { price: bad });
        assert.equal(r.status, 400, JSON.stringify(bad));
        assert.match(r.body.msg, /USD price cannot be cleared/);
      }
      assert.equal((await stored("old-cat")).price, 10);
    });

    test("zero is rejected for every currency, set or not", async () => {
      for (const id of ["old-cat", "full-cat"]) {
        for (const key of ["price", "priceEur", "priceGbp"]) {
          for (const zero of [0, "0", "0.00"]) {
            const r = await put(id, { [key]: zero });
            assert.equal(r.status, 400, `${id} ${key} ${zero}`);
            assert.match(r.body.msg, /greater than 0/);
          }
        }
      }
    });

    test("negatives, text, booleans, arrays, 3 decimals and values above 100,000 are rejected", async () => {
      for (const bad of [-1, "-5", "abc", true, [5], {}, 1.234, "9.999", 100000.01, 1e9]) {
        for (const key of ["price", "priceEur", "priceGbp"]) {
          const r = await put("old-cat", { [key]: bad });
          assert.equal(r.status, 400, `${key} ${JSON.stringify(bad)}`);
        }
      }
      const row = await stored("old-cat");
      assert.equal(row.price, 10);
    });

    test("the maximum, 100000, and the minimum, 0.01, are accepted", async () => {
      assert.equal((await put("old-cat", { priceEur: 100000 })).status, 200);
      assert.equal((await put("old-cat", { priceGbp: 0.01 })).status, 200);
      const row = await stored("old-cat");
      assert.deepEqual([row.priceEur, row.priceGbp], [100000, 0.01]);
    });

    test("no price at all is rejected; unknown keys are ignored", async () => {
      assert.equal((await put("old-cat", {})).status, 400);
      assert.equal((await put("old-cat", { somethingElse: 5 })).status, 400);
      assert.equal((await put("old-cat", { price: 14, somethingElse: 5 })).status, 200);
    });

    test("an unknown category is 404 and a malformed id is 400", async () => {
      assert.equal((await put("no-such-cat", { price: 5 })).status, 404);
      assert.equal((await put("Bad_ID!", { price: 5 })).status, 400);
    });

    test("only a super admin may change prices", async () => {
      assert.equal((await put("old-cat", { price: 5 }, "admin")).status, 403);
      assert.equal((await put("old-cat", { price: 5 }, "user")).status, 403);
      assert.equal((await put("old-cat", { price: 5 }, null)).status, 401);
      assert.equal((await stored("old-cat")).price, 10);
    });
  });

  describe("GET /api/pricing and /api/pricing/all", () => {
    test("flag OFF: the public response is exactly the old shape", async () => {
      const r = await call("GET", "/api/pricing", undefined, null);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body["full-cat"], { price: 10, label: "Full", currency: "USD" });
      assert.deepEqual(r.body["old-cat"], { price: 10, label: "Old", currency: "USD" });
    });

    test("flag ON: EUR/GBP are added, null where not set", async () => {
      process.env.MULTI_CURRENCY_ENABLED = "true";
      const r = await call("GET", "/api/pricing", undefined, null);
      assert.deepEqual(r.body["full-cat"], { price: 10, label: "Full", currency: "USD", priceEur: 9, priceGbp: 8 });
      assert.deepEqual(r.body["old-cat"], { price: 10, label: "Old", currency: "USD", priceEur: null, priceGbp: null });
    });

    test("the super admin list always carries all three prices", async () => {
      const r = await call("GET", "/api/pricing/all");
      assert.equal(r.status, 200);
      const full = r.body.find((x) => x.categoryId === "full-cat");
      const old = r.body.find((x) => x.categoryId === "old-cat");
      assert.deepEqual([full.price, full.priceEur, full.priceGbp], [10, 9, 8]);
      assert.deepEqual([old.price, old.priceEur, old.priceGbp], [10, undefined, undefined]);
      assert.equal((await call("GET", "/api/pricing/all", undefined, "admin")).status, 403);
    });
  });

  describe("POST /api/superadmin/healthcare/categories", () => {
    const create = (body) => call("POST", "/api/superadmin/healthcare/categories", body);
    const valid = { name: "Dental", icon: "", description: "", price: 20, priceEur: 18, priceGbp: 16 };

    test("creates the category with all three prices", async () => {
      const r = await create(valid);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const category = await HealthcareCategory.findOne({ name: "Dental" }).lean();
      assert.equal(category.price, 20);
      const row = await stored(category.pricingSlug);
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.currency], [20, 18, 16, "USD"]);
    });

    test("each of the three prices is required", async () => {
      for (const [key, label] of [["price", "USD price"], ["priceEur", "EUR price"], ["priceGbp", "GBP price"]]) {
        const body = { ...valid, name: `Missing ${key}` };
        delete body[key];
        const r = await create(body);
        assert.equal(r.status, 400, key);
        assert.ok(r.body.msg.startsWith(label), r.body.msg);
      }
      assert.equal(await HealthcareCategory.countDocuments({}), 0);
    });

    test("zero, negative, text, 3 decimals and above 100,000 are rejected for each currency", async () => {
      for (const key of ["price", "priceEur", "priceGbp"]) {
        for (const bad of [0, "0", -3, "x", "", null, 1.005, 100001, true]) {
          const r = await create({ ...valid, name: `Bad ${key}`, [key]: bad });
          assert.equal(r.status, 400, `${key} ${JSON.stringify(bad)}`);
        }
      }
      assert.equal(await HealthcareCategory.countDocuments({}), 0);
      assert.equal(await CategoryPricing.countDocuments({ categoryId: /^bad-/ }), 0);
    });

    test("prices sent as numeric strings (from a form) are accepted", async () => {
      const r = await create({ ...valid, name: "Strings", price: "20.50", priceEur: "18", priceGbp: "16.25" });
      assert.equal(r.status, 201);
      const category = await HealthcareCategory.findOne({ name: "Strings" }).lean();
      const row = await stored(category.pricingSlug);
      assert.deepEqual([row.price, row.priceEur, row.priceGbp], [20.5, 18, 16.25]);
    });

    test("the admin category list returns EUR/GBP, null where not set", async () => {
      await HealthcareCategory.create({ name: "Legacy", price: 10, pricingSlug: "old-cat" });
      await HealthcareCategory.create({ name: "Modern", price: 10, pricingSlug: "full-cat" });
      const r = await call("GET", "/api/superadmin/healthcare/categories");
      assert.equal(r.status, 200);
      const legacy = r.body.find((c) => c.name === "Legacy");
      const modern = r.body.find((c) => c.name === "Modern");
      assert.deepEqual([legacy.price, legacy.priceEur, legacy.priceGbp], [10, null, null]);
      assert.deepEqual([modern.price, modern.priceEur, modern.priceGbp], [10, 9, 8]);
    });

    test("only a super admin may create", async () => {
      const res = await fetch(`${base}/api/superadmin/healthcare/categories`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-role": "admin" },
        body: JSON.stringify(valid),
      });
      assert.equal(res.status, 403);
    });
  });

  describe("model validators", () => {
    test("a zero or negative EUR/GBP price cannot be stored", async () => {
      await assert.rejects(CategoryPricing.create({ categoryId: "z1", label: "Z", price: 5, priceEur: 0 }), /EUR price/);
      await assert.rejects(CategoryPricing.create({ categoryId: "z2", label: "Z", price: 5, priceGbp: -1 }), /GBP price/);
      await assert.rejects(CategoryPricing.create({ categoryId: "z3", label: "Z", price: 5, priceGbp: null }), /GBP price/);
    });
  });

  describe("resolveEffectiveCategoryPrice", () => {
    let warnings;
    const realWarn = console.warn;
    beforeEach(() => {
      warnings = [];
      console.warn = (...args) => warnings.push(args.join(" "));
    });
    afterEach(() => { console.warn = realWarn; });

    const cat = (slug) => ({ _id: "c1", name: slug, pricingSlug: slug, price: 3, currency: "USD" });
    const fallbackLogs = () => warnings.filter((w) => w.includes("CURRENCY_FALLBACK_USED"));

    test("USD (the default) returns the USD price and logs nothing", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat")), { price: 10, currency: "USD" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), undefined, "USD"), { price: 10, currency: "USD" });
      assert.equal(fallbackLogs().length, 0);
    });

    test("EUR and GBP return their own price with their own currency, no conversion", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), undefined, "EUR"), { price: 9, currency: "EUR" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), undefined, "gbp"), { price: 8, currency: "GBP" });
      assert.equal(fallbackLogs().length, 0);
    });

    test("a missing EUR/GBP price falls back to the USD price, labelled USD, and logs [CURRENCY_FALLBACK_USED]", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("old-cat"), undefined, "EUR"), { price: 10, currency: "USD" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("old-cat"), undefined, "GBP"), { price: 10, currency: "USD" });
      const logs = fallbackLogs();
      assert.equal(logs.length, 2);
      assert.match(logs[0], /wanted=EUR used=USD/);
      assert.match(logs[1], /wanted=GBP used=USD/);
    });

    test("the pre-built lookup gives the same answers as a single lookup", async () => {
      const lookup = await buildCategoryPricingLookup();
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), lookup, "EUR"), { price: 9, currency: "EUR" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("old-cat"), lookup, "GBP"), { price: 10, currency: "USD" });
    });

    test("an unsupported currency is treated as USD", async () => {
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), undefined, "INR"), { price: 10, currency: "USD" });
      assert.deepEqual(await resolveEffectiveCategoryPrice(cat("full-cat"), undefined, undefined), { price: 10, currency: "USD" });
    });

    test("a category with no pricing row falls back to its own legacy price in USD", async () => {
      const r = await resolveEffectiveCategoryPrice(cat("ghost"), undefined, "EUR");
      assert.deepEqual(r, { price: 3, currency: "USD" });
      assert.equal(fallbackLogs().length, 1);
    });
  });
});
