// The follow-up step: every hand-over says "Connecting you to our team"; if no admin replies within the follow-up
// time the patient is told an email follows and ONE generic email goes out (once per chat). The due time is stored on
// the conversation and a job looks for due chats, so it works after the patient leaves and after a restart.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");
const { createChatService } = require("../services/liveChat/chatService");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");

const CONNECTING = /^Thanks, .+! Connecting you to our team now\. You can keep typing your question here\.$/;
const aiHandoff = (reason) => ({
  ok: true, reply: "A person will help.", handoff: true, handoffReason: reason, offTopic: false, topic: "other",
  usage: { inputTokens: 500, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 },
});

async function waitFor(fn, ms = 4000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

describe("live chat: the email follow-up for chats waiting in the Queue", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { followUpJobMs: 100, graceMs: 250 }, // the job looks every 0.1 s here (15 s in production)
    });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
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
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const texts = (state) => state.messages.map((m) => m.text);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  async function openChat(extra = {}) {
    const contact = await lc.submitContact(extra);
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation.conversationId };
  }
  // Lets the follow-up time of a Queue chat pass (the stored due time moves into the past).
  const makeDue = (id) =>
    lc.models.LcConversation.updateOne({ conversationId: id, followUpNoticeAt: null }, { $set: { followUpDueAt: new Date(Date.now() - 1000) } });
  const noticeOf = (email) => `Our team will connect with you by email at ${email} shortly.`;

  describe("the hand-over message", () => {
    test("always 'Connecting', through the header button, a quick option and an AI hand-over, with or without an agent at their desk", async () => {
      for (const withAgent of [false, true]) {
        const agent = withAgent ? await lc.onlineAgent() : null;

        const button = await openChat();
        await lc.call(button.socket, "chat:agent");
        assert.match(texts(await stateOf(button.socket)).at(-1), CONNECTING);

        const option = await openChat();
        await lc.call(option.socket, "chat:option", { key: "live" });
        assert.match(texts(await stateOf(option.socket)).at(-1), CONNECTING);

        const viaAi = await openChat();
        lc.ai.queue.push(aiHandoff("account_issue"));
        await lc.call(viaAi.socket, "chat:message", { text: "my payment failed" });
        assert.match(texts(await stateOf(viaAi.socket)).at(-1), CONNECTING);

        for (const chat of [button, option, viaAi]) {
          const c = await convOf(chat.id);
          assert.deepEqual([c.mode, c.offlineRequested], ["queue", false]);
          assert.ok(c.followUpDueAt, "the follow-up time is stored");
          chat.socket.close();
        }
        agent?.close();
      }
    });

    test("the follow-up time is queuedAt + the setting (default 1 minute)", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:agent");
      const c = await convOf(chat.id);
      assert.equal(Math.round((c.followUpDueAt - c.queuedAt) / 1000), 60);
      chat.socket.close();
    });
  });

  describe("after the follow-up time with no admin reply", () => {
    test("the patient is told an email follows, the chat is labelled and ONE generic email goes out; it stays in the Queue", async () => {
      const chat = await openChat({ name: "Priya Raman", email: "priya@example.com" });
      await lc.call(chat.socket, "chat:agent");
      await sleep(300);
      assert.equal(lc.emails.length, 0, "nothing before the follow-up time");
      assert.equal((await stateOf(chat.socket)).emailFollowUp, false);

      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1), "the job sends the email");
      const state = await stateOf(chat.socket);
      assert.equal(texts(state).at(-1), noticeOf("priya@example.com"));
      assert.deepEqual([state.mode, state.emailFollowUp], ["queue", true]);

      const mail = lc.emails[0];
      assert.equal(mail.to, "priya@example.com");
      assert.equal(mail.subject, "We received your message – Humancare Connect");
      assert.ok(mail.body.includes(`reference ${chat.id}`));
      const c = await convOf(chat.id);
      assert.equal(c.followUp.status, "sent");
      assert.deepEqual([c.mode, c.offlineRequested], ["queue", true]);
      assert.equal(c.followUpDueAt, null);

      // the admin sees the label, and can still take the chat
      const row = (await rest("GET", "/conversations?view=live")).body.conversations.find((r) => r.conversationId === chat.id);
      assert.deepEqual([row.mode, row.emailFollowUp, row.emailStatus], ["queue", true, "sent"]);

      // once per chat: running the job again, or the patient asking again, sends nothing more
      await makeDue(chat.id);
      await lc.livechat.chat.runFollowUpDue();
      await lc.call(chat.socket, "chat:message", { text: "hello?" });
      await sleep(400);
      assert.equal(lc.emails.length, 1);
      assert.equal(texts(await stateOf(chat.socket)).filter((t) => t === noticeOf("priya@example.com")).length, 1);
      chat.socket.close();
    });

    test("an admin can still join afterwards; the patient sees who joined", async () => {
      const chat = await openChat({ email: "late@example.com" });
      await lc.call(chat.socket, "chat:agent");
      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1));
      assert.equal((await rest("POST", `/conversations/${chat.id}/takeover`, A)).status, 200);
      const state = await stateOf(chat.socket);
      assert.deepEqual([state.mode, state.agent?.name], ["live", "Sam"]);
      assert.ok(texts(state).includes("Sam joined the chat"));
      chat.socket.close();
    });

    test("the email contains NO health details: no message text, topic, option label, file name or reason", async () => {
      const chat = await openChat({ name: "Priya Raman", email: "priya2@example.com" });
      await lc.call(chat.socket, "chat:option", { key: "sick_notes" });
      lc.ai.queue.push(aiHandoff("technical_issue"));
      await lc.call(chat.socket, "chat:message", { text: "Persistent migraine and I take sumatriptan, the video call will not start" });
      assert.equal((await convOf(chat.id)).mode, "queue");
      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1));
      const body = `${lc.emails[0].subject}\n${lc.emails[0].body}`.toLowerCase();
      for (const forbidden of ["migraine", "sumatriptan", "sick note", "prescription", "consultation", "second opinion", "medical advice", "refill", "topic", "video call", "technical", "technical_issue", "support hours", "offline"]) {
        assert.equal(body.includes(forbidden), false, forbidden);
      }
      assert.doesNotMatch(body, /\d{1,2}:\d{2}/, "no opening hours");
      assert.ok(body.includes("don't include medical details"));
      chat.socket.close();
    });
  });

  describe("it is cancelled", () => {
    test("when an admin replies first (the reply takes the chat over)", async () => {
      const chat = await openChat({ email: "replied@example.com" });
      await lc.call(chat.socket, "chat:agent");
      const res = await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi, Sam here" } });
      assert.equal(res.status, 200);
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.followUpDueAt, c.followUpNoticeAt], ["live", null, null]);
      await makeDue(chat.id); // no effect: the chat is not in the Queue
      await sleep(500);
      assert.equal(lc.emails.length, 0);
      assert.equal(texts(await stateOf(chat.socket)).includes(noticeOf("replied@example.com")), false);
      chat.socket.close();
    });

    test("when an admin takes the chat over", async () => {
      const chat = await openChat({ email: "taken@example.com" });
      await lc.call(chat.socket, "chat:agent");
      assert.equal((await rest("POST", `/conversations/${chat.id}/takeover`, A)).status, 200);
      assert.equal((await convOf(chat.id)).followUpDueAt, null);
      await makeDue(chat.id);
      await sleep(500);
      assert.equal(lc.emails.length, 0);
      assert.ok(texts(await stateOf(chat.socket)).includes("Sam joined the chat"), "the patient sees someone is there");
      chat.socket.close();
    });

    test("when the patient switches back to the AI; asking for a person again starts the step again", async () => {
      const chat = await openChat({ email: "ai@example.com" });
      await lc.call(chat.socket, "chat:agent");
      const switched = await lc.call(chat.socket, "chat:switch-ai");
      assert.equal(switched.ok, true);
      assert.equal((await convOf(chat.id)).followUpDueAt, null);
      await sleep(400);
      assert.equal(lc.emails.length, 0);

      await lc.call(chat.socket, "chat:agent");
      const again = await convOf(chat.id);
      assert.equal(again.mode, "queue");
      assert.ok(again.followUpDueAt, "a new follow-up time");
      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1));
      chat.socket.close();
    });

    test("a second Queue entry after the notice says only 'Connecting' and sends no second email", async () => {
      const chat = await openChat({ email: "twice@example.com" });
      await lc.call(chat.socket, "chat:agent");
      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1));
      assert.equal((await lc.call(chat.socket, "chat:switch-ai")).ok, true);
      await lc.call(chat.socket, "chat:agent");
      const state = await stateOf(chat.socket);
      assert.match(texts(state).at(-1), CONNECTING);
      const c = await convOf(chat.id);
      assert.equal(c.followUpDueAt, null, "no new follow-up: the notice and email were given for this chat");
      await sleep(400);
      assert.equal(lc.emails.length, 1);
      chat.socket.close();
    });
  });

  describe("it does not depend on the patient or the process", () => {
    test("it still fires after the patient closes the tab, and the chat stays in the Queue", async () => {
      const chat = await openChat({ email: "gone@example.com" });
      await lc.call(chat.socket, "chat:agent");
      chat.socket.close();
      await sleep(700); // longer than the 0.25 s "visitor left" grace period
      assert.equal((await convOf(chat.id)).mode, "queue", "not archived as 'patient left'");

      await makeDue(chat.id);
      assert.ok(await waitFor(() => lc.emails.length === 1), "the email goes out although nobody is on the site");
      assert.equal(lc.emails[0].to, "gone@example.com");
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.offlineRequested, c.followUp.status], ["queue", true, "sent"]);
      await sleep(700);
      assert.equal((await convOf(chat.id)).mode, "queue", "still waiting for an agent afterwards");
    });

    test("it survives a restart: the due time is in the database and a fresh service picks it up", async () => {
      const chat = await openChat({ email: "restart@example.com" });
      await lc.call(chat.socket, "chat:agent");
      chat.socket.close();
      await sleep(400);
      // The "old process" had a timer that never fired; a new process starts with nothing but the database.
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { followUpDueAt: new Date(Date.now() - 5 * 60_000) } });
      const fresh = createChatService({
        models: lc.models,
        loadSettings: async () => (await lc.models.LcSettings.getSettings()).toObject(),
        ai: lc.ai,
        limits: lc.livechat.limits,
        presence: lc.livechat.presence,
        agents: lc.livechat.agents,
        followUp: lc.livechat.followUp,
      });
      assert.ok((await fresh.runFollowUpDue()) >= 0);
      assert.ok(await waitFor(() => lc.emails.length === 1));
      const c = await convOf(chat.id);
      assert.equal(c.followUp.status, "sent");
      const messages = await lc.models.LcMessage.find({ conversationId: chat.id, sender: "ai" }).lean();
      assert.ok(messages.some((m) => decryptLiveChatText(m.text) === noticeOf("restart@example.com")));
      fresh.shutdown();
    });

    test("the stored due time moves with the 'minutes' setting", async () => {
      await lc.models.LcSettings.updateOne({ key: "default" }, { $set: { followUpMinutes: 7 } });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:agent");
      const c = await convOf(chat.id);
      assert.equal(Math.round((c.followUpDueAt - c.queuedAt) / 60000), 7);
      await lc.models.LcSettings.updateOne({ key: "default" }, { $set: { followUpMinutes: 1 } });
      chat.socket.close();
    });
  });
});
