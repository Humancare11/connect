const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const { installSocketErrorGuard } = require("../utils/socketErrorGuard");

function fakeSocket() {
  const socket = new EventEmitter();
  socket.emitted = [];
  const realEmit = socket.emit.bind(socket);
  socket.emit = (event, ...args) => {
    if (event === "signaling-error") {
      socket.emitted.push([event, ...args]);
      return true;
    }
    return realEmit(event, ...args);
  };
  return socket;
}
const quiet = { error() {} };

test("a synchronous throw (null payload destructuring) is contained and reported", () => {
  const socket = fakeSocket();
  installSocketErrorGuard(socket, { logger: quiet });
  socket.on("video-offer", ({ appointmentId }) => appointmentId);
  assert.doesNotThrow(() => socket.listeners("video-offer")[0](null));
  assert.equal(socket.emitted.length, 1);
  assert.equal(socket.emitted[0][1].code, "server_error");
  assert.equal(socket.emitted[0][1].event, "video-offer");
});

test("an async rejection is contained and reported", async () => {
  const socket = fakeSocket();
  installSocketErrorGuard(socket, { logger: quiet });
  socket.on("direct-pin", async () => {
    throw new Error("db down");
  });
  await socket.listeners("direct-pin")[0]();
  assert.equal(socket.emitted.length, 1);
});

test("healthy handlers run normally with their arguments and return value", () => {
  const socket = fakeSocket();
  installSocketErrorGuard(socket, { logger: quiet });
  const seen = [];
  socket.on("ok", (a, b) => {
    seen.push([a, b]);
    return 42;
  });
  assert.equal(socket.listeners("ok")[0](1, 2), 42);
  assert.deepEqual(seen, [[1, 2]]);
  assert.equal(socket.emitted.length, 0);
});

test("emitting the error to a closed socket does not throw", () => {
  const socket = fakeSocket();
  installSocketErrorGuard(socket, { logger: quiet });
  socket.emit = () => {
    throw new Error("closed");
  };
  socket.on("x", () => {
    throw new Error("boom");
  });
  assert.doesNotThrow(() => socket.listeners("x")[0]());
});
