const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAllowedOrigins } = require("../utils/allowedOrigins");

test("production: no localhost origin, from the built-in list or from the environment", () => {
  const list = buildAllowedOrigins({ env: { CORS_ALLOWED_ORIGINS: "http://localhost:8080, http://127.0.0.1:5173, https://extra.example.com", FRONTEND_URL: "http://localhost:3000" }, nodeEnv: "production" });
  assert.ok(!list.some((o) => /localhost|127\.0\.0\.1/.test(o)));
  assert.ok(list.includes("https://humancareconnect.co"));
  assert.ok(list.includes("https://www.humancareconnect.co"));
  assert.ok(list.includes("https://uat.humancareconnect.co")); // stays until the buckets are confirmed separate
  assert.ok(list.includes("https://extra.example.com"));
});

test("production: no duplicates and a trailing slash is normalised", () => {
  const list = buildAllowedOrigins({ env: { FRONTEND_URL: "https://humancareconnect.co/" }, nodeEnv: "production" });
  assert.equal(list.filter((o) => o === "https://humancareconnect.co").length, 1);
});

test("outside production: localhost and UAT keep working", () => {
  for (const nodeEnv of ["development", "test", undefined]) {
    const list = buildAllowedOrigins({ env: {}, nodeEnv });
    assert.ok(list.includes("http://localhost:5173"));
    assert.ok(list.includes("http://localhost:3000"));
    assert.ok(list.includes("https://uat.humancareconnect.co"));
  }
});
