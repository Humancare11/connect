const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, scriptedAi, sleep, dayKey } = require("./helpers/liveChatServer");
const { createWindowLimiter, checkMessageText } = require("../services/liveChat/limits");
const { createAiService, buildSystemPrompt, buildMessages, costOf, SCHEMA } = require("../services/liveChat/aiService");
const { createOpenAiProvider, classify } = require("../services/liveChat/aiProviders/openai");
const { verifyTurnstile, VERIFY_URL } = require("../services/liveChat/turnstile");
const { readAiConfig, readTurnstileSecret, TURNSTILE_TEST_SECRET } = require("../utils/liveChat/config");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

const PRICES = { LIVECHAT_PRICE_INPUT_PER_1M: "0.10", LIVECHAT_PRICE_OUTPUT_PER_1M: "0.50", LIVECHAT_PRICE_CACHED_INPUT_PER_1M: "0.01" };
const AI_ENV = { LIVECHAT_MODEL: "gpt-6-luna", LIVECHAT_OPENAI_API_KEY: "test-key", ...PRICES };

describe("abuse limits (live)", () => {
  let lc;
  before(async () => {
    lc = await startChatServer();
    lc.livechat.limits.limits.chatsPerIpPerDay = 1000; // every test chat comes from 127.0.0.1; the real limit has its own test
  });
  after(async () => {
    await lc.close();
  });

  async function openChat(visitorExtra = {}) {
    const contact = await lc.submitContact(visitorExtra);
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, contact, started };
  }

  test("max 6 messages per minute per visitor: the 7th is refused, other visitors are unaffected", async () => {
    const { socket } = await openChat();
    const results = [];
    for (let i = 0; i < 7; i += 1) results.push(await lc.call(socket, "chat:message", { text: `question ${i}` }));
    assert.deepEqual(results.slice(0, 6).map((r) => r.ok), [true, true, true, true, true, true]);
    assert.deepEqual([results[6].ok, results[6].error], [false, "rate_limited"]);

    const other = await openChat();
    assert.equal((await lc.call(other.socket, "chat:message", { text: "hello" })).ok, true);
    socket.close();
    other.socket.close();
  });

  test("quick-option clicks and the header button count towards the per-minute limit too", async () => {
    const { socket } = await openChat();
    for (let i = 0; i < 5; i += 1) await lc.call(socket, "chat:message", { text: `q${i}` });
    assert.equal((await lc.call(socket, "chat:option", { key: "others" })).ok, true); // 6th
    const seventh = await lc.call(socket, "chat:agent");
    assert.deepEqual([seventh.ok, seventh.error], [false, "rate_limited"]);
    socket.close();
  });

  test("max 1,000 characters per message (counted in characters, not bytes)", async () => {
    const { socket } = await openChat();
    assert.equal((await lc.call(socket, "chat:message", { text: "é".repeat(1000) })).ok, true);
    const tooLong = await lc.call(socket, "chat:message", { text: "a".repeat(1001) });
    assert.deepEqual([tooLong.ok, tooLong.error], [false, "message_too_long"]);
    const empty = await lc.call(socket, "chat:message", { text: "   " });
    assert.deepEqual([empty.ok, empty.error], [false, "empty_message"]);
    const notText = await lc.call(socket, "chat:message", { text: { $gt: "" } });
    assert.equal(notText.ok, false);
    socket.close();
  });

  test("an oversized chat packet is dropped before any handler runs", async () => {
    const { socket, started } = await openChat();
    const mine = { conversationId: started.conversation.conversationId, sender: "patient" };
    const before = await lc.models.LcMessage.countDocuments(mine);
    let acked = false;
    socket.emit("chat:message", { text: "x".repeat(20_000) }, () => (acked = true));
    await sleep(200);
    assert.equal(acked, false);
    assert.equal(await lc.models.LcMessage.countDocuments(mine), before);
    socket.close();
  });

  test("max 30 AI replies per chat: after the limit the patient is handed to a live agent", async () => {
    await lc.setSettings({ "handoffRules.maxAiRepliesPerChat": 2 });
    lc.ai.calls.length = 0;
    const { socket } = await openChat();
    await lc.call(socket, "chat:message", { text: "one" });
    await lc.call(socket, "chat:message", { text: "two" });
    assert.equal(lc.ai.calls.length, 2);
    await lc.call(socket, "chat:message", { text: "three" });
    assert.equal(lc.ai.calls.length, 2, "no third model call");
    const state = (await lc.call(socket, "chat:resume")).conversation;
    assert.equal(state.mode, "queue");
    assert.ok(state.messages.some((m) => /reached my limit/.test(m.text)));
    await lc.setSettings({ "handoffRules.maxAiRepliesPerChat": 30 });
    socket.close();
  });

  test("the default AI reply cap is 30 chats worth", () => {
    assert.equal(DEFAULT_SETTINGS.handoffRules.maxAiRepliesPerChat, 30);
    assert.equal(readAiConfig({}).maxOutputTokens, 300);
  });

  test("max 5 new chats per IP per day: the 6th is refused, existing chats keep working", async () => {
    const limits = lc.livechat.limits.limits;
    assert.equal((await require("../utils/liveChat/config").readLimits({})).chatsPerIpPerDay, 5, "the default is 5");
    limits.chatsPerIpPerDay = 5;
    await lc.models.LcConversation.deleteMany({});
    const sockets = [];
    try {
      for (let i = 0; i < 5; i += 1) {
        const contact = await lc.submitContact();
        const socket = await lc.chatSocket(contact.token);
        const res = await lc.call(socket, "chat:start", {});
        assert.equal(res.ok, true, `chat ${i + 1}`);
        sockets.push(socket);
      }
      const contact = await lc.submitContact();
      const sixthSocket = await lc.chatSocket(contact.token);
      sockets.push(sixthSocket);
      const sixth = await lc.call(sixthSocket, "chat:start", {});
      assert.deepEqual([sixth.ok, sixth.error], [false, "chat_limit"]);
      assert.equal(await lc.models.LcConversation.countDocuments(), 5);

      // an existing chat is not affected by the limit
      assert.equal((await lc.call(sockets[0], "chat:message", { text: "still here" })).ok, true);

      // chats older than a day no longer count
      await lc.models.LcConversation.updateMany({}, { $set: { startedAt: new Date(Date.now() - 25 * 3600 * 1000) } });
      const again = await lc.call(sixthSocket, "chat:start", {});
      assert.equal(again.ok, true);
    } finally {
      limits.chatsPerIpPerDay = 1000;
      sockets.forEach((s) => s.close());
    }
  });

  test("daily AI spend cap: once reached the AI is not called, the notice shows and live chat still works", async () => {
    await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 3.01 } }, { upsert: true });
    lc.ai.calls.length = 0;
    const { socket } = await openChat();
    const res = await lc.call(socket, "chat:message", { text: "What is the price?" });
    assert.equal(res.ok, true);
    assert.equal(lc.ai.calls.length, 0, "the model is not called once the cap is reached");
    const state = (await lc.call(socket, "chat:resume")).conversation;
    assert.equal(state.aiUnavailable, true);
    assert.equal(state.mode, "queue");
    assert.ok(state.messages.some((m) => /AI assistant is unavailable/.test(m.text)));
    lc.livechat.chat.aiBreaker.until = 0;
    lc.livechat.chat.aiBreaker.alerted = false;
    await lc.models.LcAiUsage.deleteMany({});
    socket.close();
  });

  test("the spend cap comes from settings", async () => {
    await lc.setSettings({ dailySpendCapUsd: 10 });
    await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 3.01 } }, { upsert: true });
    const settings = await lc.livechat.chat && (await lc.models.LcSettings.findOne({ key: "default" }).lean());
    const status = await lc.livechat.limits.spendStatus(settings);
    assert.equal(status.capReached, false);
    assert.equal(status.cap, 10);
    await lc.setSettings({ dailySpendCapUsd: 3 });
    await lc.models.LcAiUsage.deleteMany({});
  });
});

describe("limits helpers", () => {
  test("the window limiter allows N per window and frees up afterwards", () => {
    let t = 1_000_000;
    const limiter = createWindowLimiter({ windowMs: 60_000, max: 6, now: () => t });
    for (let i = 0; i < 6; i += 1) assert.equal(limiter.allow("v1"), true);
    assert.equal(limiter.allow("v1"), false);
    assert.equal(limiter.allow("v2"), true);
    t += 60_001;
    assert.equal(limiter.allow("v1"), true);
  });

  test("message text checks", () => {
    assert.deepEqual(checkMessageText("  hi  "), { ok: true, text: "hi" });
    assert.equal(checkMessageText(undefined).error, "empty_message");
    assert.equal(checkMessageText("a".repeat(1001)).error, "message_too_long");
    assert.equal(checkMessageText("a".repeat(1000)).ok, true);
  });

  test("the spend day is the support-time-zone day, not UTC", () => {
    const lateEvening = new Date("2026-10-10T02:30:00Z"); // 22:30 on Oct 9 in New York
    assert.equal(dayKey(lateEvening, "America/New_York"), "2026-10-09");
  });
});

describe("AI service", () => {
  const goodResult = (over = {}) => ({
    text: JSON.stringify({ reply: "It is $49.", handoff: false, handoffReason: "none", topic: "pricing", ...over }),
    finishReason: "stop",
    refusal: false,
    usage: { inputTokens: 1000, cachedInputTokens: 400, outputTokens: 100 },
  });
  const serviceWith = (complete, env = AI_ENV) => createAiService({ env, providers: { openai: () => ({ complete }) }, log: () => {} });
  const ask = (svc) => svc.generateReply({ settings: DEFAULT_SETTINGS, history: [{ role: "patient", text: "price?" }] });

  test("returns the validated structured answer with tokens and cost", async () => {
    const out = await ask(serviceWith(async () => goodResult()));
    assert.equal(out.ok, true);
    assert.deepEqual([out.reply, out.handoff, out.handoffReason, out.topic], ["It is $49.", false, "none", "pricing"]);
    // 600 uncached * $0.10 + 400 cached * $0.01 + 100 output * $0.50, per 1M tokens
    assert.ok(Math.abs(out.usage.costUsd - (600 * 0.1 + 400 * 0.01 + 100 * 0.5) / 1e6) < 1e-12);
  });

  test("asks for strict JSON with a 300-token cap", async () => {
    let seen;
    await ask(serviceWith(async (input) => ((seen = input), goodResult())));
    assert.equal(seen.maxOutputTokens, 300);
    assert.equal(seen.schema, SCHEMA);
    assert.equal(SCHEMA.additionalProperties, false);
    assert.deepEqual(SCHEMA.required, ["reply", "handoff", "handoffReason", "topic"]);
  });

  test("an emergency always hands off", async () => {
    const out = await ask(serviceWith(async () => goodResult({ handoff: false, handoffReason: "emergency" })));
    assert.equal(out.handoff, true);
    assert.equal(out.handoffReason, "emergency");
  });

  test("cut-off, refused, empty, malformed or empty-reply output is not trusted", async () => {
    const cases = [
      { ...goodResult(), finishReason: "length" },
      { ...goodResult(), refusal: true },
      { ...goodResult(), text: "" },
      { ...goodResult(), text: "not json" },
      goodResult({ reply: "   " }),
      goodResult({ handoff: "yes" }),
    ];
    const kinds = [];
    for (const c of cases) kinds.push((await ask(serviceWith(async () => c))).kind);
    assert.deepEqual(kinds, ["incomplete", "incomplete", "incomplete", "invalid", "invalid", "invalid"]);
  });

  test("provider errors become a kind, never a throw", async () => {
    const out = await ask(serviceWith(async () => { throw Object.assign(new Error("x"), { kind: "quota", status: 429 }); }));
    assert.deepEqual([out.ok, out.kind], [false, "quota"]);
    const other = await ask(serviceWith(async () => { throw new Error("boom"); }));
    assert.deepEqual([other.ok, other.kind], [false, "api_error"]);
  });

  test("without a key, model or prices the AI refuses to run", async () => {
    let called = false;
    const svc = serviceWith(async () => ((called = true), goodResult()), { LIVECHAT_MODEL: "gpt-6-luna", LIVECHAT_OPENAI_API_KEY: "k" });
    const out = await ask(svc);
    assert.deepEqual([out.ok, out.kind, called], [false, "not_configured", false]);
  });

  test("nothing is logged but outcome and token counts", async () => {
    const lines = [];
    const svc = createAiService({ env: AI_ENV, providers: { openai: () => ({ complete: async () => goodResult() }) }, log: (e) => lines.push(JSON.stringify(e)) });
    await svc.generateReply({ settings: DEFAULT_SETTINGS, history: [{ role: "patient", text: "my secret symptom" }] });
    assert.equal(lines.join("").includes("secret"), false);
    assert.equal(lines.join("").includes("$49"), false);
    assert.match(lines[0], /"outcome":"ok"/);
  });

  test("the system prompt carries the brief's rules and the prices from settings", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS);
    for (const needle of ["Never diagnose", "medications or doses", "call 911", "language", "General consultation: $49", "Fit to fly: $69", "Prescription refills: $60", "short"]) {
      assert.ok(prompt.includes(needle), needle);
    }
    const custom = buildSystemPrompt({ ...DEFAULT_SETTINGS, businessFacts: "We are closed on Christmas Day." });
    assert.ok(custom.includes("closed on Christmas Day"));
  });

  test("the model sees only the last 10 patient/AI/agent messages, nothing else", () => {
    const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "ai" : "patient", text: `m${i}` }));
    history.push({ role: "system", text: "secret system line" }, { role: "note", text: "internal note" });
    const messages = buildMessages(history);
    assert.equal(messages.length, 10);
    assert.deepEqual(messages.map((m) => m.role).slice(0, 2), ["user", "assistant"]);
    assert.equal(JSON.stringify(messages).includes("internal note"), false);
    assert.equal(JSON.stringify(messages).includes("system line"), false);
  });

  test("costOf uses the cached-input price for cached tokens", () => {
    const config = readAiConfig(AI_ENV);
    assert.equal(costOf({ inputTokens: 1_000_000, cachedInputTokens: 1_000_000, outputTokens: 0 }, config), 0.01);
    assert.equal(costOf({ inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 }, config), 0.6);
  });
});

describe("OpenAI provider", () => {
  const fakeClient = (handler) => () => ({ chat: { completions: { create: async (request) => handler(request) } } });
  const completion = (over = {}) => ({
    choices: [{ finish_reason: "stop", message: { content: '{"reply":"ok"}' } }],
    usage: { prompt_tokens: 64, completion_tokens: 21, prompt_tokens_details: { cached_tokens: 10 } },
    ...over,
  });

  test("sends the configured model, strict schema, token cap and the lowest reasoning effort by default", async () => {
    let request;
    const provider = createOpenAiProvider(readAiConfig(AI_ENV), { clientFactory: fakeClient((r) => ((request = r), completion())) });
    const out = await provider.complete({ system: "S", messages: [{ role: "user", content: "hi" }], schema: SCHEMA, schemaName: "livechat_reply", maxOutputTokens: 300 });
    assert.equal(request.model, "gpt-6-luna");
    assert.equal(request.max_completion_tokens, 300);
    assert.equal(request.reasoning_effort, "none");
    assert.equal(request.response_format.json_schema.strict, true);
    assert.deepEqual(request.messages[0], { role: "system", content: "S" });
    assert.deepEqual(out.usage, { inputTokens: 64, cachedInputTokens: 10, outputTokens: 21 });
  });

  test("model and reasoning effort are configurable; an empty effort sends no reasoning parameter", async () => {
    let request;
    const run = async (env) => {
      const provider = createOpenAiProvider(readAiConfig(env), { clientFactory: fakeClient((r) => ((request = r), completion())) });
      await provider.complete({ system: "S", messages: [], schema: SCHEMA, schemaName: "x", maxOutputTokens: 300 });
    };
    await run({ ...AI_ENV, LIVECHAT_MODEL: "another-model", LIVECHAT_REASONING_EFFORT: "low" });
    assert.deepEqual([request.model, request.reasoning_effort], ["another-model", "low"]);
    await run({ ...AI_ENV, LIVECHAT_REASONING_EFFORT: "" });
    assert.equal("reasoning_effort" in request, false);
  });

  test("errors are classified: quota, config, rate limit, outage", async () => {
    const kindFor = async (err) => {
      const provider = createOpenAiProvider(readAiConfig(AI_ENV), { clientFactory: fakeClient(() => { throw err; }) });
      try {
        await provider.complete({ system: "S", messages: [], schema: SCHEMA, schemaName: "x", maxOutputTokens: 300 });
      } catch (e) {
        return e.kind;
      }
      return null;
    };
    assert.equal(await kindFor(Object.assign(new Error("x"), { status: 429, code: "insufficient_quota" })), "quota");
    assert.equal(await kindFor(Object.assign(new Error("x"), { status: 429 })), "rate_limited");
    assert.equal(await kindFor(Object.assign(new Error("x"), { status: 401 })), "config");
    assert.equal(await kindFor(Object.assign(new Error("x"), { status: 400 })), "config");
    assert.equal(await kindFor(Object.assign(new Error("x"), { status: 503 })), "unavailable");
    assert.equal(classify(new Error("weird")), "api_error");
  });
});

describe("Turnstile", () => {
  const respond = (data, ok = true) => async () => ({ ok, json: async () => data });

  test("passes only when Cloudflare says success", async () => {
    assert.deepEqual(await verifyTurnstile({ token: "t", env: {}, fetchImpl: respond({ success: true }) }), { ok: true });
    assert.equal((await verifyTurnstile({ token: "t", env: {}, fetchImpl: respond({ success: false }) })).ok, false);
  });

  test("posts the secret, token and IP to the Cloudflare siteverify URL", async () => {
    let call;
    await verifyTurnstile({ token: "tok", ip: "1.2.3.4", env: { TURNSTILE_SECRET_KEY: "real-secret" }, fetchImpl: async (url, init) => ((call = { url, body: init.body.toString() }), { ok: true, json: async () => ({ success: true }) }) });
    assert.equal(call.url, VERIFY_URL);
    assert.match(call.body, /secret=real-secret/);
    assert.match(call.body, /response=tok/);
    assert.match(call.body, /remoteip=1.2.3.4/);
  });

  test("fails closed: no token, network error, Cloudflare outage", async () => {
    assert.equal((await verifyTurnstile({ token: "", env: {}, fetchImpl: respond({ success: true }) })).reason, "missing_token");
    assert.equal((await verifyTurnstile({ token: "t", env: {}, fetchImpl: async () => { throw new Error("down"); } })).ok, false);
    assert.equal((await verifyTurnstile({ token: "t", env: {}, fetchImpl: respond({}, false) })).ok, false);
  });

  test("outside production the Cloudflare test secret is used; in production a missing secret refuses", async () => {
    assert.equal(readTurnstileSecret({ NODE_ENV: "development" }), TURNSTILE_TEST_SECRET);
    assert.equal(TURNSTILE_TEST_SECRET, "1x0000000000000000000000000000000AA");
    assert.equal(readTurnstileSecret({ NODE_ENV: "production" }), "");
    const out = await verifyTurnstile({ token: "t", env: { NODE_ENV: "production" }, fetchImpl: respond({ success: true }) });
    assert.deepEqual([out.ok, out.reason], [false, "not_configured"]);
    assert.equal(readTurnstileSecret({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: "abc" }), "abc");
  });
});
