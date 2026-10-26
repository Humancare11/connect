const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const EventEmitter = require("node:events");
const { Server } = require("socket.io");
const { createGracefulShutdown, registerShutdownSignals } = require("../utils/gracefulShutdown");

const quietLogger = () => {
  const lines = { log: [], error: [] };
  return { lines, log: (...a) => lines.log.push(a.join(" ")), error: (...a) => lines.error.push(a.join(" ")) };
};

test("real http + socket.io server: closes once, no ERR_SERVER_NOT_RUNNING, exit 0", async () => {
  const server = http.createServer();
  const io = new Server(server);
  await new Promise((resolve) => server.listen(0, resolve));

  const logger = quietLogger();
  const exits = [];
  let dbCloses = 0;
  const shutdown = createGracefulShutdown({
    io,
    server,
    closeDatabase: async () => { dbCloses += 1; },
    exit: (code) => exits.push(code),
    logger,
  });

  await shutdown("SIGTERM");
  assert.deepEqual(exits, [0]);
  assert.equal(dbCloses, 1);
  assert.equal(server.listening, false);
  assert.deepEqual(logger.lines.error, []);
});

test("a second signal does not run shutdown again", async () => {
  const server = http.createServer();
  const io = new Server(server);
  await new Promise((resolve) => server.listen(0, resolve));

  const exits = [];
  let dbCloses = 0;
  const shutdown = createGracefulShutdown({
    io,
    server,
    closeDatabase: async () => { dbCloses += 1; },
    exit: (code) => exits.push(code),
    logger: quietLogger(),
  });

  await Promise.all([shutdown("SIGINT"), shutdown("SIGTERM"), shutdown("SIGINT")]);
  assert.deepEqual(exits, [0]);
  assert.equal(dbCloses, 1);
});

test("a genuine close error still exits 1", async () => {
  const exits = [];
  const logger = quietLogger();
  const shutdown = createGracefulShutdown({
    io: { close: (cb) => cb(new Error("boom")) },
    server: { listening: false },
    closeDatabase: async () => {},
    exit: (code) => exits.push(code),
    logger,
  });
  await shutdown("SIGTERM");
  assert.deepEqual(exits, [1]);
  assert.equal(logger.lines.error.length, 1);
});

test("signal handlers are registered only once per process", () => {
  const proc = new EventEmitter();
  const calls = [];
  assert.equal(registerShutdownSignals(proc, (s) => calls.push(s)), true);
  assert.equal(registerShutdownSignals(proc, (s) => calls.push(s)), false);
  proc.emit("SIGTERM");
  proc.emit("SIGINT");
  assert.deepEqual(calls, ["SIGTERM", "SIGINT"]);
  assert.equal(proc.listenerCount("SIGTERM"), 1);
  assert.equal(proc.listenerCount("SIGINT"), 1);
});
