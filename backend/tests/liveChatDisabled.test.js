const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const { mountLiveChat, seedLiveChatDefaults } = require("../services/liveChat");
const { checkLiveChatConfig, parseLiveChatKey } = require("../utils/liveChat/config");
const { encryptLiveChatText, decryptLiveChatText } = require("../utils/liveChat/crypto");
const { startLiveChatServer, once } = require("./helpers/liveChatServer");

const KEY = "a".repeat(64);

async function withServer(fn) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fn({ app, io, url: `http://127.0.0.1:${server.address().port}` });
  } finally {
    io.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

const validateAccessToken = async () => ({ id: "a1", role: "admin" });

describe("live chat kill switch", () => {
  test("LIVECHAT_ENABLED unset or false: nothing is mounted", async () => {
    for (const env of [{}, { LIVECHAT_ENABLED: "false" }, { LIVECHAT_ENABLED: "" }, { LIVECHAT_ENABLED: "0" }]) {
      await withServer(async ({ app, io, url }) => {
        assert.equal(mountLiveChat({ app, io, env, validateAccessToken }), null);
        assert.equal(io._nsps.has("/livechat"), false);
        assert.equal(io._nsps.has("/livechat-admin"), false);
        const res = await fetch(`${url}/api/admin/livechat/visitors`, { headers: { "x-test-role": "admin" } });
        assert.equal(res.status, 404);
      });
    }
  });

  test("disabled: seeding does not touch the database", async () => {
    // No mongoose connection exists in this test; a DB call would hang/throw, so a clean `false` proves it.
    assert.equal(await seedLiveChatDefaults({ LIVECHAT_ENABLED: "false" }), false);
  });

  test("enabled: the namespaces and the API exist", async () => {
    const lc = await startLiveChatServer();
    try {
      assert.ok(lc.io._nsps.has("/livechat"));
      assert.ok(lc.io._nsps.has("/livechat-admin"));
      const res = await fetch(`${lc.url}/api/admin/livechat/visitors`, { headers: { "x-test-role": "admin" } });
      assert.equal(res.status, 200);
    } finally {
      await lc.close();
    }
  });

  test("enabled: connecting while disabled elsewhere gives a clean error, not a hang", async () => {
    await withServer(async ({ app, io, url }) => {
      mountLiveChat({ app, io, env: {}, validateAccessToken });
      const { io: connectClient } = require("socket.io-client");
      const socket = connectClient(`${url}/livechat`, { reconnection: false, transports: ["websocket"] });
      const err = await once(socket, "connect_error");
      assert.match(err.message, /Invalid namespace/);
      socket.close();
    });
  });
});

describe("LIVECHAT_ENCRYPTION_KEY", () => {
  test("production + enabled without a key: the module refuses to start (and the app keeps running)", async () => {
    const env = { LIVECHAT_ENABLED: "true", NODE_ENV: "production" };
    assert.equal(checkLiveChatConfig(env).ok, false);
    assert.match(checkLiveChatConfig(env).reason, /LIVECHAT_ENCRYPTION_KEY/);

    await withServer(async ({ app, io }) => {
      const errors = [];
      const original = console.error;
      console.error = (...args) => errors.push(args.join(" "));
      try {
        assert.equal(mountLiveChat({ app, io, env, validateAccessToken }), null);
      } finally {
        console.error = original;
      }
      assert.equal(io._nsps.has("/livechat-admin"), false);
      assert.ok(errors.some((line) => line.includes("[livechat]")));
    });
  });

  test("production + enabled with an invalid key is refused too", () => {
    for (const bad of ["short", "z".repeat(64), Buffer.alloc(16).toString("base64")]) {
      const check = checkLiveChatConfig({ LIVECHAT_ENABLED: "true", NODE_ENV: "production", LIVECHAT_ENCRYPTION_KEY: bad });
      assert.equal(check.ok, false, bad);
    }
  });

  test("production + enabled with a valid key is accepted; non-production does not need one", () => {
    assert.equal(checkLiveChatConfig({ LIVECHAT_ENABLED: "true", NODE_ENV: "production", LIVECHAT_ENCRYPTION_KEY: KEY }).ok, true);
    assert.equal(checkLiveChatConfig({ LIVECHAT_ENABLED: "true", NODE_ENV: "development" }).ok, true);
    assert.equal(parseLiveChatKey(Buffer.alloc(32, 7).toString("base64")).length, 32);
  });

  test("live-chat text round-trips and is not stored in the clear", () => {
    const record = encryptLiveChatText("my blood pressure is high");
    assert.ok(record.cipherText && !record.cipherText.includes("blood"));
    assert.equal(decryptLiveChatText(record), "my blood pressure is high");
    assert.equal(decryptLiveChatText(encryptLiveChatText("")), "");
  });

  test("chatCrypto.js is untouched: it does not read LIVECHAT_ENCRYPTION_KEY", () => {
    const source = require("node:fs").readFileSync(require.resolve("../utils/chatCrypto"), "utf8");
    assert.equal(source.includes("LIVECHAT"), false);
  });
});

describe("live chat models and seeded settings", () => {
  const mongoose = require("mongoose");
  const { MongoMemoryServer } = require("mongodb-memory-server");
  let mongod;
  after(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });

  test("all ten models load and settings are seeded once with the agreed defaults", async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const names = ["LcVisitor", "LcConversation", "LcMessage", "LcFile", "LcPageVisit", "LcAgentProfile",
      "LcSettings", "LcAiUsage", "LcBlockedIp", "LcCannedReply"];
    for (const name of names) await require(`../models/${name}`).init();

    assert.equal(await seedLiveChatDefaults({ LIVECHAT_ENABLED: "true", NODE_ENV: "test" }), true);
    assert.equal(await seedLiveChatDefaults({ LIVECHAT_ENABLED: "true", NODE_ENV: "test" }), true); // idempotent

    const LcSettings = require("../models/LcSettings");
    assert.equal(await LcSettings.countDocuments(), 1);
    const settings = await LcSettings.findOne().lean();
    assert.equal(settings.aiMode, "ai_first");
    assert.equal(settings.supportHours.timezone, "America/New_York");
    assert.equal(settings.supportHours.days.length, 7);
    assert.deepEqual(settings.supportHours.days[0], { day: "sunday", enabled: true, open: "08:00", close: "22:00" });
    assert.deepEqual(settings.quickOptions.map((o) => o.label), [
      "Online Consultation with Prescription",
      "Prescription & Prescription refill",
      "Medical Advice/Second Opinion",
      "Sick Notes",
      "Others",
      "Talk to a live agent",
    ]);
    assert.equal(settings.prices.find((p) => p.name === "Fit to fly").price, 69);
    assert.equal(settings.dailySpendCapUsd, 3);
  });

  test("messages are stored encrypted, never as plain text", async () => {
    const LcMessage = require("../models/LcMessage");
    await LcMessage.create({ conversationId: "HCTEST0001", sender: "patient", text: encryptLiveChatText("I have chest pain") });
    const raw = await mongoose.connection.db.collection("lcmessages").findOne({});
    assert.equal(JSON.stringify(raw).includes("chest pain"), false);
    assert.equal(decryptLiveChatText(raw.text), "I have chest pain");
  });
});
