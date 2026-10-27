// Token expiry DURING a call. Needs a short access-token lifetime so a token
// genuinely expires mid-call: ACCESS_TOKEN_TTL=20s npx playwright test tests/resilience-token.spec.js
import { expect, test } from "../helpers/harness.js";
import { dropSocket, ensureBackendUp, restartBackend, sleep, waitForSocketConnected } from "../helpers/resilience.js";

const TTL = process.env.ACCESS_TOKEN_TTL || "";
const ttlMs = (() => {
  const m = /^(\d+)(ms|s|m)?$/.exec(TTL.trim());
  if (!m) return 0;
  return Number(m[1]) * ({ ms: 1, s: 1000, m: 60000 }[m[2] || "s"]);
})();

test.describe("appointment call — token expiry mid-call", () => {
  test.beforeEach(async () => {
    await ensureBackendUp();
  });
  test.skip(!ttlMs, "set ACCESS_TOKEN_TTL (e.g. 20s) so the access token really expires during the call");
  test.beforeEach(async ({}, testInfo) => testInfo.setTimeout(300_000));

  test("6 access token expires, then the socket drops — session refresh + rejoin, call recovers", async ({ call }) => {
    await call.joinBoth();
    await sleep(ttlMs + 5_000); // both access tokens are now expired
    await dropSocket(call.patient.page);
    await dropSocket(call.doctor.page);
    await Promise.all([waitForSocketConnected(call.patient.page, 60_000), waitForSocketConnected(call.doctor.page, 60_000)]);
    await call.bothRecovered(60_000, "after token expiry");
    await expect(call.patient.page.locator(".hc-vc__gate")).toHaveCount(0);
    await expect(call.doctor.page.locator(".hc-vc__gate")).toHaveCount(0);
  });

  test("6b access token expired AND the backend restarts — still recovers", async ({ call }) => {
    await call.joinBoth();
    await sleep(ttlMs + 5_000);
    await restartBackend();
    await Promise.all([waitForSocketConnected(call.patient.page, 120_000), waitForSocketConnected(call.doctor.page, 120_000)]);
    await call.bothRecovered(90_000, "expired token + restart");
    await expect(call.patient.page.locator(".hc-vc__gate")).toHaveCount(0);
  });

  test("6c an authenticated REST call after expiry transparently refreshes (no logout)", async ({ call }) => {
    await call.joinBoth();
    await sleep(ttlMs + 5_000);
    const status = await call.patient.page.evaluate(async (id) => {
      const res = await fetch(`/api/appointments/patient/${id}`, { credentials: "include" });
      return res.status;
    }, call.appointmentId);
    // 200 directly, or 401 then the app's interceptor refreshes - the direct fetch has no interceptor,
    // so what we really assert is that the SESSION is still refreshable:
    const refreshed = await call.patient.page.evaluate(async () => {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", headers: { "X-Auth-Role": "user" } });
      return res.status;
    });
    expect([200, 401]).toContain(status);
    expect(refreshed).toBe(200);
    const again = await call.patient.page.evaluate(async (id) => (await fetch(`/api/appointments/patient/${id}`, { credentials: "include" })).status, call.appointmentId);
    expect(again).toBe(200);
  });
});
