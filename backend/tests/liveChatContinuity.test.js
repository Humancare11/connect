const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, AGENT_A } = require("./helpers/liveChatServer");
const { createChatService } = require("../services/liveChat/chatService");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");

// A conversation never ends because the patient left (tab hidden, phone locked, socket dropped, backend restarted).
// The same device returns to the same thread with its history; X > "End chat" closes it (optionally clearing the
// device); the device shows a chat for at most 30 days after its last message.
describe("live chat: chats never auto-end, returning patients continue the same thread", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.emails.length = 0;
  });

  const DAY = 86_400_000;
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const texts = (conversation) => conversation.messages.map((m) => m.text);
  async function openChat(extra = {}) {
    const contact = await lc.submitContact({ name: "Dana Reed", ...extra });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, visitorId: contact.visitorId, id: started.conversation.conversationId };
  }
  const freshService = () =>
    createChatService({
      models: lc.models,
      loadSettings: async () => (await lc.models.LcSettings.getSettings()).toObject(),
      ai: lc.ai,
      limits: lc.livechat.limits,
      presence: lc.livechat.presence,
      agents: lc.livechat.agents,
      followUp: lc.livechat.followUp,
    });

  test("a disconnect (hidden tab, locked phone, dropped socket) does not close the chat", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "hello there" });
    chat.socket.close();
    await sleep(900); // several grace periods in this test server
    await lc.livechat.chat.runAbandonedSweep();
    const conv = await convOf(chat.id);
    assert.deepEqual([conv.mode, conv.closedReason, conv.leftAt, conv.leaveDueAt], ["ai", "", null, null]);
  });

  test("a backend restart does not close chats (a fresh service on the same database)", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "before the restart" });
    chat.socket.close();
    const fresh = freshService();
    const out = await fresh.runAbandonedSweep();
    await fresh.runAbandonedSweep();
    assert.equal(out.left, 0);
    assert.equal((await convOf(chat.id)).mode, "ai");

    const back = await lc.chatSocket(chat.token);
    const state = await stateOf(back);
    assert.equal(state.conversationId, chat.id);
    assert.ok(texts(state).includes("before the restart"));
    back.close();
  });

  test("return after the chat was archived: the same thread with its history; writing reopens it and it is active again", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "my question" });
    await lc.models.LcConversation.updateOne(
      { conversationId: chat.id },
      { $set: { mode: "archived", closedReason: "inactive", modeBeforeLeft: "ai", closedAt: new Date(Date.now() - 5 * DAY), lastMessageAt: new Date(Date.now() - 5 * DAY) } }
    );
    chat.socket.close();

    const back = await lc.chatSocket(chat.token);
    const shown = await stateOf(back);
    assert.deepEqual([shown.conversationId, shown.mode, shown.canContinue], [chat.id, "archived", true]);
    assert.ok(texts(shown).includes("my question"), "the history is there");

    const sent = await lc.call(back, "chat:message", { text: "I am back" });
    assert.equal(sent.ok, true);
    const conv = await convOf(chat.id);
    assert.deepEqual([conv.mode, conv.closedReason, conv.closedAt], ["ai", "", null]);
    const row = (await lc.rest("GET", "/conversations?view=ai", { user: AGENT_A })).body.conversations.find((c) => c.conversationId === chat.id);
    assert.equal(row?.mode, "ai", "back in the admin active list");
    const after = await stateOf(back);
    assert.equal(after.conversationId, chat.id);
    assert.ok(texts(after).includes("my question") && texts(after).includes("I am back"));
    back.close();
  });

  test("X > End chat: the chat is closed as patient_ended, stays readable, and the next visit continues the same thread", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "please help" });
    const res = await lc.call(chat.socket, "chat:end", { clear: false });
    assert.equal(res.ok, true);
    const conv = await convOf(chat.id);
    assert.deepEqual([conv.mode, conv.closedReason], ["archived", "patient_ended"]);
    assert.ok(conv.closedAt);
    const internal = await lc.models.LcMessage.find({ conversationId: chat.id, internal: true }).lean();
    assert.ok(internal.some((m) => decryptLiveChatText(m.text) === "Patient ended the chat"));
    chat.socket.close();

    const back = await lc.chatSocket(chat.token);
    const shown = await stateOf(back);
    assert.deepEqual([shown.conversationId, shown.mode, shown.canContinue, shown.closedReason], [chat.id, "archived", true, "patient_ended"]);
    assert.ok(texts(shown).includes("please help"));
    assert.equal((await lc.call(back, "chat:message", { text: "one more question" })).ok, true);
    assert.equal((await convOf(chat.id)).mode, "ai");
    back.close();
  });

  test("X > End chat with 'clear': the server stops showing the chat to this device", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "private question" });
    assert.equal((await lc.call(chat.socket, "chat:end", { clear: true })).ok, true);
    assert.equal((await convOf(chat.id)).closedReason, "patient_ended");
    chat.socket.close();

    const back = await lc.chatSocket(chat.token);
    assert.equal(await stateOf(back), null, "nothing older than the clear is shown");
    const fresh = await lc.call(back, "chat:start", {});
    assert.notEqual(fresh.conversation.conversationId, chat.id);
    assert.ok(!texts(fresh.conversation).includes("private question"));
    assert.equal((await convOf(chat.id)).mode, "archived", "the record is kept (retention is unchanged)");
    back.close();
  });

  test("the device shows a chat for at most 30 days after its last message", async () => {
    const chat = await openChat();
    await lc.call(chat.socket, "chat:message", { text: "a month ago" });
    chat.socket.close();
    await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { lastMessageAt: new Date(Date.now() - 29 * DAY) } });
    let back = await lc.chatSocket(chat.token);
    assert.equal((await stateOf(back)).conversationId, chat.id, "29 days: still shown");
    back.close();

    await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { lastMessageAt: new Date(Date.now() - 31 * DAY) } });
    back = await lc.chatSocket(chat.token);
    assert.equal(await stateOf(back), null, "31 days: the next visit starts fresh");
    const fresh = await lc.call(back, "chat:start", {});
    assert.notEqual(fresh.conversation.conversationId, chat.id);
    const old = await convOf(chat.id);
    assert.ok(old, "the server data is unchanged");
    back.close();
  });

  test("a blocked chat is not resurrected, and the patient never gets 'This chat has ended'", async () => {
    const chat = await openChat();
    await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { mode: "archived", closedReason: "blocked", closedAt: new Date() } });
    const res = await lc.call(chat.socket, "chat:message", { text: "hi" });
    assert.equal(res.ok, false);
    assert.doesNotMatch(JSON.stringify(res), /has ended/i);
    assert.equal((await convOf(chat.id)).mode, "archived");
    chat.socket.close();
  });
});
