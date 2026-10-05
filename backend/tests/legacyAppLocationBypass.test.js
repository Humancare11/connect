const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { resolveSignupLocation } = require("../controllers/authController");
const { isLegacyAppClient } = require("../utils/legacyAppBypass");

const reqWith = (headers = {}) => ({ headers });

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DART_UA = "Dart/3.5 (dart:io)";

const withFlag = (value, fn) => {
  const previous = process.env.LEGACY_APP_LOCATION_BYPASS;
  if (value === undefined) delete process.env.LEGACY_APP_LOCATION_BYPASS;
  else process.env.LEGACY_APP_LOCATION_BYPASS = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.LEGACY_APP_LOCATION_BYPASS;
    else process.env.LEGACY_APP_LOCATION_BYPASS = previous;
  }
};

test("legacy app (native User-Agent, no header) without a country may skip location", () => {
  withFlag(undefined, () => {
    for (const ua of [DART_UA, "okhttp/4.12.0", "Runner/1 CFNetwork/1494 Darwin/23.4.0"]) {
      const result = resolveSignupLocation(reqWith({ "user-agent": ua }), { country: "", state: "", city: "" });
      assert.equal(result.error, undefined, ua);
      assert.deepEqual(result.set, {}, ua);
      assert.equal(result.skipped, true, ua);
    }
    // Fields entirely absent (what an old build actually sends).
    const result = resolveSignupLocation(reqWith({ "user-agent": DART_UA }), {});
    assert.equal(result.skipped, true);
  });
});

test("browser signup without a country is still rejected", () => {
  withFlag(undefined, () => {
    const result = resolveSignupLocation(reqWith({ "user-agent": BROWSER_UA }), { country: "", state: "", city: "" });
    assert.equal(result.error, "Country is required.");
  });
});

test("requests with no User-Agent (curl/scripts) are still rejected", () => {
  withFlag(undefined, () => {
    assert.equal(resolveSignupLocation(reqWith(), {}).error, "Country is required.");
  });
});

test("new app build (X-Client-Platform header) without a country is rejected", () => {
  withFlag(undefined, () => {
    for (const platform of ["android", "ios"]) {
      const req = reqWith({ "user-agent": DART_UA, "x-client-platform": platform, "x-app-version": "1.0.0+16" });
      assert.equal(isLegacyAppClient(req), false);
      assert.equal(resolveSignupLocation(req, { country: "" }).error, "Country is required.");
    }
  });
});

test("legacy app that sends a country is validated like everyone else", () => {
  withFlag(undefined, () => {
    const req = reqWith({ "user-agent": DART_UA });
    assert.equal(resolveSignupLocation(req, { country: "Atlantis" }).error, "Select a valid country.");
    assert.equal(resolveSignupLocation(req, { country: "India" }).error, "State / Province is required.");
    const ok = resolveSignupLocation(req, { country: "India", state: "Kerala", city: "Kochi" });
    assert.equal(ok.error, undefined);
    assert.equal(ok.skipped, undefined);
    assert.deepEqual(ok.set, { country: "India", state: "Kerala", city: "Kochi", locationSource: "user" });
  });
});

test("LEGACY_APP_LOCATION_BYPASS=false switches the bypass off", () => {
  for (const off of ["false", "0", "off", "FALSE"]) {
    withFlag(off, () => {
      const result = resolveSignupLocation(reqWith({ "user-agent": DART_UA }), {});
      assert.equal(result.error, "Country is required.", off);
    });
  }
  // Any other value (or unset) leaves it on.
  withFlag("true", () => {
    assert.equal(resolveSignupLocation(reqWith({ "user-agent": DART_UA }), {}).skipped, true);
  });
});
