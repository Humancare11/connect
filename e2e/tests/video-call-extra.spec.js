// Extra appointment-call (VideoCall.jsx) coverage requested for a wider
// pre-release sweep: quick start, mic/camera off together, permission
// denied/slow, page refresh (not just Leave+rejoin), screen share, call-end
// cleanup, and a long call. Nothing in the app is modified — read-only
// checks against the real running app, same as tests/video-call.spec.js.
import fs from "node:fs";
import path from "node:path";
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import {
  assertFramesFlowing,
  expect,
  jsHeapUsed,
  newParty,
  overrideGetUserMedia,
  readInbound,
  test,
  waitForRetryButton,
  waitForVideoFlowing,
} from "../helpers/harness.js";

const RESULTS_DIR = path.resolve("test-results");
const START = /requestPcRebuild:START/;
const RECOVERY_START = /requestPcRebuild:START(?!.*"reason":"missing")/;

async function writeLogs(name, doctor, patient) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const base = path.join(RESULTS_DIR, name);
  fs.writeFileSync(`${base}-doctor.log`, await doctor.logs.text());
  fs.writeFileSync(`${base}-patient.log`, await patient.logs.text());
}

test.describe("appointment call — extra coverage", () => {
  test("a: quick start — both flowing within 8s, no rebuild", async ({ call }) => {
    const { doctor, patient } = call;
    const url = `/video-call/${call.appointmentId}`;
    const startedAt = Date.now();
    await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
    await Promise.all([
      waitForVideoFlowing(doctor.page, { timeoutMs: 8_000, label: "doctor" }),
      waitForVideoFlowing(patient.page, { timeoutMs: 8_000, label: "patient" }),
    ]);
    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs, "time to first video on both sides").toBeLessThan(8_000);
    expect(await doctor.logs.count(RECOVERY_START), "doctor rebuilds on plain start").toBe(0);
    expect(await patient.logs.count(RECOVERY_START), "patient rebuilds on plain start").toBe(0);
  });

  test("c: camera AND mic off on both sides for 60s — no rebuild, call stays up", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await Promise.all([
      doctor.page.getByTitle("Turn camera off").click(),
      doctor.page.getByTitle("Mute microphone").click(),
      patient.page.getByTitle("Turn camera off").click(),
      patient.page.getByTitle("Mute microphone").click(),
    ]);

    await doctor.page.waitForTimeout(60_000);

    const doctorState = await readInbound(doctor.page);
    const patientState = await readInbound(patient.page);
    expect(doctorState.state, "doctor pc still connected").toBe("connected");
    expect(patientState.state, "patient pc still connected").toBe("connected");
    expect(await doctor.logs.count(RECOVERY_START), "doctor recovery rebuilds").toBe(0);
    expect(await patient.logs.count(RECOVERY_START), "patient recovery rebuilds").toBe(0);
    expect(
      await doctor.logs.count(/mediaStallWatchdog:TRIGGERING_rebuild/),
      "doctor watchdog fired",
    ).toBe(0);
    expect(
      await patient.logs.count(/mediaStallWatchdog:TRIGGERING_rebuild/),
      "patient watchdog fired",
    ).toBe(0);
  });

  test("d1: patient camera/mic permission denied — no crash, error UI shown", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    await overrideGetUserMedia(patient.page, { kind: "deny" });
    const url = `/video-call/${process.env.TEST_APPOINTMENT_ID}`;
    try {
      await Promise.all([
        // waitUntil: "domcontentloaded" — the default "load" has occasionally
        // hung indefinitely in this environment on an unrelated background
        // beacon request that never settles; app readiness doesn't depend on
        // it and every other assertion below has its own real timeout.
        doctor.page.goto(url, { timeout: 20_000, waitUntil: "domcontentloaded" }),
        patient.page.goto(url, { timeout: 20_000, waitUntil: "domcontentloaded" }),
      ]);
      // Patient must land on the camera-error UI with a way out, not spin
      // forever on "Connecting…".
      await expect(patient.page.locator(".hc-vc__error-bar")).toBeVisible({ timeout: 15_000 });
      await expect(
        patient.page.locator(".hc-vc__error-bar button", { hasText: "Retry" }),
      ).toBeVisible();
      // Doctor's page must still be alive and responsive (no crash) even
      // though its only peer never published any media.
      await expect(doctor.page.locator("body")).toBeVisible();
      expect(await doctor.logs.count(/pageerror/), "doctor page errors").toBe(0);
      expect(await patient.logs.count(/pageerror/), "patient page errors").toBe(0);
    } finally {
      await writeLogs("d1-permission-denied", doctor, patient);
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("d2: patient permission prompt answered after 12s — call still connects", async ({
    browser,
    baseURL,
  }) => {
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    // Longer than VideoCall.jsx's MEDIA_ACQUIRE_TIMEOUT_MS (8s), so this
    // actually exercises the "continue without media, attach late" path
    // end-to-end against a real (delayed) fake device, not a synthetic stall.
    await overrideGetUserMedia(patient.page, { kind: "delay", delayMs: 12_000 });
    const url = `/video-call/${process.env.TEST_APPOINTMENT_ID}`;
    try {
      await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 30_000, label: "doctor (late patient media)" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 30_000, label: "patient" }),
      ]);
    } finally {
      await writeLogs("d2-slow-permission-prompt", doctor, patient);
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("e1: doctor refreshes the page mid-call — both recover", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();
    await doctor.page.reload();
    await call.bothFlowing(30_000, "after doctor page refresh");
  });

  test("e2: patient refreshes the page mid-call — both recover", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();
    await patient.page.reload();
    await call.bothFlowing(30_000, "after patient page refresh");
  });

  test("f: screen share start/stop — call keeps working", async ({ call }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    const shareBtn = doctor.page.locator(".hc-vc__btn--share");
    await expect(shareBtn).toBeEnabled({ timeout: 5_000 });
    await shareBtn.click();

    // Either it actually starts (headless Chromium's fake screen source) or
    // the app declines gracefully — either way nothing should crash and the
    // patient's inbound video must keep flowing throughout.
    await patient.page.waitForTimeout(3_000);
    expect(await doctor.logs.count(/pageerror/), "doctor page errors during share").toBe(0);
    await assertFramesFlowing(patient.page, 5_000, { label: "patient during screen share" });

    if (await shareBtn.getAttribute("title") === "Stop sharing") {
      await shareBtn.click();
    }
    await assertFramesFlowing(patient.page, 5_000, { label: "patient after stopping share" });
    expect(await doctor.logs.count(/pageerror/), "doctor page errors after stopping share").toBe(0);
  });

  test("g: call end — leaves cleanly, tracks stopped, pc closed, no lingering activity", async ({
    call,
  }) => {
    const { doctor, patient } = call;
    await call.joinBoth();

    await patient.page.getByTitle("Leave call").click();
    await patient.page
      .locator(".hc-vc__confirm-btn--danger", { hasText: "Leave Call" })
      .click();
    await patient.page.waitForURL((u) => !u.pathname.startsWith("/video-call"), { timeout: 15_000 });

    // Local tracks must actually be stopped, not just detached — otherwise
    // the camera/mic indicator stays on after the user has left the call.
    const tracksStillLive = await patient.page.evaluate(() => {
      const pcs = (window.__e2e && window.__e2e.pcs) || [];
      const pc = pcs[pcs.length - 1];
      if (!pc) return false;
      return pc.getSenders().some((s) => s.track && s.track.readyState === "live");
    });
    expect(tracksStillLive, "a local track is still live after Leave Call").toBe(false);

    const pcClosed = await patient.page.evaluate(() => {
      const pcs = (window.__e2e && window.__e2e.pcs) || [];
      const pc = pcs[pcs.length - 1];
      return !pc || pc.signalingState === "closed";
    });
    expect(pcClosed, "peer connection closed after Leave Call").toBe(true);

    // No further rebuild/offer/answer activity should appear once the
    // patient is gone — a proxy for "no leftover timer kept firing".
    const before = await patient.logs.count(/RETRY-DEBUG/);
    await patient.page.waitForTimeout(6_000);
    const after = await patient.logs.count(/RETRY-DEBUG/);
    expect(after - before, "RETRY-DEBUG lines logged after leaving").toBe(0);

    // Doctor must not be stuck: it should see the patient as gone.
    await expect(doctor.page.getByText(/left|waiting/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("h: 5-minute call — stays connected, no repeated rebuilds, no log spam", async ({ call }) => {
    test.setTimeout(400_000);
    const { doctor, patient } = call;
    await call.joinBoth();

    const heapStart = await jsHeapUsed(doctor.page);
    await Promise.all([
      assertFramesFlowing(doctor.page, 300_000, { maxStallMs: 10_000, label: "doctor 5min" }),
      assertFramesFlowing(patient.page, 300_000, { maxStallMs: 10_000, label: "patient 5min" }),
    ]);
    const heapEnd = await jsHeapUsed(doctor.page);

    expect(await doctor.logs.count(RECOVERY_START), "doctor recovery rebuilds over 5min").toBe(0);
    expect(await patient.logs.count(RECOVERY_START), "patient recovery rebuilds over 5min").toBe(0);

    const doctorLineCount = (await doctor.logs.text()).split("\n").length;
    const patientLineCount = (await patient.logs.text()).split("\n").length;
    // Loose ceiling — stats polling etc. is expected; a real spam bug (a
    // tight loop) would blow well past this over 5 minutes.
    expect(doctorLineCount, "doctor console line count over 5min").toBeLessThan(20_000);
    expect(patientLineCount, "patient console line count over 5min").toBeLessThan(20_000);

    if (heapStart != null && heapEnd != null) {
      console.log(`[heap] doctor start=${heapStart} end=${heapEnd} deltaMB=${((heapEnd - heapStart) / 1e6).toFixed(1)}`);
    }
  });
});

void START;
