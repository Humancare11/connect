// GET /api/appointment-tree carries each category's pricingSlug (the key of GET /api/pricing), so the booking page reached from the
// header menu can find the visitor's EUR / GBP / INR price. Real route and models, in-memory database.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const HealthcareCategory = require("../models/HealthcareCategory");
const { CategoryPricing } = require("../models/CategoryPricing");
const treeRouter = require("../routes/appointmentTree");
const pricingRouter = require("../routes/pricing");

describe("appointment tree carries the pricing slug", () => {
  let replSet, server, base;
  const saved = {};
  const ENV = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];

  before(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    process.env.MULTI_CURRENCY_ENABLED = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await HealthcareCategory.init();
    await CategoryPricing.init();
    await HealthcareCategory.create({ name: "Children & Family", icon: "baby", description: "d", price: 10, pricingSlug: "children-family", isActive: true });
    await HealthcareCategory.create({ name: "Legacy", icon: "x", description: "d", price: 5, isActive: true });
    await CategoryPricing.create({ categoryId: "children-family", label: "Children & Family", price: 10, priceEur: 9, priceGbp: 8, priceInr: 799 });
    const app = express();
    app.use("/api/appointment-tree", treeRouter);
    app.use("/api/pricing", pricingRouter);
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

  test("every category has its pricingSlug (empty string when it has none), next to _id", async () => {
    const tree = await (await fetch(`${base}/api/appointment-tree`)).json();
    const family = tree.find((c) => c.name === "Children & Family");
    assert.equal(family.pricingSlug, "children-family");
    assert.ok(family._id && family._id !== family.pricingSlug);
    assert.equal(tree.find((c) => c.name === "Legacy").pricingSlug, "");
  });

  test("the slug is the key of the public price table that holds the INR price", async () => {
    const tree = await (await fetch(`${base}/api/appointment-tree`)).json();
    const table = await (await fetch(`${base}/api/pricing`)).json();
    const family = tree.find((c) => c.name === "Children & Family");
    assert.equal(table[family.pricingSlug].priceInr, 799);
    assert.equal(table[family._id], undefined, "the Mongo _id is not a key of the table");
  });
});
