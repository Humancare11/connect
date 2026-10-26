// Backend restart recovery, transient DB failure, and graceful shutdown against
// the real server process. Run with:  npm run test:integration
const test = require("node:test");
const assert = require("node:assert/strict");
const { startStack, sleep } = require("../helpers/signalingStack");

// A client that behaves like the real pages: (re)join on every "connect".
function autoJoin(stack, socket, role) {
  socket.on("connect", () => stack.joinAppointment(socket, role));
  if (socket.connected) stack.joinAppointment(socket, role);
}

test("backend restart mid-call: reconnecting clients rejoin and meet again with no denial", async () => {
  const stack = await startStack({ graceMs: 1500 });
  try {
    const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken, reconnection: true });
    const patient = await stack.connect({ token: stack.tokens.patient.accessToken, reconnection: true });
    autoJoin(stack, doctor, "doctor");
    autoJoin(stack, patient, "patient");
    await stack.waitFor(doctor, "peer-joined");
    await stack.waitFor(patient, "peer-joined");

    await stack.stopBackend(); // hard kill: no goodbye, state in memory is gone
    await stack.waitFor(doctor, "disconnect", { timeout: 15_000 });
    doctor.events.length = 0;
    patient.events.length = 0;
    await stack.startBackend();

    await stack.waitFor(doctor, "peer-joined", { timeout: 30_000 });
    await stack.waitFor(patient, "peer-joined", { timeout: 30_000 });
    assert.equal(stack.count(doctor, "room-access-denied"), 0);
    assert.equal(stack.count(patient, "room-access-denied"), 0);
    // signaling works again end to end
    patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: { type: "offer", sdp: "v=0\r\n" } });
    await stack.waitFor(doctor, "video-offer", { timeout: 5000 });
  } finally {
    await stack.stop();
  }
});

test("restart with an EXPIRED access token: the refresh token still gets the client back in", async () => {
  const stack = await startStack({ graceMs: 1500, env: { ACCESS_TOKEN_TTL: "2s" } });
  try {
    const tokens = await stack.login("patient");
    await sleep(3000); // access token is now expired
    // the real web client falls back to its refresh token / cookie; the mobile one refreshes first
    const res = await fetch(`${stack.baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.refreshToken}`, "X-Auth-Role": "user", "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    assert.equal(res.status, 200);
    const fresh = (await res.json()).accessToken;
    assert.ok(fresh);
    const s = await stack.connect({ token: fresh });
    await stack.joinAppointment(s, "patient", { tokenOverride: fresh });
    await stack.waitFor(s, "appointment-chat-history", { timeout: 5000 });

    // and an expired token alone is refused with the retryable reason, never a permanent one
    const stale = await stack.connect({ token: tokens.accessToken });
    await stack.joinAppointment(stale, "patient", { tokenOverride: tokens.accessToken });
    const denied = await stack.waitFor(stale, "room-access-denied");
    assert.equal(denied.reason, "unauthenticated");
  } finally {
    await stack.stop();
  }
});

test("transient DB failure: join is answered server_error (retryable), the process survives", async () => {
  const stack = await startStack({ graceMs: 1500, env: { MONGOOSE_BUFFER_TIMEOUT_MS: "1500" } });
  try {
    const patient = await stack.connect({ token: stack.tokens.patient.accessToken });
    const guest = await stack.connect();
    await stack.killMongo();
    await stack.joinAppointment(patient, "patient");
    const denied = await stack.waitFor(patient, "room-access-denied", { timeout: 40_000 });
    assert.ok(["server_error", "unauthenticated"].includes(denied.reason), `reason ${denied.reason}`);
    assert.notEqual(denied.reason, "appointment_not_found");
    assert.notEqual(denied.reason, "invalid_appointment");

    guest.emit("join-direct-room", { roomId: stack.ids.directRoomId, guestId: "guest-dbdown-aaaa" });
    const err = await stack.waitFor(guest, "direct-room-error", { timeout: 40_000 });
    assert.equal(err.code, "server_error");

    assert.equal(await stack.alive(), true, "the server must not crash when the database disappears");
  } finally {
    await stack.stop();
  }
});

test("SIGTERM: graceful shutdown exits 0 and never logs ERR_SERVER_NOT_RUNNING", { skip: process.platform === "win32" && "Windows has no SIGTERM handlers (kill is unconditional); covered by tests/gracefulShutdown.test.js" }, async () => {
  const stack = await startStack();
  try {
    const exited = stack.childExited;
    process.kill(stack.childPid, "SIGTERM");
    const { code } = await exited;
    assert.equal(code, 0);
    assert.ok(!/ERR_SERVER_NOT_RUNNING|Error during graceful shutdown/.test(stack.logs()));
  } finally {
    await stack.stop();
  }
});
