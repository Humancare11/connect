// Queue chats and inactivity: a chat in the Queue with no admin reply for the inactivity minutes moves to Archive temp
// (closedReason "inactive", modeBeforeLeft "queue"), QUIETLY: the patient gets no closing line and keeps the normal
// composer. The email follow-up still fires first. An admin can join or reply from Archive temp (the chat becomes a
// live chat assigned to them); a patient message puts it back in the Queue. Midnight (IST) drops it from Archive temp.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startChatServer, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");
const { encryptLiveChatText, decryptLiveChatText } = require("../utils/liveChat/crypto");
const { istTodayStart } = require("../services/liveChat/istDay");

const MIN = 60_000;
const ID_CHARS = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const newId = () => "HC" + Array.from({ length: 8 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join("");

describe("live chat: Queue chats go to Archive temp after inactivity", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { followUpJobMs: 3_600_000, graceMs: 600_000, dailySweepStartDelayMs: 3_600_000 },
    });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
  });
  after(async () => {
    await lc.close();
  });

  const A = { user: AGENT_A };
  const B = { user: AGENT_B };
  const rest = (...args) => lc.rest(...args);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const makeDue = (id) => lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { inactiveDueAt: new Date(Date.now() - 1000) } });
  const systemLines = async (id) =>
    (await lc.models.LcMessage.find({ conversationId: id, sender: "system" }).lean()).map((m) => decryptLiveChatText(m.text));

  // A patient in the Queue. By default the 1-minute email follow-up has already fired (as it would have, long before
  // the 10-minute inactivity time); { followUp: false } leaves it pending.
  async function queued({ followUp = true, ...extra } = {}) {
    const contact = await lc.submitContact({ name: "Queue Patient", email: "queue.patient@example.com", ...extra });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:agent");
    if (followUp) {
      await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { followUpDueAt: new Date(Date.now() - 1000) } });
      await lc.livechat.chat.runFollowUpDue();
    }
    return { socket, id, token: contact.token, visitorId: contact.visitorId };
  }

  describe("the Queue timer", () => {
    test("entering the Queue starts it; patient messages do not extend it", async () => {
      const chat = await queued();
      const first = (await convOf(chat.id)).inactiveDueAt;
      assert.ok(first, "a timer exists");
      assert.ok(Math.abs(first.getTime() - Date.now() - 10 * MIN) < 15_000, "about 10 minutes (the setting)");
      await lc.call(chat.socket, "chat:message", { text: "hello? anyone there?" });
      const after = (await convOf(chat.id)).inactiveDueAt;
      assert.equal(String(after), String(first), "unchanged by the patient's message");
      chat.socket.close();
    });

    test("when due, the chat goes to Archive temp quietly: no closing line, the patient's view stays the Queue", async () => {
      const chat = await queued();
      const before = await systemLines(chat.id);
      await makeDue(chat.id);
      const handled = await lc.livechat.chat.runInactiveDue();
      assert.ok(handled >= 1);
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.closedReason, c.modeBeforeLeft], ["archived", "inactive", "queue"]);
      assert.deepEqual(await systemLines(chat.id), before, "no closing line was added");

      const state = await stateOf(chat.socket);
      assert.equal(state.mode, "queue", "the widget keeps the normal Queue view");
      assert.equal(state.canContinue, false);
      assert.equal(state.closedReason, "");

      // running again changes nothing
      assert.equal(await lc.livechat.chat.runInactiveDue(), 0);
      chat.socket.close();
    });

    test("the email follow-up still goes first; the chat is archived after it", async () => {
      const chat = await queued({ followUp: false });
      await makeDue(chat.id);
      assert.equal(await lc.livechat.chat.runInactiveDue(), 0, "follow-up still pending: not archived yet");
      assert.equal((await convOf(chat.id)).mode, "queue");

      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { followUpDueAt: new Date(Date.now() - 1000) } });
      await lc.livechat.chat.runFollowUpDue();
      await makeDue(chat.id); // the follow-up reset nothing: the inactivity time is still its own
      assert.equal(lc.emails.filter((m) => m.conversationId === chat.id || String(m.body).includes(chat.id)).length, 1, "one email");
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      assert.equal((await convOf(chat.id)).mode, "archived");
      chat.socket.close();
    });

    test("it is archived even while the patient is online", async () => {
      const chat = await queued(); // socket stays open
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      assert.equal((await convOf(chat.id)).mode, "archived");
      chat.socket.close();
    });
  });

  describe("Archive temp and joining", () => {
    test("it is listed in Archive temp today, and an admin joining makes it a live chat assigned to them", async () => {
      const chat = await queued();
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();

      const rows = (await rest("GET", "/conversations?view=live", A)).body.conversations;
      const row = rows.find((r) => r.conversationId === chat.id);
      assert.ok(row, "listed");
      assert.deepEqual([row.mode, row.joinable], ["archived", true]);

      const join = await rest("POST", `/conversations/${chat.id}/takeover`, { ...A });
      assert.equal(join.status, 200, JSON.stringify(join.body));
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, String(c.assigneeId), c.closedReason, c.closedAt, c.modeBeforeLeft], ["live", AGENT_A, "", null, ""]);
      assert.ok(c.inactiveDueAt, "the live timer");
      const state = await stateOf(chat.socket);
      assert.equal(state.mode, "live");
      chat.socket.close();
    });

    test("replying from Archive temp joins and sends", async () => {
      const chat = await queued();
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      const res = await rest("POST", `/conversations/${chat.id}/messages`, { ...B, body: { text: "Hello, how can I help?" } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, String(c.assigneeId)], ["live", AGENT_B]);
      chat.socket.close();
    });

    test("after IST midnight it is no longer in Archive temp and can no longer be joined from there", async () => {
      const chat = await queued();
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      await lc.models.LcConversation.updateOne(
        { conversationId: chat.id },
        { $set: { closedAt: new Date(istTodayStart(Date.now()).getTime() - 1000) } }
      );
      const rows = (await rest("GET", "/conversations?view=live", A)).body.conversations;
      assert.ok(!rows.some((r) => r.conversationId === chat.id), "gone from Archive temp");
      const archive = (await rest("GET", `/archive?q=${chat.id}`, A)).body.rows;
      assert.ok(archive.some((r) => r.conversationId === chat.id), "still on the Archive page");
      const join = await rest("POST", `/conversations/${chat.id}/takeover`, { ...A });
      assert.equal(join.status, 409);
      chat.socket.close();
    });
  });

  describe("the patient writes again", () => {
    test("within 24 hours the chat goes back to the Queue, with no 'welcome back' line and a fresh timer", async () => {
      const chat = await queued();
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      const before = await systemLines(chat.id);

      const sent = await lc.call(chat.socket, "chat:message", { text: "Is anyone coming?" });
      assert.equal(sent.ok, true, JSON.stringify(sent));
      const c = await convOf(chat.id);
      assert.deepEqual([c.mode, c.assigneeId], ["queue", null]);
      assert.ok(c.inactiveDueAt && c.inactiveDueAt > new Date());
      assert.deepEqual(await systemLines(chat.id), before, "no welcome-back line for a quiet archive");
      chat.socket.close();
    });

    test("after 24 hours it stays archived", async () => {
      const chat = await queued();
      await makeDue(chat.id);
      await lc.livechat.chat.runInactiveDue();
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { closedAt: new Date(Date.now() - 25 * 60 * MIN) } });
      await lc.call(chat.socket, "chat:message", { text: "hello again" }).catch(() => ({}));
      assert.equal((await convOf(chat.id)).mode, "archived");
      chat.socket.close();
    });
  });

  describe("catch-up and midnight", () => {
    async function seedQueue({ queuedAt, lastAt = queuedAt, inactiveDueAt = null } = {}) {
      const id = newId();
      await lc.models.LcConversation.create({
        conversationId: id,
        visitorId: `v${crypto.randomBytes(12).toString("hex")}`,
        mode: "queue",
        everLive: true,
        queuedAt,
        lastMessageAt: lastAt,
        startedAt: new Date(queuedAt.getTime() - MIN),
        inactiveDueAt,
      });
      await lc.models.LcMessage.create({ conversationId: id, sender: "patient", text: encryptLiveChatText("hello"), createdAt: lastAt });
      return id;
    }

    test("the catch-up archives a Queue chat that has waited past the minutes with no timer, quietly", async () => {
      const old = await seedQueue({ queuedAt: new Date(Date.now() - 30 * MIN) });
      const recent = await seedQueue({ queuedAt: new Date(Date.now() - 2 * MIN) });
      const out = await lc.livechat.chat.runAbandonedSweep();
      assert.ok(out.inactive >= 1);
      const c = await convOf(old);
      assert.deepEqual([c.mode, c.closedReason, c.modeBeforeLeft], ["archived", "inactive", "queue"]);
      assert.equal((await systemLines(old)).length, 0);
      assert.equal((await convOf(recent)).mode, "queue");
      assert.equal((await lc.livechat.chat.runAbandonedSweep()).inactive, 0, "idempotent");
    });

    test("the midnight sweep archives a Queue chat with no message today and nobody connected; keeps a connected patient", async () => {
      await lc.models.LcSettings.updateOne({ key: "default" }, { $set: { lastDailySweepDay: "" } });
      const start = istTodayStart(Date.now());
      const stale = await seedQueue({ queuedAt: new Date(start.getTime() - 3 * 60 * MIN), inactiveDueAt: new Date(Date.now() + 60 * MIN) });
      const chat = await queued();
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { lastMessageAt: new Date(start.getTime() - 60 * MIN) } });

      await lc.livechat.chat.runDailySweep();
      const c = await convOf(stale);
      assert.deepEqual([c.mode, c.closedReason, c.modeBeforeLeft], ["archived", "inactive", "queue"]);
      assert.equal((await systemLines(stale)).length, 0, "quiet");
      assert.equal((await convOf(chat.id)).mode, "queue", "connected patient: kept");
      chat.socket.close();
    });
  });
});
