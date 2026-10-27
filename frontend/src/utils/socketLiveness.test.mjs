import test from "node:test";
import assert from "node:assert/strict";
import { probeSocketAlive, ensureSocketAlive } from "./socketLiveness.js";

// Fake socket.io client: timeout(ms).emit(event, data, cb) calls cb(err?) per `mode`.
function fakeSocket({ connected = true, mode = "ack" } = {}) {
  const calls = [];
  const socket = {
    connected,
    calls,
    timeout() {
      return {
        emit(event, data, cb) {
          calls.push(event);
          if (mode === "ack") cb(null, { ok: true });
          else if (mode === "timeout") cb(new Error("operation has timed out"));
          else if (mode === "throw") throw new Error("boom");
          // mode "silent": never calls back
        },
      };
    },
    connect() { calls.push("connect"); this.connected = true; },
    disconnect() { calls.push("disconnect"); this.connected = false; },
  };
  return socket;
}

test("alive when the server acks", async () => {
  assert.equal(await probeSocketAlive(fakeSocket({ mode: "ack" })), true);
});

test("dead on ack timeout, on emit throwing, and when not connected", async () => {
  assert.equal(await probeSocketAlive(fakeSocket({ mode: "timeout" })), false);
  assert.equal(await probeSocketAlive(fakeSocket({ mode: "throw" })), false);
  assert.equal(await probeSocketAlive(fakeSocket({ connected: false })), false);
  assert.equal(await probeSocketAlive(null), false);
});

test("ensureSocketAlive leaves a healthy socket alone", async () => {
  const s = fakeSocket({ mode: "ack" });
  assert.equal(await ensureSocketAlive(s), true);
  assert.deepEqual(s.calls, ["hc-ping"]);
});

test("ensureSocketAlive reconnects a zombie socket (and calls onDead first)", async () => {
  const s = fakeSocket({ mode: "timeout" });
  let dead = 0;
  assert.equal(await ensureSocketAlive(s, { onDead: () => dead++ }), false);
  assert.equal(dead, 1);
  assert.deepEqual(s.calls, ["hc-ping", "disconnect", "connect"]);
});

test("ensureSocketAlive just connects when disconnected", async () => {
  const s = fakeSocket({ connected: false });
  assert.equal(await ensureSocketAlive(s), false);
  assert.deepEqual(s.calls, ["connect"]);
});
