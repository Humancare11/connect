const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { resolveSocketIp } = require("../services/liveChat");
const { devFakeIp } = require("../utils/liveChat/config");

const socket = (headers = {}, address = "::ffff:10.0.0.7") => ({ handshake: { address, headers } });
const ROOT = path.join(__dirname, "..", "..");

describe("live chat: client IP, dev override, GeoIP warning", () => {
  test("LIVECHAT_DEV_FAKE_IP works outside production and only for a valid PUBLIC address", () => {
    assert.equal(devFakeIp({ NODE_ENV: "development", LIVECHAT_DEV_FAKE_IP: "8.8.8.8" }), "8.8.8.8");
    assert.equal(devFakeIp({ LIVECHAT_DEV_FAKE_IP: " 1.1.1.1 " }), "1.1.1.1"); // NODE_ENV unset = not production
    for (const bad of ["", "127.0.0.1", "10.1.2.3", "192.168.0.5", "::1", "not-an-ip", "999.1.1.1"]) {
      assert.equal(devFakeIp({ NODE_ENV: "development", LIVECHAT_DEV_FAKE_IP: bad }), "", bad);
    }
  });

  test("in production the override is IGNORED everywhere", () => {
    for (const nodeEnv of ["production", "Production", " PRODUCTION "]) {
      const env = { NODE_ENV: nodeEnv, LIVECHAT_DEV_FAKE_IP: "8.8.8.8", TRUST_PROXY: "1" };
      assert.equal(devFakeIp(env), "");
      assert.equal(resolveSocketIp(socket({ "x-forwarded-for": "198.51.100.23" }), env), "198.51.100.23");
    }
  });

  test("in development the override replaces the (private) local address for sockets", () => {
    const env = { NODE_ENV: "development", LIVECHAT_DEV_FAKE_IP: "8.8.8.8" };
    assert.equal(resolveSocketIp(socket({}, "::1"), env), "8.8.8.8");
    assert.equal(resolveSocketIp(socket({}, "::1"), { NODE_ENV: "development" }), "::1", "without the variable nothing changes");
  });

  test("behind a proxy the visitor's address is used, not the proxy's (TRUST_PROXY / X-Forwarded-For)", () => {
    const headers = { "x-forwarded-for": "198.51.100.23" };
    assert.equal(resolveSocketIp(socket(headers), { NODE_ENV: "production" }), "198.51.100.23", "default: one trusted hop");
    assert.equal(resolveSocketIp(socket(headers), { NODE_ENV: "production", TRUST_PROXY: "1" }), "198.51.100.23");
    // two hops (e.g. Cloudflare/Render + Nginx): the visitor is the second from the right
    const chain = { "x-forwarded-for": "198.51.100.23, 172.16.0.9" };
    assert.equal(resolveSocketIp(socket(chain), { NODE_ENV: "production", TRUST_PROXY: "2" }), "198.51.100.23");
    // a visitor cannot choose their own address when nothing is trusted
    assert.equal(resolveSocketIp(socket({ "x-forwarded-for": "6.6.6.6" }), { NODE_ENV: "production", TRUST_PROXY: "false" }), "10.0.0.7");
    // Cloudflare header only when explicitly enabled
    assert.equal(resolveSocketIp(socket({ "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "198.51.100.23" }), { NODE_ENV: "production", USE_CLOUDFLARE_HEADERS: "true" }), "203.0.113.50");
    assert.equal(resolveSocketIp(socket({ "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "198.51.100.23" }), { NODE_ENV: "production" }), "198.51.100.23");
  });

  test("the server sets trust proxy from TRUST_PROXY, and the GeoIP warning explains how to fix it", () => {
    assert.match(fs.readFileSync(path.join(ROOT, "backend", "server.js"), "utf8"), /app\.set\("trust proxy", parseTrustProxy\(process\.env\.TRUST_PROXY\)\)/);
    const geo = fs.readFileSync(path.join(ROOT, "backend", "utils", "geoIp.js"), "utf8");
    assert.ok(geo.includes("https://db-ip.com/db/download/ip-to-city-lite"));
    assert.ok(geo.includes("backend/data/dbip-city-lite.mmdb"));
    assert.ok(geo.includes("LIVECHAT_DEV_FAKE_IP"));
    assert.match(fs.readFileSync(path.join(ROOT, "backend", "server.js"), "utf8"), /initGeoIp\(\)/, "loaded (and warned about) at startup");
  });

  test("the example env file documents the override as development only and has no value", () => {
    const example = fs.readFileSync(path.join(ROOT, "backend", ".env.example"), "utf8");
    assert.match(example, /^LIVECHAT_DEV_FAKE_IP=\s*$/m);
    assert.match(example, /DEVELOPMENT ONLY/);
  });
});
