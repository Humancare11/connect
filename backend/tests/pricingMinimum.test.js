// Minimum price: 0.01 for USD / EUR / GBP, 1 rupee for INR. A tiny value (5e-324, 1e-8, 4e-9, 0.004) used to pass
// the checks and then round to 0; it is now rejected on create and on PUT, for all four currencies.
const { test, describe, before, after, beforeEach } = require("node:test");
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
const { parsePrice, minPriceFor, maxPriceFor } = require("../utils/currencyConfig");
const pricingRouter = require("../routes/pricing");
const healthcareRouter = require("../routes/healthcareManagement");

const FIELDS = [["USD", "price"], ["EUR", "priceEur"], ["GBP", "priceGbp"], ["INR", "priceInr"]];
const TINY = [5e-324, 1e-8, 4e-9, 0.004, 0.0049, 0.009, "0.004", "0.001"];

describe("parsePrice minimum", () => {
  test("minPriceFor: 0.01, and 1 for INR", () => {
    assert.equal(minPriceFor("USD"), 0.01);
    assert.equal(minPriceFor("eur"), 0.01);
    assert.equal(minPriceFor("GBP"), 0.01);
    assert.equal(minPriceFor("INR"), 1);
    assert.equal(minPriceFor(undefined), 0.01);
  });

  test("tiny values are rejected, never rounded to 0", () => {
    for (const raw of TINY) {
      const r = parsePrice(raw);
      assert.ok(r.error, `${raw} must be rejected`);
      assert.equal(r.value, undefined);
    }
  });

  test("0.01 and 1 are accepted for USD / EUR / GBP; 0.5 and 0.99 are rejected for INR", () => {
    assert.deepEqual(parsePrice(0.01), { value: 0.01 });
    assert.deepEqual(parsePrice("0.01"), { value: 0.01 });
    assert.deepEqual(parsePrice(1), { value: 1 });
    const max = maxPriceFor("INR");
    const min = minPriceFor("INR");
    for (const raw of [0.5, "0.50", 0.99, 0.01]) assert.match(parsePrice(raw, max, min).error, /at least 1\./, String(raw));
    assert.deepEqual(parsePrice(1, max, min), { value: 1 });
    assert.deepEqual(parsePrice("1.00", max, min), { value: 1 });
    assert.deepEqual(parsePrice(1499.5, max, min), { value: 1499.5 });
  });

  test("the maximum and the 2-decimal rule still apply", () => {
    assert.ok(parsePrice(100001).error);
    assert.ok(parsePrice(10.005).error);
    assert.deepEqual(parsePrice(100000), { value: 100000 });
  });
});

describe("admin price routes reject prices below the minimum", () => {
  let replSet, server, base;
  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-role": "superadmin" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const put = (id, body) => call("PUT", `/api/pricing/${id}`, body);
  const create = (body) => call("POST", "/api/superadmin/healthcare/categories", body);
  const valid = { name: "Dental", icon: "", description: "", price: 20, priceEur: 18, priceGbp: 16, priceInr: 1499 };

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
  });
  beforeEach(async () => {
    await CategoryPricing.deleteMany({});
    await HealthcareCategory.deleteMany({});
    await CategoryPricing.create({ categoryId: "cat", label: "Cat", price: 10, priceEur: 9, priceGbp: 8, priceInr: 799 });
  });

  test("PUT: every tiny value is refused for all 4 currencies and the stored prices stay", async () => {
    for (const [code, key] of FIELDS) {
      for (const bad of TINY) {
        const r = await put("cat", { [key]: bad });
        assert.equal(r.status, 400, `${code} ${bad}`);
      }
    }
    const row = await CategoryPricing.findOne({ categoryId: "cat" }).lean();
    assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [10, 9, 8, 799]);
  });

  test("PUT: INR 0.50 is refused (message names the minimum); INR 1 and 0.01 USD/EUR/GBP are accepted", async () => {
    let r = await put("cat", { priceInr: 0.5 });
    assert.equal(r.status, 400);
    assert.match(r.body.msg, /INR price must be at least 1\./);
    assert.equal((await put("cat", { priceInr: 1 })).status, 200);
    for (const [, key] of FIELDS.slice(0, 3)) assert.equal((await put("cat", { [key]: 0.01 })).status, 200, key);
    const row = await CategoryPricing.findOne({ categoryId: "cat" }).lean();
    assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [0.01, 0.01, 0.01, 1]);
  });

  test("create: every tiny value is refused for all 4 currencies and nothing is created", async () => {
    for (const [code, key] of FIELDS) {
      for (const bad of TINY) {
        const r = await create({ ...valid, name: `Bad ${code}`, [key]: bad });
        assert.equal(r.status, 400, `${code} ${bad}`);
      }
    }
    const r = await create({ ...valid, name: "Bad rupee", priceInr: 0.5 });
    assert.equal(r.status, 400);
    assert.match(r.body.msg, /INR price must be at least 1\./);
    assert.equal(await HealthcareCategory.countDocuments({}), 0);
  });

  test("create: the smallest allowed prices (0.01 and ₹1) are accepted", async () => {
    const r = await create({ ...valid, name: "Cheap", price: 0.01, priceEur: 0.01, priceGbp: 0.01, priceInr: 1 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
});
