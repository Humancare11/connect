// Appointment video call (VideoCall.jsx): reconnect / Retry behaviour.
//
// These tests read the app's own "[RETRY-DEBUG]" console lines (RETRY_DEBUG in
// frontend/src/utils/retryDebug.js must be true) and the real inbound-video
// frame counter of each side's RTCPeerConnection.
import {
  assertFramesFlowing,
  expect,
  readInbound,
  retryButton,
  simulateStall,
  test,
  waitForRetryButton,
  waitForVideoFlowing,
} from "../helpers/harness.js";

// Any rebuild START, and only RECOVERY rebuilds: a "missing" START is the
// structural join-time rebuild (peer-joined arriving before this side's pc
// exists — exempt from the rate limit by design) and is timing-dependent, so
// "no rebuild" assertions must not count it.
const START = /requestPcRebuild:START/;
const RECOVERY_START = /requestPcRebuild:START(?!.*"reason":"missing")/;

test.describe("appointment call reconnect", () => {
  test("1 baseline - both join, video flows 30s, no rebuild", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();
    await Promise.all([
      assertFramesFlowing(doctor.page, 30_000, { label: "doctor" }),
      assertFramesFlowing(patient.page, 30_000, { label: "patient" }),
    ]);
    expect(await doctor.logs.count(RECOVERY_START), "doctor recovery rebuilds").toBe(0);
    expect(await patient.logs.count(RECOVERY_START), "patient recovery rebuilds").toBe(0);
  });

  test("2 patient taps Retry - video resumes, doctor detects rebuilt peer", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await simulateStall(patient.page);
    const btn = await waitForRetryButton(patient.page);
    await btn.click();

    await call.bothRecovered(10_000, "after patient Retry");
    expect(
      await doctor.logs.has(/peer_rebuilt_detected_via_fingerprint/),
      "doctor log should show peer_rebuilt_detected_via_fingerprint",
    ).toBe(true);
  });

  test("3 doctor taps Retry - video resumes, request-peer-rebuild sent and received", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await simulateStall(doctor.page);
    const btn = await waitForRetryButton(doctor.page);
    await btn.click();

    await call.bothRecovered(10_000, "after doctor Retry");
    expect(await doctor.logs.has(/request-peer-rebuild:SENT/), "doctor SENT").toBe(true);
    expect(await patient.logs.has(/request-peer-rebuild:RECEIVED/), "patient RECEIVED").toBe(true);
  });

  test("4 both tap Retry within 1s - video resumes, no rebuild loop", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await Promise.all([simulateStall(doctor.page), simulateStall(patient.page)]);
    const [doctorBtn, patientBtn] = await Promise.all([
      waitForRetryButton(doctor.page),
      waitForRetryButton(patient.page),
    ]);
    // Fire both DOM clicks in the same instant. (Playwright's own click()
    // waits for actionability, and the first Retry hides the other side's
    // banner via the peer rebuild request before the second click can land.)
    await Promise.all([
      doctorBtn.evaluate((el) => el.click()),
      patientBtn.evaluate((el) => el.click()),
    ]);

    await call.bothRecovered(15_000, "after both Retry");
    // Let any loop reveal itself, then count.
    await doctor.page.waitForTimeout(8_000);
    expect(await doctor.logs.count(START), "doctor rebuild STARTs").toBeLessThanOrEqual(2);
    expect(await patient.logs.count(START), "patient rebuild STARTs").toBeLessThanOrEqual(2);
    await call.bothRecovered(5_000, "still recovered after settle");
  });

  test("5 Retry tapped 3 times quickly - one rebuild, banner held as Reconnecting…", async ({ call }) => {
    const { patient } = call;
    await call.joinBoth();

    await simulateStall(patient.page);
    const btn = await waitForRetryButton(patient.page);
    // Three quick taps at the same spot.
    await btn.click({ clickCount: 3, delay: 30 });

    // After the first tap the banner must stay up, with the button disabled
    // and reading "Reconnecting…" (previously the tap hid the whole banner).
    const held = patient.page.locator(".hc-vc__reconnect-stalled-notice button", {
      hasText: "Reconnecting…",
    });
    await expect(held).toBeVisible({ timeout: 2_000 });
    await expect(held).toBeDisabled();

    await call.bothRecovered(15_000, "after triple tap");
    // ...and goes away once the connection is healthy (or the 5s hold ends).
    await expect(patient.page.locator(".hc-vc__reconnect-stalled-notice")).toBeHidden({
      timeout: 8_000,
    });
    await patient.page.waitForTimeout(3_000);

    expect(await patient.logs.count(/forceReconnect:TAPPED/), "forceReconnect taps handled").toBe(1);
    expect(
      await patient.logs.count(/requestPcRebuild:START.*"reason":"manual_retry"/),
      "manual_retry rebuild STARTs from the Retry taps",
    ).toBe(1);
    expect(await patient.logs.count(RECOVERY_START), "total recovery rebuild STARTs").toBe(1);
  });

  test("6 camera off on patient for 60s - watchdog does not rebuild", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await patient.page.getByTitle("Turn camera off").click();
    const before = await readInbound(doctor.page);
    await patient.page.waitForTimeout(60_000);
    const after = await readInbound(doctor.page);

    expect(await doctor.logs.count(/mediaStallWatchdog:TRIGGERING_rebuild/), "doctor watchdog").toBe(0);
    expect(await patient.logs.count(/mediaStallWatchdog:TRIGGERING_rebuild/), "patient watchdog").toBe(0);
    expect(await doctor.logs.count(RECOVERY_START), "doctor recovery rebuilds").toBe(0);
    expect(await patient.logs.count(RECOVERY_START), "patient recovery rebuilds").toBe(0);
    // Still alive: audio keeps flowing to the doctor while the camera is off.
    expect(after.audio.bytes).toBeGreaterThan(before.audio.bytes);
  });

  test("7 patient leaves and rejoins - video resumes, no rate-limit block", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    // Real UI leave: control-bar button, then confirm in the modal.
    await patient.page.getByTitle("Leave call").click();
    await patient.page
      .locator(".hc-vc__confirm-btn--danger", { hasText: "Leave Call" })
      .click();
    await patient.page.waitForURL((u) => !u.pathname.startsWith("/video-call"), { timeout: 15_000 });

    await patient.page.goto(`/video-call/${call.appointmentId}`);
    await call.bothFlowing(30_000, "after patient rejoin");

    expect(await doctor.logs.count(/BLOCKED_rate_limit/), "doctor rate-limit blocks").toBe(0);
    expect(await patient.logs.count(/BLOCKED_rate_limit/), "patient rate-limit blocks").toBe(0);
  });
});

// Keep unused-import linters quiet without changing behaviour.
void retryButton;
void waitForVideoFlowing;
