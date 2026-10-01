// Backend-only coverage for the PIN-based-roles socket layer (see
// server.js's verify-direct-pin / direct-session-takeover / join-direct-room
// PIN branch). No browser page involved — the frontend PIN-entry screen
// doesn't exist yet (that's the next step in the plan), so this drives the
// raw socket protocol directly with socket.io-client, the same way a page
// would once it exists. Still rides on the normal e2e webServer bootstrap
// (throwaway mongo + real backend), just skips Chromium entirely.
import crypto from "node:crypto";
import { io as ioClient } from "socket.io-client";
import { request } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { ADMIN_STATE } from "../global-setup.js";

function newGuestId() {
  return crypto.randomUUID();
}

async function adminApi(baseURL) {
  return request.newContext({ baseURL, storageState: ADMIN_STATE });
}

async function createRoomWithPins(api) {
  const res = await api.post("/api/direct-video-room", { data: { note: "pin-socket test", expiresInHours: 24 } });
  expect(res.ok(), `create room failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { room: body.room, doctorPin: body.doctorPin, patientPin: body.patientPin };
}

function connectSocket(baseURL, extraHeaders) {
  // Matches the real client's default (frontend/src/socket.js): polling
  // first, then upgrade — a websocket-only connection was silently never
  // completing against this server's setup.
  const socket = ioClient(baseURL, {
    path: "/socket.io/",
    transports: ["polling", "websocket"],
    forceNew: true,
    reconnection: false,
    extraHeaders,
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

test.describe("direct call — PIN socket layer", () => {
  test.skip(!process.env.TEST_ADMIN_EMAIL, "TEST_ADMIN_EMAIL is not set (seeded automatically in local mode)");

  test("correct PIN assigns the right role and join-direct-room succeeds", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();

      socket.emit("verify-direct-pin", { roomId: room.roomId, pin: doctorPin, guestId });
      const ok = await once(socket, "direct-pin-ok");
      expect(ok.role).toBe("doctor");
      expect(typeof ok.sessionToken).toBe("string");

      socket.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken: ok.sessionToken });
      const joined = await once(socket, "direct-room-joined");
      expect(joined.role).toBe("doctor");
      expect(joined.resumedCall).toBe(false);
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("wrong PIN is rejected, and 5 wrong attempts block further attempts", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { room } = await createRoomWithPins(api);
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();

      for (let i = 0; i < 5; i++) {
        socket.emit("verify-direct-pin", { roomId: room.roomId, pin: "000000", guestId });
        const err = await once(socket, "direct-pin-error");
        expect(err.blocked).toBeFalsy();
      }

      socket.emit("verify-direct-pin", { roomId: room.roomId, pin: "000000", guestId });
      const blocked = await once(socket, "direct-pin-error");
      expect(blocked.blocked).toBe(true);
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("a refresh (same sessionToken) rejoins without a new PIN prompt, and resumedCall is true", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { room, patientPin } = await createRoomWithPins(api);
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();

      socket.emit("verify-direct-pin", { roomId: room.roomId, pin: patientPin, guestId });
      const { sessionToken } = await once(socket, "direct-pin-ok");
      socket.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      await once(socket, "direct-room-joined");

      // Simulate a page refresh: a fresh socket, same stored token, no PIN re-entry.
      const socket2 = await connectSocket(baseURL);
      socket2.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      const rejoined = await once(socket2, "direct-room-joined");
      expect(rejoined.role).toBe("patient");
      expect(rejoined.resumedCall).toBe(true);
      socket2.disconnect();
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("second device with the same PIN gets a conflict; confirmed takeover evicts the first device", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let deviceA, deviceB;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);

      deviceA = await connectSocket(baseURL);
      const guestA = newGuestId();
      deviceA.emit("verify-direct-pin", { roomId: room.roomId, pin: doctorPin, guestId: guestA });
      const okA = await once(deviceA, "direct-pin-ok");
      deviceA.emit("join-direct-room", { roomId: room.roomId, guestId: guestA, sessionToken: okA.sessionToken });
      await once(deviceA, "direct-room-joined");

      const supersededPromise = once(deviceA, "direct-session-superseded");

      deviceB = await connectSocket(baseURL);
      const guestB = newGuestId();
      deviceB.emit("verify-direct-pin", { roomId: room.roomId, pin: doctorPin, guestId: guestB });
      const conflict = await once(deviceB, "direct-pin-conflict");
      expect(conflict.role).toBe("doctor");

      deviceB.emit("direct-session-takeover", { roomId: room.roomId, pin: doctorPin, guestId: guestB, role: "doctor" });
      const okB = await once(deviceB, "direct-pin-ok");
      expect(okB.role).toBe("doctor");

      const superseded = await supersededPromise;
      expect(superseded.msg).toMatch(/another device/i);

      deviceB.emit("join-direct-room", { roomId: room.roomId, guestId: guestB, sessionToken: okB.sessionToken });
      const joinedB = await once(deviceB, "direct-room-joined");
      expect(joinedB.role).toBe("doctor");
    } finally {
      deviceA?.disconnect();
      deviceB?.disconnect();
      await api.dispose();
    }
  });

  test("regenerate PIN (default): current device's session survives a refresh, old PIN stops working", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { room, patientPin } = await createRoomWithPins(api);
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();
      socket.emit("verify-direct-pin", { roomId: room.roomId, pin: patientPin, guestId });
      const { sessionToken } = await once(socket, "direct-pin-ok");
      socket.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      await once(socket, "direct-room-joined");

      const regen = await api.post(`/api/direct-video-room/${room.roomId}/regenerate-pin`, {
        data: { role: "patient" },
      });
      expect(regen.ok()).toBeTruthy();
      const { pin: newPin } = await regen.json();
      expect(newPin).not.toBe(patientPin);

      // Old device's existing token still works (a "refresh" right now).
      const socket2 = await connectSocket(baseURL);
      socket2.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      const rejoined = await once(socket2, "direct-room-joined");
      expect(rejoined.role).toBe("patient");
      socket2.disconnect();

      // The OLD PIN can no longer start a NEW session.
      const socket3 = await connectSocket(baseURL);
      socket3.emit("verify-direct-pin", { roomId: room.roomId, pin: patientPin, guestId: newGuestId() });
      const err = await once(socket3, "direct-pin-error");
      expect(err.msg).toMatch(/incorrect/i);
      socket3.disconnect();
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("regenerate PIN + endCurrentSession: old token is rejected and the live device is disconnected", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    let socket;
    try {
      const { room, doctorPin } = await createRoomWithPins(api);
      socket = await connectSocket(baseURL);
      const guestId = newGuestId();
      socket.emit("verify-direct-pin", { roomId: room.roomId, pin: doctorPin, guestId });
      const { sessionToken } = await once(socket, "direct-pin-ok");
      socket.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      await once(socket, "direct-room-joined");

      const supersededPromise = once(socket, "direct-session-superseded");
      const regen = await api.post(`/api/direct-video-room/${room.roomId}/regenerate-pin`, {
        data: { role: "doctor", endCurrentSession: true },
      });
      expect(regen.ok()).toBeTruthy();

      const superseded = await supersededPromise;
      expect(superseded.msg).toMatch(/session has ended/i);

      // The old token is now genuinely dead, even for a plain rejoin.
      const socket2 = await connectSocket(baseURL);
      socket2.emit("join-direct-room", { roomId: room.roomId, guestId, sessionToken });
      const rejected = await once(socket2, "direct-session-superseded");
      expect(rejected.msg).toMatch(/enter the new pin/i);
      socket2.disconnect();
    } finally {
      socket?.disconnect();
      await api.dispose();
    }
  });

  test("admin can view PINs again after creation, and the view is logged", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    try {
      const { room, doctorPin, patientPin } = await createRoomWithPins(api);

      const res = await api.get(`/api/direct-video-room/${room.roomId}/pins`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.doctorPin).toBe(doctorPin);
      expect(body.patientPin).toBe(patientPin);

      const events = await api.get(`/api/direct-video-room/${room.roomId}/events`);
      const eventsBody = await events.json();
      const viewedEntry = eventsBody.timeline.find((e) => e.type === "admin_viewed_pins");
      expect(viewedEntry, "expected an admin_viewed_pins timeline entry").toBeTruthy();
      // The PIN value itself must never appear in the timeline summary text.
      expect(viewedEntry.summary).not.toContain(doctorPin);
      expect(viewedEntry.summary).not.toContain(patientPin);
    } finally {
      await api.dispose();
    }
  });

  test("per-room brute force: many wrong attempts from different IPs still gets blocked", async ({ baseURL }) => {
    const api = await adminApi(baseURL);
    const sockets = [];
    try {
      const { room } = await createRoomWithPins(api);

      // TRUST_PROXY defaults to trusting one X-Forwarded-For hop — spoof a
      // distinct source IP per attempt so this exercises the per-ROOM
      // window specifically, not the per-IP one (already covered above).
      for (let i = 0; i < 20; i++) {
        const s = await connectSocket(baseURL, { "x-forwarded-for": `10.9.${i}.1` });
        sockets.push(s);
        s.emit("verify-direct-pin", { roomId: room.roomId, pin: "111111", guestId: newGuestId() });
        await once(s, "direct-pin-error");
      }

      const finalSocket = await connectSocket(baseURL, { "x-forwarded-for": "10.9.250.1" });
      sockets.push(finalSocket);
      finalSocket.emit("verify-direct-pin", { roomId: room.roomId, pin: "111111", guestId: newGuestId() });
      const blocked = await once(finalSocket, "direct-pin-error");
      expect(blocked.blocked).toBe(true);
    } finally {
      sockets.forEach((s) => s.disconnect());
      await api.dispose();
    }
  });
});
