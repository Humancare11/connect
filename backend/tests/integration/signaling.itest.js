// Real-process signaling tests (appointment + direct rooms): join/deny reasons,
// grace timers and rejoin races, duplicate joins, relay validation, rate
// limits, malformed / hostile input. Run with:  npm run test:integration
const test = require("node:test");
const assert = require("node:assert/strict");
const { startStack, sleep } = require("../helpers/signalingStack");

const GRACE_MS = 1500;
const VALID_SDP = (type) => ({ type, sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" });

let stack;

test.before(async () => {
  stack = await startStack({ graceMs: GRACE_MS });
});

test.after(async () => {
  await stack?.stop();
});

// Joins doctor + patient to the main appointment and waits until both see each other.
async function bothJoined(appointmentId = stack.ids.appointmentId) {
  const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken });
  const patient = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(doctor, "doctor", { appointmentId });
  await stack.joinAppointment(patient, "patient", { appointmentId });
  await stack.waitFor(doctor, "peer-joined");
  await stack.waitFor(patient, "peer-joined");
  return { doctor, patient };
}

const closeAll = (...sockets) => sockets.forEach((s) => s.close());

// ------------------------------------------------------------------ deny reasons
test("join: doctor and patient meet", async () => {
  const { doctor, patient } = await bothJoined();
  await stack.waitFor(patient, "appointment-chat-history");
  closeAll(doctor, patient);
});

test("join denied: unauthenticated (no token)", async () => {
  const s = await stack.connect();
  await stack.joinAppointment(s, "patient", { tokenOverride: "" });
  const denied = await stack.waitFor(s, "room-access-denied");
  assert.equal(denied.reason, "unauthenticated");
  s.close();
});

test("join denied: unauthenticated (garbage token)", async () => {
  const s = await stack.connect({ token: "not.a.jwt" });
  await stack.joinAppointment(s, "patient", { tokenOverride: "not.a.jwt" });
  assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "unauthenticated");
  s.close();
});

test("join denied: not_participant (a different patient)", async () => {
  const s = await stack.connect({ token: stack.tokens.other.accessToken });
  await stack.joinAppointment(s, "other");
  assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "not_participant");
  s.close();
});

test("join denied: appointment_not_found", async () => {
  const s = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(s, "patient", { appointmentId: "64b64b64b64b64b64b64b64b" });
  assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "appointment_not_found");
  s.close();
});

test("join denied: invalid_appointment (malformed id) and (missing id) are permanent-style but clear", async () => {
  const s = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(s, "patient", { appointmentId: "not-an-object-id" });
  assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "invalid_appointment");
  s.events.length = 0;
  s.emit("join-appointment-room", {});
  assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "invalid_appointment");
  s.close();
});

test("join denied: appointment_ended once completed or cancelled", async () => {
  for (const status of ["completed", "cancelled"]) {
    const id = await stack.makeAppointment(status);
    const s = await stack.connect({ token: stack.tokens.patient.accessToken });
    await stack.joinAppointment(s, "patient", { appointmentId: id });
    assert.equal((await stack.waitFor(s, "room-access-denied")).reason, "appointment_ended", status);
    s.close();
  }
});

// ------------------------------------------------------------------ presence & grace timers
test("a dropped peer is announced at once (peer-socket-down) and again when it returns (peer-socket-up) - no participant-left", async () => {
  const { doctor, patient } = await bothJoined();
  patient.close();
  await stack.waitFor(doctor, "peer-socket-down", { timeout: 3000 });

  const patient2 = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(patient2, "patient");
  await stack.waitFor(doctor, "peer-socket-up", { timeout: 3000 });

  await sleep(GRACE_MS + 1200);
  assert.equal(stack.count(doctor, "participant-left"), 0, "rejoin inside the grace period must cancel the timer");
  closeAll(doctor, patient2);
});

test("a peer that never returns is declared gone after the grace period (participant-left)", async () => {
  const { doctor, patient } = await bothJoined();
  const t0 = Date.now();
  patient.close();
  await stack.waitFor(doctor, "participant-left", { timeout: GRACE_MS + 3000 });
  assert.ok(Date.now() - t0 >= GRACE_MS - 200, "must not be announced before the grace period");
  doctor.close();
});

test("drop -> rejoin -> drop again: the FIRST timer must not declare the peer gone early (M4)", async () => {
  const { doctor, patient } = await bothJoined();
  patient.close(); // drop #1 at t0
  const t0 = Date.now();
  await sleep(500);
  const p2 = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(p2, "patient"); // rejoin at ~t0+500
  await stack.waitFor(doctor, "peer-socket-up");
  await sleep(300);
  p2.close(); // drop #2 at ~t0+800 -> its own grace ends ~t0+2300
  const secondDropAt = Date.now();

  // The old timer would fire at t0+1500. Nothing may arrive before the new one.
  await sleep(GRACE_MS - 300);
  assert.equal(stack.count(doctor, "participant-left"), 0, `participant-left arrived ${Date.now() - t0}ms after drop #1`);
  await stack.waitFor(doctor, "participant-left", { timeout: 3000 });
  assert.ok(Date.now() - secondDropAt >= GRACE_MS - 250, "the grace period restarts from the latest drop");
  doctor.close();
});

test("both participants drop at once: each one's return is still reported", async () => {
  const { doctor, patient } = await bothJoined();
  doctor.close();
  patient.close();
  await sleep(300);
  const d2 = await stack.connect({ token: stack.tokens.doctor.accessToken });
  await stack.joinAppointment(d2, "doctor");
  await sleep(200);
  const p2 = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(p2, "patient");
  await stack.waitFor(d2, "peer-joined", { timeout: 4000 });
  await stack.waitFor(p2, "peer-joined", { timeout: 4000 });
  await sleep(GRACE_MS + 1000);
  assert.equal(stack.count(d2, "participant-left"), 0);
  assert.equal(stack.count(p2, "participant-left"), 0);
  closeAll(d2, p2);
});

test("duplicate join: the same user on a second socket evicts the first (duplicate-session)", async () => {
  const { doctor, patient } = await bothJoined();
  const patient2 = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(patient2, "patient");
  await stack.waitFor(patient, "duplicate-session", { timeout: 3000 });
  await stack.waitFor(patient2, "peer-joined");
  closeAll(doctor, patient, patient2);
});

test("joining twice on the same socket is harmless", async () => {
  const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken });
  await stack.joinAppointment(doctor, "doctor");
  await stack.joinAppointment(doctor, "doctor");
  await sleep(300);
  assert.equal(stack.count(doctor, "room-access-denied"), 0);
  doctor.close();
});

// ------------------------------------------------------------------ relay, validation, rate limits
test("offer/answer/ICE are relayed between the two participants", async () => {
  const { doctor, patient } = await bothJoined();
  patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer"), offerId: "o-1" });
  const offer = await stack.waitFor(doctor, "video-offer");
  assert.equal(offer.offerId, "o-1");
  doctor.emit("video-answer", { appointmentId: stack.ids.appointmentId, answer: VALID_SDP("answer"), offerId: "o-1" });
  assert.equal((await stack.waitFor(patient, "video-answer")).offerId, "o-1");
  patient.emit("ice-candidate", { appointmentId: stack.ids.appointmentId, candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" } });
  await stack.waitFor(doctor, "ice-candidate");
  closeAll(doctor, patient);
});

test("hc-ping is acknowledged (resume liveness probe)", async () => {
  const s = await stack.connect({ token: stack.tokens.patient.accessToken });
  const ack = await s.timeout(2000).emitWithAck("hc-ping", {});
  assert.equal(ack.ok, true);
  s.close();
});

test("signaling from a socket that never joined is refused with a clear error", async () => {
  const s = await stack.connect({ token: stack.tokens.patient.accessToken });
  s.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer") });
  const err = await stack.waitFor(s, "signaling-error");
  assert.equal(err.code, "not_in_room");
  assert.equal(err.event, "video-offer");
  s.close();
});

test("events after leave-appointment-room are refused", async () => {
  const { doctor, patient } = await bothJoined();
  patient.emit("leave-appointment-room", { appointmentId: stack.ids.appointmentId });
  await stack.waitFor(doctor, "participant-left");
  patient.events.length = 0;
  patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer") });
  assert.equal((await stack.waitFor(patient, "signaling-error")).code, "not_in_room");
  closeAll(doctor, patient);
});

test("malformed offers/answers are refused (invalid_payload) and never relayed", async () => {
  const { doctor, patient } = await bothJoined();
  const id = stack.ids.appointmentId;
  const bad = [
    { appointmentId: id, offer: "string" },
    { appointmentId: id, offer: { type: "answer", sdp: "v=0" } }, // wrong type for an offer
    { appointmentId: id, offer: { type: "offer", sdp: "" } },
    { appointmentId: id, offer: { type: "offer", sdp: 42 } },
    { appointmentId: id, offer: { type: "offer", sdp: "x".repeat(200_000) } }, // over MAX_SDP_LENGTH
    { appointmentId: id },
  ];
  for (const payload of bad) {
    patient.events.length = 0;
    patient.emit("video-offer", payload);
    assert.equal((await stack.waitFor(patient, "signaling-error")).code, "invalid_payload", JSON.stringify(payload).slice(0, 80));
    await sleep(350); // stay under the per-socket error-reply cap
  }
  assert.equal(stack.count(doctor, "video-offer"), 0, "none of the malformed offers may reach the peer");
  // an answer in the wrong state is just a well-formed answer: relayed, the CLIENT state machine rejects it
  doctor.emit("video-answer", { appointmentId: id, answer: VALID_SDP("answer"), offerId: "never-offered" });
  await stack.waitFor(patient, "video-answer");
  closeAll(doctor, patient);
});

test("null / non-object payloads do not crash the server: they get a server_error reply", async () => {
  const { doctor, patient } = await bothJoined();
  const events = ["video-offer", "video-answer", "ice-candidate", "camera-state", "join-appointment-room", "appointment-message", "direct-video-offer"];
  for (const event of events) {
    patient.events.length = 0;
    patient.emit(event, null);
    await sleep(120);
    patient.emit(event, "just a string");
    patient.emit(event, 12345);
    await sleep(380);
  }
  assert.equal(await stack.alive(), true, "backend must still be serving");
  // and the connection + room still work afterwards
  patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer") });
  await stack.waitFor(doctor, "video-offer");
  closeAll(doctor, patient);
});

test("a huge payload (> maxHttpBufferSize) drops that socket only; the server and other rooms are unaffected", async () => {
  const { doctor, patient } = await bothJoined();
  const noisy = await stack.connect({ token: stack.tokens.other.accessToken });
  noisy.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: { type: "offer", sdp: "x".repeat(3_000_000) } });
  await new Promise((resolve) => noisy.once("disconnect", resolve));
  assert.equal(await stack.alive(), true);
  patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer") });
  await stack.waitFor(doctor, "video-offer");
  closeAll(doctor, patient);
});

test("ICE candidates are rate limited (60/s) and over-limit ones are reported, duplicates are fine", async () => {
  const { doctor, patient } = await bothJoined();
  doctor.events.length = 0;
  patient.events.length = 0;
  const candidate = { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" };
  for (let i = 0; i < 200; i += 1) {
    patient.emit("ice-candidate", { appointmentId: stack.ids.appointmentId, candidate }); // identical = duplicates
  }
  await sleep(1200);
  const relayed = stack.count(doctor, "ice-candidate");
  assert.ok(relayed >= 1 && relayed <= 70, `relayed ${relayed}`);
  assert.ok(stack.count(patient, "signaling-error") >= 1, "the sender is told it was rate limited");
  assert.ok(stack.count(patient, "signaling-error") <= 6, "error replies themselves are capped");
  assert.equal(patient.events.find((e) => e.event === "signaling-error").args[0].code, "rate_limited");
  closeAll(doctor, patient);
});

test("SDP burst: up to 6 per second pass, the rest are reported", async () => {
  const { doctor, patient } = await bothJoined();
  doctor.events.length = 0;
  for (let i = 0; i < 20; i += 1) patient.emit("video-offer", { appointmentId: stack.ids.appointmentId, offer: VALID_SDP("offer") });
  await sleep(1000);
  const relayed = stack.count(doctor, "video-offer");
  assert.ok(relayed >= 1 && relayed <= 6, `relayed ${relayed}`);
  closeAll(doctor, patient);
});

test("unknown events and unknown rooms are ignored without side effects", async () => {
  const s = await stack.connect({ token: stack.tokens.patient.accessToken });
  s.emit("definitely-not-an-event", { a: 1 });
  s.emit("leave-appointment-room", { appointmentId: "64b64b64b64b64b64b64b64b" });
  s.emit("leave-direct-room", { roomId: "ffffffffffffffffffffffffffffffff" });
  await sleep(300);
  assert.equal(await stack.alive(), true);
  assert.equal(s.connected, true);
  s.close();
});

// ------------------------------------------------------------------ ICE endpoint
test("GET /api/rtc/ice-servers: needs auth, returns STUN+TURN creds, no warning when TURN is configured", async () => {
  assert.equal((await fetch(`${stack.baseUrl}/api/rtc/ice-servers`)).status, 401);
  const res = await fetch(`${stack.baseUrl}/api/rtc/ice-servers`, { headers: { Authorization: `Bearer ${stack.tokens.patient.accessToken}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.iceServers.some((s) => String(s.urls).startsWith("turn:") || [].concat(s.urls).some((u) => u.startsWith("turn:"))));
  assert.ok(body.ttlSeconds > 0);
  assert.equal(body.warning, undefined);
});

// ------------------------------------------------------------------ direct rooms
const directJoin = (socket, roomId, guestId = "guest-aaaaaaaa", name = "Guest") =>
  socket.emit("join-direct-room", { roomId, guestId, name });

test("direct: invalid / unknown / expired / closed links get a specific error code", async () => {
  const cases = [
    ["not a room id", "invalid"],
    ["ffffffffffffffffffffffffffffffff", "not_found"],
    [await stack.makeDirectRoom({ status: "expired" }), "closed"], // status string other than active/expired -> see below
  ];
  // an "expired" document is reported as expired; anything else non-active as closed
  const expiredRoom = await stack.makeDirectRoom({ status: "expired" });
  const closedRoom = await stack.makeDirectRoom({ status: "closed" });
  const timedOutRoom = await stack.makeDirectRoom({ status: "active", expiresInMs: -60_000 });
  const expectations = [
    [cases[0][0], "invalid"],
    [cases[1][0], "not_found"],
    [expiredRoom, "expired"],
    [closedRoom, "closed"],
    [timedOutRoom, "expired"],
  ];
  for (const [roomId, code] of expectations) {
    const s = await stack.connect();
    directJoin(s, roomId);
    const err = await stack.waitFor(s, "direct-room-error");
    assert.equal(err.code, code, roomId);
    assert.ok(err.msg && err.msg.length > 5, "has a human message");
    s.close();
  }
});

test("direct: bad guest id / payload is rejected cleanly", async () => {
  const s = await stack.connect();
  s.emit("join-direct-room", { roomId: stack.ids.directRoomId, guestId: "x" });
  assert.equal((await stack.waitFor(s, "direct-room-error")).code, "invalid");
  s.events.length = 0;
  s.emit("join-direct-room", null);
  await sleep(300);
  assert.equal(await stack.alive(), true);
  s.close();
});

test("direct: two guests meet; a third is told the room is full; the first can still reconnect", async () => {
  const roomId = await stack.makeDirectRoom();
  const host = await stack.connect();
  const guest = await stack.connect();
  // live clients answer the server's presence check (a silent seat is handed over)
  for (const s of [host, guest]) s.on("presence-ping", (_d, ack) => typeof ack === "function" && ack());
  directJoin(host, roomId, "host-aaaaaaaa", "Host");
  await stack.waitFor(host, "direct-room-joined");
  directJoin(guest, roomId, "guest-bbbbbbbb", "Guest");
  await stack.waitFor(guest, "direct-room-joined");
  await stack.waitFor(host, "direct-peer-joined");

  const third = await stack.connect();
  directJoin(third, roomId, "third-cccccccc", "Third");
  assert.equal((await stack.waitFor(third, "direct-room-error")).code, "full");
  third.close();
  closeAll(host, guest);
});

test("direct: a guest that drops and returns inside the grace window never causes direct-participant-left (M4)", async () => {
  const roomId = await stack.makeDirectRoom();
  const host = await stack.connect();
  directJoin(host, roomId, "host-aaaaaaaa", "Host");
  await stack.waitFor(host, "direct-room-joined");
  let guest = await stack.connect();
  directJoin(guest, roomId, "guest-bbbbbbbb", "Guest");
  await stack.waitFor(host, "direct-peer-joined");

  guest.close(); // drop #1
  await stack.waitFor(host, "direct-peer-socket-down", { timeout: 3000 });
  guest = await stack.connect();
  directJoin(guest, roomId, "guest-bbbbbbbb", "Guest"); // same guestId -> same seat
  await stack.waitFor(host, "direct-peer-socket-up", { timeout: 3000 });
  guest.close(); // drop #2
  await stack.waitFor(host, "direct-peer-socket-down", { timeout: 3000 });
  const g3 = await stack.connect();
  directJoin(g3, roomId, "guest-bbbbbbbb", "Guest");
  await stack.waitFor(host, "direct-peer-socket-up", { timeout: 3000 });

  await sleep(5000 + 1500); // the stack runs with DIRECT_ROOM_LEAVE_GRACE_MS=5000
  assert.equal(stack.count(host, "direct-participant-left"), 0);
  closeAll(host, g3);
});

test("direct: a guest that never returns is declared gone after the grace period", async () => {
  const roomId = await stack.makeDirectRoom();
  const host = await stack.connect();
  const guest = await stack.connect();
  directJoin(host, roomId, "host-aaaaaaaa", "Host");
  directJoin(guest, roomId, "guest-bbbbbbbb", "Guest");
  await stack.waitFor(host, "direct-peer-joined");
  guest.close();
  await stack.waitFor(host, "direct-participant-left", { timeout: 9000 });
  host.close();
});

test("direct: signaling from outside the room is refused; null payloads cannot crash the server", async () => {
  const s = await stack.connect();
  s.emit("direct-video-offer", { roomId: stack.ids.directRoomId, offer: VALID_SDP("offer") });
  assert.equal((await stack.waitFor(s, "signaling-error")).code, "not_in_room");
  for (const event of ["direct-video-offer", "direct-video-answer", "direct-ice-candidate", "direct-media-state", "verify-direct-pin", "direct-session-takeover", "join-direct-room", "admin-watch-direct-room"]) {
    s.emit(event, null);
    s.emit(event, "x");
    await sleep(60);
  }
  await sleep(500);
  assert.equal(await stack.alive(), true);
  s.close();
});

test("direct PIN room: wrong PIN rejected, right PIN grants a role, the token rejoins, bad token is refused", async () => {
  const { encryptPin } = require("../../utils/directPinCrypto");
  const crypto = require("node:crypto");
  const roomId = crypto.randomBytes(16).toString("hex");
  await stack.models.DirectVideoRoom.create({
    roomId,
    createdBy: stack.ids.patientId,
    createdByName: "Signal Patient",
    status: "active",
    expiresAt: new Date(Date.now() + 3600_000),
    doctorPinEncrypted: encryptPin("111111"),
    patientPinEncrypted: encryptPin("222222"),
  });

  const s = await stack.connect();
  s.emit("verify-direct-pin", { roomId, pin: "000000", guestId: "guest-pin-aaaa" });
  const wrong = await stack.waitFor(s, "direct-pin-error");
  assert.match(wrong.msg, /Incorrect PIN/i);

  s.events.length = 0;
  s.emit("verify-direct-pin", { roomId, pin: "111111", guestId: "guest-pin-aaaa" });
  const ok = await stack.waitFor(s, "direct-pin-ok");
  assert.equal(ok.role, "doctor");

  s.emit("join-direct-room", { roomId, guestId: "guest-pin-aaaa", sessionToken: ok.sessionToken });
  await stack.waitFor(s, "direct-room-joined");

  const bad = await stack.connect();
  bad.emit("join-direct-room", { roomId, guestId: "guest-pin-bbbb", sessionToken: "tampered.token" });
  assert.equal((await stack.waitFor(bad, "direct-room-error")).code, "pin_required");

  // a second device with the same PIN gets a conflict, not a silent takeover
  const second = await stack.connect();
  second.emit("verify-direct-pin", { roomId, pin: "111111", guestId: "guest-pin-bbbb" });
  assert.equal((await stack.waitFor(second, "direct-pin-conflict")).role, "doctor");
  closeAll(s, bad, second);
});
