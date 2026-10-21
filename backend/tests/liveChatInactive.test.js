// Auto-archive of inactive chats: when the last message is from the AI or an admin and the patient sends nothing for
// the configured time, the chat moves to Archived as "Inactive" (AI chats and live agent chats). The due time is stored
// on the conversation and the existing job looks for due chats. Chats in the Queue and chats where the patient spoke
// last are never closed this way. When the patient writes again, the same conversation reopens.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, FILES, AGENT_A, SUPER_S } = require("./helpers/liveChatServer");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");

const CLOSED_LINE = "No new messages for a while. You can keep writing here any time and we'll continue.";

async function waitFor(fn, ms = 4000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

describe("live chat: inactive chats are archived", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_MAX_FILES_PER_CHAT: "3" },
      mount: { followUpJobMs: 100, graceMs: 60_000 }, // the job looks every 0.1 s; nobody "leaves" during a test
    });
    lc.agentNames[AGENT_A] = "Sam";
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.emails.length = 0;
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const SUPER = { user: SUPER_S, role: "superadmin" };
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const texts = (state) => state.messages.map((m) => m.text);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  async function openChat() {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation.conversationId };
  }
  // The patient wrote and the AI answered: the chat now waits on the patient.
  async function aiAnswered(chat, text = "How much is a consultation?") {
    await lc.call(chat.socket, "chat:message", { text });
    assert.ok(await waitFor(async () => (await stateOf(chat.socket)).messages.at(-1).sender === "ai"));
  }
  // Lets the stored due time pass.
  const makeDue = (id) => lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { inactiveDueAt: new Date(Date.now() - 1000) } });
  const minutesAhead = (date) => (date.getTime() - Date.now()) / 60_000;

  describe("archived after the patient is silent", () => {
    test("after an AI reply: due in 10 minutes, then Inactive with the patient-visible line", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      const c = await convOf(chat.id);
      assert.ok(c.inactiveDueAt, "the due time is stored on the chat");
      assert.ok(Math.abs(minutesAhead(c.inactiveDueAt) - 10) < 0.5, "default 10 minutes");
      assert.equal(c.mode, "ai");

      await makeDue(chat.id);
      const closed = await waitFor(async () => (await convOf(chat.id)).mode === "archived");
      assert.ok(closed, "the job archives it");
      const after = await convOf(chat.id);
      assert.deepEqual([after.closedReason, after.inactiveDueAt, after.modeBeforeLeft], ["inactive", null, "ai"]);
      assert.ok(after.closedAt);

      const state = await stateOf(chat.socket);
      assert.equal(texts(state).at(-1), CLOSED_LINE);
      assert.deepEqual([state.mode, state.closedReason, state.canContinue, state.canRate], ["archived", "inactive", true, false]);

      // the admin list shows the reason, so the label is not mistaken for Resolved or Left
      const row = (await rest("GET", "/conversations?view=ai")).body.conversations.find((r) => r.conversationId === chat.id);
      assert.deepEqual([row.mode, row.closedReason], ["archived", "inactive"]);
      chat.socket.close();
    });

    test("after an admin reply in a live agent chat", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello" });
      assert.equal((await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi, this is Sam." } })).status, 200);
      const c = await convOf(chat.id);
      assert.equal(c.mode, "live");
      assert.ok(c.inactiveDueAt && Math.abs(minutesAhead(c.inactiveDueAt) - 10) < 0.5);

      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "archived"));
      const after = await convOf(chat.id);
      assert.deepEqual([after.closedReason, after.modeBeforeLeft, after.everLive], ["inactive", "live", true]);
      assert.equal(texts(await stateOf(chat.socket)).at(-1), CLOSED_LINE);
      chat.socket.close();
    });

    test("a chat where the patient never wrote (greeting only) is closed too", async () => {
      const chat = await openChat();
      const c = await convOf(chat.id);
      assert.ok(c.inactiveDueAt, "the greeting starts the timer");
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));
      chat.socket.close();
    });

    test("survives a restart: nothing in memory, a fresh sweep picks the due chat up", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { inactiveDueAt: new Date(Date.now() - 1000) } });
      const handled = await lc.livechat.chat.runInactiveDue();
      // the background job may have got there first; either way the chat is closed exactly once
      assert.ok(handled <= 1);
      assert.equal((await convOf(chat.id)).closedReason, "inactive");
      const lines = (await lc.models.LcMessage.find({ conversationId: chat.id, sender: "system" }).lean()).map((m) => decryptLiveChatText(m.text));
      assert.equal(lines.filter((t) => t === CLOSED_LINE).length, 1);
      chat.socket.close();
    });
  });

  describe("never archived", () => {
    test("a chat where the patient sent the last message", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      // the patient wrote again (AI turn not finished yet); a stale due time must not close the chat
      await lc.models.LcMessage.create({ conversationId: chat.id, sender: "patient", text: { cipherText: "", iv: "", tag: "" } });
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      await sleep(300);
      const c = await convOf(chat.id);
      assert.equal(c.mode, "ai");
      assert.equal(c.inactiveDueAt, null, "the check clears the stale timer");
      chat.socket.close();
    });

    test("internal notes do not start or move the timer", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      const before = (await convOf(chat.id)).inactiveDueAt;
      await sleep(30);
      assert.equal((await rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "internal" } })).status, 200);
      assert.equal((await convOf(chat.id)).inactiveDueAt.getTime(), before.getTime());
      chat.socket.close();
    });
  });

  describe("a new message resets or cancels the timer", () => {
    test("a patient message cancels it until the AI answers again, then it restarts", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { inactiveDueAt: new Date(Date.now() + 60_000) } }); // 1 min left
      await aiAnswered(chat, "and a refill?");
      const c = await convOf(chat.id);
      assert.ok(minutesAhead(c.inactiveDueAt) > 9, "restarted from the new AI reply");
      chat.socket.close();
    });

    test("an admin message restarts it", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello" });
      await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "one moment" } });
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { inactiveDueAt: new Date(Date.now() + 60_000) } });
      await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "still checking" } });
      assert.ok(minutesAhead((await convOf(chat.id)).inactiveDueAt) > 9);
      chat.socket.close();
    });
  });

  describe("an admin joining counts like an admin message", () => {
    test("take-over (button and first reply) restarts the timer; so does a Super Admin taking over", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      const old = new Date(Date.now() + 60_000); // 1 minute left on the AI's timer
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { inactiveDueAt: old } });
      assert.equal((await rest("POST", `/conversations/${chat.id}/takeover`, A)).status, 200);
      let c = await convOf(chat.id);
      assert.equal(c.mode, "live");
      assert.ok(Math.abs(minutesAhead(c.inactiveDueAt) - 10) < 0.5, "joined: a fresh 10 minutes");

      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { inactiveDueAt: old } });
      assert.equal((await rest("POST", `/conversations/${chat.id}/takeover`, SUPER)).status, 200);
      c = await convOf(chat.id);
      assert.ok(Math.abs(minutesAhead(c.inactiveDueAt) - 10) < 0.5, "a Super Admin taking over restarts it too");
      chat.socket.close();
    });
  });

  describe("the patient comes back", () => {
    test("writing reopens the same AI conversation and the AI answers", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));

      // reloading the page alone does not reopen it
      const reloaded = await stateOf(chat.socket);
      assert.equal(reloaded.mode, "archived");
      assert.equal((await convOf(chat.id)).mode, "archived");

      lc.ai.queue.push({
        ok: true, reply: "Welcome back, here to help.", handoff: false, handoffReason: "none", offTopic: false, topic: "pricing",
        usage: { inputTokens: 500, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 },
      });
      const sent = await lc.call(chat.socket, "chat:message", { text: "I'm back" });
      assert.equal(sent.ok, true, JSON.stringify(sent));
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.closedReason, c.closedAt, c.inactiveDueAt === null], ["ai", "", null, false], "same chat, timer running again");
      assert.equal(await lc.models.LcConversation.countDocuments({ visitorId: c.visitorId }), 1, "no second conversation");
      const state = await stateOf(chat.socket);
      assert.equal(state.conversationId, chat.id);
      assert.ok(texts(state).includes("I'm back"));
      assert.equal(texts(state).at(-1), "Welcome back, here to help.");
      chat.socket.close();
    });

    test("a chat that had an agent returns to the Queue (as 'patient left' does)", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello" });
      await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi" } });
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));
      assert.equal((await lc.call(chat.socket, "chat:message", { text: "are you there?" })).ok, true);
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.assigneeId], ["queue", null]);
      assert.ok(c.inactiveDueAt, "a chat back in the Queue gets a fresh Queue timer");
      chat.socket.close();
    });

    test("a file upload reopens it too", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));
      const res = await lc.upload(chat.token, { name: "scan.pdf", buffer: FILES.pdf, type: "application/octet-stream" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal((await convOf(chat.id)).mode, "ai");
      chat.socket.close();
    });

    test("a rejected file does not reopen it (wrong type, too large, over the per-chat limit)", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));

      const wrongType = await lc.upload(chat.token, { name: "run.exe", buffer: FILES.exe, type: "application/octet-stream" });
      assert.equal(wrongType.status, 400);
      const tooBig = await lc.upload(chat.token, { name: "huge.pdf", buffer: Buffer.concat([FILES.pdf, Buffer.alloc(11 * 1024 * 1024)]) });
      assert.ok([400, 413].includes(tooBig.status), `too large: ${tooBig.status}`);
      for (let i = 0; i < 3; i += 1) {
        await lc.models.LcFile.create({
          conversationId: chat.id, visitorId: (await convOf(chat.id)).visitorId, s3Key: `k/${i}`, name: { cipherText: "", iv: "", tag: "" }, mimeType: "application/pdf", size: 1,
        });
      }
      const overLimit = await lc.upload(chat.token, { name: "scan.pdf", buffer: FILES.pdf, type: "application/octet-stream" });
      assert.equal(overLimit.status, 409);

      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.closedReason], ["archived", "inactive"], "still closed after three rejected files");
      assert.equal((await stateOf(chat.socket)).canContinue, true);
      chat.socket.close();
    });

    test("after 30 days (the device window) it is no longer shown and the message is refused", async () => {
      const chat = await openChat();
      await aiAnswered(chat);
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));
      await new Promise((r) => setTimeout(r, 400)); // let any late AI line land first, so it cannot undo the back-dating
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { closedAt: new Date(Date.now() - 31 * 86_400_000), lastMessageAt: new Date(Date.now() - 31 * 86_400_000) } });
      assert.equal(await stateOf(chat.socket), null, "an old Inactive chat is no longer shown to the patient");
      const res = await lc.call(chat.socket, "chat:message", { text: "hi" });
      assert.deepEqual([res.ok, res.error], [false, "no_conversation"]);
      chat.socket.close();
    });
  });

  describe("the setting", () => {
    const save = (value, who = SUPER) => rest("PUT", "/settings", { ...who, body: { inactiveMinutes: value } });
    after(async () => {
      await save(10);
    });

    test("default 10, whole numbers 5 to 60 only, Super Admin only", async () => {
      assert.equal((await rest("GET", "/settings", SUPER)).body.settings.inactiveMinutes, 10);
      for (const bad of [4, 61, 0, -5, 7.5, "10", null]) {
        assert.equal((await save(bad)).status, 400, `rejects ${JSON.stringify(bad)}`);
      }
      for (const good of [5, 60, 20]) {
        const res = await save(good);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal((await rest("GET", "/settings", SUPER)).body.settings.inactiveMinutes, good);
      }
      assert.equal((await save(30, A)).status, 403, "an admin cannot change it");
      assert.equal((await rest("GET", "/settings", SUPER)).body.settings.inactiveMinutes, 20);
    });

    test("applies to timers set afterwards, and the closing line shows the minutes", async () => {
      assert.equal((await save(15)).status, 200);
      const chat = await openChat();
      await aiAnswered(chat);
      assert.ok(Math.abs(minutesAhead((await convOf(chat.id)).inactiveDueAt) - 15) < 0.5);
      await makeDue(chat.id);
      assert.ok(await waitFor(async () => (await convOf(chat.id)).closedReason === "inactive"));
      assert.equal(texts(await stateOf(chat.socket)).at(-1), "No new messages for a while. You can keep writing here any time and we'll continue.");
      chat.socket.close();
    });
  });
});
