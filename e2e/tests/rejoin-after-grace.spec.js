// A patient who is gone longer than the server's 30s leave grace and comes back
// must end with REMOTE VIDEO RENDERING on both sides, after at most one rebuild
// per side.
//
// context.setOffline() only cuts HTTP and the signaling socket: WebRTC media
// keeps flowing through it. So the call here is relay-only through a local TURN
// server which is stopped for the outage, cutting media as well. Needs
// E2E_TURN_DIR (see README, "Relay / TURN scenarios").
import fs from "node:fs";
import { request } from "@playwright/test";
import { ADMIN_STATE, DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createFreshAppointment } from "../helpers/directRoomSeed.js";
import {
  expect,
  newParty,
  overrideGetUserMedia,
  setGumMode,
  test,
  waitForVideoFlowing,
} from "../helpers/harness.js";
import { ensureBackendUp, forceRelayOnly, sleep, startTurn, stopTurn, turnAvailable } from "../helpers/resilience.js";

// What a person would see: the remote <video> has a size and new frames keep
// being presented.
async function renderedFrames(page, windowMs = 5000) {
  return page.evaluate(async (ms) => {
    const video = document.querySelector("video.hc-vc__main-video");
    if (!video) return { width: 0, frames: 0 };
    let frames = 0;
    let handle = null;
    const onFrame = () => {
      frames += 1;
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    await new Promise((resolve) => setTimeout(resolve, ms));
    video.cancelVideoFrameCallback(handle);
    return { width: video.videoWidth, frames };
  }, windowMs);
}

async function expectRendering(party, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  do {
    last = await renderedFrames(party.page);
    // Advancing: headless Chromium may present less than one frame a second.
    // A frozen or black picture presents none.
    if (last.width > 0 && last.frames >= 2) return;
  } while (Date.now() < deadline);
  throw new Error(`${label}: remote video is not rendering (videoWidth=${last.width}, frames in 5s=${last.frames})`);
}

const rebuilds = (party) => party.logs.count(/requestPcRebuild:START/);

// A real webcam or phone camera takes seconds to reopen after a rebuild; the
// fake test camera is instant, which hides ordering bugs.
const SCENARIOS = [
  { seconds: 25 },
  { seconds: 35 },
  { seconds: 70 },
  { seconds: 35, cameraDelayMs: 3000 },
  { seconds: 70, cameraDelayMs: 3000 },
];

test.describe("rejoin after the leave grace", () => {
  test.skip(!turnAvailable(), "needs a local TURN server (E2E_TURN_DIR)");

  test.beforeEach(async () => {
    await ensureBackendUp();
    await startTurn();
  });
  test.afterAll(async () => {
    await stopTurn();
  });

  for (const { seconds, cameraDelayMs = 0 } of SCENARIOS) {
    const name = `${seconds}s${cameraDelayMs ? `, camera reopens after ${cameraDelayMs / 1000}s` : ""}`;
    test(`patient offline ${name}: both sides render remote video again, one rebuild each at most`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(360_000);
      const { appointmentId } = await createFreshAppointment({
        mongoUri: LOCAL_MONGO_URI,
        doctorEmail: process.env.TEST_DOCTOR_EMAIL,
        patientEmail: process.env.TEST_PATIENT_EMAIL,
      });
      // permissions: [] — see helpers/relayCall.js
      const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL, { permissions: [] });
      const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL, { permissions: [] });
      const admin = await request.newContext({ baseURL, storageState: ADMIN_STATE });
      try {
        await forceRelayOnly(doctor.context);
        await forceRelayOnly(patient.context);
        await overrideGetUserMedia(doctor.page, { kind: "allow" });
        await overrideGetUserMedia(patient.page, { kind: "allow" });
        const url = `/video-call/${appointmentId}`;
        await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
        await Promise.all([
          waitForVideoFlowing(doctor.page, { timeoutMs: 45_000, label: "doctor" }),
          waitForVideoFlowing(patient.page, { timeoutMs: 45_000, label: "patient" }),
        ]);
        await Promise.all([expectRendering(doctor, "doctor before"), expectRendering(patient, "patient before")]);

        const before = { doctor: await rebuilds(doctor), patient: await rebuilds(patient), at: Date.now() };
        if (cameraDelayMs) {
          // Only later camera requests (the rebuilds) are slow.
          const slow = { kind: "delay", delayMs: cameraDelayMs };
          await setGumMode(doctor.page, slow);
          await setGumMode(patient.page, slow);
        }
        await patient.context.setOffline(true);
        await stopTurn(); // media dies with the network
        await sleep(seconds * 1000);
        await startTurn();
        await patient.context.setOffline(false);

        await Promise.all([
          expectRendering(doctor, "doctor after", 90_000),
          expectRendering(patient, "patient after", 90_000),
        ]);
        // Still rendering once the recovery has settled (not a brief flash).
        await sleep(15_000);
        await Promise.all([expectRendering(doctor, "doctor settled", 15_000), expectRendering(patient, "patient settled", 15_000)]);
        for (const [who, party] of [["doctor", doctor], ["patient", patient]]) {
          await expect.soft(party.page.locator(".hc-vc__video-paused"), `${who}: no "Video paused" notice`).toHaveCount(0);
          await expect.soft(party.page.locator(".hc-vc__playback-unblock"), `${who}: no "Tap to resume" banner`).toHaveCount(0);
        }

        expect.soft((await rebuilds(doctor)) - before.doctor, "doctor rebuilds (console)").toBeLessThanOrEqual(1);
        expect.soft((await rebuilds(patient)) - before.patient, "patient rebuilds (console)").toBeLessThanOrEqual(1);
        const report = await (await admin.get(`/api/call-reports/${appointmentId}`)).json();
        const since = (report.timeline || []).filter((e) => new Date(e.at).getTime() >= before.at);
        console.log(`[rejoin ${name}] report:`, since.map((e) => `${e.type}/${e.role}`).join(", "));
        for (const role of ["doctor", "patient"]) {
          expect
            .soft(since.filter((e) => e.type === "pc_rebuild" && e.role === role).length, `${role} rebuilds (report)`)
            .toBeLessThanOrEqual(1);
        }
      } finally {
        fs.mkdirSync("test-results", { recursive: true });
        const tag = `rejoin-${seconds}s${cameraDelayMs ? "-slowcam" : ""}`;
        fs.writeFileSync(`test-results/${tag}-doctor.log`, await doctor.logs.text());
        fs.writeFileSync(`test-results/${tag}-patient.log`, await patient.logs.text());
        await admin.dispose();
        await doctor.context.close();
        await patient.context.close();
      }
    });
  }
});
