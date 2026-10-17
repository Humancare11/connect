// Resilience of the APPOINTMENT video call (doctor + patient): real network /
// socket / backend / media faults, and the call must recover on its own.
// Faults are injected from the TEST side (context.setOffline, closing the
// socket transport, killing the backend or TURN process, ending media tracks);
// nothing in the app is modified. "Recovered" always means: real inbound video
// frames increasing on BOTH sides, sendrecv negotiated, no error screen, and
// the signaling socket connected again.
import {
  assertFramesFlowing,
  bothRecovered,
  expect,
  newParty,
  overrideGetUserMedia,
  readInbound,
  test,
  waitForVideoFlowing,
} from "../helpers/harness.js";
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createFreshAppointment } from "../helpers/directRoomSeed.js";
import {
  dropSocket,
  ensureBackendUp,
  endLocalTracks,
  forceRelayOnly,
  inboundBytes,
  injectServerReply,
  liveLocalTracks,
  restartBackend,
  selectedCandidateTypes,
  sleep,
  socketState,
  startTurn,
  stopTurn,
  turnAvailable,
  waitForSocketConnected,
} from "../helpers/resilience.js";

const errorGate = (page) => page.locator(".hc-vc__gate");
const peerLeftNotice = (page) => page.locator(".hc-vc__peer-left-notice");

async function pageErrors(party) {
  return party.logs.count(/pageerror/);
}

// The state every scenario must end in.
async function expectHealthy(call, label, { timeoutMs = 60_000 } = {}) {
  const { doctor, patient } = call;
  await Promise.all([waitForSocketConnected(doctor.page, timeoutMs), waitForSocketConnected(patient.page, timeoutMs)]);
  await call.bothRecovered(timeoutMs, label);
  await expect(errorGate(doctor.page), `${label}: doctor error screen`).toHaveCount(0);
  await expect(errorGate(patient.page), `${label}: patient error screen`).toHaveCount(0);
  expect(await pageErrors(doctor), `${label}: doctor page errors`).toBe(0);
  expect(await pageErrors(patient), `${label}: patient page errors`).toBe(0);
}

test.describe("appointment call — resilience", () => {
  test.beforeEach(async () => {
    await ensureBackendUp();
  });
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(300_000);
  });

  test("1 normal join — both sides see AND hear each other", async ({ call }) => {
    await call.joinBoth();
    const [d0, p0] = await Promise.all([inboundBytes(call.doctor.page), inboundBytes(call.patient.page)]);
    await sleep(3_000);
    const [d1, p1] = await Promise.all([inboundBytes(call.doctor.page), inboundBytes(call.patient.page)]);
    expect(d1.video).toBeGreaterThan(d0.video);
    expect(d1.audio).toBeGreaterThan(d0.audio);
    expect(p1.video).toBeGreaterThan(p0.video);
    expect(p1.audio).toBeGreaterThan(p0.audio);
    await expectHealthy(call, "normal join");
  });

  for (const seconds of [5, 20, 60]) {
    test(`2 patient offline ${seconds}s then back online — recovers`, async ({ call }) => {
      await call.joinBoth();
      await call.patient.context.setOffline(true);
      await sleep(seconds * 1000);
      await call.patient.context.setOffline(false);
      await expectHealthy(call, `offline ${seconds}s`, { timeoutMs: 90_000 });
      // the doctor's "peer left" notice must be gone once the call is back
      await expect(peerLeftNotice(call.doctor.page)).toHaveCount(0, { timeout: 30_000 });
    });
  }

  test("3 BOTH sides offline at once, then online — recovers", async ({ call }) => {
    await call.joinBoth();
    await Promise.all([call.doctor.context.setOffline(true), call.patient.context.setOffline(true)]);
    await sleep(35_000); // longer than the server's 30s leave grace
    await Promise.all([call.doctor.context.setOffline(false), call.patient.context.setOffline(false)]);
    await expectHealthy(call, "both offline", { timeoutMs: 120_000 });
  });

  test("4 backend restarted mid-call — recovers with no error screen", async ({ call }) => {
    await call.joinBoth();
    await restartBackend();
    await expectHealthy(call, "backend restart", { timeoutMs: 120_000 });
  });

  test("5 socket closed by the server mid-call — recovers", async ({ call }) => {
    await call.joinBoth();
    await dropSocket(call.patient.page);
    await expectHealthy(call, "patient socket closed");
    await dropSocket(call.doctor.page);
    await expectHealthy(call, "doctor socket closed");
  });

  test("7 tab hidden for 2 minutes (socket dies in the background) then visible — recovers", async ({ call }) => {
    await call.joinBoth();
    const page = call.patient.page;
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await call.patient.context.setOffline(true); // what the OS does to a frozen tab
    await dropSocket(page);
    await sleep(120_000);
    await call.patient.context.setOffline(false);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expectHealthy(call, "tab hidden 2min", { timeoutMs: 90_000 });
  });

  test("8 peer leaves -> 'left' UI; peer returns -> call resumes", async ({ call }) => {
    await call.joinBoth();
    await call.patient.page.goto("/"); // leaves the call page (about:blank has no mediaDevices, which trips the harness init script)
    await expect(peerLeftNotice(call.doctor.page)).toBeVisible({ timeout: 60_000 });
    await call.patient.page.goto(`/video-call/${call.appointmentId}`);
    await expectHealthy(call, "peer returned");
    await expect(peerLeftNotice(call.doctor.page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("9 peer reloads the page mid-call — call resumes", async ({ call }) => {
    await call.joinBoth();
    await call.patient.page.reload();
    await expectHealthy(call, "patient reload");
    await call.doctor.page.reload();
    await expectHealthy(call, "doctor reload");
  });

  test("10 same user opens the call in a second tab — defined behaviour, no crash", async ({ call }) => {
    await call.joinBoth();
    const second = await call.patient.context.newPage();
    const errors = [];
    second.on("pageerror", (e) => errors.push(String(e)));
    await second.goto(`/video-call/${call.appointmentId}`);
    // the OLD tab is told another session took over and shows a clear message...
    await expect(errorGate(call.patient.page)).toBeVisible({ timeout: 30_000 });
    await expect(errorGate(call.patient.page)).toContainText(/another consultation session|elsewhere/i);
    // ...and the NEW tab owns the call
    await waitForVideoFlowing(second, { timeoutMs: 40_000, label: "second tab" });
    await waitForVideoFlowing(call.doctor.page, { timeoutMs: 40_000, label: "doctor" });
    expect(errors).toEqual([]);
    await second.close();
  });

  test("11a transient server_error on re-join — retries and ends up in the call", async ({ call }) => {
    await call.joinBoth();
    await injectServerReply(call.patient.page, "join-appointment-room", ["room-access-denied", { reason: "server_error", msg: "injected" }], 2);
    await dropSocket(call.patient.page);
    await expectHealthy(call, "server_error x2 then ok", { timeoutMs: 90_000 });
  });

  test("11b room_full and unauthenticated on re-join are also retried", async ({ call }) => {
    await call.joinBoth();
    await injectServerReply(call.patient.page, "join-appointment-room", ["room-access-denied", { reason: "room_full", msg: "injected" }], 1);
    await dropSocket(call.patient.page);
    await expectHealthy(call, "room_full x1", { timeoutMs: 60_000 });
    await injectServerReply(call.patient.page, "join-appointment-room", ["room-access-denied", { reason: "unauthenticated", msg: "injected" }], 1);
    await dropSocket(call.patient.page);
    await expectHealthy(call, "unauthenticated x1", { timeoutMs: 60_000 });
  });

  test("11c retries exhausted -> clear message + working Retry button -> rejoins", async ({ call }) => {
    await call.joinBoth();
    await injectServerReply(call.patient.page, "join-appointment-room", ["room-access-denied", { reason: "server_error", msg: "injected" }], 50);
    await dropSocket(call.patient.page);
    const notice = call.patient.page.locator(".hc-vc__reconnect-stalled-notice", { hasText: "Couldn't rejoin the call." });
    await expect(notice).toBeVisible({ timeout: 70_000 });
    // the camera/mic must still be alive while we wait
    expect(await liveLocalTracks(call.patient.page, "video")).toBeGreaterThan(0);
    await call.patient.page.evaluate(() => window.__e2eInjectRestore?.());
    await notice.getByRole("button", { name: "Retry" }).click();
    await expectHealthy(call, "manual Retry after exhaustion", { timeoutMs: 60_000 });
  });

  test("11d terminal denial (appointment_ended) ends the call cleanly with a message", async ({ call }) => {
    await call.joinBoth();
    await injectServerReply(call.patient.page, "join-appointment-room", ["room-access-denied", { reason: "appointment_ended", msg: "This appointment has ended." }], 1);
    await dropSocket(call.patient.page);
    await expect(errorGate(call.patient.page)).toContainText("This appointment has ended.", { timeout: 30_000 });
    expect(await liveLocalTracks(call.patient.page, "video"), "camera released").toBe(0);
    expect(await pageErrors(call.patient)).toBe(0);
  });

  test("12 local camera track ends mid-call — re-acquired, peer sees video again", async ({ call }) => {
    await call.joinBoth();
    const before = await readInbound(call.doctor.page);
    expect(await endLocalTracks(call.patient.page, "video")).toBeGreaterThan(0);
    // a NEW live video track appears without the user doing anything
    await expect.poll(() => liveLocalTracks(call.patient.page, "video"), { timeout: 30_000 }).toBeGreaterThan(0);
    // and the doctor keeps decoding frames from the patient
    await assertFramesFlowing(call.doctor.page, 12_000, { maxStallMs: 8_000, label: "doctor sees patient after camera loss" });
    const after = await readInbound(call.doctor.page);
    expect(after.video.frames).toBeGreaterThan((before.video?.frames ?? 0));
    await expectHealthy(call, "camera recovered");
  });

  test("12b local microphone track ends mid-call — re-acquired", async ({ call }) => {
    await call.joinBoth();
    expect(await endLocalTracks(call.patient.page, "audio")).toBeGreaterThan(0);
    await expect.poll(() => liveLocalTracks(call.patient.page, "audio"), { timeout: 30_000 }).toBeGreaterThan(0);
    const a0 = (await inboundBytes(call.doctor.page)).audio;
    await sleep(4_000);
    expect((await inboundBytes(call.doctor.page)).audio).toBeGreaterThan(a0);
  });

  test("14 no camera device — joins audio-only with the other side hearing it, no crash", async ({ browser, baseURL }, testInfo) => {
    testInfo.setTimeout(120_000);
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      await patient.context.addInitScript(() => {
        const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = (c) =>
          c && c.video
            ? Promise.reject(new DOMException("Requested device not found", "NotFoundError"))
            : real(c);
      });
      const url = `/video-call/${process.env.TEST_APPOINTMENT_ID}`;
      await Promise.all([
        doctor.page.goto(url, { waitUntil: "domcontentloaded" }),
        patient.page.goto(url, { waitUntil: "domcontentloaded" }),
      ]);
      try {
        await expect.poll(async () => (await inboundBytes(doctor.page)).audio, { timeout: 40_000 }).toBeGreaterThan(0);
      } catch (err) {
        console.log("PATIENT LOG:" + (await patient.logs.text()).slice(-3000));
        console.log("DOCTOR LOG:" + (await doctor.logs.text()).slice(-1500));
        throw err;
      }
      const a0 = (await inboundBytes(doctor.page)).audio;
      await sleep(3_000);
      expect((await inboundBytes(doctor.page)).audio).toBeGreaterThan(a0);
      await expect(errorGate(patient.page)).toHaveCount(0);
      expect(await pageErrors(patient)).toBe(0);
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("16 ICE-servers endpoint fails — falls back to STUN-only, warns, call still connects", async ({ call }) => {
    await call.patient.page.route("**/api/rtc/ice-servers", (route) => route.fulfill({ status: 500, body: "boom" }));
    await call.joinBoth({ flowTimeoutMs: 60_000 });
    await expect(call.patient.page.getByText(/Relay server unavailable/i)).toBeVisible({ timeout: 30_000 });
    expect(await pageErrors(call.patient)).toBe(0);
  });

  test("17a rapid flapping: socket dropped 10 times in 30s — ends connected", async ({ call }) => {
    await call.joinBoth();
    for (let i = 0; i < 10; i += 1) {
      await dropSocket(i % 2 ? call.doctor.page : call.patient.page);
      await sleep(3_000);
    }
    await expectHealthy(call, "socket flapping", { timeoutMs: 90_000 });
  });

  test("17b rapid flapping: offline/online 10 times in 30s — ends connected", async ({ call }) => {
    await call.joinBoth();
    for (let i = 0; i < 10; i += 1) {
      await call.patient.context.setOffline(true);
      await sleep(1_500);
      await call.patient.context.setOffline(false);
      await sleep(1_500);
    }
    await expectHealthy(call, "offline flapping", { timeoutMs: 90_000 });
  });

  test("19 appointment completed by the doctor — ends cleanly for both, re-join refused with a clear message", async ({ browser, baseURL }) => {
    // Own appointment: completing it is permanent and must not poison the shared one.
    const { appointmentId } = await createFreshAppointment({
      mongoUri: LOCAL_MONGO_URI,
      doctorEmail: process.env.TEST_DOCTOR_EMAIL,
      patientEmail: process.env.TEST_PATIENT_EMAIL,
    });
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 40_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 40_000, label: "patient" }),
      ]);
      const res = await doctor.context.request.put(`${baseURL}/api/appointments/${appointmentId}/complete`);
      expect(res.ok(), `complete failed: ${res.status()}`).toBeTruthy();
      // the patient is told and sent away, and the camera is released
      await expect(patient.page).toHaveURL(/dashboard|login|\/$/, { timeout: 30_000 });
      await expect.poll(() => liveLocalTracks(patient.page, "video"), { timeout: 15_000, message: "camera released after leaving" }).toBe(0);
      expect(await pageErrors(patient)).toBe(0);
      expect(await pageErrors(doctor)).toBe(0);
      // coming back is refused with a message, not a blank screen
      await patient.page.goto(url);
      await expect(patient.page.locator(".hc-vc__gate, .hc-vc__completed").first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });
});

// ── Scenarios that need a real TURN relay (E2E_TURN_DIR -> node-turn) ──────
test.describe("appointment call — via TURN relay", () => {
  test.beforeEach(async () => {
    await ensureBackendUp();
  });
  test.skip(!turnAvailable(), "set E2E_TURN_DIR to a folder with node-turn + turn-server.js (see README)");
  test.beforeEach(async ({}, testInfo) => testInfo.setTimeout(300_000));
  test.afterEach(async () => {
    await stopTurn();
  });

  test("15 relay-only (iceTransportPolicy=relay) — connects THROUGH the relay", async ({ call }) => {
    await startTurn();
    await Promise.all([forceRelayOnly(call.doctor.context), forceRelayOnly(call.patient.context)]);
    await call.joinBoth({ flowTimeoutMs: 60_000 });
    expect(await selectedCandidateTypes(call.doctor.page)).toMatchObject({ local: "relay" });
    expect(await selectedCandidateTypes(call.patient.page)).toMatchObject({ local: "relay" });
    await assertFramesFlowing(call.doctor.page, 8_000, { label: "relay doctor" });
  });

  test("2b REAL media outage: relay dies + patient offline 20s, both come back — recovers", async ({ call }) => {
    await startTurn();
    await Promise.all([forceRelayOnly(call.doctor.context), forceRelayOnly(call.patient.context)]);
    await call.joinBoth({ flowTimeoutMs: 60_000 });
    await call.patient.context.setOffline(true);
    await stopTurn(); // media path is genuinely dead now
    await sleep(20_000);
    await startTurn();
    await call.patient.context.setOffline(false);
    await expectHealthy(call, "relay + network outage", { timeoutMs: 120_000 });
  });

  test("18 impaired relay (15% loss, ~150ms latency) — the call stays up", async ({ call }) => {
    await startTurn({ dropPercent: 15, latencyMs: 150 });
    await Promise.all([forceRelayOnly(call.doctor.context), forceRelayOnly(call.patient.context)]);
    await call.joinBoth({ flowTimeoutMs: 90_000 });
    await assertFramesFlowing(call.doctor.page, 45_000, { maxStallMs: 10_000, label: "doctor under loss" });
    await assertFramesFlowing(call.patient.page, 15_000, { maxStallMs: 10_000, label: "patient under loss" });
    await expect(errorGate(call.doctor.page)).toHaveCount(0);
    await expect(errorGate(call.patient.page)).toHaveCount(0);
  });
});
