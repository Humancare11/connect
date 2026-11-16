const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const { emailTimingMiddleware, timingState } = require("../services/email/timingLog");

describe("email timing log (UAT only)", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  async function hit(env) {
    const lines = [];
    const app = express();
    app.use(emailTimingMiddleware({ env, logger: (l) => lines.push(l) }));
    app.get("/messages/:id", async (req, res) => {
      await Promise.all([Mailbox.find({}).lean(), Mailbox.countDocuments({})]);
      await Mailbox.aggregate([{ $match: {} }]);
      res.json({ ok: true });
    });
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const res = await fetch(`http://127.0.0.1:${server.address().port}/messages/64b0f0f0f0f0f0f0f0f0f0f0?q=secret@x.com`);
    await new Promise((r) => server.close(r));
    return { status: res.status, lines };
  }

  test("on: one line per request with the route pattern, status, total and DB numbers - nothing else", async () => {
    const { status, lines } = await hit({ EMAIL_TIMING_LOG: "true" });
    assert.equal(status, 200);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[email-timing\] GET \/messages\/:id 200 total=\d+ms dbCalls=3 dbMs=\d+$/);
    assert.ok(!/64b0f0f0|secret|@/.test(lines[0]), "no real id, query or address");
  });

  test("off by default", async () => {
    assert.deepEqual(timingState({}), { on: false, reason: "flag_off" });
    assert.equal((await hit({})).lines.length, 0);
  });

  test("refused when NODE_ENV=production, whatever else is set", async () => {
    const env = { EMAIL_TIMING_LOG: "true", NODE_ENV: "production" };
    assert.deepEqual(timingState(env), { on: false, reason: "production" });
    assert.equal((await hit(env)).lines.length, 0);
  });
});
