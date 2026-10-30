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

  test("flag ON, logged in: the IP decides too - the profile country plays no part", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_k";
    process.env.RAZORPAY_KEY_SECRET = "s";
    try {
      // profile India, but the request comes from the UK -> GBP (a patient from India who is in the UK pays the UK price)
      geoIp._setReader(readerFor("GB"));
      const india = await mkUser("India");
      assert.deepEqual((await get({ token: tokenFor(india) })).body, { currency: "GBP", country: "GB", source: "ip" });

      // profile UK, but the request comes from India -> INR
      geoIp._setReader(readerFor("IN"));
      const uk = await mkUser("United Kingdom");
      assert.deepEqual((await get({ token: tokenFor(uk) })).body, { currency: "INR", country: "IN", source: "ip" });

      // profile Germany, request from the US -> USD
      geoIp._setReader(readerFor("US"));
      const germany = await mkUser("Germany");
      assert.deepEqual((await get({ token: tokenFor(germany) })).body, { currency: "USD", country: "US", source: "ip" });
    } finally {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
    }
  });

  test("the same IP gives the same answer logged in and logged out, and for any profile country (or none)", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const loggedOut = (await get()).body;
    for (const country of ["India", "Germany", "United Kingdom", "Narnia", ""]) {
      const user = await mkUser(country);
      assert.deepEqual((await get({ token: tokenFor(user) })).body, loggedOut, country || "(no profile country)");
    }
  });

  test("the answer never says the profile decided it (source is ip, default, error or disabled)", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const user = await mkUser("India");
    const seen = new Set();
    seen.add((await get({ token: tokenFor(user) })).body.source);
    geoIp._setReader({ get: () => null });
    seen.add((await get({ token: tokenFor(user) })).body.source);
    delete process.env.MULTI_CURRENCY_ENABLED;
    seen.add((await get({ token: tokenFor(user) })).body.source);
    assert.deepEqual([...seen].sort(), ["default", "disabled", "ip"]);
  });

  test("flag ON: an IP that cannot be placed (no data, private address) is USD", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    geoIp._setReader({ get: () => null });
    assert.deepEqual((await get()).body, { currency: "USD", country: "", source: "default" });
    geoIp._setReader(readerFor("FR"));
    for (const ip of ["10.0.0.5", "192.168.1.20", "127.0.0.1"]) {
      assert.deepEqual((await get({ ip })).body, { currency: "USD", country: "", source: "default" }, ip); // not public IPs
    }
  });

  test("a spoofed header cannot change the answer: only the proxy-reported client address counts", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    // a reader that knows two addresses: the real client (UK) and the address a visitor would like to appear from (India)
    geoIp._setReader({
      get: (ip) => {
        const iso = { "81.2.69.142": "GB", "49.36.0.10": "IN" }[ip];
        return iso ? { country: { iso_code: iso }, subdivisions: [], city: { names: { en: "X" } } } : null;
      },
    });
    // a real proxy appends the address it saw to X-Forwarded-For; the left part is whatever the client sent. With one trusted hop
    // (the production default) the last entry is the client, so the spoofed left entry is ignored.
    const spoofApp = express();
    spoofApp.set("trust proxy", 1);
    spoofApp.use("/api/geo", geoRouter);
    const spoofServer = http.createServer(spoofApp);
    await new Promise((r) => spoofServer.listen(0, "127.0.0.1", r));
    try {
      const url = `http://127.0.0.1:${spoofServer.address().port}/api/geo/currency`;
      const res = await fetch(url, {
        headers: {
          "x-forwarded-for": "49.36.0.10, 81.2.69.142", // client claims to be in India; the proxy saw the UK address
          "cf-connecting-ip": "49.36.0.10", // not trusted unless USE_CLOUDFLARE_HEADERS=true
          "x-real-ip": "49.36.0.10",
          "x-client-ip": "49.36.0.10",
          forwarded: "for=49.36.0.10",
        },
      });
      assert.deepEqual(await res.json(), { currency: "GBP", country: "GB", source: "ip" });
    } finally {
      await new Promise((r) => spoofServer.close(r));
    }
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

});
