// The midnight (India time) cleanup and Archive temp as "archived today (IST)".
//   - Archive temp lists only chats archived since IST midnight.
//   - The sweep archives, as "inactive", chats with no message today that are not active: AI-mode chats whose patient
//     is not connected, and admin-held chats whose last visible message is from an admin or the AI. It keeps the
//     Queue, chats with a connected patient, and admin-held chats where the patient wrote last.
//   - Idempotent, and it catches up after downtime (the day is recorded when a sweep completes).
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startChatServer, AGENT_A } = require("./helpers/liveChatServer");
const { encryptLiveChatText, decryptLiveChatText } = require("../utils/liveChat/crypto");
const { istDayKey, istDayStart, istTodayStart } = require("../services/liveChat/istDay");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ID_CHARS = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const newId = () => "HC" + Array.from({ length: 8 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join("");

describe("IST day helpers", () => {
  test("the IST day starts at 18:30 UTC the evening before", () => {
    assert.equal(istDayKey(Date.parse("2026-10-14T18:29:59Z")), "2026-10-14");
    assert.equal(istDayKey(Date.parse("2026-10-14T18:30:00Z")), "2026-10-15");
    assert.equal(istDayStart("2026-10-15").toISOString(), "2026-10-14T18:30:00.000Z");
    assert.equal(istTodayStart(Date.parse("2026-10-15T03:00:00Z")).toISOString(), "2026-10-14T18:30:00.000Z");
  });
});

describe("live chat: IST midnight cleanup", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      // the background job must not sweep during these tests; they call runDailySweep themselves
      mount: { followUpJobMs: 3_600_000, graceMs: 600_000, dailySweepStartDelayMs: 3_600_000 },
    });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    await lc.models.LcSettings.updateOne({ key: "default" }, { $set: { lastDailySweepDay: "" } });
  });

  const A = { user: AGENT_A };
  const rest = (...args) => lc.rest(...args);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const todayStart = () => istTodayStart(Date.now());
  const yesterday = () => new Date(todayStart().getTime() - 2 * HOUR); // 22:00 IST the evening before

  // A chat created directly (no socket, so nobody is "connected"), with its last visible message.
  async function seed({ mode = "ai", last = "ai", lastAt = yesterday(), everLive = false, assigned = false, closedAt = null } = {}) {
    const id = newId();
    await lc.models.LcConversation.create({
      conversationId: id,
      visitorId: `v${crypto.randomBytes(12).toString("hex")}`,
      mode,
      everLive: everLive || mode === "live" || mode === "queue",
      assigneeId: assigned ? AGENT_A : null,
      agentName: assigned ? "Sam" : "",
      lastMessageAt: lastAt,
      startedAt: new Date(lastAt.getTime() - 10 * 60_000),
      closedAt,
      ...(closedAt ? { closedReason: "resolved" } : {}),
    });
    await lc.models.LcMessage.create({ conversationId: id, sender: last, text: encryptLiveChatText("hello"), createdAt: lastAt });
    return id;
  }

  describe("Archive temp is 'archived today (IST)'", () => {
    test("a chat archived just after IST midnight is listed, one archived just before is not; both stay on the Archive page", async () => {
      const start = todayStart().getTime();
      const today = await seed({ mode: "archived", closedAt: new Date(start + 1000), lastAt: new Date(start + 1000) });
      const before = await seed({ mode: "archived", closedAt: new Date(start - 1000), lastAt: new Date(start - 1000) });
      const ids = (await rest("GET", "/conversations?view=ai", A)).body.conversations.map((c) => c.conversationId);
      assert.ok(ids.includes(today), "archived today");
      assert.ok(!ids.includes(before), "archived before IST midnight: Archive page only");
      const all = (await rest("GET", "/archive?from=2000-01-01", A)).body.rows.map((r) => r.conversationId);
      assert.ok(all.includes(today) && all.includes(before));
    });
  });

  describe("the sweep", () => {
    test("archives non-active AI and admin-held chats as inactive; keeps Queue, connected-patient and patient-waiting chats", async () => {
      const aiChat = await seed({ mode: "ai", last: "ai" });
      const backWithAi = await seed({ mode: "ai", last: "agent", everLive: true });
      const liveAnswered = await seed({ mode: "live", last: "agent", assigned: true });
      const liveAiLast = await seed({ mode: "live", last: "ai", assigned: true });
      const livePatientWaiting = await seed({ mode: "live", last: "patient", assigned: true });
      const queued = await seed({ mode: "queue", last: "patient" });
      const queuedAnswered = await seed({ mode: "queue", last: "ai" });
      const activeToday = await seed({ mode: "ai", last: "ai", lastAt: new Date(todayStart().getTime() + 60_000) });

      // a chat whose patient is connected right now
      const contact = await lc.submitContact({ name: "Here Now" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const connected = started.conversation.conversationId;
      await lc.models.LcConversation.updateOne({ conversationId: connected }, { $set: { lastMessageAt: yesterday() } });

      const result = await lc.livechat.chat.runDailySweep();
      assert.equal(result.skipped, false);

      for (const id of [aiChat, backWithAi, liveAnswered, liveAiLast]) {
        const c = await convOf(id);
        assert.equal(c.mode, "archived", id);
        assert.equal(c.closedReason, "inactive");
        assert.ok(c.closedAt >= todayStart(), "closed now, so the 24 h reopen window starts now");
        assert.ok(["ai", "live"].includes(c.modeBeforeLeft));
        const lines = (await lc.models.LcMessage.find({ conversationId: id, sender: "system" }).lean()).map((m) => decryptLiveChatText(m.text));
        assert.equal(lines.length, 1);
      }
      assert.equal((await convOf(livePatientWaiting)).mode, "live", "the patient wrote last: stays");
      assert.equal((await convOf(queued)).mode, "queue");
      assert.equal((await convOf(queuedAnswered)).mode, "queue", "the Queue is never swept");
      assert.equal((await convOf(activeToday)).mode, "ai", "a message today keeps it");
      assert.equal((await convOf(connected)).mode, "ai", "the patient is connected: kept");
      socket.close();

      // the swept chats are in Archive temp today and on the Archive page
      const ids = (await rest("GET", "/conversations?view=ai", A)).body.conversations.filter((c) => c.mode === "archived").map((c) => c.conversationId);
      assert.ok(ids.includes(aiChat));
    });

    test("idempotent: a second run the same day does nothing; running it forced changes nothing more", async () => {
      const id = await seed({ mode: "ai", last: "ai" });
      const first = await lc.livechat.chat.runDailySweep();
      assert.equal(first.archived >= 1, true);
      const after = await convOf(id);
      const second = await lc.livechat.chat.runDailySweep();
      assert.equal(second.skipped, true);
      const forced = await lc.livechat.chat.runDailySweep({ force: true });
      assert.equal(forced.archived, 0, "already archived");
      const again = await convOf(id);
      assert.equal(String(again.closedAt), String(after.closedAt));
      assert.equal(await lc.models.LcMessage.countDocuments({ conversationId: id, sender: "system" }), 1, "one closing line");
    });

    test("catches up after downtime: yesterday was the last sweep, today's first run archives what is stale", async () => {
      const yesterdayKey = istDayKey(Date.now() - DAY);
      await lc.models.LcSettings.updateOne({ key: "default" }, { $set: { lastDailySweepDay: yesterdayKey } });
      const stale = await seed({ mode: "ai", last: "ai", lastAt: new Date(todayStart().getTime() - 20 * HOUR) });
      const result = await lc.livechat.chat.runDailySweep();
      assert.equal(result.skipped, false);
      assert.equal((await convOf(stale)).mode, "archived");
      const doc = await lc.models.LcSettings.findOne({ key: "default" }).lean();
      assert.equal(doc.lastDailySweepDay, istDayKey(Date.now()));
    });

    test("a swept chat reopens when the patient writes within 24 hours", async () => {
      const contact = await lc.submitContact({ name: "Comes Back" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const id = started.conversation.conversationId;
      await lc.call(socket, "chat:message", { text: "How much is a consultation?" });
      socket.close();
      // simulate: nobody connected, last message yesterday
      await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { lastMessageAt: yesterday() } });
      await lc.models.LcMessage.updateMany({ conversationId: id }, { $set: { createdAt: yesterday() } });
      lc.livechat.chat.shutdown(); // drops the grace timers and connection counts: the patient is gone
      lc.livechat.presence.visitors.delete(contact.visitorId);
      await lc.livechat.chat.runDailySweep();
      const swept = await convOf(id);
      assert.equal(swept.mode, "archived");
      assert.equal(swept.closedReason, "inactive");

      const again = await lc.chatSocket(contact.token);
      const reply = await lc.call(again, "chat:message", { text: "Are you still there?" });
      assert.notEqual(reply?.ok, false, JSON.stringify(reply));
      const back = await convOf(id);
      assert.notEqual(back.mode, "archived", "the same chat continues");
      again.close();
    });
  });
});
