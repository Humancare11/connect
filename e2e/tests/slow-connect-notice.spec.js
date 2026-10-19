// "Still trying" notice: joined + peer present but no media for 30s -> the
// notice shows with Retry / Leave; once ICE is allowed again it goes away and
// the call recovers. ICE is blocked from the TEST side by making
// new connections relay-only with no relay servers (no candidates, no media).
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createFreshAppointment } from "../helpers/directRoomSeed.js";
import { expect, newParty, test, waitForVideoFlowing } from "../helpers/harness.js";
import { ensureBackendUp, sleep } from "../helpers/resilience.js";

const NOTICE_TEXT = "Connection is taking longer than usual. Still trying";

async function blockIce(context) {
  await context.addInitScript(() => {
    window.__blockIce = true;
    const Orig = window.RTCPeerConnection;
    // While blocked, a connection is built relay-only with no relay servers:
    // it gathers no candidates and can never connect. A rebuild after the
    // flag is cleared is a normal connection.
    window.RTCPeerConnection = class extends Orig {
      constructor(config = {}, ...rest) {
        super(window.__blockIce ? { ...config, iceServers: [], iceTransportPolicy: "relay" } : config, ...rest);
      }
    };
  });
}

test.describe("still-trying notice", () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(240_000);
    await ensureBackendUp();
  });

  test("appears within 45s when ICE is blocked, disappears and the call recovers once unblocked", async ({ browser, baseURL }) => {
    const { appointmentId } = await createFreshAppointment({
      mongoUri: LOCAL_MONGO_URI,
      doctorEmail: process.env.TEST_DOCTOR_EMAIL,
      patientEmail: process.env.TEST_PATIENT_EMAIL,
    });
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      await Promise.all([blockIce(doctor.context), blockIce(patient.context)]);
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url, { waitUntil: "domcontentloaded" }), patient.page.goto(url, { waitUntil: "domcontentloaded" })]);

      // not before ~30s of waiting...
      await sleep(15_000);
      await expect(doctor.page.getByText(NOTICE_TEXT)).toHaveCount(0);
      // ...but within 45s of both being in
      const started = Date.now();
      await expect(doctor.page.getByText(NOTICE_TEXT)).toBeVisible({ timeout: 45_000 });
      await expect(patient.page.getByText(NOTICE_TEXT)).toBeVisible({ timeout: 15_000 });
      const waited = (Date.now() - started + 15_000) / 1000;
      expect(waited, "notice should not appear before ~30s").toBeGreaterThan(27);
      await expect(doctor.page.locator(".hc-vc__slow-connect-notice").getByRole("button", { name: "Retry" })).toBeVisible();
      await expect(doctor.page.locator(".hc-vc__slow-connect-notice").getByRole("button", { name: "Leave" })).toBeVisible();

      // unblock, then use the notice's own Retry (full rebuild)
      await Promise.all([doctor.page.evaluate(() => (window.__blockIce = false)), patient.page.evaluate(() => (window.__blockIce = false))]);
      await doctor.page.locator(".hc-vc__slow-connect-notice").getByRole("button", { name: "Retry" }).click();

      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 60_000, label: "doctor after unblock" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 60_000, label: "patient after unblock" }),
      ]);
      await expect(doctor.page.getByText(NOTICE_TEXT)).toHaveCount(0, { timeout: 10_000 });
      await expect(patient.page.getByText(NOTICE_TEXT)).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });
});
