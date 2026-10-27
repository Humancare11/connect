// Admin-only appointment call report: who joined from what (web / app),
// reconnects, timeline - viewed through the real admin UI after real calls.
//
//  - web <-> web: two real browsers.
//  - app <-> web and app <-> app: the native app cannot be driven here, so the
//    "app" side is a socket.io client that behaves like it on the wire (a Dart
//    User-Agent and the clientInfo the app declares). Real-device joins are on
//    the manual checklist (docs/video-call-manual-test-checklist.md).
import { io as ioClient } from "socket.io-client";
import { request } from "@playwright/test";
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createFreshAppointment } from "../helpers/directRoomSeed.js";
import { expect, newParty, test, waitForVideoFlowing } from "../helpers/harness.js";
import { ensureBackendUp, sleep } from "../helpers/resilience.js";

const DART = "Dart/3.5 (dart:io)";
const decodeId = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).id;
const ANDROID_INFO = { platform: "android", appVersion: "1.0.18+17", osName: "Android", osVersion: "14", deviceModel: "Pixel 8" };

test.describe("appointment call report (admin only)", () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(240_000);
    await ensureBackendUp();
  });

  async function freshAppointment() {
    return (
      await createFreshAppointment({
        mongoUri: LOCAL_MONGO_URI,
        doctorEmail: process.env.TEST_DOCTOR_EMAIL,
        patientEmail: process.env.TEST_PATIENT_EMAIL,
      })
    ).appointmentId;
  }

  async function login(baseURL, path, creds) {
    const api = await request.newContext({ baseURL });
    const res = await api.post(path, { data: { email: creds.email, password: creds.password } });
    expect(res.ok(), `login ${path}: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    const state = await api.storageState();
    await api.dispose();
    return { accessToken: body.accessToken, state };
  }

  async function adminPage(browser, baseURL, appointmentId) {
    const { state } = await login(baseURL, "/api/auth/admin-login", { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
    const context = await browser.newContext({ baseURL, storageState: state });
    const page = await context.newPage();
    await page.goto(`/admin-dashboard/appointments/${appointmentId}/call-report`, { waitUntil: "domcontentloaded" });
    return { context, page };
  }

  // A socket that looks like the native app on the wire.
  async function appSocket(baseURL, token, { role, appointmentId, userId, clientInfo }) {
    const socket = ioClient(baseURL, {
      path: "/socket.io/",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: { token },
      extraHeaders: { "user-agent": DART },
    });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    socket.emit("user-online", { userId, role, token });
    socket.emit("join-appointment-room", { appointmentId, userId, role, token, capabilities: { peerRebuild: true }, ...(clientInfo ? { clientInfo } : {}) });
    await new Promise((resolve) => socket.once("appointment-chat-history", resolve));
    return socket;
  }

  test("web doctor <-> web patient: both shown as Web (browser + OS), connected, timeline, patient leaving", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    let admin;
    try {
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url, { waitUntil: "domcontentloaded" }), patient.page.goto(url, { waitUntil: "domcontentloaded" })]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 40_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 40_000, label: "patient" }),
      ]);
      await sleep(2_000);

      admin = await adminPage(browser, baseURL, appointmentId);
      await expect(admin.page.getByRole("heading", { name: "Call Report" })).toBeVisible({ timeout: 20_000 });
      for (const section of ["Summary", "Participants", "Timeline"]) {
        await expect(admin.page.getByRole("heading", { name: section })).toBeVisible();
      }
      const rows = admin.page.locator(".dvc-table tbody tr").filter({ hasText: /Doctor|Patient/ });
      await expect(rows.filter({ hasText: "Doctor" }).first()).toContainText(/Web \(Chrome|Web \(Chromium|Web \(Headless/);
      await expect(rows.filter({ hasText: "Patient" }).first()).toContainText(/Web \(/);
      await expect(admin.page.getByText("Connected").first()).toBeVisible();
      await expect(admin.page.locator("td", { hasText: /^Yes/ }).first()).toBeVisible();
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Doctor joined from Web");
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Patient joined from Web");
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Doctor and patient are both in the call");

      // the patient closes the page -> the drop is recorded at once ("left" follows
      // only if they do not come back within the server's grace period)
      await patient.page.goto("/");
      await sleep(1_500);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Patient disconnected", { timeout: 20_000 });
    } finally {
      await admin?.context.close();
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("Android-app patient <-> web doctor (app side simulated): 'App (Android 14, v1.0.18+17, Pixel 8)' vs 'Web (Chrome ...)'", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    let admin;
    let appPatient;
    try {
      await doctor.page.goto(`/video-call/${appointmentId}`, { waitUntil: "domcontentloaded" });
      const patientLogin = await login(baseURL, "/api/auth/login", { email: process.env.TEST_PATIENT_EMAIL, password: process.env.TEST_PATIENT_PASSWORD });
      const patientId = decodeId(patientLogin.accessToken);
      appPatient = await appSocket(baseURL, patientLogin.accessToken, { role: "user", appointmentId, userId: patientId, clientInfo: ANDROID_INFO });
      await sleep(3_000);

      admin = await adminPage(browser, baseURL, appointmentId);
      await expect(admin.page.getByRole("heading", { name: "Participants" })).toBeVisible({ timeout: 20_000 });
      await expect(admin.page.locator(".dvc-table tbody tr").filter({ hasText: "Patient" }).first()).toContainText("App (Android 14, v1.0.18+17, Pixel 8)");
      await expect(admin.page.locator(".dvc-table tbody tr").filter({ hasText: "Doctor" }).first()).toContainText("Web (");
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Patient joined from App (Android 14, v1.0.18+17, Pixel 8)");

      // a drop and a return shows up as a reconnect
      appPatient.close();
      await sleep(1_200);
      const again = await appSocket(baseURL, patientLogin.accessToken, { role: "user", appointmentId, userId: patientId, clientInfo: ANDROID_INFO });
      await sleep(1_500);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await expect(admin.page.locator(".dvc-timeline")).toContainText("Patient reconnected after", { timeout: 20_000 });
      appPatient = again;
    } finally {
      appPatient?.close();
      await admin?.context.close();
      await doctor.context.close();
    }
  });

  test("app <-> app (both simulated): doctor app that declares nothing is still shown as an App", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    let admin;
    const sockets = [];
    try {
      const d = await login(baseURL, "/api/doctor/login", { email: process.env.TEST_DOCTOR_EMAIL, password: process.env.TEST_DOCTOR_PASSWORD });
      const p = await login(baseURL, "/api/auth/login", { email: process.env.TEST_PATIENT_EMAIL, password: process.env.TEST_PATIENT_PASSWORD });
      sockets.push(await appSocket(baseURL, d.accessToken, { role: "doctor", appointmentId, userId: decodeId(d.accessToken) })); // doctorapp: no clientInfo
      sockets.push(await appSocket(baseURL, p.accessToken, { role: "user", appointmentId, userId: decodeId(p.accessToken), clientInfo: { ...ANDROID_INFO, platform: "ios", osName: "iOS", osVersion: "17.5", deviceModel: "iPhone 15" } }));
      await sleep(2_500);

      admin = await adminPage(browser, baseURL, appointmentId);
      const rows = admin.page.locator(".dvc-table tbody tr");
      await expect(rows.filter({ hasText: "Doctor" }).first()).toContainText("App (version and OS not reported)", { timeout: 20_000 });
      await expect(rows.filter({ hasText: "Patient" }).first()).toContainText("App (iOS 17.5, v1.0.18+17, iPhone 15)");
    } finally {
      sockets.forEach((s) => s.close());
      await admin?.context.close();
    }
  });

  // ---------------------------------------------------------------- phase 2: quality stats

  test("web <-> web: stats columns, connection type and the Live section show real numbers; list badge appears", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    let admin;
    try {
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url, { waitUntil: "domcontentloaded" }), patient.page.goto(url, { waitUntil: "domcontentloaded" })]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 40_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 40_000, label: "patient" }),
      ]);

      admin = await adminPage(browser, baseURL, appointmentId);
      await expect(admin.page.getByRole("heading", { name: "Live" })).toBeVisible({ timeout: 20_000 });
      // watching speeds the clients up (~3s): live numbers arrive without waiting 30s
      await expect(admin.page.getByText(/RTT: \d+ms/).first()).toBeVisible({ timeout: 30_000 });

      // the patient leaves: the pending aggregate is written at once
      await patient.page.goto("/");
      await sleep(2_500);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      const rows = admin.page.locator(".dvc-table tbody tr").filter({ hasText: /Doctor|Patient/ });
      await expect(rows.filter({ hasText: "Patient" }).first()).toContainText(/Direct \(peer-to-peer\)|Relay \(TURN\)/, { timeout: 20_000 });
      await expect(rows.filter({ hasText: "Patient" }).first()).not.toContainText("No stats received");

      // the call column in the appointment list (one batch query)
      const listRequests = [];
      admin.page.on("request", (r) => r.url().includes("/api/call-reports/summaries") && listRequests.push(r.postData()));
      await admin.page.goto("/admin-dashboard/appointments?tab=all", { waitUntil: "domcontentloaded" });
      const row = admin.page.locator("tr", { hasText: appointmentId });
      await expect(row).toContainText(/Connected|Not connected/, { timeout: 30_000 });
      expect(listRequests.length, "one batch request, not one per row").toBe(1);
    } finally {
      await admin?.context.close();
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("app (simulated) <-> web: relay vs direct, stats and live numbers per participant", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    let admin;
    let appPatient;
    try {
      await doctor.page.goto(`/video-call/${appointmentId}`, { waitUntil: "domcontentloaded" });
      const patientLogin = await login(baseURL, "/api/auth/login", { email: process.env.TEST_PATIENT_EMAIL, password: process.env.TEST_PATIENT_PASSWORD });
      const patientId = decodeId(patientLogin.accessToken);
      appPatient = await appSocket(baseURL, patientLogin.accessToken, { role: "user", appointmentId, userId: patientId, clientInfo: ANDROID_INFO });

      const monitoring = new Promise((resolve) => appPatient.once("call-monitoring-active", resolve));
      admin = await adminPage(browser, baseURL, appointmentId);
      await expect(admin.page.getByRole("heading", { name: "Live" })).toBeVisible({ timeout: 20_000 });
      expect(await Promise.race([monitoring, sleep(10_000).then(() => "timeout")])).toBe(true);

      const sample = { appointmentId, rtt: 210, packetLoss: 0.06, jitter: 14, bitrateKbps: 420, outKbps: 300, iceType: "relay", quality: "weak", resolution: "480x640", connectionState: "connected" };
      appPatient.emit("call-stats", sample);
      await expect(admin.page.getByText("RTT: 210ms")).toBeVisible({ timeout: 15_000 });
      await expect(admin.page.getByText("Relay", { exact: true }).first()).toBeVisible();
      await sleep(2_100);
      appPatient.emit("call-stats", { ...sample, final: true, rtt: 230 });

      appPatient.close();
      await sleep(2_000);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      const patientRow = admin.page.locator(".dvc-table tbody tr").filter({ hasText: "Patient" }).first();
      await expect(patientRow).toContainText("Relay (TURN)", { timeout: 20_000 });
      await expect(patientRow).toContainText("210 / 220 / 230");
      await expect(patientRow).toContainText("Weak");
      // problems derived from the quality numbers
      await expect(admin.page.getByText(/packet loss/i).first()).toBeVisible();
    } finally {
      appPatient?.close();
      await admin?.context.close();
      await doctor.context.close();
    }
  });

  test("doctor and patient never receive live stats or monitoring details they should not see", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    let appPatient;
    let appDoctor;
    try {
      const d = await login(baseURL, "/api/doctor/login", { email: process.env.TEST_DOCTOR_EMAIL, password: process.env.TEST_DOCTOR_PASSWORD });
      const p = await login(baseURL, "/api/auth/login", { email: process.env.TEST_PATIENT_EMAIL, password: process.env.TEST_PATIENT_PASSWORD });
      appDoctor = await appSocket(baseURL, d.accessToken, { role: "doctor", appointmentId, userId: decodeId(d.accessToken) });
      appPatient = await appSocket(baseURL, p.accessToken, { role: "user", appointmentId, userId: decodeId(p.accessToken), clientInfo: ANDROID_INFO });
      const seen = [];
      for (const s of [appDoctor, appPatient]) s.on("call-live-stats", (x) => seen.push(x));
      appDoctor.emit("admin-watch-call", { appointmentId });
      appPatient.emit("admin-watch-call", { appointmentId });
      await sleep(500);
      appPatient.emit("call-stats", { appointmentId, rtt: 50, iceType: "host", quality: "good" });
      await sleep(1_500);
      expect(seen).toEqual([]);
    } finally {
      appDoctor?.close();
      appPatient?.close();
    }
  });

  test("doctor, patient and an unrelated user cannot open the report (UI and API)", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      for (const party of [doctor, patient]) {
        await party.page.goto("/", { waitUntil: "domcontentloaded" });
        const status = await party.page.evaluate(async (id) => (await fetch(`/api/call-reports/${id}`, { credentials: "include" })).status, appointmentId);
        expect(status, `${party.role} API`).toBe(403);
        await party.page.goto(`/admin-dashboard/appointments/${appointmentId}/call-report`, { waitUntil: "domcontentloaded" });
        await sleep(1_500);
        await expect(party.page.getByRole("heading", { name: "Call Report" })).toHaveCount(0);
        await expect(party.page.locator(".dvc-timeline")).toHaveCount(0);
      }
      // anonymous
      const anon = await request.newContext({ baseURL });
      expect((await anon.get(`/api/call-reports/${appointmentId}`)).status()).toBe(401);
      await anon.dispose();
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });

  test("the call page itself shows doctor and patient nothing about a report", async ({ browser, baseURL }) => {
    const appointmentId = await freshAppointment();
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    try {
      const url = `/video-call/${appointmentId}`;
      await Promise.all([doctor.page.goto(url, { waitUntil: "domcontentloaded" }), patient.page.goto(url, { waitUntil: "domcontentloaded" })]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 40_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 40_000, label: "patient" }),
      ]);
      for (const party of [doctor, patient]) {
        await expect(party.page.getByText(/call report|joined from/i)).toHaveCount(0);
      }
    } finally {
      await doctor.context.close();
      await patient.context.close();
    }
  });
});
