const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { startChatServer, sleep } = require("./helpers/liveChatServer");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");
const { readAiConfig } = require("../utils/liveChat/config");
const { scrubLogText } = require("../services/liveChat/visitorNamespace");
const safety = require("../services/liveChat/safety");

const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 };
const modelReply = (reply, over = {}) => ({
  ok: true, reply, handoff: false, handoffReason: "none", offTopic: false, topic: "other", links: [],
  language: { code: "en", name: "English" }, usage: USAGE, ...over,
});
// Waits (up to 3 s) until the condition holds: the background turn starts a moment after the ack.
const until = async (condition) => {
  for (let i = 0; i < 60 && !condition(); i += 1) await sleep(50);
};
const held = () => {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  return { promise, release };
};

describe("live chat: the AI turn runs in the background and always ends with a reply", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { aiDeadlineMs: 1500 }, // long enough that a busy machine does not trip it in the tests that hold the model back
    });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.livechat.chat.aiBreaker.until = 0;
    lc.livechat.chat.aiBreaker.alerted = false;
  });

  async function openChat() {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home" });
    const typing = [];
    socket.on("chat:typing", (t) => t.from === "ai" && typing.push(t.typing));
    return { socket, id: started.conversation.conversationId, visitorId: contact.visitorId, typing };
  }
  const stored = async (chat) =>
    (await lc.models.LcMessage.find({ conversationId: chat.id }).sort({ createdAt: 1 }).lean()).map((m) => ({ ...m, text: decryptLiveChatText(m.text) }));
  const stateOf = async (chat) => (await lc.call(chat.socket, "chat:resume")).conversation;

  test("chat:message is acknowledged right after the save, while the AI turn is still running; the patient's message comes first", async () => {
    const gate = held();
    lc.ai.queue.push(() => gate.promise.then(() => modelReply("A general consultation is $49.")));
    const chat = await openChat();
    const seen = [];
    chat.socket.on("chat:message", (m) => seen.push(`${m.message.sender}:${m.message.text}`));

    const ack = await lc.raw(chat.socket, "chat:message", { text: "How much is a consultation?" });
    assert.deepEqual(ack, { ok: true }, "the ack carries no AI data");
    await until(() => lc.ai.calls.length === 1);
    assert.equal(lc.ai.calls.length, 1, "the AI turn is running");
    assert.deepEqual(seen, ["patient:How much is a consultation?"], "no AI reply yet, the patient's message is already shown");

    gate.release();
    await lc.livechat.chat.whenAiIdle();
    await sleep(100); // the socket event reaches this test client a moment after the server finished
    assert.deepEqual(seen, ["patient:How much is a consultation?", "ai:A general consultation is $49."]);
    assert.deepEqual(chat.typing, [true, false]);
    chat.socket.close();
  });

  test("one AI turn per chat: 3 quick messages make at most 2 model calls, replies in order, none twice", async () => {
    const gate = held();
    lc.ai.queue.push(() => gate.promise.then(() => modelReply("REPLY-ONE")));
    lc.ai.queue.push(modelReply("REPLY-TWO"));
    const chat = await openChat();

    await lc.raw(chat.socket, "chat:message", { text: "first question" });
    await lc.raw(chat.socket, "chat:message", { text: "second question" });
    await lc.raw(chat.socket, "chat:message", { text: "third question" });
    await until(() => lc.ai.calls.length === 1);
    await sleep(100);
    assert.equal(lc.ai.calls.length, 1, "no second turn while the first one runs");

    gate.release();
    await lc.livechat.chat.whenAiIdle();
    assert.equal(lc.ai.calls.length, 2, "exactly one more turn for the messages that arrived meanwhile");
    const secondHistory = lc.ai.calls[1].history.filter((m) => m.role === "patient").map((m) => m.text);
    assert.deepEqual(secondHistory.slice(-3), ["first question", "second question", "third question"], "the second turn sees all of them");

    const rows = (await stored(chat)).filter((m) => ["patient", "ai"].includes(m.sender)).map((m) => `${m.sender}:${m.text}`);
    const replies = rows.filter((r) => r.startsWith("ai:REPLY"));
    assert.deepEqual(replies, ["ai:REPLY-ONE", "ai:REPLY-TWO"], "each reply once, in order");
    const lastPatient = rows.lastIndexOf("patient:third question");
    assert.ok(rows.indexOf("ai:REPLY-TWO") > lastPatient, "the second reply follows the messages it answers");
    assert.ok(rows.indexOf("ai:REPLY-ONE") > rows.indexOf("patient:first question"));
    chat.socket.close();
  });

  test("a single message still makes exactly one model call", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "hello" });
    assert.equal(lc.ai.calls.length, 1);
    chat.socket.close();
  });

  describe("every failure path ends with typing off and a message, never nothing", () => {
    const expectFallback = async (chat, { breaker = true } = {}) => {
      const state = await stateOf(chat);
      if (breaker) assert.equal(state.aiUnavailable, true);
      assert.equal(state.mode, "queue");
      assert.ok(state.messages.some((m) => m.sender === "system" || m.sender === "ai"));
      assert.equal(chat.typing.at(-1), false, "typing indicator off");
    };

    test("the model call throws", async () => {
      lc.ai.queue.push(() => {
        throw new Error("boom");
      });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello there" });
      await expectFallback(chat);
      chat.socket.close();
    });

    test("the model hangs: the server deadline sends the fallback", async () => {
      lc.ai.queue.push(() => new Promise(() => {})); // never answers
      const chat = await openChat();
      const started = Date.now();
      await lc.call(chat.socket, "chat:message", { text: "hello there" });
      assert.ok(Date.now() - started < 3000);
      await expectFallback(chat);
      chat.socket.close();
    });

    test("the model reports a timeout or an error kind", async () => {
      for (const kind of ["timeout", "api_error"]) {
        lc.livechat.chat.aiBreaker.until = 0;
        lc.livechat.chat.aiBreaker.alerted = false;
        lc.ai.queue.push({ ok: false, kind });
        const chat = await openChat();
        await lc.call(chat.socket, "chat:message", { text: "hello there" });
        await expectFallback(chat);
        chat.socket.close();
      }
    });

    test("a failure while saving the reply still ends with the fallback and typing off", async () => {
      lc.ai.queue.push(modelReply("Fine, thanks."));
      const chat = await openChat();
      // make the database step that saves the reply's counters fail once
      const LcConversation = lc.models.LcConversation;
      const realUpdate = LcConversation.updateOne.bind(LcConversation);
      let failed = false;
      LcConversation.updateOne = (filter, update, ...rest) => {
        if (!failed && update?.$inc && "aiReplyCount" in update.$inc) {
          failed = true;
          return Promise.reject(new Error("db down"));
        }
        return realUpdate(filter, update, ...rest);
      };
      try {
        await lc.call(chat.socket, "chat:message", { text: "hello there" });
      } finally {
        LcConversation.updateOne = realUpdate;
      }
      assert.ok(failed);
      await expectFallback(chat, { breaker: false }); // a one-off failure does not open the outage breaker
      chat.socket.close();
    });

    test("a reply blocked by the safety filter is replaced by the fixed text", async () => {
      lc.ai.queue.push(modelReply("You may have a migraine. Rest in a dark room."));
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "I get bad headaches" });
      const ai = (await stored(chat)).filter((m) => m.sender === "ai").at(-1);
      assert.equal(ai.text, safety.FIXED_TEXT.fallback.en);
      assert.equal(chat.typing.at(-1), false);
      chat.socket.close();
    });

    test("an answer that stays too long is replaced by the fixed safe reply", async () => {
      lc.ai.queue.push({ ok: false, kind: "too_long", usage: USAGE });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "tell me everything" });
      const ai = (await stored(chat)).filter((m) => m.sender === "ai").at(-1);
      assert.equal(ai.text, safety.FIXED_TEXT.fallback.en);
      assert.equal(chat.typing.at(-1), false);
      chat.socket.close();
    });

    test("aiDone never rejects, even when the turn and its fallback both fail", async () => {
      lc.ai.queue.push(() => {
        throw new Error("boom");
      });
      const chat = await openChat();
      const LcConversation = lc.models.LcConversation;
      const realFindById = LcConversation.findById;
      const sent = await lc.livechat.chat.sendMessage(chat.visitorId, "hello there");
      LcConversation.findById = () => {
        throw new Error("db down");
      };
      try {
        assert.equal(sent.ok, true);
        assert.equal(await sent.aiDone, undefined);
      } finally {
        LcConversation.findById = realFindById;
      }
      chat.socket.close();
    });
  });

  describe("logs", () => {
    test("AI unavailable names the failed condition", () => {
      assert.deepEqual(readAiConfig({}).missing, ["missing_api_key", "missing_model", "missing_prices"]);
      assert.deepEqual(readAiConfig({ LIVECHAT_MODEL: "m", LIVECHAT_OPENAI_API_KEY: "k", LIVECHAT_PRICE_INPUT_PER_1M: "1" }).missing, ["missing_prices"]);
      assert.deepEqual(readAiConfig({ LIVECHAT_MODEL: "m", LIVECHAT_OPENAI_API_KEY: "k", LIVECHAT_PRICE_INPUT_PER_1M: "1", LIVECHAT_PRICE_OUTPUT_PER_1M: "2" }).missing, []);
    });

    test("the breaker warning includes the reason", async () => {
      const warnings = [];
      const realWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));
      try {
        lc.ai.queue.push({ ok: false, kind: "not_configured", reason: "missing_api_key" });
        const chat = await openChat();
        await lc.call(chat.socket, "chat:message", { text: "hello there" });
        chat.socket.close();
      } finally {
        console.warn = realWarn;
      }
      assert.ok(warnings.some((w) => w.includes("AI unavailable (not_configured: missing_api_key)")), warnings.join("|"));
    });

    test("chat event failed logs event, name, code and a short scrubbed message", async () => {
      const errors = [];
      const realError = console.error;
      console.error = (...args) => errors.push(args.join(" "));
      const chat = await openChat();
      const realFind = lc.models.LcVisitor.findOne;
      lc.models.LcVisitor.findOne = () => {
        const err = new Error("cannot reach db for emma@example.com, call +1 302 303 9993");
        err.name = "MongoNetworkError";
        err.code = "ECONNRESET";
        throw err;
      };
      let res;
      try {
        res = await lc.call(chat.socket, "chat:resume");
      } finally {
        lc.models.LcVisitor.findOne = realFind;
        console.error = realError;
      }
      assert.deepEqual(res, { ok: false, error: "server_error" });
      const line = errors.find((e) => e.includes("chat event failed"));
      assert.ok(line, errors.join("|"));
      assert.match(line, /event=chat:resume name=MongoNetworkError code=ECONNRESET msg=/);
      assert.equal(/emma@example\.com|302 303 9993/.test(line), false);
      chat.socket.close();
    });

    test("scrubLogText masks emails, numbers and token-like runs and cuts to length", () => {
      assert.equal(scrubLogText("mail a@b.co now", 100), "mail [email] now");
      assert.equal(scrubLogText("call +1 (302) 303-9993 ok", 100), "call [number] ok");
      assert.equal(scrubLogText("key sk_abcdefghijklmnopqrstuvwxyz0123", 100), "key [token]");
      assert.equal(scrubLogText("x".repeat(500).replace(/x/g, "ab "), 10).length, 10);
      assert.equal(scrubLogText(undefined, 10), "");
    });
  });

  describe("mongoose debug", () => {
    const debugFlag = (env) =>
      execFileSync(process.execPath, ["-e", "require('./config/db'); process.stdout.write(String(require('mongoose').get('debug')))"], {
        cwd: require("node:path").join(__dirname, ".."),
        env: { PATH: process.env.PATH, ...env },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    test("off by default, on only with MONGOOSE_DEBUG=true, never in production", () => {
      assert.equal(debugFlag({}), "false");
      assert.equal(debugFlag({ NODE_ENV: "development" }), "false");
      assert.equal(debugFlag({ MONGOOSE_DEBUG: "true" }), "true");
      assert.equal(debugFlag({ MONGOOSE_DEBUG: "true", NODE_ENV: "production" }), "false");
      assert.equal(debugFlag({ NODE_ENV: "production" }), "false");
    });
  });
});
