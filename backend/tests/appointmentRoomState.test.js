const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");
const {
  appointmentRoomName,
  appointmentIdOfRoom,
  appointmentRoomsOf,
  withAppointmentId,
  rebuildAfterRecovery,
  leaveAppointmentRoom,
  leaveOtherAppointmentRooms,
} = require("../utils/appointmentRoomState");

// ── Pure helpers ────────────────────────────────────────────────────────────

test("room names round-trip, and only appointment_* rooms count", () => {
  assert.equal(appointmentRoomName("abc"), "appointment_abc");
  assert.equal(appointmentIdOfRoom("appointment_abc"), "abc");
  for (const other of ["abc", "direct_abc", "patient_1", "", null, undefined]) assert.equal(appointmentIdOfRoom(other), "");
  assert.deepEqual(appointmentRoomsOf({ rooms: new Set(["sock1", "patient_1", "appointment_A", "appointment_B"]) }), ["A", "B"]);
});

test("withAppointmentId only adds: existing fields are kept, and an existing appointmentId is not overwritten", () => {
  assert.deepEqual(withAppointmentId("A"), { appointmentId: "A" });
  assert.deepEqual(withAppointmentId(7, { isCamOff: true }), { appointmentId: "7", isCamOff: true });
  assert.deepEqual(withAppointmentId("A", { appointmentId: "keep" }), { appointmentId: "keep" });
});

// ── A real Socket.IO server with the same wiring server.js uses ─────────────

// The relevant slice of server.js: the "disconnect" handler clears socketRooms (as the real one does), a recovered
// connection is rebuilt, join leaves other appointment rooms first, leave and relayed events are gated on socketRooms.
function startServer() {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { connectionStateRecovery: { maxDisconnectionDuration: 10000, skipMiddlewares: true } });
  const socketRooms = new Map();
  const roomActivated = new Map();
  const state = { socketRooms, roomActivated };
  const seen = { recovered: [] };

  const inRoom = (socket, id) =>
    String(socketRooms.get(socket.id) || "") === String(id) && socket.rooms.has(appointmentRoomName(id));

  io.on("connection", (socket) => {
    seen.recovered.push(socket.recovered);
    if (socket.recovered) rebuildAfterRecovery(socket, state);
    socket.emit("hello"); // gives the client an offset to recover from

    socket.on("join-appointment-room", ({ appointmentId }) => {
      const room = appointmentRoomName(appointmentId);
      leaveOtherAppointmentRooms(socket, appointmentId, state);
      if (!socket.rooms.has(room)) socket.join(room);
      socketRooms.set(socket.id, appointmentId);
      socket.to(room).emit("peer-joined", { appointmentId: String(appointmentId), resumedCall: false });
    });
    socket.on("leave-appointment-room", ({ appointmentId }) => {
      if (!inRoom(socket, appointmentId)) return;
      leaveAppointmentRoom(socket, appointmentId, state);
    });
    socket.on("video-offer", ({ appointmentId, offer }) => {
      if (!inRoom(socket, appointmentId)) return;
      socket.to(appointmentRoomName(appointmentId)).emit("video-offer", { appointmentId: String(appointmentId), offer });
    });
    socket.on("disconnect", () => socketRooms.delete(socket.id));
  });

  return new Promise((resolve) =>
    httpServer.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${httpServer.address().port}`;
      resolve({
        io, state, seen, url,
        close: () => new Promise((r) => { io.close(); httpServer.close(() => r()); }),
      });
    })
  );
}

const client = (url) => connect(url, { reconnectionDelay: 30, reconnectionDelayMax: 60, transports: ["websocket"] });
const connected = (c) => new Promise((resolve) => (c.connected ? resolve() : c.once("connect", resolve)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const record = (c, ...events) => {
  const log = [];
  for (const e of events) c.on(e, (payload) => log.push({ e, payload }));
  return log;
};
// Drops the connection under the client; it reconnects by itself and Socket.IO recovers its session.
const dropAndRecover = async (c) => {
  const before = c.id;
  await new Promise((resolve) => {
    c.once("disconnect", resolve);
    c.io.engine.close();
  });
  await connected(c);
  assert.equal(c.id, before, "a recovered socket keeps its id");
};
const serverSocket = (srv, c) => srv.io.sockets.sockets.get(c.id);
const join = async (c, id) => {
  c.emit("join-appointment-room", { appointmentId: id });
  await sleep(60);
};

test("recovery: the room bookkeeping is rebuilt on its own, so leave-appointment-room works without re-joining", async () => {
  const srv = await startServer();
  const a = client(srv.url);
  const b = client(srv.url);
  try {
    await Promise.all([connected(a), connected(b)]);
    await join(a, "X");
    await join(b, "X");
    await sleep(60);
    const bLog = record(b, "participant-left");

    await dropAndRecover(a);
    assert.equal(srv.seen.recovered.at(-1), true, "this really was a state-recovered connection");
    assert.equal(srv.state.socketRooms.get(a.id), "X", "socketRooms was rebuilt from the restored rooms");
    assert.ok(serverSocket(srv, a).rooms.has("appointment_X"));

    a.emit("leave-appointment-room", { appointmentId: "X" });
    await sleep(100);
    assert.deepEqual(bLog, [{ e: "participant-left", payload: { appointmentId: "X" } }], "the peer is told, and which call it was");
    assert.equal(serverSocket(srv, a).rooms.has("appointment_X"), false, "the socket really left the room");
    assert.equal(srv.state.socketRooms.has(a.id), false);
  } finally {
    a.close(); b.close();
    await srv.close();
  }
});

test("recovery without the fix would have ignored the leave: the control (no rebuild) keeps the socket in the old room", async () => {
  // Same flow, but with the bookkeeping left cleared, which is what happened before. Shows the test above is meaningful.
  const srv = await startServer();
  const a = client(srv.url);
  try {
    await connected(a);
    await join(a, "X");
    await dropAndRecover(a);
    srv.state.socketRooms.delete(a.id); // undo the rebuild
    a.emit("leave-appointment-room", { appointmentId: "X" });
    await sleep(100);
    assert.ok(serverSocket(srv, a).rooms.has("appointment_X"), "the leave was ignored: still in the old room");
  } finally {
    a.close();
    await srv.close();
  }
});

test("call A ends after a recovered reconnect, call B starts on the same socket: a late participant-left from A never reaches B", async () => {
  const srv = await startServer();
  const a = client(srv.url); // the participant who moves from call A to call B
  const peerA = client(srv.url);
  const peerB = client(srv.url);
  try {
    await Promise.all([connected(a), connected(peerA), connected(peerB)]);
    await join(a, "A");
    await join(peerA, "A");
    await join(peerB, "B");
    await dropAndRecover(a); // a's connection drops and is recovered while still in call A
    await sleep(60);

    const aLog = record(a, "participant-left", "peer-joined", "video-offer");
    const peerALog = record(peerA, "participant-left", "peer-joined", "video-offer");
    const peerBLog = record(peerB, "participant-left", "peer-joined", "video-offer");

    await join(a, "B"); // call B starts on the same socket, without an explicit leave from A
    assert.deepEqual(appointmentRoomsOf(serverSocket(srv, a)), ["B"], "it is in call B's room only");
    assert.equal(srv.state.socketRooms.get(a.id), "B");
    assert.deepEqual(peerALog.filter((x) => x.e === "participant-left"), [{ e: "participant-left", payload: { appointmentId: "A" } }], "call A's peer was told a left, tagged A");

    // The late participant-left for call A (what the old grace timer sent into the room by name).
    srv.io.to("appointment_A").emit("participant-left", withAppointmentId("A"));
    await sleep(100);
    assert.deepEqual(aLog.filter((x) => x.e === "participant-left"), [], "the socket in call B gets nothing from call A");
    assert.deepEqual(peerBLog.filter((x) => x.e === "participant-left"), [], "call B's other participant gets nothing from call A");

    // Signaling for call A no longer works from this socket, signaling for call B does.
    a.emit("video-offer", { appointmentId: "A", offer: "from-a-to-A" });
    a.emit("video-offer", { appointmentId: "B", offer: "from-a-to-B" });
    await sleep(100);
    assert.deepEqual(peerALog.filter((x) => x.e === "video-offer"), [], "nothing is relayed into call A");
    assert.deepEqual(peerBLog.filter((x) => x.e === "video-offer").map((x) => x.payload), [{ appointmentId: "B", offer: "from-a-to-B" }]);
    // and call B's own join event reached B's peer, tagged B
    assert.deepEqual(peerBLog.filter((x) => x.e === "peer-joined").map((x) => x.payload.appointmentId), ["B"]);
  } finally {
    a.close(); peerA.close(); peerB.close();
    await srv.close();
  }
});

test("joining the room the socket is already in (a recovered client re-joining) keeps it there and leaves nothing", async () => {
  const srv = await startServer();
  const a = client(srv.url);
  const b = client(srv.url);
  try {
    await Promise.all([connected(a), connected(b)]);
    await join(a, "X");
    await join(b, "X");
    await dropAndRecover(a);
    const bLog = record(b, "participant-left", "peer-joined");
    await join(a, "X");
    assert.deepEqual(appointmentRoomsOf(serverSocket(srv, a)), ["X"]);
    assert.equal(srv.state.socketRooms.get(a.id), "X");
    assert.deepEqual(bLog.filter((x) => x.e === "participant-left"), []);
    assert.deepEqual(bLog.filter((x) => x.e === "peer-joined").map((x) => x.payload.appointmentId), ["X"]);
  } finally {
    a.close(); b.close();
    await srv.close();
  }
});

test("a recovered socket with two appointment rooms (never expected) is cut back to the newest one", async () => {
  const srv = await startServer();
  const a = client(srv.url);
  try {
    await connected(a);
    const s = serverSocket(srv, a);
    s.join("appointment_old");
    s.join("appointment_new");
    rebuildAfterRecovery(s, srv.state);
    assert.deepEqual(appointmentRoomsOf(s), ["new"]);
    assert.equal(srv.state.socketRooms.get(a.id), "new");
  } finally {
    a.close();
    await srv.close();
  }
});

test("a socket in no appointment room is left alone by the rebuild", async () => {
  const srv = await startServer();
  const a = client(srv.url);
  try {
    await connected(a);
    assert.equal(rebuildAfterRecovery(serverSocket(srv, a), srv.state), "");
    assert.equal(srv.state.socketRooms.has(a.id), false);
  } finally {
    a.close();
    await srv.close();
  }
});

test("the last one out clears the room's 'activated' flag", async () => {
  const srv = await startServer();
  const a = client(srv.url);
  try {
    await connected(a);
    await join(a, "X");
    srv.state.roomActivated.set("X", Date.now());
    leaveAppointmentRoom(serverSocket(srv, a), "X", srv.state);
    assert.equal(srv.state.roomActivated.has("X"), false);
  } finally {
    a.close();
    await srv.close();
  }
});

// ── server.js is wired to this, and every call event carries the id ─────────

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8").replace(/\r\n/g, "\n");

test("server.js rebuilds on recovery, leaves other rooms on join, and leaves through the helper", () => {
  assert.match(source, /if \(socket\.recovered\) \{[\s\S]*?rebuildAfterRecovery\(socket, roomState\);/);
  assert.equal((source.match(/leaveOtherAppointmentRooms\(socket, appointmentId, roomState\)/g) || []).length, 2, "the recovered branch and the normal join");
  assert.match(source, /socket\.on\("leave-appointment-room"[\s\S]*?leaveAppointmentRoom\(socket, appointmentId, roomState\);/);
  assert.match(source, /const roomState = \{ socketRooms, roomActivated \};/);
});

test("every appointment call event carries appointmentId (added only: no existing field is gone)", () => {
  const carries = [
    /emit\("video-offer", \{ appointmentId: String\(appointmentId\), offer, offerId: sanitizeOfferId\(offerId\) \}\)/,
    /emit\("video-answer", \{ appointmentId: String\(appointmentId\), answer, offerId: sanitizeOfferId\(offerId\) \}\)/,
    /emit\("ice-candidate", \{ appointmentId: String\(appointmentId\), candidate \}\)/,
    /emit\("ice-restart-request", withAppointmentId\(appointmentId\)\)/,
    /emit\("camera-state", \{ appointmentId: String\(appointmentId\), isCamOff: Boolean\(isCamOff\) \}\)/,
    /emit\("request-peer-rebuild", withAppointmentId\(appointmentId\)\)/,
    /emit\("peer-socket-down", withAppointmentId\(appointmentId\)\)/,
    /emit\("participant-left", withAppointmentId\(appointmentId\)\)/,
  ];
  for (const re of carries) assert.match(source, re, String(re));
  assert.equal((source.match(/emit\("peer-socket-up", withAppointmentId\(appointmentId\)\)/g) || []).length, 2);
  const peerJoined = source.match(/emit\("peer-joined", \{\n\s*appointmentId: String\(appointmentId\),\n\s*resumedCall: wasActivated,/g) || [];
  assert.equal(peerJoined.length, 4, "all four peer-joined emits");
  assert.equal((source.match(/emit\("appointment-access-revoked", \{\n\s*appointmentId: String\(appointmentId\),\n\s*msg:/g) || []).length, 2, "removed from the call / call ended");
  // none of the appointment call events is still sent without it
  for (const bare of ['emit("participant-left")', 'emit("peer-socket-up")', 'emit("peer-socket-down")', 'emit("ice-restart-request")', 'emit("request-peer-rebuild")']) {
    assert.ok(!source.includes(bare), bare);
  }
  // the old fields are still all there
  assert.match(source, /peerCapabilities: socketCapabilities\.get\(socket\.id\)/);
  assert.match(source, /resumedCall: wasActivated/);
});
