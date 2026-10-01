// Session-expiry / token-refresh reliability — covers the real bug found
// this session: AdminContext.jsx had no refresh-on-mount fallback (unlike
// AuthContext.jsx/DoctorAuthContext.jsx), and api.js's reactive 401 handler
// silently discarded a successful refresh's tokens whenever the triggering
// request's role couldn't be inferred from its URL, leaving the session
// permanently stuck instead of recovering. See api.js, AuthContext.jsx,
// DoctorAuthContext.jsx, AdminContext.jsx, App.jsx's SessionTimeoutManager.
//
// Requires ACCESS_TOKEN_TTL set short (e.g. "60s") when invoking Playwright
// — playwright.config.js's webServer env passes this straight through to
// the backend, and verifyToken.js's own gate refuses to honor it at all
// when NODE_ENV=production. Skips itself entirely if the override isn't
// set, since these tests would otherwise wait out the real 15-minute
// expiry.
import { test, expect } from "@playwright/test";
import { newParty, waitForVideoFlowing } from "../helpers/harness.js";
import { DOCTOR_STATE, PATIENT_STATE, ADMIN_STATE } from "../global-setup.js";
import { credentials } from "../helpers/env.js";

function parseTtlMs(raw) {
  const match = /^(\d+)(s|m)?$/i.exec(String(raw || "").trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  return value * (unit === "m" ? 60_000 : 1_000);
}

const TTL_MS = parseTtlMs(process.env.ACCESS_TOKEN_TTL);
const IDLE_MS = TTL_MS ? TTL_MS + 15_000 : 0;

test.describe("session refresh reliability", () => {
  test.skip(!TTL_MS, "Set ACCESS_TOKEN_TTL (e.g. ACCESS_TOKEN_TTL=60s) to run these — see playwright.config.js");
  test.skip(!process.env.TEST_ADMIN_EMAIL, "TEST_ADMIN_EMAIL is not set (seeded automatically in local mode)");

  // Runs first, deliberately: it needs global-setup's ADMIN_STATE snapshot
  // to still be within its TTL at the moment this test's FIRST navigation
  // happens, with no refresh having occurred yet for this session. Once the
  // other two tests below have run (each idles past TTL for ~IDLE_MS), that
  // snapshot is stale enough that this test's own first page load would
  // itself trigger a real recovery refresh, populating a fresh in-memory
  // bearer token this test's cookie-corruption never touches — the session
  // would then still work despite the "dead" cookies, which is actually the
  // fix working correctly, just not what THIS test is trying to isolate.
  test("invalid session: refresh genuinely fails, shows a clear message, redirects to login, returns to the same page after logging back in", async ({
    browser,
    baseURL,
  }) => {
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const target = "/admin-dashboard/direct-video-consultation/calls";
      await admin.page.goto(target, { waitUntil: "domcontentloaded" });
      await expect(admin.page.getByRole("heading", { name: "Direct Video Calls" })).toBeVisible({ timeout: 10_000 });

      // A genuinely dead session — both cookies invalid, not just an
      // expired-but-refreshable access token.
      await admin.context.clearCookies();
      await admin.context.addCookies([
        { name: "adminToken", value: "invalid.invalid.invalid", url: baseURL },
        { name: "adminRefreshToken", value: "invalid.invalid.invalid", url: baseURL },
      ]);

      // Trigger: clicking the alerts bell fires an immediate authenticated
      // call (DirectCallAlertsBell.jsx's openPanel — GET .../alerts), not
      // gated by skipAuthRefresh, so its 401 goes through the real
      // reactive refresh-then-retry path this fix targets. Deterministic
      // and fast — waiting on the bell's own 30s background poll instead
      // worked (confirmed manually) but made this test's timing margin
      // uncomfortably tight against its own poll-cycle alignment.
      await admin.page.getByRole("button", { name: "Direct call alerts" }).click();
      await expect(admin.page).toHaveURL(/\/adminauth/, { timeout: 15_000 });
      // .first(): AdminAuth.jsx renders both the admin and super-admin
      // panels in the DOM at once (CSS just flips which is visually
      // active), each showing the same error message.
      await expect(admin.page.getByText(/session has expired/i).first()).toBeVisible();

      const creds = credentials();
      const adminFormBox = admin.page.locator(".login-form-box");
      await adminFormBox.locator('input[name="email"]').fill(creds.admin.email);
      await adminFormBox.locator('input[name="password"]').fill(creds.admin.password);
      await adminFormBox.getByRole("button", { name: /sign in/i }).click();

      // Back on the exact page that was open when the session died.
      await expect(admin.page).toHaveURL(new RegExp(target.replace(/\//g, "\\/")), { timeout: 15_000 });
    } finally {
      await admin.context.close();
    }
  });

  test("admin: idle past token expiry, then create a link and open the Calls list — no re-login", async ({
    browser,
    baseURL,
  }) => {
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      await admin.page.waitForTimeout(IDLE_MS);

      await admin.page.goto("/admin-dashboard/direct-video-consultation", { waitUntil: "domcontentloaded" });
      await expect(admin.page).not.toHaveURL(/\/adminauth/);
      await admin.page.getByRole("button", { name: "Generate Secure Link" }).click();
      await expect(admin.page.getByText("Generated video consultation link")).toBeVisible({ timeout: 15_000 });

      await admin.page.goto("/admin-dashboard/direct-video-consultation/calls", { waitUntil: "domcontentloaded" });
      await expect(admin.page).not.toHaveURL(/\/adminauth/);
      await expect(admin.page.getByRole("heading", { name: "Direct Video Calls" })).toBeVisible({ timeout: 10_000 });
    } finally {
      await admin.context.close();
    }
  });

  test("doctor and patient: idle past token expiry, then join an appointment call — connects", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      await Promise.all([doctor.page.waitForTimeout(IDLE_MS), patient.page.waitForTimeout(IDLE_MS)]);

      const appointmentId = process.env.TEST_APPOINTMENT_ID;
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 30_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 30_000, label: "patient" }),
      ]);
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });
});
