// Unit tests for the shared input validators (utils/inputGuards.js), the HTTP guard (middleware/rejectOperatorInput.js) and the
// per-event socket checks (utils/socketInputGuard.js). Run: node --test tests/inputGuards.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const {
  asObjectIdString, asRoomToken, hasOperatorKey, isIdFieldName, findNonScalarIdField, typeName,
} = require("../utils/inputGuards");
const { rejectOperatorInput } = require("../middleware/rejectOperatorInput");
const { validatePacket, installSocketInputGuard } = require("../utils/socketInputGuard");

const ID = "64b7f0c2a1b2c3d4e5f60718";

test("asObjectIdString: only a 24-hex-character string passes; objects, arrays, operators, numbers and junk give null", () => {
  assert.equal(asObjectIdString(ID), ID);
  assert.equal(asObjectIdString(ID.toUpperCase()), ID.toUpperCase());
  for (const bad of [{ $ne: null }, { $gte: ID }, { $in: [ID] }, [ID], [ID, ID], { toString: 1 }, 12345, null, undefined, true, "", " " + ID, ID + " ", ID.slice(1), ID + "0", "g".repeat(24), "../../etc", "$ne", ID + "\n"]) {
    assert.equal(asObjectIdString(bad), null, JSON.stringify(bad));
  }
});

test("asRoomToken: a plain safe token passes; objects, arrays, long or odd strings do not", () => {
  assert.equal(asRoomToken("a".repeat(48)), "a".repeat(48));
  assert.equal(asRoomToken("room_Id-12"), "room_Id-12");
  for (const bad of [{ $ne: null }, ["abc12345"], 123456, "", "short", "a".repeat(129), "has space123", "a/b/c/d/e", "$ne1234", "x\u0000y12345"]) {
    assert.equal(asRoomToken(bad), null, JSON.stringify(bad));
  }
});

test("hasOperatorKey finds a $-key at any depth, also inside arrays; plain data is fine; hostile depth or size counts as hostile", () => {
  assert.equal(hasOperatorKey({ email: { $gt: "" } }), true);
  assert.equal(hasOperatorKey({ a: [{ b: { $where: "1" } }] }), true);
  assert.equal(hasOperatorKey({ $or: [] }), true);
  assert.equal(hasOperatorKey({ email: "a@b.c", n: 5, list: [1, "x", { y: 2 }], nested: { deep: { er: null } } }), false);
  assert.equal(hasOperatorKey({ "price$": 1, "a.b": 2 }), false, "a $ that is not the first character is not an operator");
  assert.equal(hasOperatorKey(null), false);
  assert.equal(hasOperatorKey("text"), false);
  let deep = { x: 1 }; for (let i = 0; i < 40; i++) deep = { n: deep };
  assert.equal(hasOperatorKey(deep), true, "absurdly deep");
});

test("id-like field names and non-scalar values", () => {
  for (const n of ["id", "_id", "appointmentId", "doctorId", "patientId", "userId", "partner_Id".replace("_", "")]) assert.equal(isIdFieldName(n), true, n);
  for (const n of ["doctorIds", "ids", "idea", "paid", "Id", "email", "valid"]) assert.equal(isIdFieldName(n), false, n);
  assert.deepEqual(findNonScalarIdField({ doctorId: { a: 1 } }), { field: "doctorId", type: "object" });
  assert.deepEqual(findNonScalarIdField({ id: [ID] }), { field: "id", type: "array" });
  assert.equal(findNonScalarIdField({ doctorId: ID, patientId: null, count: { a: 1 }, doctorIds: [ID] }), null);
  assert.equal(findNonScalarIdField("x"), null);
  assert.equal(typeName(null), "null");
  assert.equal(typeName([]), "array");
  assert.equal(typeName({}), "object");
});

// ---- the HTTP guard, on a real express app ----
async function withApp(fn) {
  const app = express();
  app.use(express.json());
  app.use(rejectOperatorInput);
  app.all("/echo", (req, res) => res.json({ ok: true, body: req.body, query: req.query }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a);
  try { await fn(base, warnings); } finally { console.warn = realWarn; await new Promise((r) => server.close(r)); }
}
const post = (base, body, path = "/echo") => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("HTTP guard: normal requests pass unchanged (strings, numbers, lists, nested data, path-style ids)", async () => {
  await withApp(async (base, warnings) => {
    const body = { email: "a@b.co", doctorId: ID, patientId: null, count: 3, doctorIds: [ID, ID], items: [{ name: "x", qty: 2 }], nested: { a: { b: "c" } } };
    const res = await post(base, body);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).body, body);
    const g = await fetch(`${base}/echo?doctorId=${ID}&page=2&status=confirmed`);
    assert.equal(g.status, 200);
    assert.equal(warnings.length, 0, "nothing logged for normal traffic");
  });
});

test("HTTP guard: operator keys in the body are refused with 400 and ONE log line that does not contain the value", async () => {
  await withApp(async (base, warnings) => {
    for (const body of [{ email: { $gt: "" }, password: "x" }, { filter: { a: [{ $where: "sleep(1000)" }] } }, { $or: [{ a: 1 }] }]) {
      const res = await post(base, body);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { msg: "Invalid request." });
    }
    assert.equal(warnings.length, 3);
    const logged = JSON.stringify(warnings);
    assert.ok(logged.includes("[security] request input rejected") && logged.includes("/echo") && logged.includes("operator_key"));
    assert.equal(logged.includes("sleep"), false, "the rejected value is never logged");
    assert.equal(logged.includes("$gt"), false);
  });
});

test("HTTP guard: a query key that starts with $ is refused; bracket keys stay harmless plain strings (Express 5 does not build objects from them)", async () => {
  await withApp(async (base) => {
    for (const q of ["$where=1", "$ne=x&a=1"]) {
      const res = await fetch(`${base}/echo?${q}`);
      assert.equal(res.status, 400, q);
    }
    const harmless = await fetch(`${base}/echo?email[$ne]=x`);
    assert.equal(harmless.status, 200);
    assert.deepEqual((await harmless.json()).query, { "email[$ne]": "x" }, "a flat string key, not an operator object");
  });
});

test("HTTP guard: an object or array where an id is expected is refused with 400 'Invalid id.'", async () => {
  await withApp(async (base, warnings) => {
    for (const body of [{ doctorId: { a: 1 } }, { appointmentId: [ID] }, { id: [ID, ID] }, { _id: { x: 1 } }, { patientId: [] }]) {
      const res = await post(base, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(await res.json(), { msg: "Invalid id." });
    }
    for (const q of ["doctorId=a&doctorId=b", `id=${ID}&id=${ID}`]) { // a repeated key arrives as an array
      const res = await fetch(`${base}/echo?${q}`);
      assert.equal(res.status, 400, q);
    }
    assert.equal(warnings.length, 7);
    assert.equal(JSON.stringify(warnings).includes(ID), false);
  });
});

// ---- the per-event socket checks ----
test("socket: appointment events need a real id string in a plain-object payload", () => {
  const events = ["join-appointment-room", "leave-appointment-room", "video-telemetry", "video-offer", "video-answer", "ice-candidate", "ice-restart-request", "call-connected", "call-stats", "admin-watch-call", "admin-unwatch-call", "camera-state", "lang-changed", "caption", "tr-status", "request-peer-rebuild", "appointment-message"];
  for (const ev of events) {
    assert.equal(validatePacket(ev, { appointmentId: ID, text: "x" }).ok, true, ev + " good");
    for (const bad of [{ $ne: null }, { $gte: ID }, [ID], [ID, ID], 12345, null, undefined, "", "garbage", ID + "x", true]) {
      const v = validatePacket(ev, { appointmentId: bad });
      assert.equal(v.ok, false, `${ev} ${JSON.stringify(bad)}`);
      assert.equal(v.field, "appointmentId");
    }
    for (const bad of [null, undefined, "text", 5, [ID], true]) assert.equal(validatePacket(ev, bad).ok, false, `${ev} payload ${JSON.stringify(bad)}`);
  }
});

test("socket: join / user-online identity fields must be strings; capabilities and clientInfo plain objects", () => {
  const join = (extra) => validatePacket("join-appointment-room", { appointmentId: ID, ...extra });
  assert.equal(join({ userId: ID, role: "doctor", token: "abc.def.ghi", capabilities: { peerRebuild: true }, clientInfo: { platform: "web" } }).ok, true);
  assert.equal(join({}).ok, true);
  assert.equal(join({ userId: null, token: undefined }).ok, true);
  for (const extra of [{ userId: { $ne: 1 } }, { role: ["doctor"] }, { token: { a: 1 } }, { token: "t".repeat(9000) }, { capabilities: [1] }, { clientInfo: "web" }, { role: "r".repeat(33) }]) {
    assert.equal(join(extra).ok, false, JSON.stringify(extra).slice(0, 60));
  }
  assert.equal(validatePacket("user-online", { userId: ID, role: "user", token: "x" }).ok, true);
  assert.equal(validatePacket("user-online", undefined).ok, true);
  for (const bad of [{ userId: { $ne: 1 } }, { role: 5 }, { token: ["a"] }, "x", [1]]) assert.equal(validatePacket("user-online", bad).ok, false, JSON.stringify(bad));
});

test("socket chat: text max 2000, fileName and fileType max 200, every field a string or absent; senderName is not read at all", () => {
  const chat = (extra) => validatePacket("appointment-message", { appointmentId: ID, ...extra });
  assert.equal(chat({ senderId: ID, senderName: "Anyone", text: "hello" }).ok, true);
  assert.equal(chat({ text: "t".repeat(2000) }).ok, true, "exactly 2000 is fine");
  assert.equal(chat({ text: "", fileUrl: "uploads/a.pdf", fileName: "f".repeat(200), fileType: "application/pdf" }).ok, true);
  assert.equal(chat({ text: "t".repeat(2001) }).ok, false);
  assert.equal(chat({ text: "x", fileName: "f".repeat(201) }).ok, false);
  assert.equal(chat({ text: "x", fileType: "f".repeat(201) }).ok, false);
  for (const field of ["text", "fileName", "fileType", "fileUrl", "senderId"]) {
    for (const bad of [{ a: 1 }, { $gt: "" }, ["x"], 12345, true]) {
      const v = chat({ text: "x", [field]: bad });
      assert.equal(v.ok, false, `${field} ${JSON.stringify(bad)}`);
      assert.equal(v.field, field);
    }
  }
  assert.equal(chat({ text: "x", senderName: { a: 1 } }).ok, true, "senderName is ignored by the server, so its shape cannot matter");
  assert.equal(chat({ text: "x", fileName: null, fileType: null }).ok, true);
});

test("socket direct rooms: roomId must be a safe token; text fields strings", () => {
  const events = ["verify-direct-pin", "direct-session-takeover", "join-direct-room", "leave-direct-room", "direct-video-offer", "direct-video-answer", "direct-ice-candidate", "direct-ice-restart-request", "direct-media-state", "direct-call-connected", "admin-watch-direct-room", "admin-unwatch-direct-room", "direct-call-stats", "direct-call-problem", "direct-room-message"];
  const room = "ab12".repeat(12);
  for (const ev of events) {
    assert.equal(validatePacket(ev, { roomId: room }).ok, true, ev);
    for (const bad of [{ $ne: null }, [room], 123456, "", "x", "bad id with spaces", null, undefined]) assert.equal(validatePacket(ev, { roomId: bad }).ok, false, `${ev} ${JSON.stringify(bad)}`);
    assert.equal(validatePacket(ev, null).ok, false);
  }
  assert.equal(validatePacket("verify-direct-pin", { roomId: room, pin: "123456", guestId: "g-1" }).ok, true);
  assert.equal(validatePacket("join-direct-room", { roomId: room, guestId: "g", name: "Guest", sessionToken: "s" }).ok, true);
  for (const extra of [{ pin: 123456 }, { guestId: { a: 1 } }, { name: ["x"] }, { sessionToken: { $ne: 1 } }, { role: 5 }, { guestId: "g".repeat(129) }]) {
    assert.equal(validatePacket("join-direct-room", { roomId: room, ...extra }).ok, false, JSON.stringify(extra));
  }
  assert.equal(validatePacket("direct-room-message", { roomId: room, text: "x".repeat(5000) }).ok, true, "the existing 2000-character cut for direct chat is unchanged");
  assert.equal(validatePacket("direct-room-message", { roomId: room, text: { a: 1 } }).ok, false);
  assert.equal(validatePacket("direct-media-state", { roomId: room, isMicOff: true, isCamOff: false }).ok, true);
});

test("socket: events the guard does not know are passed through untouched", () => {
  for (const ev of ["hc-ping", "disconnect", "something-else"]) assert.equal(validatePacket(ev, { appointmentId: { $ne: 1 } }).ok, true);
});

// ---- the packet middleware itself, with a fake socket ----
function fakeSocket() {
  const s = { id: "sock1", used: null, emitted: [], use(fn) { s.used = fn; }, emit(ev, p) { s.emitted.push([ev, p]); } };
  return s;
}
function run(socket, event, payload) {
  let passed = false;
  socket.used([event, payload], () => { passed = true; });
  return passed;
}

test("socket middleware: a bad join gets the SAME answer the app gives for an invalid id and no handler runs; a good one passes", () => {
  const warnings = [];
  const socket = fakeSocket();
  installSocketInputGuard(socket, { logger: { warn: (...a) => warnings.push(a) } });
  assert.equal(run(socket, "join-appointment-room", { appointmentId: ID }), true);
  assert.equal(run(socket, "join-appointment-room", { appointmentId: { $gte: ID } }), false);
  assert.deepEqual(socket.emitted.at(-1), ["room-access-denied", { msg: "Access to this call room was denied.", reason: "invalid_appointment" }]);
  assert.equal(run(socket, "video-offer", { appointmentId: [ID], offer: {} }), false);
  assert.deepEqual(socket.emitted.at(-1)[0], "signaling-error");
  assert.equal(socket.emitted.at(-1)[1].code, "invalid_payload");
  // chat and user-online are dropped without an answer, exactly as the handlers already did for bad input
  const before = socket.emitted.length;
  assert.equal(run(socket, "appointment-message", { appointmentId: ID, text: { a: 1 } }), false);
  assert.equal(run(socket, "user-online", { token: { a: 1 } }), false);
  assert.equal(socket.emitted.length, before);
  // log lines: event, field name and type only
  const logged = JSON.stringify(warnings);
  assert.ok(logged.includes("[security] socket input rejected"));
  assert.equal(logged.includes(ID), false);
  assert.equal(logged.includes("$gte"), false);
});

test("socket middleware: answers to bad packets are limited to 5 per second per socket", () => {
  let t = 1000;
  const socket = fakeSocket();
  installSocketInputGuard(socket, { logger: { warn() {} }, now: () => t });
  for (let i = 0; i < 20; i++) run(socket, "video-offer", { appointmentId: { $ne: 1 } });
  assert.equal(socket.emitted.length, 5);
  t += 1500;
  run(socket, "video-offer", { appointmentId: { $ne: 1 } });
  assert.equal(socket.emitted.length, 6);
});
