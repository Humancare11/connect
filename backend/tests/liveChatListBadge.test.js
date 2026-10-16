const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A } = require("./helpers/liveChatServer");

// The AI chats badge (unread) and the AI chats list must agree: a brand-new AI chat with fresh messages is in the list
// (Active) whenever it is counted in the badge.
describe("live chat: AI chats badge and list agree", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  const A = { user: AGENT_A };
  const list = async () => (await lc.rest("GET", "/conversations?view=ai", A)).body.conversations;
  const badge = async () => (await lc.rest("GET", "/unread", A)).body;

  test("a new AI chat with a patient message and an AI reply is listed as active and counted", async () => {
    const before = await badge();
    const contact = await lc.submitContact({ name: "Satish" });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: "How much is a consultation?" });
    const rows = await list();
    const row = rows.find((c) => c.conversationId === id);
    assert.ok(row, "listed");
    assert.equal(row.bucket, "active");
    assert.ok(row.unread >= 1);
    const stored = await lc.models.LcConversation.findOne({ conversationId: id }).lean();
    assert.ok(stored.lastActivityAt, "lastActivityAt set by the first messages");
    const now = await badge();
    assert.equal(now.ai - before.ai, rows.filter((c) => c.unread > 0 && c.conversationId === id).reduce((n, c) => n + c.unread, 0));
    socket.close();
  });

  test("every chat the badge counts is in the list (an unread chat of yesterday is not hidden)", async () => {
    const contact = await lc.submitContact({ name: "Old Chat" });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: "hello" });
    const old = new Date(Date.now() - 3 * 86_400_000);
    await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { lastMessageAt: old, lastActivityAt: old } });
    const counted = (await badge()).ai;
    const listed = (await list()).reduce((n, c) => n + (c.unread || 0), 0);
    assert.equal(listed, counted, "badge and list count the same unread messages");
    socket.close();
  });
});
