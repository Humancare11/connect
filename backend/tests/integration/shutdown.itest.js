// A backend restart must be invisible to a running call: the shutting-down server
// tells nobody that a participant dropped or left. Run with:  npm run test:integration
const test = require("node:test");
const assert = require("node:assert/strict");
const { startStack, sleep } = require("../helpers/signalingStack");

const GRACE_MS = 1500;
const PRESENCE_EVENTS = ["peer-socket-down", "participant-left", "direct-peer-socket-down", "direct-participant-left"];

let stack;

test.before(async () => {
  stack = await startStack({ graceMs: GRACE_MS, controllable: true });
});

test.after(async () => {
  await stack?.stop();
});

test("graceful shutdown announces no drop and no departure, in appointment and direct rooms", async () => {
  const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken });
  const patient = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(doctor, "doctor");
  await stack.joinAppointment(patient, "patient");
  await stack.waitFor(doctor, "peer-joined");
  await stack.waitFor(patient, "peer-joined");

  const host = await stack.connect();
  const guest = await stack.connect();
  host.emit("join-direct-room", { roomId: stack.ids.directRoomId, guestId: "guest-host-aaaa", name: "Host" });
  await stack.waitFor(host, "direct-room-joined");
  guest.emit("join-direct-room", { roomId: stack.ids.directRoomId, guestId: "guest-peer-bbbb", name: "Peer" });
  await stack.waitFor(host, "direct-peer-joined");
  await stack.waitFor(guest, "direct-room-joined");

  const sockets = [doctor, patient, host, guest];
  const exit = await stack.shutdownBackend();
  await sleep(300);

  assert.equal(exit.code, 0, stack.logs().slice(-1500));
  for (const socket of sockets) {
    assert.equal(socket.connected, false, "every client saw the server go away");
    for (const event of PRESENCE_EVENTS) assert.equal(stack.count(socket, event), 0, `${event} was sent during shutdown`);
  }
});
