// End-to-end proof against the REAL server process (node server.js + in-memory MongoDB), through real sockets and real HTTP:
//   F1 an operator object / array as an appointment id no longer opens a room or returns other appointments' chat history;
//   F2 malformed chat fields no longer reach the other person, text is limited to 2000 characters;
//   the chat sender name is the signed-in user's own name, never what the browser sends;
//   a normal call and normal chat behave as before.
// Run: node --test tests/socketInputValidation.test.js
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startStack } = require("./helpers/signalingStack");

describe("socket and HTTP input validation (real server)", () => {
  let stack;
  let victimAppointmentId;
  let ids;
  let tokens;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const events = (s, name) => s.events.filter((e) => e.event === name);

  before(async () => {
    stack = await startStack({ env: { TRANSCRIPTION_ENABLED: "false" } });
    ids = stack.ids;
    tokens = stack.tokens;
    // a second booking belonging to a different patient, with one private chat message in it
    const now = new Date();
    victimAppointmentId = String((await stack.models.Appointment.create({
      patientId: ids.otherId, doctorId: ids.doctorId, category: "General", specialty: "General Practice", condition: "victim",
      patientDetails: { firstName: "V", lastName: "V", email: stack.creds.other.email }, date: now.toISOString().slice(0, 10), time: "11:00",
      appointmentDateTimeUtc: now, status: "confirmed", paymentStatus: "paid",
    }))._id);
    const v = await stack.connect({ token: tokens.other.accessToken });
    v.emit("user-online", { userId: ids.otherId, role: "user", token: tokens.other.accessToken });
    v.emit("join-appointment-room", { appointmentId: victimAppointmentId, userId: ids.otherId, role: "user", token: tokens.other.accessToken });
    await sleep(700);
    v.emit("appointment-message", { appointmentId: victimAppointmentId, senderId: ids.otherId, senderName: "Victim", text: "VICTIM-PRIVATE-MESSAGE-DUMMY" });
    await sleep(800);
    v.close();
  });

  after(async () => { await stack?.stop(); });

  async function join(role, appointmentId, { raw } = {}) {
    const s = await stack.connect({ token: tokens[role].accessToken });
    if (raw) { s.emit("join-appointment-room", raw); } else { await stack.joinAppointment(s, role, { appointmentId }); }
    await sleep(800);
    return s;
  }

  test("a normal call is unchanged: both join their own room, chat history loads, peers see each other", async () => {
    const d = await join("doctor", ids.appointmentId);
    const p = await join("patient", ids.appointmentId);
    assert.ok(events(d, "peer-joined").length >= 1 && events(p, "peer-joined").length >= 1);
    assert.equal(events(p, "appointment-chat-history").length, 1);
    assert.equal(events(p, "room-access-denied").length, 0);
    const before = events(p, "camera-state").length;
    d.emit("camera-state", { appointmentId: ids.appointmentId, isCamOff: true });
    await sleep(400);
    assert.equal(events(p, "camera-state").length, before + 1, "signalling still relays");
    d.close(); p.close(); await sleep(300);
  });

  test("F1: an object, array or $-operator as appointmentId is refused as an invalid id; no room, no chat history, nothing from other appointments", async () => {
    const d = await join("doctor", ids.appointmentId);
    const bads = [{ $gte: ids.appointmentId }, { $ne: null }, { $in: [ids.appointmentId, victimAppointmentId] }, { $nin: [] }, [ids.appointmentId], [ids.appointmentId, victimAppointmentId], 12345, "garbage", { toString: "x" }, null];
    for (const role of ["patient", "doctor"]) {
      for (const bad of bads) {
        const uid = role === "doctor" ? ids.doctorId : ids.patientId;
        const s = await stack.connect({ token: tokens[role].accessToken });
        s.emit("user-online", { userId: uid, role: role === "doctor" ? "doctor" : "user", token: tokens[role].accessToken });
        s.emit("join-appointment-room", { appointmentId: bad, userId: uid, role: role === "doctor" ? "doctor" : "user", token: tokens[role].accessToken });
        await sleep(450);
        const denied = events(s, "room-access-denied");
        assert.equal(denied.length, 1, `${role} ${JSON.stringify(bad)}`);
        assert.equal(denied[0].args[0].reason, "invalid_appointment");
        assert.equal(events(s, "appointment-chat-history").length, 0, `no history for ${JSON.stringify(bad)}`);
        assert.equal(JSON.stringify(s.events).includes("VICTIM-PRIVATE"), false);
        assert.equal(events(s, "peer-joined").length, 0);
        s.close();
      }
    }
    d.close(); await sleep(300);
  });

  test("F1: the same bad ids are refused on every other call event (offer, ice, camera, chat, leave, watch ...) without a crash", async () => {
    const d = await join("doctor", ids.appointmentId);
    const p = await join("patient", ids.appointmentId);
    const sdp = { type: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" };
    const evs = [["video-offer", { offer: sdp }], ["video-answer", { answer: { ...sdp, type: "answer" } }], ["ice-candidate", { candidate: { candidate: "c" } }], ["ice-restart-request", {}], ["camera-state", { isCamOff: true }], ["call-connected", {}], ["call-stats", {}], ["request-peer-rebuild", {}], ["leave-appointment-room", {}], ["video-telemetry", { event: "x" }], ["admin-watch-call", {}], ["appointment-message", { text: "hello" }]];
    const base = { video: events(d, "video-offer").length, cam: events(d, "camera-state").length, chat: events(d, "appointment-message").length, left: events(d, "participant-left").length };
    for (const [ev, extra] of evs) {
      for (const bad of [{ $ne: null }, [ids.appointmentId]]) p.emit(ev, { appointmentId: bad, ...extra });
    }
    await sleep(900);
    assert.equal(events(d, "video-offer").length, base.video);
    assert.equal(events(d, "camera-state").length, base.cam);
    assert.equal(events(d, "appointment-message").length, base.chat);
    assert.equal(events(d, "participant-left").length, base.left, "an array id no longer counts as a real leave");
    assert.equal(await stack.alive(), true);
    // and the patient is still properly in the room afterwards
    p.emit("camera-state", { appointmentId: ids.appointmentId, isCamOff: false });
    await sleep(400);
    assert.equal(events(d, "camera-state").length, base.cam + 1);
    d.close(); p.close(); await sleep(300);
  });

  test("F2: malformed chat fields never reach the other person, a normal message still does; the call screen of the doctor is safe", async () => {
    const d = await join("doctor", ids.appointmentId);
    const p = await join("patient", ids.appointmentId);
    const got = [];
    d.on("appointment-message", (m) => got.push(m));
    const send = async (extra) => { const n = got.length; p.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.patientId, senderName: "Signal Patient", text: "ok", ...extra }); await sleep(450); return got.length - n; };
    const bad = [
      { text: { a: 1 } }, { text: { $gt: "" } }, { text: ["x", "y"] }, { text: 12345 }, { text: true },
      { text: "t".repeat(2001) }, { text: "t".repeat(100000) },
      { text: "", fileUrl: "uploads/a.pdf", fileName: { a: 1 }, fileType: "application/pdf" },
      { text: "", fileUrl: "uploads/a.pdf", fileName: "a.pdf", fileType: ["z"] },
      { text: "", fileUrl: "uploads/a.pdf", fileName: "f".repeat(201), fileType: "application/pdf" },
      { text: "", fileUrl: "uploads/a.pdf", fileName: "a.pdf", fileType: "f".repeat(201) },
      { text: "", fileUrl: { a: 1 } }, { text: "x", senderId: { a: 1 } },
    ];
    for (const extra of bad) assert.equal(await send(extra), 0, `rejected: ${JSON.stringify(extra).slice(0, 70)}`);
    assert.equal(await send({}), 1, "a normal message still goes through");
    assert.equal(await send({ text: "t".repeat(2000) }), 1, "exactly 2000 characters is fine");
    assert.equal(await send({ text: "", fileUrl: "uploads/a.pdf", fileName: "a.pdf", fileType: "application/pdf" }), 1, "a normal file message still goes through");
    assert.equal(got.at(-1).fileName, "a.pdf");
    assert.equal(p.connected, true, "the sender is not disconnected");
    d.close(); p.close(); await sleep(300);
  });

  test("the sender name is the signed-in person's own name, never what the browser sends (and unchanged for real users)", async () => {
    const d = await join("doctor", ids.appointmentId);
    const p = await join("patient", ids.appointmentId);
    const atDoctor = []; const atPatient = [];
    d.on("appointment-message", (m) => atDoctor.push(m));
    p.on("appointment-message", (m) => atPatient.push(m));
    // exactly what the real call page sends: the user's own name
    p.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.patientId, senderName: "Signal Patient", text: "from patient" });
    d.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.doctorId, senderName: "Signal Doctor", text: "from doctor" });
    await sleep(900);
    assert.equal(atDoctor.find((m) => m.text === "from patient").senderName, "Signal Patient");
    assert.equal(atPatient.find((m) => m.text === "from doctor").senderName, "Signal Doctor");
    // a browser that lies about its name or id
    p.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.doctorId, senderName: "Dr. Admin (Verified)", text: "spoof 1" });
    p.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.patientId, senderName: { a: 1 }, text: "spoof 2" });
    p.emit("appointment-message", { appointmentId: ids.appointmentId, senderId: ids.patientId, text: "no name at all" });
    await sleep(1100);
    for (const text of ["spoof 1", "spoof 2", "no name at all"]) {
      const m = atDoctor.find((x) => x.text === text);
      assert.ok(m, text);
      assert.equal(m.senderName, "Signal Patient", `${text}: name comes from the server`);
      assert.equal(m.senderId, ids.patientId, "and so does the id");
    }
    // the stored history shows the same name
    const p2 = await join("patient", ids.appointmentId);
    const hist = events(p2, "appointment-chat-history").at(-1).args[0].messages;
    assert.ok(hist.length >= 3 && hist.filter((m) => m.senderRole === "user").every((m) => m.senderName === "Signal Patient"));
    d.close(); p.close(); p2.close(); await sleep(300);
  });

  test("direct (link) rooms: an object, array or $-operator as roomId is refused", async () => {
    const s = await stack.connect({});
    for (const ev of ["verify-direct-pin", "join-direct-room", "direct-session-takeover", "direct-video-offer", "leave-direct-room", "direct-room-message", "direct-call-stats"]) {
      for (const bad of [{ $ne: null }, ["abcdef123456"], 123456]) s.emit(ev, { roomId: bad, pin: "123456", guestId: "g1", name: "n", text: "t", offer: {} });
    }
    s.emit("join-direct-room", { roomId: "ab12".repeat(12), guestId: { a: 1 }, name: "n" });
    s.emit("verify-direct-pin", { roomId: "ab12".repeat(12), pin: 123456, guestId: "g" });
    await sleep(900);
    assert.equal(events(s, "signaling-error").length >= 1, true, "refused with the usual invalid_payload answer");
    assert.equal(events(s, "signaling-error").every((e) => e.args[0].code === "invalid_payload"), true);
    assert.equal(await stack.alive(), true);
    s.close();
  });

  test("HTTP: an operator object where a value is expected is refused with 400; a normal login still works", async () => {
    const post = (path, body) => fetch(stack.baseUrl + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    for (const path of ["/api/auth/login", "/api/doctor/login"]) {
      const res = await post(path, { email: { $gt: "" }, password: { $gt: "" } });
      assert.equal(res.status, 400, path);
      assert.deepEqual(await res.json(), { msg: "Invalid request." });
    }
    const ok = await post("/api/auth/login", stack.creds.patient);
    assert.equal(ok.status, 200, "a normal login is unchanged");
    const auth = { Authorization: "Bearer " + tokens.patient.accessToken, "Content-Type": "application/json" };
    const bad = await fetch(stack.baseUrl + "/api/speech-token?appointmentId=" + ids.appointmentId + "&appointmentId=" + victimAppointmentId, { headers: auth });
    assert.equal(bad.status, 400, "a repeated id parameter arrives as an array and is refused");
    const warn = stack.logs();
    assert.ok(warn.includes("[security] request input rejected"));
    assert.equal(warn.includes("VICTIM-PRIVATE"), false);
  });

  test("log lines for rejected input carry the event, field name and type only; never the value", async () => {
    const s = await stack.connect({ token: tokens.patient.accessToken });
    s.emit("join-appointment-room", { appointmentId: { $gte: "SECRET-MARKER-VALUE" } });
    s.emit("appointment-message", { appointmentId: ids.appointmentId, text: { secret: "SECRET-MARKER-TEXT" } });
    await sleep(600);
    const log = stack.logs();
    assert.ok(log.includes("[security] socket input rejected"));
    assert.equal(log.includes("SECRET-MARKER"), false);
    s.close();
  });
});
