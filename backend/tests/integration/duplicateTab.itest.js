// PIN guest rooms: a second tab with the same session takes the seat, and the
// first one is told and cannot take it back. Run with:  npm run test:integration
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startStack, sleep } = require("../helpers/signalingStack");

let stack;

test.before(async () => {
  stack = await startStack();
});

test.after(async () => {
  await stack?.stop();
});

// A fresh PIN room with the patient's session token (shared by every tab of one browser).
async function pinRoom() {
  const { encryptPin } = require("../../utils/directPinCrypto");
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
  s.emit("verify-direct-pin", { roomId, pin: "222222", guestId: "guest-same-browser" });
  const { sessionToken } = await stack.waitFor(s, "direct-pin-ok");
  s.close();

  // Opens a socket and joins; tabId is omitted entirely for an older web build.
  const join = async (tabId) => {
    const socket = await stack.connect();
    socket.emit("join-direct-room", { roomId, guestId: "guest-same-browser", sessionToken, ...(tabId ? { tabId } : {}) });
    return socket;
  };
  return { join };
}

test("the evicted tab is told, and its automatic rejoin does not take the seat back", async () => {
  const { join } = await pinRoom();
  const first = await join("tab-first-0001");
  await stack.waitFor(first, "direct-room-joined");
  const second = await join("tab-second-002");
  await stack.waitFor(second, "direct-room-joined");
  await stack.waitFor(first, "direct-duplicate-session", { timeout: 2000 });

  const rejoin = await join("tab-first-0001");
  await stack.waitFor(rejoin, "direct-duplicate-session", { timeout: 2000 });
  assert.equal(stack.count(rejoin, "direct-room-joined"), 0);
  assert.equal(stack.count(second, "direct-duplicate-session"), 0, "the newer tab keeps the call");
});

test("a tab that was offline when it was replaced cannot take the seat back", async () => {
  const { join } = await pinRoom();
  const first = await join("tab-first-0001");
  await stack.waitFor(first, "direct-room-joined");
  first.close();
  await sleep(150);
  const second = await join("tab-second-002");
  await stack.waitFor(second, "direct-room-joined");

  const back = await join("tab-first-0001");
  await stack.waitFor(back, "direct-duplicate-session", { timeout: 2000 });
  assert.equal(stack.count(second, "direct-duplicate-session"), 0);
});

test("the same tab reconnecting on a new socket just rejoins", async () => {
  const { join } = await pinRoom();
  const before = await join("tab-only-00001");
  await stack.waitFor(before, "direct-room-joined");
  const after = await join("tab-only-00001");
  await stack.waitFor(after, "direct-room-joined");
  assert.equal(stack.count(after, "direct-duplicate-session"), 0);
});

test("a client that sends no tabId still joins, and the socket it replaces is told", async () => {
  const { join } = await pinRoom();
  const first = await join();
  await stack.waitFor(first, "direct-room-joined");
  const second = await join();
  await stack.waitFor(second, "direct-room-joined");
  await stack.waitFor(first, "direct-duplicate-session", { timeout: 2000 });
});
