// Backend-only coverage for Part 2's disconnect_reason / Problems box /
// superadmin timeline delete — same raw socket.io-client approach as
// direct-pin-socket.spec.js (no browser needed; a real ICE failure or a
// genuine "ping timeout" aren't practically simulatable in a fast test, so
// those two reasons are exercised via code review rather than here).
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { io as ioClient } from "socket.io-client";
import { request } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { ADMIN_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createDirectRoom } from "../helpers/directRoomSeed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(here, "../../backend");

function newGuestId() {
  return crypto.randomUUID();
}

async function adminApi(baseURL) {
  return request.newContext({ baseURL, storageState: ADMIN_STATE });
}

async function createRoomWithPins(api) {
  const res = await api.post("/api/direct-video-room", { data: { note: "disconnect-reason test", expiresInHours: 24 } });
  expect(res.ok(), `create room failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { room: body.room, doctorPin: body.doctorPin, patientPin: body.patientPin };
}

function connectSocket(baseURL) {
  const socket = ioClient(baseURL, {
    path: "/socket.io/",
    transports: ["polling", "websocket"],
    forceNew: true,
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), 10_000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function once(socket, event, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function joinPinRoom(baseURL, roomId, pin) {
  const socket = await connectSocket(baseURL);
  const guestId = newGuestId();
  socket.emit("verify-direct-pin", { roomId, pin, guestId });
  const ok = await once(socket, "direct-pin-ok");
  socket.emit("join-direct-room", { roomId, guestId, sessionToken: ok.sessionToken });
  const joined = await once(socket, "direct-room-joined");
  return { socket, guestId, role: joined.role };
}

// Waits for a room's timeline to contain an event matching `predicate` —
// disconnected/rejected events are logged fire-and-forget server-side, so
// there can be a short delay after the triggering action.
async function waitForEvent(api, roomId, predicate, timeoutMs = 8_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await api.get(`/api/direct-video-room/${roomId}/events`);
    const body = await res.json();
    const found = (body.timeline || []).find(predicate);
    if (found) return body;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("timed out waiting for the expected event to appear in the timeline");
}

// Seeds a THROWAWAY admin/superadmin user and logs in as them, returning a
// fresh, isolated request context. Deliberately never reuses the shared
// ADMIN_STATE session for either half of the superadmin-only check below —
// securityMonitor.js's recordSecurityEvent calls revokeUserSessions() on
// the acting user whenever a "privilege_escalation" security event (exactly
// what a non-superadmin hitting a superadmin-only route raises) is logged
// with "critical" severity. That's a real, intentional defense-in-depth
// lockout, not a bug — but it means deliberately triggering that 403 with
// the shared seeded admin would revoke ITS session too, breaking every
// other test in the suite that relies on ADMIN_STATE still being valid.
// Throwaway users for both sides of the check keeps that blast radius
// contained to this test alone.
async function createThrowawayAdminApi(baseURL, role) {
  const host = new URL(LOCAL_MONGO_URI).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("refusing to seed a throwaway admin against a non-local Mongo URI");
  }
  // Resolve mongoose/bcrypt/models from the BACKEND's own node_modules (not
  // this e2e package's) — mirrors helpers/seed.js and directRoomSeed.js's
  // require pattern exactly, so the model shares the same mongoose instance.
  const require = createRequire(path.join(BACKEND_DIR, "package.json"));
  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  const User = require(path.join(BACKEND_DIR, "models/User.js"));
  const conn = await mongoose.createConnection(LOCAL_MONGO_URI).asPromise();
  const email = `e2e-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "ThrowawayPass123!";
  try {
    const Model = conn.model("User", User.schema);
    await Model.create({
      name: `E2E ${role}`,
      email,
      password: await bcrypt.hash(password, 10),
      role,
    });
  } finally {
    await conn.close();
  }
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/auth/admin-login", { data: { email, password } });
  expect(res.ok(), `${role} login failed: ${res.status()}`).toBeTruthy();
  return ctx;
}

test.describe("direct call — disconnect reasons, Problems box, superadmin delete", () => {
  test.skip(!process.env.TEST_ADMIN_EMAIL, "TEST_ADMIN_EMAIL is not set (seeded automatically in local mode)");

  test("admin_ended: force-end tags the disconnect, and it's excluded from Problems", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let party;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      party = await joinPinRoom(baseURL, room.roomId, doctorPin);

      const res = await api.post(`/api/direct-video-room/${room.roomId}/force-end`);
      expect(res.ok()).toBeTruthy();

      const body = await waitForEvent(api, room.roomId, (e) => e.type === "disconnected" && /ended by admin/i.test(e.summary));
      expect((body.problems || []).some((p) => p.reason === "admin_ended")).toBe(false);
    } finally {
      party?.socket.disconnect();
      await api.dispose();
    }
  });

  test("session_taken_over: a confirmed takeover tags the evicted device's disconnect", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let deviceA, deviceB;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      const a = await joinPinRoom(baseURL, room.roomId, doctorPin);
      deviceA = a.socket;

      deviceB = await connectSocket(baseURL);
      const guestB = newGuestId();
      deviceB.emit("verify-direct-pin", { roomId: room.roomId, pin: doctorPin, guestId: guestB });
      await once(deviceB, "direct-pin-conflict");
      deviceB.emit("direct-session-takeover", { roomId: room.roomId, pin: doctorPin, guestId: guestB, role: "doctor" });
      await once(deviceB, "direct-pin-ok");

      const body = await waitForEvent(
        api,
        room.roomId,
        (e) => e.type === "disconnected" && /taken over by another device/i.test(e.summary),
      );
      expect((body.problems || []).some((p) => p.reason === "session_taken_over")).toBe(false);
    } finally {
      deviceA?.disconnect();
      deviceB?.disconnect();
      await api.dispose();
    }
  });

  test("pin_regenerated: regenerate + endCurrentSession tags the evicted device's disconnect", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let party;
    try {
      const { room, patientPin } = await createRoomWithPins(api);
      party = await joinPinRoom(baseURL, room.roomId, patientPin);

      const res = await api.post(`/api/direct-video-room/${room.roomId}/regenerate-pin`, {
        data: { role: "patient", endCurrentSession: true },
      });
      expect(res.ok()).toBeTruthy();

      const body = await waitForEvent(api, room.roomId, (e) => e.type === "disconnected" && /pin regenerated/i.test(e.summary));
      expect((body.problems || []).some((p) => p.reason === "pin_regenerated")).toBe(false);
    } finally {
      party?.socket.disconnect();
      await api.dispose();
    }
  });

  test("link_expired: joining an expired link is rejected and shows in Problems", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { roomId } = await createDirectRoom({ mongoUri: LOCAL_MONGO_URI, status: "active", expiresInMs: -60_000 });
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();
      socket.emit("join-direct-room", { roomId, guestId, name: "E2E Expired" });
      const err = await once(socket, "direct-room-error");
      expect(err.code).toBe("expired");

      const body = await waitForEvent(api, roomId, (e) => e.type === "rejected");
      const linkExpiredProblem = (body.problems || []).find((p) => p.reason === "link_expired");
      expect(linkExpiredProblem, "expected a link_expired entry in problems").toBeTruthy();
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("no signal at all: a raw disconnect with no hint falls back to 'unknown' and shows in Problems", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let party;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      party = await joinPinRoom(baseURL, room.roomId, doctorPin);

      // No /leaving beacon, no direct-call-problem — just an abrupt drop,
      // exactly like a tab getting killed with zero warning.
      party.socket.disconnect();

      const body = await waitForEvent(api, room.roomId, (e) => e.type === "disconnected" && /reason unknown/i.test(e.summary));
      const unknownProblem = (body.problems || []).find((p) => p.reason === "unknown");
      expect(unknownProblem, "expected an 'unknown' entry in problems").toBeTruthy();
      expect(unknownProblem.detectable).toBe("unknown");
    } finally {
      await api.dispose();
    }
  });

  test("pagehide beacon: /leaving tags the next disconnect as tab_closed, excluded from Problems", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let party;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      party = await joinPinRoom(baseURL, room.roomId, doctorPin);

      const beaconRes = await api.post(
        `/api/direct-video-room/${room.roomId}/leaving?guestId=${encodeURIComponent(party.guestId)}`,
      );
      expect(beaconRes.ok()).toBeTruthy();
      party.socket.disconnect();

      const body = await waitForEvent(api, room.roomId, (e) => e.type === "disconnected" && /tab\/app closed/i.test(e.summary));
      expect((body.problems || []).some((p) => p.reason === "tab_closed")).toBe(false);
    } finally {
      await api.dispose();
    }
  });

  test("superadmin-only delete: a regular admin is refused, a superadmin can delete and leaves one audit entry", async ({
    baseURL,
  }) => {
    const api = await adminApi(baseURL);
    const throwawayAdminApi = await createThrowawayAdminApi(baseURL, "admin");
    const superApi = await createThrowawayAdminApi(baseURL, "superadmin");
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      const { socket } = await joinPinRoom(baseURL, room.roomId, doctorPin);
      socket.disconnect();
      await waitForEvent(api, room.roomId, (e) => e.type === "joined");

      // A throwaway regular-admin identity for this specific negative check
      // — triggering superAdminOnly's 403 raises a "critical" privilege-
      // escalation security event, which revokes the ACTING user's own
      // sessions (see createThrowawayAdminApi's doc comment). Doing this
      // with the shared ADMIN_STATE admin would knock every other test in
      // the suite off its session.
      const forbidden = await throwawayAdminApi.delete(`/api/direct-video-room/${room.roomId}/events`);
      expect(forbidden.status()).toBe(403);

      const before = await api.get(`/api/direct-video-room/${room.roomId}/events`);
      const beforeBody = await before.json();
      const deletedCount = beforeBody.timeline.length;
      expect(deletedCount).toBeGreaterThan(0);

      const del = await superApi.delete(`/api/direct-video-room/${room.roomId}/events`);
      expect(del.ok()).toBeTruthy();
      const delBody = await del.json();
      expect(delBody.deletedCount).toBe(deletedCount);

      const after = await api.get(`/api/direct-video-room/${room.roomId}/events`);
      const afterBody = await after.json();
      expect(afterBody.timeline).toHaveLength(1);
      expect(afterBody.timeline[0].type).toBe("admin_deleted_timeline");
      expect(afterBody.timeline[0].summary).toMatch(/superadmin/i);
    } finally {
      await api.dispose();
      await throwawayAdminApi.dispose();
      await superApi.dispose();
    }
  });
});
