const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { parseBuild, getPlatformConfig, getAppVersionConfig, PLAY_STORE_URL } = require("../utils/appVersion");
const requireMinAppVersion = require("../middleware/requireMinAppVersion");

const KEYS = [
  "APP_MIN_BUILD_ANDROID", "APP_LATEST_BUILD_ANDROID", "APP_STORE_URL_ANDROID",
  "APP_MIN_BUILD_IOS", "APP_LATEST_BUILD_IOS", "APP_STORE_URL_IOS",
  "APP_FORCE_STORE_UPDATE_ANDROID", "APP_FORCE_STORE_UPDATE_IOS",
];

// Runs fn with exactly these APP_* env vars set (everything else cleared).
const withEnv = async (vars, fn) => {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  }
};

const run = (headers) => {
  const out = { nextCalled: false, status: null, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  requireMinAppVersion({ headers }, res, () => { out.nextCalled = true; });
  return out;
};

test("parseBuild reads the build number after '+'", () => {
  assert.equal(parseBuild("1.0.0+16"), 16);
  assert.equal(parseBuild(" 2.3.1+120 "), 120);
  assert.equal(parseBuild("16"), 16);
  assert.equal(parseBuild("1.0.0"), null);
  assert.equal(parseBuild("1.0.0+abc"), null);
  assert.equal(parseBuild(""), null);
  assert.equal(parseBuild(undefined), null);
});

test("config defaults: nothing blocked, Android store URL set, iOS empty", async () => {
  await withEnv({}, () => {
    assert.deepEqual(getAppVersionConfig(), {
      android: { minBuild: 0, latestBuild: 0, storeUrl: PLAY_STORE_URL, forceStoreUpdate: false },
      ios: { minBuild: 0, latestBuild: 0, storeUrl: "", forceStoreUpdate: false },
    });
    assert.equal(PLAY_STORE_URL, "https://play.google.com/store/apps/details?id=com.humancareconnect.app");
  });
});

test("config reads env, ignores junk, and latest is never below min", async () => {
  await withEnv(
    { APP_MIN_BUILD_ANDROID: "16", APP_LATEST_BUILD_ANDROID: "10", APP_MIN_BUILD_IOS: "abc",
      APP_LATEST_BUILD_IOS: "20", APP_STORE_URL_IOS: "https://apps.apple.com/app/id1" },
    () => {
      assert.deepEqual(getPlatformConfig("android"), { minBuild: 16, latestBuild: 16, storeUrl: PLAY_STORE_URL, forceStoreUpdate: false });
      assert.deepEqual(getPlatformConfig("ios"), { minBuild: 0, latestBuild: 20, storeUrl: "https://apps.apple.com/app/id1", forceStoreUpdate: false });
      assert.equal(getPlatformConfig("windows"), null);
    }
  );
});

test("middleware is inactive while minBuild is 0 (default)", async () => {
  await withEnv({}, () => {
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.0.0+1" }).nextCalled, true);
  });
});

test("middleware returns 426 APP_UPDATE_REQUIRED for a declared build below the minimum", async () => {
  await withEnv({ APP_MIN_BUILD_ANDROID: "16" }, () => {
    const out = run({ "x-client-platform": "android", "x-app-version": "1.0.0+15" });
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 426);
    assert.equal(out.body.code, "APP_UPDATE_REQUIRED");
    assert.equal(out.body.msg, "Please update the app to continue.");
    assert.equal(out.body.storeUrl, PLAY_STORE_URL);
    assert.equal(out.body.minBuild, 16);
  });
});

test("middleware lets through builds at or above the minimum", async () => {
  await withEnv({ APP_MIN_BUILD_ANDROID: "16" }, () => {
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.0.0+16" }).nextCalled, true);
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.2.0+40" }).nextCalled, true);
  });
});

test("middleware never blocks undeclared clients (web, curl, old app builds)", async () => {
  await withEnv({ APP_MIN_BUILD_ANDROID: "99", APP_MIN_BUILD_IOS: "99" }, () => {
    assert.equal(run({}).nextCalled, true);
    assert.equal(run({ "user-agent": "Dart/3.5 (dart:io)" }).nextCalled, true);
    assert.equal(run({ "x-client-platform": "android" }).nextCalled, true); // no version
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "garbage" }).nextCalled, true);
    assert.equal(run({ "x-app-version": "1.0.0+1" }).nextCalled, true); // no platform
    assert.equal(run({ "x-client-platform": "windows", "x-app-version": "1.0.0+1" }).nextCalled, true);
  });
});

test("minimums are per platform", async () => {
  await withEnv({ APP_MIN_BUILD_IOS: "20" }, () => {
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.0.0+1" }).nextCalled, true);
    assert.equal(run({ "x-client-platform": "ios", "x-app-version": "1.0.0+19" }).status, 426);
  });
});

test("sign-up routes (and only those) carry the version gate", () => {
  const router = require("../routes/auth");
  const gated = new Set();
  const ungated = new Set();
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const has = layer.route.stack.some((l) => l.handle === requireMinAppVersion);
    (has ? gated : ungated).add(`${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  }
  assert.deepEqual([...gated].sort(), ["POST /google", "POST /register", "POST /send-register-otp"]);
  assert.ok(ungated.has("POST /login"));
  assert.ok(ungated.has("POST /refresh"));
});

test("GET /api/app/version serves the config, uncached", async () => {
  const app = express();
  app.use("/api/app", require("../routes/appVersion"));
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try {
    await withEnv({ APP_MIN_BUILD_ANDROID: "16", APP_LATEST_BUILD_ANDROID: "18" }, async () => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/app/version`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(await res.json(), {
        android: { minBuild: 16, latestBuild: 18, storeUrl: PLAY_STORE_URL, forceStoreUpdate: false },
        ios: { minBuild: 0, latestBuild: 0, storeUrl: "", forceStoreUpdate: false },
      });
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("forceStoreUpdate: unset -> false, 'true' -> true (any case, trimmed), anything else -> false", async () => {
  await withEnv({}, () => {
    assert.equal(getPlatformConfig("android").forceStoreUpdate, false);
    assert.equal(getPlatformConfig("ios").forceStoreUpdate, false);
  });
  for (const value of ["true", "TRUE", " True "]) {
    await withEnv({ APP_FORCE_STORE_UPDATE_ANDROID: value }, () => assert.equal(getPlatformConfig("android").forceStoreUpdate, true, value));
  }
  for (const value of ["", "false", "1", "yes", "on", "truee", "0", "abc"]) {
    await withEnv({ APP_FORCE_STORE_UPDATE_ANDROID: value, APP_FORCE_STORE_UPDATE_IOS: value }, () => {
      assert.equal(getPlatformConfig("android").forceStoreUpdate, false, `"${value}"`);
      assert.equal(getPlatformConfig("ios").forceStoreUpdate, false, `"${value}"`);
    });
  }
});

test("forceStoreUpdate is per platform", async () => {
  await withEnv({ APP_FORCE_STORE_UPDATE_IOS: "true" }, () => {
    const config = getAppVersionConfig();
    assert.equal(config.android.forceStoreUpdate, false);
    assert.equal(config.ios.forceStoreUpdate, true);
  });
});

test("GET /api/app/version carries forceStoreUpdate, and builds 18 and older ignore it", async () => {
  const app = express();
  app.use("/api/app", require("../routes/appVersion"));
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try {
    await withEnv({ APP_MIN_BUILD_ANDROID: "16", APP_LATEST_BUILD_ANDROID: "19", APP_FORCE_STORE_UPDATE_ANDROID: "true" }, async () => {
      const body = await (await fetch(`http://127.0.0.1:${server.address().port}/api/app/version`)).json();
      assert.equal(body.android.forceStoreUpdate, true);
      assert.equal(body.ios.forceStoreUpdate, false);

      // What build 18's AppVersionService reads (lib/services/app_update_service.dart): platform object -> minBuild, latestBuild, storeUrl.
      // It never looks at any other key, so the new field cannot change its decision.
      const old = body.android;
      assert.equal(old.minBuild, 16);
      assert.equal(old.latestBuild, 19);
      assert.equal(old.storeUrl, PLAY_STORE_URL);
      const { forceStoreUpdate, ...legacyShape } = old;
      assert.deepEqual(legacyShape, { minBuild: 16, latestBuild: 19, storeUrl: PLAY_STORE_URL });
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the sign-up version gate ignores forceStoreUpdate (only minBuild blocks)", async () => {
  await withEnv({ APP_MIN_BUILD_ANDROID: "16", APP_FORCE_STORE_UPDATE_ANDROID: "true" }, () => {
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.0.0+18" }).nextCalled, true);
    assert.equal(run({ "x-client-platform": "android", "x-app-version": "1.0.0+15" }).status, 426);
  });
});
