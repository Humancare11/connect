const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, scriptedAi, once, sleep, VISITOR_ID } = require("./helpers/liveChatServer");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");

describe("live chat: contact form gate, quick options, live-agent button", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000" } }); // the real limit is tested in liveChatAbuse
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
  });

  // Registers a visitor through the contact form and opens a chat. Returns { socket, conversation, visitorId }.
  async function openChat(extra = {}) {
    const contact = await lc.submitContact(extra);
    assert.equal(contact.status, 200, JSON.stringify(contact));
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/book-appointment", title: "Book" });
    assert.equal(started.ok, true, JSON.stringify(started));
    return { socket, contact, conversation: started.conversation, visitorId: contact.visitorId };
  }

  describe("no chat before the contact form", () => {
    test("the form is required: missing or invalid fields are rejected and nothing is stored", async () => {
      const before = await lc.models.LcVisitor.countDocuments();
      for (const bad of [
        { name: "", email: "a@b.co" },
        { name: "Emma Wilson", email: "" },
        { name: "Emma Wilson", email: "not-an-email" },
        { name: "E", email: "a@b.co" },
        { name: "Emma Wilson", email: "a@b.co", phone: "12345" }, // too short
        { name: "Emma Wilson", email: "a@b.co", phone: "1234567890123456" }, // too long
        { name: "Emma Wilson", email: "a@b.co", phone: "call me maybe" },
      ]) {
        const res = await lc.post("/contact", { consent: true, turnstileToken: "good-token", ...bad });
        assert.equal(res.status, 400, JSON.stringify(bad));
        assert.equal(res.body.token, undefined);
      }
      assert.equal(await lc.models.LcVisitor.countDocuments(), before);
    });

    test("name + email is enough; a phone with 7-15 digits is accepted and normalised", async () => {
      const ok = await lc.submitContact({ phone: "" });
      assert.equal(ok.status, 200);
      assert.ok(ok.token && ok.visitorId);
      const withPhone = await lc.submitContact({ phone: "+1 (302) 303-9993" });
      assert.equal(withPhone.status, 200);
      const visitor = await lc.models.LcVisitor.findOne({ visitorId: withPhone.visitorId }).lean();
      assert.equal(decryptLiveChatText(visitor.phone), "+13023039993");
    });

    test("Turnstile and the privacy consent are required; the honeypot silently drops bots", async () => {
      const count = await lc.models.LcVisitor.countDocuments();
      const noCaptcha = await lc.post("/contact", { name: "Emma Wilson", email: "e@x.co", consent: true, turnstileToken: "bad" });
      assert.equal(noCaptcha.status, 400);
      assert.ok(noCaptcha.body.errors.captcha);
      const noConsent = await lc.post("/contact", { name: "Emma Wilson", email: "e@x.co", turnstileToken: "good-token" });
      assert.equal(noConsent.status, 400);
      const bot = await lc.post("/contact", {
        name: "Bot Botson", email: "bot@x.co", consent: true, turnstileToken: "good-token", companyUrl: "http://spam.example",
      });
      assert.equal(bot.status, 200);
      assert.equal(bot.body.token, "");
      assert.equal(await lc.models.LcVisitor.countDocuments(), count);
    });

    test("contact details are stored encrypted", async () => {
      const contact = await lc.submitContact({ name: "Priya Raman", email: "priya.raman@example.com" });
      const raw = await require("mongoose").connection.db.collection("lcvisitors").findOne({ visitorId: contact.visitorId });
      assert.equal(JSON.stringify(raw).includes("Priya"), false);
      assert.equal(JSON.stringify(raw).includes("priya.raman"), false);
    });

    test("a socket without a chat token cannot chat, even a tracker with cookie consent", async () => {
      const tracker = await lc.visitor(); // cookie consent only
      const before = await lc.models.LcMessage.countDocuments();
      let acked = false;
      tracker.emit("chat:start", () => (acked = true));
      tracker.emit("chat:message", { text: "hello?" }, () => (acked = true));
      await sleep(200);
      assert.equal(acked, false);
      assert.equal(await lc.models.LcMessage.countDocuments(), before);
      tracker.close();
    });

    test("a forged or tampered chat token is refused at connect", async () => {
      await assert.rejects(lc.chatSocket("not-a-token"), { message: "invalid_token" });
      const real = await lc.submitContact();
      await assert.rejects(lc.chatSocket(real.token.slice(0, -3) + "abc"), { message: "invalid_token" });
    });

    test("a valid token whose contact record is gone cannot start a chat", async () => {
      const contact = await lc.submitContact();
      await lc.models.LcVisitor.deleteOne({ visitorId: contact.visitorId });
      const socket = await lc.chatSocket(contact.token);
      const resumed = await lc.call(socket, "chat:resume");
      assert.equal(resumed.needContact, true);
      const started = await lc.call(socket, "chat:start", {});
      assert.deepEqual([started.ok, started.error], [false, "contact_required"]);
      const sent = await lc.call(socket, "chat:message", { text: "hi" });
      assert.deepEqual([sent.ok, sent.error], [false, "contact_required"]);
      socket.close();
    });

    test("a returning visitor skips the form: resume finds the contact and the open chat", async () => {
      const first = await openChat();
      first.socket.close();
      const again = await lc.chatSocket(first.contact.token);
      const resumed = await lc.call(again, "chat:resume");
      assert.equal(resumed.needContact, false);
      assert.equal(resumed.conversation.conversationId, first.conversation.conversationId);
      assert.equal(resumed.firstName, "Emma");
      again.close();
    });
  });

  describe("greeting and quick options", () => {
    test("after the form: greeting with the first name, then the six option cards from settings", async () => {
      const { conversation, socket } = await openChat({ name: "Sophia Martinez" });
      assert.equal(conversation.messages.length, 1);
      assert.equal(conversation.messages[0].sender, "ai");
      assert.equal(
        conversation.messages[0].text,
        "Hi Sophia! Welcome to Humancare Connect. I'm Humancare AI, your healthcare coordinator. How can I help you today?"
      );
      assert.deepEqual(conversation.options.map((o) => o.label), [
        "Online Consultation with Prescription",
        "Prescription & Prescription refill",
        "Medical Advice/Second Opinion",
        "Sick Notes",
        "Others",
        "Talk to a live agent",
      ]);
      assert.equal(conversation.optionsUsed, false);
      socket.close();
    });

    test("clicking a card sends its label as the patient's message, the AI replies for that topic, the cards disappear", async () => {
      const { socket, conversation } = await openChat();
      const seen = [];
      socket.on("chat:message", (m) => seen.push(m.message));
      const stateChanged = once(socket, "chat:state");

      const result = await lc.call(socket, "chat:option", { key: "second_opinion" });
      assert.equal(result.ok, true);
      await stateChanged;

      const resumed = await lc.call(socket, "chat:resume");
      const messages = resumed.conversation.messages;
      assert.deepEqual(messages.slice(-2).map((m) => m.sender), ["patient", "ai"]);
      assert.equal(messages.at(-2).text, "Medical Advice/Second Opinion");
      assert.ok(messages.at(-1).text.startsWith("A Second Medical Opinion is $60."));
      assert.equal(resumed.conversation.optionsUsed, true);
      assert.deepEqual(resumed.conversation.options, []);
      assert.equal(lc.ai.calls.length, 0, "a topic reply is configured text, not an AI call");

      const conv = await lc.models.LcConversation.findOne({ conversationId: conversation.conversationId }).lean();
      assert.equal(conv.topic, "second_opinion");
      assert.equal(conv.mode, "ai");

      // the cards cannot be used twice
      const again = await lc.call(socket, "chat:option", { key: "sick_notes" });
      assert.deepEqual([again.ok, again.error], [false, "options_used"]);
      assert.ok(seen.length >= 2);
      socket.close();
    });

    test("an unknown option is refused", async () => {
      const { socket } = await openChat();
      const res = await lc.call(socket, "chat:option", { key: "free-money" });
      assert.deepEqual([res.ok, res.error], [false, "unknown_option"]);
      socket.close();
    });

    test("the card text is stored encrypted", async () => {
      const { socket, conversation } = await openChat();
      await lc.call(socket, "chat:option", { key: "sick_notes" });
      const rows = await require("mongoose").connection.db.collection("lcmessages").find({ conversationId: conversation.conversationId }).toArray();
      assert.ok(rows.length >= 3);
      assert.equal(JSON.stringify(rows).includes("Sick Notes"), false);
      socket.close();
    });

    test("'Talk to a live agent' card moves the chat to the queue with no second form", async () => {
      const agent = await lc.onlineAgent();
      const { socket, conversation } = await openChat();
      const res = await lc.call(socket, "chat:option", { key: "live" });
      assert.equal(res.ok, true);
      const resumed = await lc.call(socket, "chat:resume");
      assert.equal(resumed.conversation.mode, "queue");
      assert.equal(resumed.conversation.offline, false);
      assert.match(resumed.conversation.messages.at(-1).text, /Connecting you to our team/);
      const conv = await lc.models.LcConversation.findOne({ conversationId: conversation.conversationId }).lean();
      assert.equal(conv.mode, "queue");
      assert.equal(conv.everLive, true);
      socket.close();
      agent.close();
    });
  });

  describe("header 'Talk to live agent' button", () => {
    test("visible once the AI chat has started; hidden while waiting for or talking to an agent", async () => {
      const agent = await lc.onlineAgent();
      const { socket, conversation } = await openChat();
      assert.equal(conversation.canRequestAgent, true);

      const clicked = await lc.call(socket, "chat:agent");
      assert.equal(clicked.ok, true);
      let state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.mode, "queue");
      assert.equal(state.canRequestAgent, false, "hidden while waiting");

      await lc.models.LcConversation.updateOne({ conversationId: conversation.conversationId }, { $set: { mode: "live" } });
      state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.canRequestAgent, false, "hidden while talking to an agent");

      const again = await lc.call(socket, "chat:agent");
      assert.deepEqual([again.ok, again.error], [false, "not_available"]);
      socket.close();
      agent.close();
    });

    test("not available before there is a chat (the form comes first)", async () => {
      const contact = await lc.submitContact();
      const socket = await lc.chatSocket(contact.token);
      const resumed = await lc.call(socket, "chat:resume");
      assert.equal(resumed.conversation, null);
      const res = await lc.call(socket, "chat:agent");
      assert.deepEqual([res.ok, res.error], [false, "no_conversation"]);
      socket.close();
    });

    test("the AI can hand off: the server decides from the structured output, not from the text", async () => {
      const agent = await lc.onlineAgent();
      lc.ai.queue.push({
        ok: true, reply: "A live agent can check your booking.", handoff: true, handoffReason: "account_issue",
        topic: "booking", usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 },
      });
      const { socket } = await openChat();
      await lc.call(socket, "chat:message", { text: "Where is my booking?" });
      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.mode, "queue");
      assert.equal(state.canRequestAgent, false);
      socket.close();
      agent.close();
    });

    test("an emergency reply ends in a live agent, whatever the flag says", async () => {
      const { validate } = require("../services/liveChat/aiService");
      const parsed = validate({ reply: "Call 911 now.", handoff: false, handoffReason: "emergency", topic: "other" });
      assert.equal(parsed.handoff, true);
    });
  });

  describe("offline team", () => {
    test("no agent online: the patient is told, the request is saved in the queue", async () => {
      const { socket, conversation } = await openChat();
      await lc.call(socket, "chat:agent");
      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.mode, "queue");
      assert.equal(state.offline, true);
      assert.match(state.messages.at(-1).text, /^Thanks, .+! We've received your question and details\. Our team will get back to you at .+@.+ shortly\.$/);
      assert.doesNotMatch(state.messages.at(-1).text, /offline/i);
      const conv = await lc.models.LcConversation.findOne({ conversationId: conversation.conversationId }).lean();
      assert.equal(conv.offlineRequested, true);
      socket.close();
    });

    test("outside support hours counts as offline even with an agent online", async () => {
      const agent = await lc.onlineAgent();
      const settings = await lc.models.LcSettings.findOne({ key: "default" });
      const original = settings.supportHours.days.map((d) => d.toObject());
      settings.supportHours.days.forEach((d) => (d.enabled = false));
      await settings.save();

      const { socket } = await openChat();
      await lc.call(socket, "chat:agent");
      assert.equal((await lc.call(socket, "chat:resume")).conversation.offline, true);

      await lc.setSettings({ "supportHours.days": original });
      socket.close();
      agent.close();
    });
  });

  describe("free-text messages and the AI", () => {
    test("the AI answers, tokens are logged on the chat and in the daily usage", async () => {
      const { socket, conversation } = await openChat();
      const res = await lc.call(socket, "chat:message", { text: "How much is a general consultation?" });
      assert.equal(res.ok, true);

      assert.equal(lc.ai.calls.length, 1);
      // no name, email or phone is sent to the model
      assert.equal(JSON.stringify(lc.ai.calls[0]).includes("emma"), false);
      assert.equal(JSON.stringify(lc.ai.calls[0].history.at(-1)), JSON.stringify({ role: "patient", text: "How much is a general consultation?" }));

      const conv = await lc.models.LcConversation.findOne({ conversationId: conversation.conversationId }).lean();
      assert.equal(conv.aiReplyCount, 1);
      assert.deepEqual([conv.tokens.input, conv.tokens.output], [1000, 50]);
      assert.equal(conv.topic, "pricing");
      const usage = await lc.models.LcAiUsage.findOne().lean();
      assert.ok(usage.requests >= 1 && usage.costUsd > 0);

      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.messages.at(-1).text, "A general consultation is $49.");
      socket.close();
    });

    test("internal notes never reach the patient", async () => {
      const { socket, conversation } = await openChat();
      const { encryptLiveChatText } = require("../utils/liveChat/crypto");
      await lc.models.LcMessage.create({
        conversationId: conversation.conversationId, sender: "note", text: encryptLiveChatText("looks like a regular, be nice"),
      });
      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.messages.some((m) => m.sender === "note" || m.text.includes("regular")), false);
      socket.close();
    });

    test("typing relays a boolean to agents, never any text", async () => {
      const agent = await lc.agent();
      await agent.snapshotPromise;
      const { socket } = await openChat();
      const seen = [];
      agent.on("chat:typing", (p) => seen.push(p));
      socket.emit("chat:typing", { typing: true, text: "my chest hurts and I take 40mg of" });
      await sleep(150);
      assert.equal(seen.length, 1);
      assert.deepEqual(Object.keys(seen[0]).sort(), ["typing", "visitorId"]);
      assert.equal(seen[0].typing, true);
      socket.close();
      agent.close();
    });
  });

  describe("AI unavailable (credits used up, outage, bad output)", () => {
    test("credit exhausted: no error is shown; the notice appears, live chat keeps working, admins are alerted once", async () => {
      const agent = await lc.onlineAgent();
      const alerts = [];
      agent.on("ai:unavailable", (a) => alerts.push(a));
      lc.ai.queue.push({ ok: false, kind: "quota" });

      const { socket } = await openChat();
      const res = await lc.call(socket, "chat:message", { text: "Can I get a refill?" });
      assert.equal(res.ok, true, "the patient never sees an error");

      const state = (await lc.call(socket, "chat:resume")).conversation;
      const texts = state.messages.map((m) => m.text);
      assert.ok(texts.includes("Our AI assistant is unavailable right now. Talk to a live agent or leave a message and we'll email you."));
      assert.equal(state.aiUnavailable, true);
      assert.equal(state.mode, "queue", "live chat still works");
      assert.equal(JSON.stringify(state).toLowerCase().includes("quota"), false);

      // a second patient in the same outage: no new model call, no second alert
      const second = await openChat();
      const calls = lc.ai.calls.length;
      await lc.call(second.socket, "chat:message", { text: "hello" });
      assert.equal(lc.ai.calls.length, calls, "circuit is open: no more calls to the model");
      await sleep(100);
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].kind, "quota");

      lc.livechat.chat.aiBreaker.until = 0; // outage over
      lc.livechat.chat.aiBreaker.alerted = false;
      socket.close();
      second.socket.close();
      agent.close();
    });

    test("a cut-off or malformed model answer also shows the fallback instead of an error", async () => {
      lc.ai.queue.push({ ok: false, kind: "incomplete" });
      const { socket } = await openChat();
      const res = await lc.call(socket, "chat:message", { text: "hi there" });
      assert.equal(res.ok, true);
      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.aiUnavailable, true);
      lc.livechat.chat.aiBreaker.until = 0;
      lc.livechat.chat.aiBreaker.alerted = false;
      socket.close();
    });
  });

  test("a chat socket for a visitor that declined cookies is not tracked", async () => {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token); // no consent flag
    await lc.call(socket, "chat:resume");
    assert.equal(lc.livechat.presence.get(contact.visitorId), null);
    socket.close();
  });

  test("the tracker and the chat share one visitor when both are allowed", async () => {
    const contact = await lc.submitContact({ visitorId: VISITOR_ID });
    assert.equal(contact.visitorId, VISITOR_ID);
    const socket = await lc.chatSocket(contact.token, { consent: true, visitorId: VISITOR_ID });
    await lc.call(socket, "chat:start", {});
    assert.equal(lc.livechat.presence.get(VISITOR_ID).activity, "ai");
    assert.ok(lc.livechat.presence.get(VISITOR_ID).conversationId);
    socket.close();
  });
});
