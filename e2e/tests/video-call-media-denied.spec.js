// Coverage for the CRITICAL fix: a side that denies/never gets camera+mic
// permission must still join the call receive-only (not strand the other
// side on "Waiting for…" forever), and must start being seen/heard once it
// grants permission via the camera-error banner's "Retry". Also covers the
// HIGH fix: that same Retry button must not hang forever on a stuck prompt.
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import {
  expect,
  newParty,
  overrideGetUserMedia,
  readInbound,
  setGumMode,
  test,
  waitForVideoFlowing,
} from "../helpers/harness.js";

const url = () => `/video-call/${process.env.TEST_APPOINTMENT_ID}`;

// The camera-error banner's own Retry button (retryMediaPermissions) — a
// DIFFERENT element from harness.js's retryButton(), which targets the
// reconnect-stalled banner (forceReconnect/requestPcRebuild) used by
// video-call.spec.js. Reusing that one here would query an element that
// never exists in this scenario, and Playwright's .click() would then wait
// on it indefinitely.
function mediaErrorRetryButton(page) {
  return page.locator(".hc-vc__error-bar button");
}

test.describe("appointment call — camera/mic denied", () => {
  test("patient denies camera/mic: joins receive-only, doctor sees it joined, then patient grants via Retry", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    await overrideGetUserMedia(patient.page, { kind: "deny" });
    try {
      await Promise.all([
        doctor.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
        patient.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
      ]);

      // Patient: camera-error banner with a way to retry, not a hang.
      await expect(patient.page.locator(".hc-vc__error-bar")).toBeVisible({ timeout: 15_000 });

      // Patient still SEES and HEARS the doctor despite sending nothing.
      await waitForVideoFlowing(patient.page, { timeoutMs: 20_000, label: "patient (recvonly)" });

      // Doctor must know the patient is actually in the call — this is the
      // CRITICAL bug: previously joinRoom() was never called on media
      // failure, so peer-joined never fired and the doctor never left
      // "Waiting for patient…". DOM-based (not log-based): a captured
      // console message can occasionally hang CDP argument serialization
      // indefinitely, and a UI check is the more direct proof anyway. The
      // "Live" pill only renders once inCall is true, which requires the
      // doctor to have actually connected to the patient's pc.
      await expect(doctor.page.locator(".hc-vc__live-pill")).toBeVisible({ timeout: 15_000 });

      // Patient grants permission and taps Retry — the doctor must start
      // receiving the patient's audio/video without a full rebuild.
      await setGumMode(patient.page, { kind: "allow" });
      await mediaErrorRetryButton(patient.page).click();
      await waitForVideoFlowing(doctor.page, { timeoutMs: 20_000, label: "doctor (after patient Retry)" });
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("doctor denies camera/mic: joins receive-only, patient still receives doctor's video after doctor's Retry", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    await overrideGetUserMedia(doctor.page, { kind: "deny" });
    try {
      await Promise.all([
        doctor.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
        patient.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
      ]);

      await expect(doctor.page.locator(".hc-vc__error-bar")).toBeVisible({ timeout: 15_000 });

      // Patient is still the offerer and has real media — doctor (no local
      // tracks) must still join and receive the patient's video. handleOffer
      // answers recvonly immediately (rather than waiting silently for local
      // media, which previously left the offerer's pc stuck re-offering
      // forever against a side that never answered at all).
      await waitForVideoFlowing(doctor.page, { timeoutMs: 20_000, label: "doctor (recvonly)" });

      // Patient's pc must at least reach "connected" (not stuck waiting) even
      // though nothing arrives from the doctor yet.
      await expect
        .poll(async () => (await readInbound(patient.page)).state, { timeout: 15_000 })
        .toBe("connected");

      // A real user takes more than an instant to grant a permission prompt
      // — past REBUILD_GRACE_MS, so the peer's request-peer-rebuild nudge
      // below isn't itself ignored as "pc already fresh".
      await patient.page.waitForTimeout(6_000);

      await setGumMode(doctor.page, { kind: "allow" });
      await mediaErrorRetryButton(doctor.page).click();
      await waitForVideoFlowing(patient.page, { timeoutMs: 20_000, label: "patient (after doctor Retry)" });
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("camera/mic Retry does not hang when the permission prompt never answers", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    await overrideGetUserMedia(patient.page, { kind: "deny" });
    try {
      await Promise.all([
        doctor.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
        patient.page.goto(url(), { timeout: 20_000, waitUntil: "domcontentloaded" }),
      ]);
      await expect(patient.page.locator(".hc-vc__error-bar")).toBeVisible({ timeout: 15_000 });

      // Longer than RETRY_MEDIA_PERMISSIONS_TIMEOUT_MS (10s): the prompt
      // never gets answered in time.
      await setGumMode(patient.page, { kind: "delay", delayMs: 20_000 });
      const btn = mediaErrorRetryButton(patient.page);
      await btn.click();
      // retryMediaPermissions clears camError optimistically the instant it
      // starts, so the whole banner (there's no separate "Retrying…" state
      // visible here) disappears immediately on click.
      await expect(patient.page.locator(".hc-vc__error-bar")).toBeHidden({ timeout: 2_000 });

      // Must give up and hand control back — not stay hidden/hung forever:
      // the error + working Retry button must return within ~10s, not the
      // original 20s the prompt is still pretending to think about.
      await expect(patient.page.locator(".hc-vc__error-bar")).toBeVisible({ timeout: 12_000 });
      await expect(btn).toHaveText("Retry", { timeout: 1_000 });
      await expect(btn).toBeEnabled();
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });
});
