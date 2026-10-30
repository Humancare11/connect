const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const User = require("../models/User");
const geoIp = require("../utils/geoIp");
const geoRouter = require("../routes/geo");

// A GeoIP reader that answers with a country code for any IP.
const readerFor = (iso) => ({ get: () => ({ country: { iso_code: iso }, subdivisions: [], city: { names: { en: "Somewhere" } } }) });

describe("GET /api/geo/currency", () => {
  let mongod, server, base;
  const originalFlag = process.env.MULTI_CURRENCY_ENABLED;

  const tokenFor = (user, extra = {}) =>
    jwt.sign({ id: String(user._id), role: "user", sid: "s1", ...extra }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const get = async ({ token, ip = "8.8.8.8" } = {}) => {
    const res = await fetch(`${base}/api/geo/currency`, {
      headers: { "x-forwarded-for": ip, ...(token ? { cookie: `userToken=${token}` } : {}) },
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const mkUser = (country) =>
    User.create({ name: "U", email: `u${Math.random().toString(36).slice(2)}@x.co`, role: "user", country });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.set("trust proxy", true);
    app.use(cookieParser());
    app.use("/api/geo", geoRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    geoIp._setReader(null);
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
    if (originalFlag === undefined) delete process.env.MULTI_CURRENCY_ENABLED;
    else process.env.MULTI_CURRENCY_ENABLED = originalFlag;
  });
  beforeEach(() => {
    delete process.env.MULTI_CURRENCY_ENABLED;
    geoIp._setReader(readerFor("FR"));
  });

  test("flag OFF: always USD, whatever the profile or the IP says", async () => {
    const user = await mkUser("Germany");
    const r = await get({ token: tokenFor(user) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { currency: "USD", country: "", source: "disabled" });
  });

  test("flag ON, logged out: the IP country decides", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    assert.deepEqual((await get()).body, { currency: "EUR", country: "FR", source: "ip" });
    geoIp._setReader(readerFor("GB"));
    assert.equal((await get()).body.currency, "GBP");
    geoIp._setReader(readerFor("US"));
    assert.equal((await get()).body.currency, "USD");
  });

  test("flag ON, logged in: the profile country wins over the IP", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const india = await mkUser("India");
    assert.deepEqual((await get({ token: tokenFor(india) })).body, { currency: "USD", country: "IN", source: "profile" });

    geoIp._setReader(readerFor("US"));
    const germany = await mkUser("Germany");
    assert.deepEqual((await get({ token: tokenFor(germany) })).body, { currency: "EUR", country: "DE", source: "profile" });
  });

  test("flag ON, logged in with no profile country: falls back to the IP", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const blank = await mkUser("");
    const r = await get({ token: tokenFor(blank) });
    assert.deepEqual(r.body, { currency: "EUR", country: "FR", source: "ip" });
  });

  test("flag ON: detection failure (no database, private IP) is USD", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    geoIp._setReader({ get: () => null });
    assert.deepEqual((await get()).body, { currency: "USD", country: "", source: "default" });
    geoIp._setReader(readerFor("FR"));
    assert.equal((await get({ ip: "10.0.0.5" })).body.currency, "USD"); // not a public IP
  });

  test("a bad, expired, refresh or non-user token is ignored (treated as logged out)", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const user = await mkUser("India");
    const bad = [
      "not-a-jwt",
      jwt.sign({ id: String(user._id), role: "user" }, "wrong-secret"),
      tokenFor(user, { type: "refresh" }),
      tokenFor(user, { role: "doctor" }),
      jwt.sign({ id: String(user._id), role: "user" }, process.env.JWT_SECRET, { expiresIn: -10 }),
    ];
    for (const token of bad) {
      const r = await get({ token });
      assert.equal(r.status, 200);
      assert.equal(r.body.source, "ip", token.slice(0, 12));
      assert.equal(r.body.currency, "EUR");
    }
  });

  test("a token for a user that no longer exists falls back to the IP", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const ghost = { _id: new mongoose.Types.ObjectId() };
    assert.equal((await get({ token: tokenFor(ghost) })).body.source, "ip");
  });

  test("the answer is never cached", async () => {
    const r = await get();
    assert.match(r.headers.get("cache-control"), /private/);
    assert.match(r.headers.get("cache-control"), /no-store/);
  });

  const hit = (ip) => fetch(`${base}/api/geo/currency`, { headers: { "x-forwarded-for": ip } });

  test("the endpoint is rate limited per IP, with a Retry-After the browser honours", async () => {
    process.env.GEO_CURRENCY_RATE_LIMIT = "5";
    try {
      const statuses = [];
      let last;
      for (let i = 0; i < 8; i += 1) {
        last = await hit("203.0.113.77");
        statuses.push(last.status);
      }
      assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429, 429]);
      assert.ok(Number(last.headers.get("retry-after")) >= 1);
      // another IP has its own allowance
      assert.equal((await hit("203.0.113.78")).status, 200);
    } finally {
      delete process.env.GEO_CURRENCY_RATE_LIMIT;
    }
  });

  test("the default allowance is generous (300 a minute): a busy shared IP, such as an office or a mobile carrier, is not limited at 60", async () => {
    delete process.env.GEO_CURRENCY_RATE_LIMIT;
    const ip = "203.0.113.90";
    for (let i = 0; i < 100; i += 1) {
      const res = await hit(ip);
      assert.equal(res.status, 200, `request ${i + 1}`);
    }
  });

  test("a nonsense limit setting falls back to the default", async () => {
    for (const bad of ["abc", "0", "-3", ""]) {
      process.env.GEO_CURRENCY_RATE_LIMIT = bad;
      assert.equal((await hit(`203.0.113.${100 + bad.length}`)).status, 200, bad);
    }
    delete process.env.GEO_CURRENCY_RATE_LIMIT;
  });

  test("a real failure is an error the browser can retry (503 + Retry-After), not a silent USD", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const user = await mkUser("India");
    const original = User.findById;
    User.findById = () => { throw new Error("database is down"); };
    const realError = console.error;
    console.error = () => {};
    try {
      const r = await get({ token: tokenFor(user) });
      assert.equal(r.status, 503);
      assert.equal(r.body.currency, undefined, "no currency is claimed");
      assert.equal(r.headers.get("retry-after"), "2");
      assert.match(r.headers.get("cache-control"), /no-store/);
    } finally {
      User.findById = original;
      console.error = realError;
    }
    // and it recovers: the same visitor gets the right answer once the database is back
    const ok = await get({ token: tokenFor(user) });
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.body.country, ok.body.source], ["IN", "profile"]);
  });
});
