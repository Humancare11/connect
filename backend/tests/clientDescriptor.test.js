const test = require("node:test");
const assert = require("node:assert/strict");
const { describeJoinClient, describeClientLabel, sanitizeDeclared } = require("../utils/clientDescriptor");

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DART = "Dart/3.5 (dart:io)";

test("web join: browser + OS come from the User-Agent, not from the payload", () => {
  const c = describeJoinClient({ declared: { platform: "web", browser: "Netscape", osName: "TempleOS" }, userAgent: CHROME_WIN });
  assert.equal(c.platform, "web");
  assert.equal(c.browser, "Chrome");
  assert.equal(c.browserVersion, "130");
  assert.match(c.osName, /Windows/);
  assert.match(describeClientLabel(c), /^Web \(Chrome 130 on Windows/);
});

test("app join (declared android + native stack) keeps the declaration", () => {
  const c = describeJoinClient({
    declared: { platform: "android", appVersion: "1.0.18+17", osName: "Android", osVersion: "14", deviceModel: "Pixel 8" },
    userAgent: DART,
  });
  assert.equal(c.platform, "android");
  assert.equal(c.platformSource, "declared");
  assert.equal(describeClientLabel(c), "App (Android 14, v1.0.18+17, Pixel 8)");
});

test("an app that declares nothing (the doctor app) is still recognised as an app", () => {
  const c = describeJoinClient({ declared: undefined, userAgent: DART });
  assert.equal(c.platform, "app");
  assert.equal(c.platformSource, "ua-inferred");
  assert.equal(describeClientLabel(c), "App (version and OS not reported)");
});

test("forged: browser User-Agent but the payload claims to be the Android app -> the server's view wins", () => {
  const c = describeJoinClient({ declared: { platform: "android", appVersion: "9.9.9" }, userAgent: CHROME_WIN });
  assert.equal(c.platform, "web");
  assert.equal(c.platformSource, "ua-overrode-declared");
  assert.equal(c.appVersion, "");
});

test("forged: native stack but the payload claims web", () => {
  const c = describeJoinClient({ declared: { platform: "web" }, userAgent: DART });
  assert.equal(c.platform, "app");
  assert.equal(c.platformSource, "ua-overrode-declared");
});

test("in-app browser is named (WhatsApp etc.)", () => {
  const c = describeJoinClient({ userAgent: `${SAFARI_IOS} WhatsApp/2.24` });
  assert.equal(c.platform, "web");
  assert.equal(c.browser, "WhatsApp browser");
});

test("garbage / hostile declarations are dropped or sanitised, never echoed raw", () => {
  assert.equal(sanitizeDeclared(null), null);
  assert.equal(sanitizeDeclared("android"), null);
  assert.equal(sanitizeDeclared([]), null);
  assert.equal(sanitizeDeclared({ platform: "windows-phone" }), null);
  const s = sanitizeDeclared({
    platform: "ios",
    appVersion: "<script>alert(1)</script>",
    osName: "iOS<img src=x onerror=1>".repeat(20),
    osVersion: "17.5\n\r\u0000",
    deviceModel: "x".repeat(500),
  });
  assert.equal(s.platform, "ios");
  assert.equal(s.appVersion, "", "an invalid version string is dropped");
  assert.ok(s.osName.length <= 30 && !/[<>]/.test(s.osName));
  assert.ok(s.deviceModel.length <= 60);
  assert.ok(!/[\n\r\u0000]/.test(s.osVersion));
});

test("no User-Agent and no declaration -> unknown, never throws", () => {
  assert.equal(describeJoinClient({}).platform, "unknown");
  assert.equal(describeJoinClient({ userAgent: 12345 }).platform, "unknown");
  assert.equal(describeClientLabel(null), "Unknown");
});
