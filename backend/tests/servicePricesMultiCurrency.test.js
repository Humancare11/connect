// Service prices (Admin > Services Price) in USD, EUR, GBP and INR: create / edit validation, the lock-once-set rule, the minimums and
// caps, the public response shapes under the multi-currency switch and the INR switch. Real routes and models, in-memory database.
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

const ServicePrice = require("../models/ServicePrice");
const servicesRouter = require("../routes/services");

const FIELDS = [["USD", "price"], ["EUR", "priceEur"], ["GBP", "priceGbp"], ["INR", "priceInr"]];
const TINY = [5e-324, 1e-8, 4e-9, 0.004, 0.009, "0.004", "0.001"];
const valid = { name: "Fit to Fly", icon: "plane", description: "Certificate", price: 25, priceEur: 23, priceGbp: 20, priceInr: 1999 };

describe("service prices in four currencies", () => {
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
  const create = (body, role) => call("POST", "/api/services", body, role);
  const put = (id, body, role) => call("PUT", `/api/services/${id}`, body, role);

  before(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await ServicePrice.init();
    const app = express();
    app.use(express.json());
    app.use("/api/services", servicesRouter);
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
    await ServicePrice.deleteMany({});
  });

  describe("create: all four prices are required", () => {
    test("creates the service with USD, EUR, GBP and INR", async () => {
      const r = await create(valid);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const row = await ServicePrice.findOne({ slug: "fit-to-fly" }).lean();
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [25, 23, 20, 1999]);
    });

    test("each of the four is required, and nothing is created without it", async () => {
      for (const [code, key] of FIELDS) {
        for (const blank of [undefined, null, "", "  "]) {
          const body = { ...valid, name: `Missing ${key}`, [key]: blank };
          if (blank === undefined) delete body[key];
          const r = await create(body);
          assert.equal(r.status, 400, `${key} ${JSON.stringify(blank)}`);
          assert.equal(r.body.msg, `${code} price is required.`);
        }
      }
      assert.equal(await ServicePrice.countDocuments({}), 0);
    });

    test("zero, negative, text, booleans, arrays, objects and 3 decimals are rejected for every currency", async () => {
      for (const [, key] of FIELDS) {
        for (const bad of [0, "0", -3, "x", true, [5], { $gt: "" }, 1.005, "1e3"]) {
          const r = await create({ ...valid, name: "Bad", [key]: bad });
          assert.equal(r.status, 400, `${key} ${JSON.stringify(bad)}`);
        }
      }
      assert.equal(await ServicePrice.countDocuments({}), 0);
    });

    test("tiny values are refused for all four currencies; INR 0.50 too; the smallest allowed (0.01, ₹1) is accepted", async () => {
      for (const [, key] of FIELDS) {
        for (const tiny of TINY) assert.equal((await create({ ...valid, name: "Tiny", [key]: tiny })).status, 400, `${key} ${tiny}`);
      }
      const r = await create({ ...valid, name: "Rupee", priceInr: 0.5 });
      assert.equal(r.status, 400);
      assert.match(r.body.msg, /INR price must be at least 1\./);
      assert.equal((await create({ ...valid, name: "Cheap", price: 0.01, priceEur: 0.01, priceGbp: 0.01, priceInr: 1 })).status, 201);
    });

    test("the cap: 100,000 for USD / EUR / GBP, 10,00,000 for INR", async () => {
      for (const key of ["price", "priceEur", "priceGbp"]) {
        assert.equal((await create({ ...valid, name: `Over ${key}`, [key]: 100001 })).status, 400, key);
        assert.equal((await create({ ...valid, name: `Max ${key}`, [key]: 100000 })).status, 201, key);
      }
      assert.equal((await create({ ...valid, name: "Over inr", priceInr: 1000001 })).status, 400);
      assert.equal((await create({ ...valid, name: "Max inr", priceInr: 1000000 })).status, 201);
    });

    test("prices sent as numeric strings (from a form) are accepted", async () => {
      assert.equal((await create({ ...valid, price: "25.50", priceEur: "23", priceGbp: "20.5", priceInr: "1999" })).status, 201);
    });

    test("the other required fields are still required; a duplicate name is 409", async () => {
      assert.equal((await create({ ...valid, name: "" })).status, 400);
      assert.equal((await create({ ...valid, icon: "" })).status, 400);
      assert.equal((await create({ ...valid, description: "" })).status, 400);
      assert.equal((await create(valid)).status, 201);
      assert.equal((await create(valid)).status, 409);
    });

    test("only a super admin may create or edit", async () => {
      assert.equal((await create(valid, null)).status, 401);
      assert.equal((await create(valid, "admin")).status, 403);
      const made = await create(valid);
      assert.equal((await put(made.body.service._id, { ...valid }, "admin")).status, 403);
    });
  });

  describe("edit", () => {
    let id;
    beforeEach(async () => {
      id = (await create(valid)).body.service._id;
    });

    test("every price can be changed", async () => {
      const r = await put(id, { ...valid, price: 30, priceEur: 28, priceGbp: 24, priceInr: 2499 });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const row = await ServicePrice.findById(id).lean();
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [30, 28, 24, 2499]);
    });

    test("USD can never be cleared or set to 0 (blank, null, missing, 0, negative)", async () => {
      for (const bad of [undefined, null, "", 0, "0", -1]) {
        const body = { ...valid, price: bad };
        if (bad === undefined) delete body.price;
        assert.equal((await put(id, body)).status, 400, JSON.stringify(bad));
      }
      assert.equal((await ServicePrice.findById(id).lean()).price, 25);
    });

    test("EUR / GBP / INR that are set can be changed but never cleared (null, empty, spaces, 0)", async () => {
      for (const [code, key] of FIELDS.slice(1)) {
        for (const bad of [null, "", "   ", 0, "0"]) {
          const r = await put(id, { ...valid, [key]: bad });
          assert.equal(r.status, 400, `${key} ${JSON.stringify(bad)}`);
          if (bad === null || (typeof bad === "string" && bad.trim() === "")) assert.equal(r.body.msg, `${code} price cannot be cleared once it is set.`);
        }
      }
      const row = await ServicePrice.findById(id).lean();
      assert.deepEqual([row.priceEur, row.priceGbp, row.priceInr], [23, 20, 1999]);
    });

    test("a price that was never set may stay out (an old service) and can be filled in later", async () => {
      const old = await ServicePrice.create({ name: "Old", slug: "old", price: 10, icon: "x", description: "d" });
      let r = await put(old._id, { name: "Old", icon: "x", description: "d", price: 12 });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      r = await put(old._id, { name: "Old", icon: "x", description: "d", price: 12, priceEur: "", priceGbp: null, priceInr: "" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      let row = await ServicePrice.findById(old._id).lean();
      assert.deepEqual([row.price, row.priceEur, row.priceGbp, row.priceInr], [12, undefined, undefined, undefined]);
      r = await put(old._id, { name: "Old", icon: "x", description: "d", price: 12, priceInr: 899 });
      assert.equal(r.status, 200);
      row = await ServicePrice.findById(old._id).lean();
      assert.equal(row.priceInr, 899);
      // now it is locked
      assert.equal((await put(old._id, { name: "Old", icon: "x", description: "d", price: 12, priceInr: "" })).status, 400);
    });

    test("tiny values, INR 0.50, over-cap and 3 decimals are refused on edit for every currency", async () => {
      for (const [, key] of FIELDS) {
        for (const tiny of TINY) assert.equal((await put(id, { ...valid, [key]: tiny })).status, 400, `${key} ${tiny}`);
        assert.equal((await put(id, { ...valid, [key]: 10.005 })).status, 400, key);
      }
      assert.equal((await put(id, { ...valid, priceInr: 0.5 })).status, 400);
      assert.equal((await put(id, { ...valid, priceInr: 1000001 })).status, 400);
      assert.equal((await put(id, { ...valid, priceEur: 100001 })).status, 400);
      assert.equal((await put(id, { ...valid, priceInr: 1 })).status, 200);
    });

    test("a rejected request writes nothing (all-or-nothing)", async () => {
      assert.equal((await put(id, { ...valid, price: 99, priceInr: 0.5 })).status, 400);
      const row = await ServicePrice.findById(id).lean();
      assert.deepEqual([row.price, row.priceInr], [25, 1999]);
    });

    test("the slug is kept when the name changes; unknown service is 404", async () => {
      const r = await put(id, { ...valid, name: "Fit to Fly Certificate" });
      assert.equal(r.body.service.slug, "fit-to-fly");
      assert.equal((await put(new mongoose.Types.ObjectId().toString(), valid)).status, 404);
    });
  });

  describe("responses", () => {
    beforeEach(async () => {
      await create(valid);
    });
    const list = async () => (await call("GET", "/api/services", undefined, null)).body;
    const bySlug = async () => (await call("GET", "/api/services/by-slug/fit-to-fly", undefined, null)).body;

    test("flag off: the old shape, no EUR / GBP / INR, even with Razorpay keys", async () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_k";
      process.env.RAZORPAY_KEY_SECRET = "s";
      for (const s of [(await list())[0], await bySlug()]) {
        assert.equal(s.price, 25);
        for (const k of ["priceEur", "priceGbp", "priceInr"]) assert.equal(k in s, false, k);
      }
    });

    test("flag on, no Razorpay keys: EUR and GBP, no INR (an Indian visitor is a USD visitor)", async () => {
      process.env.MULTI_CURRENCY_ENABLED = "true";
      for (const s of [(await list())[0], await bySlug()]) {
        assert.deepEqual([s.price, s.priceEur, s.priceGbp], [25, 23, 20]);
        assert.equal("priceInr" in s, false);
      }
    });

    test("flag on and Razorpay keys set: all four; null where not set", async () => {
      process.env.MULTI_CURRENCY_ENABLED = "true";
      process.env.RAZORPAY_KEY_ID = "rzp_test_k";
      process.env.RAZORPAY_KEY_SECRET = "s";
      const s = await bySlug();
      assert.deepEqual([s.price, s.priceEur, s.priceGbp, s.priceInr], [25, 23, 20, 1999]);
      await ServicePrice.create({ name: "Old", slug: "old", price: 10, icon: "x", description: "d" });
      const old = (await list()).find((x) => x.slug === "old");
      assert.deepEqual([old.priceEur, old.priceGbp, old.priceInr], [null, null, null]);
    });

    test("the super admin list always carries all four prices (null = not set), flag or not, and only for a super admin", async () => {
      await ServicePrice.create({ name: "Old", slug: "old", price: 10, icon: "x", description: "d" });
      const r = await call("GET", "/api/services/admin");
      assert.equal(r.status, 200);
      const old = r.body.find((x) => x.slug === "old");
      assert.deepEqual([old.price, old.priceEur, old.priceGbp, old.priceInr], [10, null, null, null]);
      assert.equal(r.body.find((x) => x.slug === "fit-to-fly").priceInr, 1999);
      assert.equal((await call("GET", "/api/services/admin", undefined, "admin")).status, 403);
      assert.equal((await call("GET", "/api/services/admin", undefined, null)).status, 401);
    });
  });

  describe("model validators", () => {
    test("a zero or negative EUR / GBP / INR price cannot be stored", async () => {
      for (const key of ["priceEur", "priceGbp", "priceInr"]) {
        await assert.rejects(ServicePrice.create({ name: `m${key}`, slug: `m${key}`, price: 5, icon: "x", description: "d", [key]: 0 }));
        await assert.rejects(ServicePrice.create({ name: `n${key}`, slug: `n${key}`, price: 5, icon: "x", description: "d", [key]: -2 }));
      }
    });
  });
});
