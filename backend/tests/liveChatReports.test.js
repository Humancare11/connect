const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, sleep, AGENT_A, AGENT_B, SUPER_S } = require("./helpers/liveChatServer");
const { encryptLiveChatText } = require("../utils/liveChat/crypto");
const { dayKey } = require("../services/liveChat/limits");
const { zonedDayStart, addDays } = require("../services/liveChat/statsService");

const oid = (id) => new mongoose.Types.ObjectId(id);
const ZONE = "America/New_York";
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("live chat: Team and Reports", () => {
  let lc;
  let todayStart;
  let today;
  let seq = 0;

  const hourIn = (date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "2-digit", hourCycle: "h23" }).format(date));

  async function chat(over = {}) {
    seq += 1;
    return lc.models.LcConversation.create({
      conversationId: `HCTEST${String(seq).padStart(4, "0")}`,
      visitorId: `visitor-report-${seq}-0123456789`,
      mode: "archived",
      startedAt: new Date(todayStart.getTime() + 2 * HOUR),
      lastMessageAt: new Date(todayStart.getTime() + 2 * HOUR),
      ...over,
    });
  }

  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000" } });
    today = dayKey(new Date(), ZONE);
    todayStart = zonedDayStart(today, ZONE);
    await mongoose.connection.db.collection("users").insertMany([
      { _id: oid(AGENT_A), name: "Sam Carter", role: "admin", email: "sam@example.com" },
      { _id: oid(AGENT_B), name: "Maya Lopez", role: "admin", email: "maya@example.com" },
      { _id: oid(SUPER_S), name: "Super Admin", role: "superadmin", email: "super@example.com" },
      { _id: oid("64b000000000000000000f01"), name: "Disabled Dan", role: "admin", accountDisabled: true, email: "dan@example.com" },
      { _id: oid("64b000000000000000000f02"), name: "Doctor Dre", role: "doctor", email: "dre@example.com" },
    ]);
  });
  after(async () => {
    await lc.close();
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };

  describe("Team", () => {
    before(async () => {
      const at = (ms) => new Date(todayStart.getTime() + ms);
      // Sam: two chats that waited in the Queue (30 s and 90 s to the first reply), one open, one resolved
      await chat({ everLive: true, assigneeId: oid(AGENT_A), agentName: "Sam", mode: "live", queuedAt: at(HOUR), liveStartedAt: at(HOUR), firstAgentReplyAt: new Date(at(HOUR).getTime() + 30_000) });
      await chat({ everLive: true, assigneeId: oid(AGENT_A), agentName: "Sam", mode: "archived", closedReason: "resolved", queuedAt: at(2 * HOUR), liveStartedAt: at(2 * HOUR), firstAgentReplyAt: new Date(at(2 * HOUR).getTime() + 90_000) });
      await chat({ everLive: true, assigneeId: oid(AGENT_A), agentName: "Sam", mode: "live", liveStartedAt: at(3 * HOUR) }); // taken from the AI, never queued
      await chat({ everLive: true, assigneeId: oid(AGENT_B), agentName: "Maya", mode: "live", liveStartedAt: at(HOUR) });
      // a chat from three days ago does not count as "today"
      await chat({ everLive: true, assigneeId: oid(AGENT_A), mode: "archived", liveStartedAt: new Date(todayStart.getTime() - 3 * DAY), queuedAt: new Date(todayStart.getTime() - 3 * DAY), firstAgentReplyAt: new Date(todayStart.getTime() - 3 * DAY + 10 * MIN) });
      // AI chats: two open, one started today, one old
      await chat({ everLive: false, mode: "ai" });
      await chat({ everLive: false, mode: "ai" });
      // a reply from the AI 4 s after the patient's first message
      const aiChat = await chat({ everLive: false, mode: "ai" });
      const t0 = todayStart.getTime() + 2 * HOUR;
      await lc.models.LcMessage.insertMany([
        { conversationId: aiChat.conversationId, sender: "ai", text: encryptLiveChatText("greeting"), createdAt: new Date(t0 - 1000) },
        { conversationId: aiChat.conversationId, sender: "patient", text: encryptLiveChatText("hi"), createdAt: new Date(t0) },
        { conversationId: aiChat.conversationId, sender: "ai", text: encryptLiveChatText("hello"), createdAt: new Date(t0 + 4000) },
      ]);
    });

    test("every admin and superadmin with role, display name, status, open chats, chats today and average first reply", async () => {
      lc.identities["tok-a"] = { id: AGENT_A, role: "admin" };
      const sam = await lc.agent("tok-a");
      await sam.snapshotPromise;
      await lc.models.LcAgentProfile.create({ userId: oid(AGENT_B), displayName: "Maya L." });

      const { body } = await rest("GET", "/team", A);
      const by = Object.fromEntries(body.agents.map((a) => [a.name, a]));
      assert.deepEqual(Object.keys(by).sort(), ["Maya Lopez", "Sam Carter", "Super Admin"], "agents only: no patients, doctors or disabled accounts");

      assert.deepEqual(
        [by["Sam Carter"].role, by["Sam Carter"].displayName, by["Sam Carter"].openChats, by["Sam Carter"].chatsToday, by["Sam Carter"].avgFirstReplySeconds],
        ["Admin", "Sam", 2, 3, 60]
      );
      assert.deepEqual([by["Maya Lopez"].displayName, by["Maya Lopez"].openChats, by["Maya Lopez"].chatsToday, by["Maya Lopez"].avgFirstReplySeconds], ["Maya L.", 1, 1, null]);
      assert.deepEqual([by["Super Admin"].role, by["Super Admin"].openChats], ["Super admin", 0]);
      assert.equal("status" in by["Sam Carter"], false, "no online/offline status any more");
      sam.close();
    });

    test("the AI agent row", async () => {
      const { body } = await rest("GET", "/team", A);
      assert.equal(body.ai.name, "AI agent");
      assert.equal(body.ai.role, "Assistant (24/7)");
      assert.equal(body.ai.openChats, 3);
      assert.equal(body.ai.chatsToday, 3);
      assert.equal(body.ai.avgFirstReplySeconds, 4);
    });

    test("a chat of the day before does not count towards today", async () => {
      const { body } = await rest("GET", "/team", A);
      assert.equal(body.agents.find((a) => a.name === "Sam Carter").chatsToday, 3);
    });
  });

  describe("Reports", () => {
    before(async () => {
      // data for the report range: today. (The Team section above already created chats today; start from known totals.)
      await lc.models.LcConversation.deleteMany({});
      await lc.models.LcMessage.deleteMany({});
      const at = (ms) => new Date(todayStart.getTime() + ms);

      // 4 solved by the AI (2 rated 5 and 3), 2 with an agent (one rated 4), 1 patient-left AI chat
      await chat({ everLive: false, startedAt: at(10 * HOUR), rating: { stars: 5, ratedAt: at(11 * HOUR) } });
      await chat({ everLive: false, startedAt: at(10 * HOUR + 5 * MIN), rating: { stars: 3, ratedAt: at(11 * HOUR) } });
      await chat({ everLive: false, startedAt: at(14 * HOUR) });
      await chat({ everLive: false, startedAt: at(14 * HOUR + MIN), closedReason: "patient_left" });
      await chat({ everLive: true, startedAt: at(10 * HOUR + 10 * MIN), queuedAt: at(10 * HOUR + 10 * MIN), firstAgentReplyAt: at(10 * HOUR + 10 * MIN + 40_000), rating: { stars: 4, ratedAt: at(12 * HOUR) } });
      await chat({ everLive: true, startedAt: at(16 * HOUR), queuedAt: at(16 * HOUR), firstAgentReplyAt: at(16 * HOUR + 80_000) });
      // a chat from yesterday (outside "today")
      await chat({ everLive: false, startedAt: new Date(todayStart.getTime() - 5 * HOUR) });

      // AI usage: today and one other day of this month
      const monthFirst = `${today.slice(0, 7)}-01`;
      await lc.models.LcAiUsage.deleteMany({});
      await lc.models.LcAiUsage.create({ day: today, requests: 10, inputTokens: 1000, outputTokens: 200, costUsd: 0.5 });
      if (monthFirst !== today) await lc.models.LcAiUsage.create({ day: monthFirst, requests: 4, inputTokens: 400, outputTokens: 80, costUsd: 0.25 });
      await lc.models.LcAiUsage.create({ day: addDays(today, -100), requests: 1, inputTokens: 10, outputTokens: 1, costUsd: 9 });
    });

    test("chats, solved by AI, first reply time, rating", async () => {
      const { status, body } = await rest("GET", `/reports?from=${today}&to=${today}`, A);
      assert.equal(status, 200, JSON.stringify(body));
      assert.deepEqual([body.chats.total, body.chats.solvedByAi, body.chats.withAgent, body.chats.patientLeft], [6, 4, 2, 1]);
      assert.equal(body.chats.solvedByAiPercent, 66.7);
      assert.equal(body.chats.today, 6);
      assert.deepEqual([body.firstReply.agentAvgSeconds, body.firstReply.agentChats], [60, 2]);
      assert.deepEqual([body.rating.average, body.rating.count], [4, 3]);
      assert.deepEqual(body.rating.distribution.map((d) => d.count), [0, 0, 1, 1, 1]);
      assert.deepEqual(body.range, { from: today, to: today, timeZone: ZONE, today });
    });

    test("AI cost: today, this month, and the selected range", async () => {
      const { body } = await rest("GET", `/reports?from=${today}&to=${today}`, A);
      const monthFirst = `${today.slice(0, 7)}-01`;
      assert.equal(body.aiCost.todayUsd, 0.5);
      assert.equal(body.aiCost.monthUsd, monthFirst === today ? 0.5 : 0.75);
      assert.equal(body.aiCost.rangeUsd, 0.5);
      assert.deepEqual([body.aiCost.rangeRequests, body.aiCost.rangeInputTokens, body.aiCost.rangeOutputTokens], [10, 1000, 200]);
      assert.equal(body.aiCost.dailyCapUsd, 3);

      const wide = (await rest("GET", `/reports?from=${addDays(today, -120)}&to=${today}`, A)).body;
      const monthPart = monthFirst === today || monthFirst < addDays(today, -120) ? 0 : 0.25;
      assert.equal(wide.aiCost.rangeUsd, Math.round((9 + 0.5 + monthPart) * 10000) / 10000, "older usage totals are kept and counted in a wide range");
    });

    test("chats per hour, AI vs agent, in the support time zone", async () => {
      const { body } = await rest("GET", `/reports?from=${today}&to=${today}`, A);
      assert.equal(body.perHour.length, 24);
      const at = (ms) => hourIn(new Date(todayStart.getTime() + ms));
      const row = (hour) => body.perHour.find((h) => h.hour === hour);
      assert.deepEqual([row(at(10 * HOUR)).ai, row(at(10 * HOUR)).agent], [2, 1]);
      assert.deepEqual([row(at(14 * HOUR)).ai, row(at(14 * HOUR)).agent], [2, 0]);
      assert.deepEqual([row(at(16 * HOUR)).ai, row(at(16 * HOUR)).agent], [0, 1]);
      assert.equal(body.perHour.reduce((n, h) => n + h.ai + h.agent, 0), 6);
    });

    test("the date range filter", async () => {
      const yesterday = addDays(today, -1);
      const y = (await rest("GET", `/reports?from=${yesterday}&to=${yesterday}`, A)).body;
      assert.equal(y.chats.total, 1);
      const both = (await rest("GET", `/reports?from=${yesterday}&to=${today}`, A)).body;
      assert.equal(both.chats.total, 7);
      const none = (await rest("GET", `/reports?from=2021-01-01&to=2021-01-31`, A)).body;
      assert.deepEqual([none.chats.total, none.chats.solvedByAiPercent, none.rating.average, none.firstReply.agentAvgSeconds], [0, null, null, null]);
      const dflt = (await rest("GET", "/reports", A)).body;
      assert.equal(dflt.range.from, today);
      assert.equal(dflt.chats.total, 6);
    });

    test("bad ranges are refused", async () => {
      for (const q of ["from=yesterday", "from=2026-13-40&to=2026-13-41", `from=${today}&to=2000-01-01`, "from=2020-01-01&to=2022-01-01", "from=2026-02-30&to=2026-03-01"]) {
        const res = await rest("GET", `/reports?${q}`, A);
        assert.equal(res.status, 400, q);
      }
      assert.equal((await rest("GET", "/reports?from=2020-01-01&to=2022-01-01", A)).body.error, "range_too_long");
    });

    test("bookings after chat: a registered user who books within 7 days after the chat", async () => {
      await lc.models.LcConversation.deleteMany({});
      const at = (ms) => new Date(todayStart.getTime() + ms);
      const users = mongoose.connection.db.collection("users");
      const appts = mongoose.connection.db.collection("appointments");
      const make = async (n, email) => {
        const _id = oid(`64b0000000000000000a10${String(n).padStart(2, "0")}`);
        if (email) await users.updateOne({ _id }, { $set: { _id, name: `U${n}`, role: "user", email } }, { upsert: true });
        return _id;
      };
      const u1 = await make(1, "book1@example.com"); // books 3 days after the chat: counts
      const u2 = await make(2, "book2@example.com"); // books 8 days after: too late
      const u3 = await make(3, "book3@example.com"); // booked the day BEFORE the chat: does not count
      const u4 = await make(4, "book4@example.com"); // cancelled booking: does not count
      const u5 = await make(5, "book5@example.com"); // two bookings within the window: counts once, 2 bookings
      const started = at(2 * HOUR);
      const withEmail = (email) => ({ contact: { name: encryptLiveChatText("X"), email: encryptLiveChatText(email), phone: encryptLiveChatText("") } });
      await chat({ ...withEmail("book1@example.com"), startedAt: started });
      await chat({ ...withEmail("book2@example.com"), startedAt: started });
      await chat({ ...withEmail("book3@example.com"), startedAt: started });
      await chat({ ...withEmail("book4@example.com"), startedAt: started });
      await chat({ ...withEmail("book5@example.com"), startedAt: started });
      await chat({ ...withEmail("nobody@example.com"), startedAt: started }); // no account
      await chat({ startedAt: started }); // no contact details at all
      await appts.insertMany([
        { patientId: u1, bookedAt: new Date(started.getTime() + 3 * DAY), status: "upcoming" },
        { patientId: u2, bookedAt: new Date(started.getTime() + 8 * DAY), status: "upcoming" },
        { patientId: u3, bookedAt: new Date(started.getTime() - DAY), status: "completed" },
        { patientId: u4, bookedAt: new Date(started.getTime() + DAY), status: "cancelled" },
        { patientId: u5, bookedAt: new Date(started.getTime() + DAY), status: "upcoming" },
        { patientId: u5, bookedAt: new Date(started.getTime() + 2 * DAY), status: "confirmed" },
      ]);
      const { body } = await rest("GET", `/reports?from=${today}&to=${today}`, A);
      assert.deepEqual(
        [body.bookings.chatsWithContact, body.bookings.chatsWithBooking, body.bookings.bookings, body.bookings.windowDays],
        [6, 2, 3, 7]
      );
    });

    test("an empty day returns zeros, not errors", async () => {
      await lc.models.LcConversation.deleteMany({});
      const { status, body } = await rest("GET", `/reports?from=${today}&to=${today}`, A);
      assert.equal(status, 200);
      assert.deepEqual([body.chats.total, body.bookings.chatsWithBooking, body.perHour.length], [0, 0, 24]);
      await sleep(10);
    });
  });
});
