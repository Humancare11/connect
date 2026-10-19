const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A, SUPER_S } = require("./helpers/liveChatServer");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");
const safety = require("../services/liveChat/safety");
const { createSitePages } = require("../services/liveChat/sitePages");

const sitePages = createSitePages();
const CONDITION = sitePages.pages.find((p) => p.type === "condition");
const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 };
const modelReply = (reply, over = {}) => ({
  ok: true, reply, handoff: false, handoffReason: "none", offTopic: false, topic: "other", links: [],
  language: { code: "en", name: "English" }, usage: USAGE, ...over,
});

describe("live chat: safety around the AI (emergency, reply filter, length, scrubbing, condition links)", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    await lc.setSettings({ aiMayLinkConditionPages: true });
  });

  async function openChat(extra = {}) {
    const contact = await lc.submitContact(extra);
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home" });
    return { socket, id: started.conversation.conversationId };
  }
  const say = (chat, text) => lc.call(chat.socket, "chat:message", { text });
  const stateOf = async (chat) => (await lc.call(chat.socket, "chat:resume")).conversation;
  const lastAi = async (chat) => (await stateOf(chat)).messages.filter((m) => m.sender === "ai").at(-1);
  const stored = (chat) => lc.models.LcMessage.find({ conversationId: chat.id }).sort({ createdAt: 1 }).lean();

  describe("the model never sees the patient's contact details", () => {
    test("name, email and phone are replaced in the history; the stored chat is unchanged", async () => {
      const chat = await openChat({ name: "Emma Wilson", email: "emma.private@example.org", phone: "+1 512 555 0142" });
      const text = "Hi, I am Emma Wilson, mail emma.private@example.org or call +1 512 555 0142 about a price";
      await say(chat, text);
      assert.equal(lc.ai.calls.length, 1);
      const seen = JSON.stringify(lc.ai.calls[0].history);
      for (const secret of ["Emma", "Wilson", "emma.private@example.org", "555 0142"]) assert.equal(seen.includes(secret), false, secret);
      assert.ok(seen.includes("[name]") && seen.includes("[email]") && seen.includes("[phone]"));
      // what is stored (and shown to the patient and admins) is the original text
      const patientRow = (await stored(chat)).find((m) => m.sender === "patient");
      assert.equal(decryptLiveChatText(patientRow.text), text);
      assert.equal((await stateOf(chat)).messages.find((m) => m.sender === "patient").text, text);
      chat.socket.close();
    });
  });

  describe("emergency detector: the server answers, not the model", () => {
    test("English: fixed 911 message, hand-over to the Queue with reason emergency, no model call", async () => {
      const chat = await openChat();
      await say(chat, "I have chest pain and it is getting worse");
      assert.equal(lc.ai.calls.length, 0);
      const state = await stateOf(chat);
      assert.equal(state.mode, "queue");
      assert.ok(state.messages.some((m) => m.sender === "ai" && m.text === safety.FIXED_TEXT.emergency.en));
      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
      assert.equal(conv.handoffReason, "emergency");
      // after the 911 message: the short fixed line, not the usual "Connecting you" one
      const texts = state.messages.filter((m) => m.sender === "ai").map((m) => m.text);
      assert.deepEqual(texts.slice(-2), [safety.FIXED_TEXT.emergency.en, safety.FIXED_TEXT.teamNotified.en]);
      assert.equal(texts.some((t) => /Connecting you/.test(t)), false);
      chat.socket.close();
    });

    test("Hindi and Spanish messages get the Hindi and Spanish message", async () => {
      const hi = await openChat();
      await say(hi, "मुझे सीने में दर्द है");
      assert.ok((await stateOf(hi)).messages.some((m) => m.text === safety.FIXED_TEXT.emergency.hi));
      assert.ok((await stateOf(hi)).messages.some((m) => m.text === safety.FIXED_TEXT.teamNotified.hi));
      const es = await openChat();
      await say(es, "no puedo respirar");
      assert.ok((await stateOf(es)).messages.some((m) => m.text === safety.FIXED_TEXT.emergency.es));
      assert.ok((await stateOf(es)).messages.some((m) => m.text === safety.FIXED_TEXT.teamNotified.es));
      assert.equal(lc.ai.calls.length, 0);
      hi.socket.close();
      es.socket.close();
    });

    test("it also fires when AI replies are switched off", async () => {
      await lc.setSettings({ aiMode: "ai_off" });
      const chat = await openChat();
      await say(chat, "I want to kill myself");
      assert.ok((await stateOf(chat)).messages.some((m) => m.text === safety.FIXED_TEXT.emergency.en));
      await lc.setSettings({ aiMode: "ai_first" });
      chat.socket.close();
    });

    test("a normal price question is not an emergency and reaches the model", async () => {
      const chat = await openChat();
      await say(chat, "How much is a consultation?");
      assert.equal(lc.ai.calls.length, 1);
      chat.socket.close();
    });
  });

  describe("reply filter: advice never reaches the patient", () => {
    test("a blocked reply is replaced by the fixed safe reply with the booking link, and marked safetyBlocked", async () => {
      lc.ai.queue.push(modelReply("You may have a migraine. Rest in a dark room."));
      const chat = await openChat();
      await say(chat, "I get bad headaches every week");
      const reply = await lastAi(chat);
      assert.equal(reply.text, safety.FIXED_TEXT.fallback.en);
      // the page that fits "headaches" (lay-word map) now goes above the booking card
      assert.deepEqual(reply.links.map((l) => l.url), ["/general-and-everyday-care/general-physician/headache"]);
      const rows = await stored(chat);
      assert.equal(rows.filter((m) => decryptLiveChatText(m.text).includes("migraine")).length, 0); // the model's text is never stored
      assert.equal(rows.filter((m) => m.safetyBlocked).length, 1);
      chat.socket.close();
    });

    test("medication variant when the patient's message or the blocked reply is about a medication or refill", async () => {
      lc.ai.queue.push(modelReply("Take 400 mg of ibuprofen every six hours."));
      const a = await openChat();
      await say(a, "I have a sore knee");
      assert.equal((await lastAi(a)).text, safety.FIXED_TEXT.fallbackMedication.en); // the blocked reply names a drug

      lc.ai.queue.push(modelReply("You probably have an infection."));
      const b = await openChat();
      await say(b, "can I get my refill early and what dose should I take");
      assert.equal((await lastAi(b)).text, safety.FIXED_TEXT.fallbackMedication.en); // the patient asked about a refill
      a.socket.close();
      b.socket.close();
    });

    test("Hindi, Spanish and other languages: fixed strings in en/hi/es, English otherwise", async () => {
      for (const [code, expected] of [["hi", safety.FIXED_TEXT.fallback.hi], ["es", safety.FIXED_TEXT.fallback.es], ["fr", safety.FIXED_TEXT.fallback.en]]) {
        lc.ai.queue.push(modelReply("You may have a migraine.", { language: { code, name: code } }));
        const chat = await openChat();
        await say(chat, "I get headaches");
        assert.equal((await lastAi(chat)).text, expected, code);
        chat.socket.close();
      }
    });

    test("service wording is sent as the model wrote it", async () => {
      const text = "Prescription refills are $60. A doctor will review your request.";
      lc.ai.queue.push(modelReply(text, { topic: "refill" }));
      const chat = await openChat();
      await say(chat, "How much is a prescription refill?");
      const reply = await lastAi(chat);
      assert.equal(reply.text, text);
      assert.equal((await stored(chat)).filter((m) => m.safetyBlocked).length, 0);
      chat.socket.close();
    });

    test("a blocked reply that asked for an emergency hand-over sends the fixed 911 message instead", async () => {
      lc.ai.queue.push(modelReply("Take 2 aspirin tablets and rest.", { handoff: true, handoffReason: "emergency" }));
      const chat = await openChat();
      await say(chat, "my arm feels strange and I feel dizzy");
      const state = await stateOf(chat);
      assert.ok(state.messages.some((m) => m.text === safety.FIXED_TEXT.emergency.en));
      assert.ok(state.messages.some((m) => m.text === safety.FIXED_TEXT.teamNotified.en));
      assert.equal(state.mode, "queue");
      chat.socket.close();
    });
  });

  describe("200-character rule", () => {
    test("a reply still too long after the retry becomes the safe fallback; the AI is not marked unavailable", async () => {
      lc.ai.queue.push({ ok: false, kind: "too_long", usage: USAGE });
      const chat = await openChat();
      await say(chat, "Tell me about your services");
      assert.equal((await lastAi(chat)).text, safety.FIXED_TEXT.fallback.en);
      assert.equal((await stateOf(chat)).mode, "ai"); // no hand-over, no "AI unavailable" notice
      // the next question is answered by the model normally (the circuit breaker did not open)
      await say(chat, "How much is a consultation?");
      assert.equal((await lastAi(chat)).text, "A general consultation is $49.");
      chat.socket.close();
    });
  });

  describe("AI may link condition pages (setting)", () => {
    test("on: condition pages are offered to the model and may be shown; off: neither", async () => {
      assert.ok(CONDITION, "the site list has condition pages");
      const asked = `tell me about ${CONDITION.keywords?.[0] || CONDITION.title}`;
      lc.ai.queue.push(modelReply("I can't give medical advice.", { links: [{ title: CONDITION.title, url: CONDITION.url }] }));
      const on = await openChat();
      await say(on, asked);
      assert.ok(lc.ai.calls[0].pages.some((p) => p.url === CONDITION.url));
      assert.ok((await lastAi(on)).links.some((l) => l.url === CONDITION.url));

      await lc.setSettings({ aiMayLinkConditionPages: false });
      lc.ai.queue.push(modelReply("I can't give medical advice.", { links: [{ title: CONDITION.title, url: CONDITION.url }, { title: "Book an appointment", url: "/appointment-booking" }] }));
      const off = await openChat();
      await say(off, asked);
      assert.equal(lc.ai.calls[1].pages.some((p) => sitePages.typeOf(p.url) === "condition"), false);
      const links = ((await lastAi(off)).links || []).map((l) => l.url);
      assert.deepEqual(links, []); // no condition page allowed, and a non-medical reply gets no button
      on.socket.close();
      off.socket.close();
    });
  });

  describe("settings: the new toggle, prices and business facts (Super Admin only, audited in full)", () => {
    const A = { user: AGENT_A };
    const S = { user: SUPER_S, role: "superadmin" };
    const save = (patch, who = S) => lc.rest("PUT", "/settings", { ...who, body: patch });
    const audit = async () => (await lc.rest("GET", "/settings/audit", A)).body.entries;

    test("defaults ON; only a Super Admin changes it; the change is logged", async () => {
      assert.equal((await lc.rest("GET", "/settings", A)).body.settings.aiMayLinkConditionPages, true);
      assert.equal((await save({ aiMayLinkConditionPages: false }, A)).status, 403);
      assert.equal((await save({ aiMayLinkConditionPages: "no" })).status, 400);
      assert.equal((await save({ aiMayLinkConditionPages: false })).body.changed, 1);
      const change = (await audit())[0].changes.find((c) => c.field === "aiMayLinkConditionPages");
      assert.deepEqual([change.before, change.after], ["true", "false"]);
      await save({ aiMayLinkConditionPages: true });
    });

    test("an admin cannot change prices or business facts (403, nothing saved, nothing logged)", async () => {
      const before = (await audit()).length;
      assert.equal((await save({ prices: [{ name: "Free visit", price: 0 }] }, A)).status, 403);
      assert.equal((await save({ businessFacts: "Everything is free." }, A)).status, 403);
      const cur = (await lc.rest("GET", "/settings", A)).body.settings;
      assert.ok(cur.prices.length > 1);
      assert.notEqual(cur.businessFacts, "Everything is free.");
      assert.equal((await audit()).length, before);
    });

    test("a Super Admin change records who, when, and the full before and after", async () => {
      const cur = (await lc.rest("GET", "/settings", S)).body.settings;
      const longFacts = `${"Closed on holidays. ".repeat(100)}END`;
      const prices = [...cur.prices.slice(0, 7), { name: "General consultation", price: 59 }];
      await save({ businessFacts: longFacts, prices });
      const entry = (await audit())[0];
      assert.equal(entry.actor.id, SUPER_S);
      assert.equal(entry.actor.role, "superadmin");
      assert.ok(entry.at);
      const facts = entry.changes.find((c) => c.field === "businessFacts");
      assert.equal(facts.after, longFacts); // not shortened
      const priceChange = entry.changes.find((c) => c.field === "prices");
      assert.deepEqual(JSON.parse(priceChange.before), cur.prices);
      assert.deepEqual(JSON.parse(priceChange.after), prices);
      // restore, and check the second change keeps the first value as "before"
      await save({ businessFacts: cur.businessFacts, prices: cur.prices });
      const back = (await audit())[0].changes.find((c) => c.field === "businessFacts");
      assert.equal(back.before, longFacts);
    });
  });
});
