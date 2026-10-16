const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A } = require("./helpers/liveChatServer");

// The admin conversation detail (opening a chat in the admin console) must load for every kind of chat, including the
// ones the continuity change creates: reopened, ended by the patient, and a visitor who cleared their device.
describe("live chat: the admin conversation detail loads for every chat state", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });

  const A = { user: AGENT_A };
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  async function openChat(extra = {}) {
    const contact = await lc.submitContact({ name: "Satish Kumar", ...extra });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    await lc.call(socket, "chat:message", { text: "How much is a sick note?" });
    return { socket, id: started.conversation.conversationId, visitorId: contact.visitorId, token: contact.token };
  }
  async function loads(id, query = "") {
    const res = await lc.rest("GET", `/conversations/${id}${query}`, A);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.equal(res.body.conversation.conversationId, id);
    assert.ok(Array.isArray(res.body.messages) && res.body.messages.length > 0);
    return res.body;
  }

  test("a normal AI chat", async () => {
    const chat = await openChat();
    const body = await loads(chat.id);
    assert.equal(body.conversation.mode, "ai");
    chat.socket.close();
  });

  test("a reopened chat (closed, then the patient wrote again), also rated before", async () => {
    const chat = await openChat();
    await lc.models.LcConversation.updateOne(
      { conversationId: chat.id },
      { $set: { mode: "archived", closedReason: "resolved", modeBeforeLeft: "ai", closedAt: new Date(), rating: { stars: 4, ratedAt: new Date() } } }
    );
    assert.equal((await lc.call(chat.socket, "chat:message", { text: "I am back" })).ok, true);
    assert.notEqual((await convOf(chat.id)).mode, "archived");
    const body = await loads(chat.id);
    assert.ok(body.messages.some((m) => m.text.startsWith("Welcome back")));
    chat.socket.close();
  });

  test("a chat the patient ended (patient_ended), in the list and as an archive view", async () => {
    const chat = await openChat();
    assert.equal((await lc.call(chat.socket, "chat:end", { clear: false })).ok, true);
    const body = await loads(chat.id);
    assert.deepEqual([body.conversation.mode, body.conversation.closedReason], ["archived", "patient_ended"]);
    await loads(chat.id, "?archive=1");
    const list = (await lc.rest("GET", "/conversations?view=ai", A)).body.conversations;
    assert.equal(list.find((c) => c.conversationId === chat.id)?.closedReason, "patient_ended");
    chat.socket.close();
  });

  test("a chat whose visitor cleared the device (deviceClearedAt)", async () => {
    const chat = await openChat();
    assert.equal((await lc.call(chat.socket, "chat:end", { clear: true })).ok, true);
    const visitor = await lc.models.LcVisitor.findOne({ visitorId: chat.visitorId }).lean();
    assert.ok(visitor.deviceClearedAt);
    await loads(chat.id);
    chat.socket.close();
  });

  test("an AI chat with a medical (flagged) reply with page links, and a model failure fallback", async () => {
    lc.ai.queue.push({
      ok: true, reply: "Sorry you're dealing with leg pain. I can't give medical advice, but a licensed Humancare Connect doctor can help you.",
      handoff: false, handoffReason: "none", offTopic: false, topic: "medical", links: [{ title: "Joint Pain", url: "/joint-pain" }],
      language: { code: "en", name: "English" }, usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 },
    });
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "pain in my legs" });
    lc.ai.queue.push({ ok: false, kind: "api_error" });
    await lc.call(chat.socket, "chat:message", { text: "and my knee" });
    const body = await loads(chat.id);
    assert.ok(body.panel.info.safety, "flagged for the AI Review page");
    chat.socket.close();
  });

  test("a failing optional lookup (page timeline, other chats) never stops the chat from opening; it is logged by name", async () => {
    const chat = await openChat();
    const { LcPageVisit } = lc.models;
    const original = LcPageVisit.find;
    const logged = [];
    const originalError = console.error;
    LcPageVisit.find = () => {
      throw new Error("boom");
    };
    console.error = (...args) => logged.push(args.join(" "));
    try {
      const body = await loads(chat.id);
      assert.deepEqual(body.panel.timeline || [], []);
    } finally {
      LcPageVisit.find = original;
      console.error = originalError;
    }
    assert.ok(logged.some((l) => l.includes("chat detail: page timeline failed")), logged.join("|"));
    chat.socket.close();
  });

  test("the visitor panel of a visitor with several chats (reopened, ended, new)", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:end", { clear: false });
    await lc.call(chat.socket, "chat:message", { text: "again" }); // reopens the same thread
    const second = await lc.call(chat.socket, "chat:end", { clear: false });
    assert.equal(second.ok, true);
    const body = await loads(chat.id);
    assert.ok(body.panel.counts.chats >= 1);
    chat.socket.close();
  });
});
