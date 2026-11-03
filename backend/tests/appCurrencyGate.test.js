const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateAppCurrencyGate, minCurrencyBuild, hasRazorpayCapability, logAppGateUsed } = require("../utils/appCurrencyGate");

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DART = "Dart/3.5 (dart:io)";
const OKHTTP = "okhttp/4.12.0";
const CFNETWORK = "Runner/17 CFNetwork/1494 Darwin/23.4.0";

const env = (min) => ({ APP_MIN_CURRENCY_BUILD_ANDROID: String(min), APP_MIN_CURRENCY_BUILD_IOS: String(min) });
const req = (headers) => ({ headers, originalUrl: "/api/payments/create-intent-by-amount" });
const app = (build, extra = {}, ua = DART) =>
  req({ "user-agent": ua, "x-client-platform": "android", "x-app-version": `1.0.0+${build}`, ...extra });

test("web browser: never touched by the gate", () => {
  const gate = evaluateAppCurrencyGate(req({ "user-agent": CHROME }), env(18));
  assert.equal(gate.isApp, false);
  assert.equal(gate.usdOnly, false);
  assert.equal(gate.noInr, false);
  assert.equal(gate.reason, "not-app");
});

test("no User-Agent at all (curl / scripts): not an app", () => {
  const gate = evaluateAppCurrencyGate(req({}), env(18));
  assert.equal(gate.isApp, false);
  assert.equal(gate.usdOnly, false);
});

test("old app that sends no headers (Dart / okhttp / CFNetwork User-Agent): USD", () => {
  for (const ua of [DART, OKHTTP, CFNETWORK]) {
    const gate = evaluateAppCurrencyGate(req({ "user-agent": ua }), env(18));
    assert.equal(gate.isApp, true, ua);
    assert.equal(gate.usdOnly, true, ua);
    assert.equal(gate.reason, "inferred", ua);
    assert.equal(gate.build, null, ua);
  }
});

test("+16 and +17 (declared, below the currency release): USD", () => {
  for (const build of [16, 17]) {
    const gate = evaluateAppCurrencyGate(app(build), env(18));
    assert.equal(gate.usdOnly, true, `+${build}`);
    assert.equal(gate.reason, "below-min", `+${build}`);
    assert.equal(gate.build, build);
  }
});

test("+18 (the currency release): allowed; rupees only with the Razorpay capability", () => {
  const plain = evaluateAppCurrencyGate(app(18), env(18));
  assert.equal(plain.usdOnly, false);
  assert.equal(plain.noInr, true);
  assert.equal(plain.reason, "allowed");

  const rupees = evaluateAppCurrencyGate(app(18, { "x-client-capabilities": "razorpay" }), env(18));
  assert.equal(rupees.usdOnly, false);
  assert.equal(rupees.noInr, false);

  const listed = evaluateAppCurrencyGate(app(19, { "x-client-capabilities": "foo, Razorpay" }), env(18));
  assert.equal(listed.noInr, false);
});

test("a later build than the minimum is allowed too", () => {
  assert.equal(evaluateAppCurrencyGate(app(25), env(18)).usdOnly, false);
});

test("APP_MIN_CURRENCY_BUILD unset or 0: every declared app is USD (safe default)", () => {
  for (const e of [{}, env(0), { APP_MIN_CURRENCY_BUILD_ANDROID: "abc" }]) {
    const gate = evaluateAppCurrencyGate(app(99), e);
    assert.equal(gate.usdOnly, true);
    assert.equal(gate.reason, "min-unset");
  }
});

test("the minimum is per platform", () => {
  const e = { APP_MIN_CURRENCY_BUILD_ANDROID: "18" };
  const ios = req({ "user-agent": CFNETWORK, "x-client-platform": "ios", "x-app-version": "1.0.0+40" });
  assert.equal(evaluateAppCurrencyGate(ios, e).usdOnly, true); // iOS minimum is not set
  assert.equal(evaluateAppCurrencyGate(app(18), e).usdOnly, false);
});

test("declared app without a readable build: USD", () => {
  for (const version of ["", "1.0.0", "abc"]) {
    const gate = evaluateAppCurrencyGate(req({ "user-agent": DART, "x-client-platform": "android", "x-app-version": version }), env(18));
    assert.equal(gate.usdOnly, true, `"${version}"`);
    assert.equal(gate.reason, "no-build", `"${version}"`);
  }
});

test("spoofed headers on a browser User-Agent: treated as web, flagged suspect", () => {
  const spoof = req({ "user-agent": CHROME, "x-client-platform": "android", "x-app-version": "1.0.0+17" });
  const gate = evaluateAppCurrencyGate(spoof, env(18));
  assert.equal(gate.isApp, false);
  assert.equal(gate.usdOnly, false); // web rules: it does NOT get the cheaper USD price
  assert.equal(gate.suspect, true);
  assert.equal(gate.reason, "suspect-web");

  const noUa = evaluateAppCurrencyGate(req({ "x-client-platform": "ios", "x-app-version": "1.0.0+17" }), env(18));
  assert.equal(noUa.isApp, false);
});

test("a spoofed 'new' build on a native User-Agent is simply an allowed build (not access control)", () => {
  const gate = evaluateAppCurrencyGate(app(18, {}, OKHTTP), env(18));
  assert.equal(gate.usdOnly, false);
});

test("helpers", () => {
  assert.equal(minCurrencyBuild("android", env(18)), 18);
  assert.equal(minCurrencyBuild("ios", {}), 0);
  assert.equal(minCurrencyBuild("unknown", env(18)), 0);
  assert.equal(hasRazorpayCapability(req({ "x-client-capabilities": "razorpay" })), true);
  assert.equal(hasRazorpayCapability(req({})), false);
});

test("[APP_GATE_USED] line carries the reason, the build, suspect and a cleaned User-Agent", () => {
  const lines = [];
  const spoof = req({ "user-agent": `${CHROME}"\n\u0001injected`, "x-client-platform": "android", "x-app-version": "1.0.0+17" });
  spoof.originalUrl = "/api/geo/currency";
  const gate = evaluateAppCurrencyGate(spoof, env(18));
  logAppGateUsed(spoof, gate, { from: "app-headers", to: "web-rules", logger: (line) => lines.push(line) });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[APP_GATE_USED\] reason=suspect-web from=app-headers to=web-rules platform=android build=17 source=header suspect=true/);
  assert.match(lines[0], /path=\/api\/geo\/currency/);
  assert.match(lines[0], /ua="Mozilla\/5\.0/);
  assert.doesNotMatch(lines[0], /\n|\u0001/);
});
