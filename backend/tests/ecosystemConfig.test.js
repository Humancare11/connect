const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ecosystem = require("../ecosystem.config.js");

const BACKEND_DIR = path.resolve(__dirname, "..");

test("PM2 runs server.js directly in production, one forked instance", () => {
  assert.equal(ecosystem.apps.length, 1);
  const [app] = ecosystem.apps;
  assert.equal(app.name, "humancareconnect-backend");
  assert.equal(app.script, "server.js");
  assert.equal(path.resolve(app.cwd), BACKEND_DIR);
  assert.equal(app.exec_mode, "fork");
  assert.equal(app.instances, 1);
  assert.equal(app.autorestart, true);
  assert.deepEqual(app.env, { NODE_ENV: "production" }, "no other values or secrets belong in this file");
});

test("PM2 waits longer than the graceful shutdown's own forced-exit timeout", () => {
  const source = fs.readFileSync(path.join(BACKEND_DIR, "utils/gracefulShutdown.js"), "utf8");
  const forcedExitMs = Number(source.match(/timeoutMs = (\d+)/)[1]);
  assert.ok(ecosystem.apps[0].kill_timeout >= 12000);
  assert.ok(ecosystem.apps[0].kill_timeout > forcedExitMs);
});
