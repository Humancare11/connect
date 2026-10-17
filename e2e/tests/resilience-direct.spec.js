// Resilience of the DIRECT (link-based, guest) video call: host + guest, PIN
// rooms, bad links, and real network / socket / backend / media faults.
import fs from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";
import { ADMIN_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createDirectRoom } from "../helpers/directRoomSeed.js";
import { expect, newParty, readInbound, test, waitForVideoFlowing, assertFramesFlowing } from "../helpers/harness.js";
import {
  dropSocket,
  endLocalTracks,
  forceRelayOnly,
  injectServerReply,
  liveLocalTracks,
  restartBackend,
  selectedCandidateTypes,
  sleep,
  startTurn,
  stopTurn,
  turnAvailable,
  waitForSocketConnected,
} from "../helpers/resilience.js";

const RESULTS_DIR = path.resolve("test-results");

const freshRoom = async (opts = {}) => (await createDirectRoom({ mongoUri: LOCAL_MONGO_URI, status: "active", ...opts })).roomId;

async function joinAsGuest(party, room, name) {
  await party.page.goto(`/direct-video-call/${room}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
  await party.page.getByLabel("Your name").fill(name);
  await party.page.getByRole("button", { name: "Join now" }).click();
}

async function twoParties(browser, baseURL, room, { relay = false } = {}) {
  const host = await newParty(browser, "host", null, baseURL);
  const guest = await newParty(browser, "guest", null, baseURL);
  if (relay) await Promise.all([forceRelayOnly(host.context), forceRelayOnly(guest.context)]);
  await joinAsGuest(host, room, "Host");
  await joinAsGuest(guest, room, "Guest");
  await Promise.all([
    waitForVideoFlowing(host.page, { timeoutMs: 60_000, label: "host" }),
    waitForVideoFlowing(guest.page, { timeoutMs: 60_000, label: "guest" }),
  ]);
  return { host, guest };
}

async function closeAll(...parties) {
  for (const p of parties) await p.context.close();
}

async function writeLogs(name, ...parties) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  for (const p of parties) fs.writeFileSync(path.join(RESULTS_DIR, `${name}-${p.role}.log`), await p.logs.text());
}

const errorScreen = (page) => page.getByRole("heading", { name: "Can't join this meeting" });

async function expectHealthy({ host, guest }, label, timeoutMs = 60_000) {
  await Promise.all([waitForSocketConnected(host.page, timeoutMs), waitForSocketConnected(guest.page, timeoutMs)]);
  await Promise.all([
    waitForVideoFlowing(host.page, { timeoutMs, label: `${label} host` }),
    waitForVideoFlowing(guest.page, { timeoutMs, label: `${label} guest` }),
  ]);
  await expect(errorScreen(host.page), `${label}: host error screen`).toHaveCount(0);
  await expect(errorScreen(guest.page), `${label}: guest error screen`).toHaveCount(0);
  expect(await host.logs.count(/pageerror/), `${label}: host page errors`).toBe(0);
  expect(await guest.logs.count(/pageerror/), `${label}: guest page errors`).toBe(0);
}

async function createPinRoom(baseURL) {
  const api = await request.newContext({ baseURL, storageState: ADMIN_STATE });
  try {
    const res = await api.post("/api/direct-video-room", { data: { note: "resilience pin", expiresInHours: 24 } });
    expect(res.ok(), `create PIN room failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    return { roomId: body.room.roomId, doctorPin: body.doctorPin, patientPin: body.patientPin };
  } finally {
    await api.dispose();
  }
}

async function enterPin(page, pin) {
  await page.locator(".dvcall-pin-boxes input").first().click();
  await page.keyboard.type(pin);
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("direct call — resilience", () => {
  test.skip(!process.env.TEST_DIRECT_ROOM_ID, "TEST_DIRECT_ROOM_ID is not set (local mode only)");
  test.beforeEach(async ({}, testInfo) => testInfo.setTimeout(300_000));

  test("D1 normal call — both see and hear each other", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await expectHealthy(parties, "normal");
    } finally {
      await writeLogs("d1-normal", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  for (const seconds of [5, 20, 60]) {
    test(`D2 guest offline ${seconds}s then online — recovers`, async ({ browser, baseURL }) => {
      const room = await freshRoom();
      const parties = await twoParties(browser, baseURL, room);
      try {
        await parties.guest.context.setOffline(true);
        await sleep(seconds * 1000);
        await parties.guest.context.setOffline(false);
        await expectHealthy(parties, `guest offline ${seconds}s`, 120_000);
      } finally {
        await writeLogs(`d2-guest-offline-${seconds}`, parties.host, parties.guest);
        await closeAll(parties.host, parties.guest);
      }
    });
  }

  test("D3 host offline 30s then online — recovers (host reconnect after drop)", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await parties.host.context.setOffline(true);
      await sleep(30_000);
      await parties.host.context.setOffline(false);
      await expectHealthy(parties, "host offline", 120_000);
    } finally {
      await writeLogs("d3-host-offline", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D4 both offline at once, then online — recovers", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await Promise.all([parties.host.context.setOffline(true), parties.guest.context.setOffline(true)]);
      await sleep(40_000);
      await Promise.all([parties.host.context.setOffline(false), parties.guest.context.setOffline(false)]);
      await expectHealthy(parties, "both offline", 120_000);
    } finally {
      await writeLogs("d4-both-offline", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D5 backend restarted mid-call — recovers with no error screen", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await restartBackend();
      await expectHealthy(parties, "backend restart", 120_000);
    } finally {
      await writeLogs("d5-backend-restart", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D6 socket closed mid-call (guest, then host) — recovers", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await dropSocket(parties.guest.page);
      await expectHealthy(parties, "guest socket closed");
      await dropSocket(parties.host.page);
      await expectHealthy(parties, "host socket closed");
    } finally {
      await writeLogs("d6-socket-closed", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D7 rapid flapping — 10 drops in 30s — ends connected", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      for (let i = 0; i < 10; i += 1) {
        await dropSocket(i % 2 ? parties.host.page : parties.guest.page);
        await sleep(3_000);
      }
      await expectHealthy(parties, "flapping", 90_000);
    } finally {
      await writeLogs("d7-flapping", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D8 tab hidden 2 minutes (guest) then visible — recovers", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      const page = parties.guest.page;
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await parties.guest.context.setOffline(true);
      await dropSocket(page);
      await sleep(120_000);
      await parties.guest.context.setOffline(false);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expectHealthy(parties, "hidden 2min", 120_000);
    } finally {
      await writeLogs("d8-hidden", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D9 guest reloads the page mid-call (same guest id) — resumes", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await parties.guest.page.reload();
      await parties.guest.page.getByRole("button", { name: "Join now" }).click({ timeout: 20_000 });
      await expectHealthy(parties, "guest reload", 90_000);
    } finally {
      await writeLogs("d9-reload", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D10 transient server_error / full on join are retried, exhaustion shows Retry", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await injectServerReply(parties.guest.page, "join-direct-room", ["direct-room-error", { code: "server_error", msg: "injected" }], 2);
      await dropSocket(parties.guest.page);
      await expectHealthy(parties, "server_error x2", 90_000);

      await injectServerReply(parties.guest.page, "join-direct-room", ["direct-room-error", { code: "full", msg: "injected" }], 1);
      await dropSocket(parties.guest.page);
      await expectHealthy(parties, "full x1", 90_000);

      await injectServerReply(parties.guest.page, "join-direct-room", ["direct-room-error", { code: "server_error", msg: "injected" }], 50);
      await dropSocket(parties.guest.page);
      const notice = parties.guest.page.locator(".hc-vc__reconnect-stalled-notice", { hasText: "Couldn't rejoin the call." });
      await expect(notice).toBeVisible({ timeout: 70_000 });
      expect(await liveLocalTracks(parties.guest.page, "video"), "camera stays on while retrying").toBeGreaterThan(0);
      await parties.guest.page.evaluate(() => window.__e2eInjectRestore?.());
      await notice.getByRole("button", { name: "Retry" }).click();
      await expectHealthy(parties, "manual Retry", 90_000);
    } finally {
      await writeLogs("d10-join-retry", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D11 a terminal join error (closed) ends cleanly with a message", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      await injectServerReply(parties.guest.page, "join-direct-room", ["direct-room-error", { code: "closed", msg: "This meeting has ended." }], 1);
      await dropSocket(parties.guest.page);
      await expect(errorScreen(parties.guest.page)).toBeVisible({ timeout: 30_000 });
      await expect(parties.guest.page.getByText("This meeting has ended.")).toBeVisible();
      await expect(parties.guest.page.getByRole("link", { name: "Return Home" })).toBeVisible();
      expect(await parties.guest.logs.count(/pageerror/)).toBe(0);
    } finally {
      await writeLogs("d11-terminal", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D12 camera track ends mid-call (guest) — re-acquired, host sees video again", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room);
    try {
      expect(await endLocalTracks(parties.guest.page, "video")).toBeGreaterThan(0);
      await expect.poll(() => liveLocalTracks(parties.guest.page, "video"), { timeout: 30_000 }).toBeGreaterThan(0);
      await assertFramesFlowing(parties.host.page, 12_000, { maxStallMs: 8_000, label: "host sees guest after camera loss" });
      await expectHealthy(parties, "camera recovered", 60_000);
    } finally {
      await writeLogs("d12-camera-ended", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D13 expired / closed / unknown / malformed links — clear message, Return Home, no crash", async ({ browser, baseURL }) => {
    const cases = [
      [await freshRoom({ expiresInMs: -60_000 }), "This meeting link has expired."],
      [await freshRoom({ status: "closed" }), "This meeting has ended."],
      ["ffffffffffffffffffffffffffffffff", "This meeting link is invalid."],
      ["not-a-room", "This meeting link is invalid."],
    ];
    for (const [roomId, message] of cases) {
      const party = await newParty(browser, "link", null, baseURL);
      try {
        await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
        await expect(party.page.getByText(message)).toBeVisible({ timeout: 15_000 });
        await expect(party.page.getByRole("link", { name: "Return Home" })).toBeVisible();
        expect(await party.logs.count(/pageerror/), roomId).toBe(0);
      } finally {
        await party.context.close();
      }
    }
  });

  test("D14 ICE-servers endpoint down — Join still works and the call connects", async ({ browser, baseURL }) => {
    const room = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await host.page.route("**/api/direct-video-room/*/ice-servers", (r) => r.fulfill({ status: 500, body: "boom" }));
      await guest.page.route("**/api/direct-video-room/*/ice-servers", (r) => r.fulfill({ status: 500, body: "boom" }));
      await joinAsGuest(host, room, "Host");
      await joinAsGuest(guest, room, "Guest");
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 60_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 60_000, label: "guest" }),
      ]);
    } finally {
      await closeAll(host, guest);
    }
  });
});

test.describe("direct call — PIN room", () => {
  test.skip(!process.env.TEST_ADMIN_EMAIL, "needs the seeded admin (local mode)");
  test.beforeEach(async ({}, testInfo) => testInfo.setTimeout(240_000));

  test("P1 wrong PIN is refused with a message; right PINs join as doctor and patient and the call connects", async ({ browser, baseURL }) => {
    const { roomId, doctorPin, patientPin } = await createPinRoom(baseURL);
    const doctor = await newParty(browser, "doctor", null, baseURL);
    const patient = await newParty(browser, "patient", null, baseURL);
    try {
      await doctor.page.goto(`/direct-video-call/${roomId}`);
      await expect(doctor.page.getByRole("heading", { name: "Enter your meeting PIN" })).toBeVisible();
      await enterPin(doctor.page, "000000");
      await expect(doctor.page.getByText(/Incorrect PIN/i)).toBeVisible({ timeout: 15_000 });
      // the form is still usable
      await enterPin(doctor.page, doctorPin);
      await doctor.page.getByRole("button", { name: /Join now|Join/ }).first().click({ timeout: 20_000 });

      await patient.page.goto(`/direct-video-call/${roomId}`);
      await enterPin(patient.page, patientPin);
      await patient.page.getByRole("button", { name: /Join now|Join/ }).first().click({ timeout: 20_000 });

      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: 60_000, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: 60_000, label: "patient" }),
      ]);
      // a reload resumes with the stored session - no PIN prompt
      await patient.page.reload();
      await expect(patient.page.getByRole("heading", { name: "Enter your meeting PIN" })).toHaveCount(0);
    } finally {
      await writeLogs("p1-pin", doctor, patient);
      await closeAll(doctor, patient);
    }
  });

  test("P2 transient server_error while verifying the PIN is retried automatically", async ({ browser, baseURL }) => {
    const { roomId, doctorPin } = await createPinRoom(baseURL);
    const doctor = await newParty(browser, "doctor", null, baseURL);
    try {
      await doctor.page.goto(`/direct-video-call/${roomId}`);
      await expect(doctor.page.getByRole("heading", { name: "Enter your meeting PIN" })).toBeVisible();
      await waitForSocketConnected(doctor.page, 20_000);
      await injectServerReply(doctor.page, "verify-direct-pin", ["direct-pin-error", { code: "server_error", msg: "injected" }], 2);
      await enterPin(doctor.page, doctorPin);
      // two injected failures are retried (1s + 2s backoff) and the third goes through
      await expect(doctor.page.getByRole("heading", { name: "Ready to join?" })).toBeVisible({ timeout: 30_000 });
    } finally {
      await closeAll(doctor);
    }
  });

  test("P3 no answer at all to the PIN request — retried, then a clear message (not stuck on 'Checking')", async ({ browser, baseURL }) => {
    const { roomId, doctorPin } = await createPinRoom(baseURL);
    const doctor = await newParty(browser, "doctor", null, baseURL);
    try {
      await doctor.page.goto(`/direct-video-call/${roomId}`);
      await waitForSocketConnected(doctor.page, 20_000);
      await injectServerReply(doctor.page, "verify-direct-pin", null, 100); // swallow every attempt
      await enterPin(doctor.page, doctorPin);
      await expect(doctor.page.getByRole("button", { name: "Checking…" })).toBeVisible();
      await expect(doctor.page.getByText(/couldn't reach the meeting service/i)).toBeVisible({ timeout: 90_000 });
      await expect(doctor.page.getByRole("button", { name: "Continue" })).toBeEnabled();
    } finally {
      await closeAll(doctor);
    }
  });
});

test.describe("direct call — via TURN relay", () => {
  test.skip(!turnAvailable(), "set E2E_TURN_DIR to a folder with node-turn + turn-server.js (see README)");
  test.beforeEach(async ({}, testInfo) => testInfo.setTimeout(300_000));
  test.afterEach(async () => {
    await stopTurn();
  });

  test("D15 relay-only call connects through the relay and survives a relay outage", async ({ browser, baseURL }) => {
    await startTurn();
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room, { relay: true });
    try {
      expect(await selectedCandidateTypes(parties.host.page)).toMatchObject({ local: "relay" });
      await stopTurn();
      await sleep(15_000);
      await startTurn();
      await expectHealthy(parties, "relay outage", 120_000);
    } finally {
      await writeLogs("d15-relay", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });

  test("D16 impaired relay (15% loss, ~150ms) — the call stays up", async ({ browser, baseURL }) => {
    await startTurn({ dropPercent: 15, latencyMs: 150 });
    const room = await freshRoom();
    const parties = await twoParties(browser, baseURL, room, { relay: true });
    try {
      await assertFramesFlowing(parties.host.page, 40_000, { maxStallMs: 10_000, label: "host under loss" });
      await assertFramesFlowing(parties.guest.page, 10_000, { maxStallMs: 10_000, label: "guest under loss" });
    } finally {
      await writeLogs("d16-lossy-relay", parties.host, parties.guest);
      await closeAll(parties.host, parties.guest);
    }
  });
});
