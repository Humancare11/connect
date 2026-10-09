// Numbers for the Team and Reports pages.
//
// "Day" always means a day in the support time zone from the settings (America/New_York by default), so "today"
// matches the team's day, not UTC.
//
// Definitions (also shown on the pages):
//   - first reply time    from the moment a chat entered the Queue to the agent's first message
//   - solved by AI        chats that never needed an agent, as a share of all chats started in the range
//   - bookings after chat a chat counts when its contact's email belongs to a registered user who booked an
//                         appointment within 7 days after the chat started
//   - AI cost             from the daily AI usage totals (kept even after chats are deleted)
const mongoose = require("mongoose");
const { decryptLiveChatText } = require("../../utils/liveChat/crypto");
const { dayKey } = require("./limits");

class StatsError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const MAX_RANGE_DAYS = 366;
const BOOKING_WINDOW_DAYS = 7;
const CHAT_SAMPLE_LIMIT = 2000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Offset of a time zone from UTC at an instant (milliseconds).
function offsetMs(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ms;
}

// The instant a calendar day (YYYY-MM-DD) starts in a time zone.
function zonedDayStart(day, timeZone) {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall;
  for (let i = 0; i < 2; i += 1) t = wall - offsetMs(t, timeZone); // twice, for days where the clocks change
  return new Date(t);
}

// A real calendar day: "2026-02-30" is refused (the date parser would quietly turn it into March 2).
const isRealDay = (value) => {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
};

const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

function createStatsService({ models, loadSettings, agents = { isAvailable: () => false }, now = () => Date.now() }) {
  const { LcConversation, LcMessage, LcAiUsage, LcAgentProfile } = models;

  const zoneOf = (settings) => settings?.supportHours?.timezone || "America/New_York";

  // The AI's first reply after the patient's first message, averaged (seconds), for the given chats.
  async function aiFirstReplySeconds(conversationIds) {
    if (!conversationIds.length) return null;
    const rows = await LcMessage.find({ conversationId: { $in: conversationIds }, sender: { $in: ["patient", "ai"] }, fileId: null })
      .sort({ createdAt: 1 })
      .select("conversationId sender createdAt")
      .lean();
    const state = new Map();
    const gaps = [];
    for (const m of rows) {
      const s = state.get(m.conversationId) || {};
      if (s.done) continue;
      if (m.sender === "patient" && !s.patientAt) s.patientAt = m.createdAt;
      else if (m.sender === "ai" && s.patientAt) {
        gaps.push((m.createdAt - s.patientAt) / 1000);
        s.done = true;
      }
      state.set(m.conversationId, s);
    }
    return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  }

  // ── Team ─────────────────────────────────────────────────────────────────────

  async function team() {
    const settings = await loadSettings();
    const zone = zoneOf(settings);
    const todayStart = zonedDayStart(dayKey(new Date(now()), zone), zone);
    const User = require("../../models/User");
    const users = await User.find({ role: { $in: ["admin", "superadmin"] }, accountDisabled: { $ne: true } }).select("name role").sort({ name: 1 }).lean();
    const ids = users.map((u) => u._id);

    const [profiles, open, today, replies, aiOpen, aiToday, aiSample] = await Promise.all([
      LcAgentProfile.find({ userId: { $in: ids } }).lean(),
      LcConversation.aggregate([{ $match: { mode: "live", assigneeId: { $in: ids } } }, { $group: { _id: "$assigneeId", n: { $sum: 1 } } }]),
      LcConversation.aggregate([{ $match: { assigneeId: { $in: ids }, liveStartedAt: { $gte: todayStart } } }, { $group: { _id: "$assigneeId", n: { $sum: 1 } } }]),
      LcConversation.aggregate([
        {
          $match: {
            assigneeId: { $in: ids },
            liveStartedAt: { $gte: todayStart },
            queuedAt: { $ne: null },
            firstAgentReplyAt: { $ne: null },
            $expr: { $gte: ["$firstAgentReplyAt", "$queuedAt"] },
          },
        },
        { $group: { _id: "$assigneeId", avgMs: { $avg: { $subtract: ["$firstAgentReplyAt", "$queuedAt"] } } } },
      ]),
      LcConversation.countDocuments({ mode: "ai" }),
      LcConversation.countDocuments({ everLive: false, startedAt: { $gte: todayStart } }),
      LcConversation.find({ everLive: false, startedAt: { $gte: todayStart } }).select("conversationId").limit(500).lean(),
    ]);

    const by = (rows, field) => new Map(rows.map((r) => [String(r._id), r[field]]));
    const openBy = by(open, "n");
    const todayBy = by(today, "n");
    const replyBy = by(replies, "avgMs");
    const profileBy = new Map(profiles.map((p) => [String(p.userId), p]));

    const agentRows = users.map((u) => {
      const id = String(u._id);
      const profile = profileBy.get(id);
      const first = String(u.name || "").trim().split(/\s+/)[0] || "Agent";
      return {
        userId: id,
        name: u.name || "",
        role: u.role === "superadmin" ? "Super admin" : "Admin",
        displayName: profile?.displayName || first,
        status: agents.isAvailable(id) ? "online" : "offline",
        openChats: openBy.get(id) || 0,
        chatsToday: todayBy.get(id) || 0,
        avgFirstReplySeconds: replyBy.has(id) ? Math.round(replyBy.get(id) / 1000) : null,
      };
    });

    return {
      ok: true,
      agents: agentRows,
      ai: {
        name: "AI agent",
        role: "Assistant (24/7)",
        displayName: "Humancare AI assistant",
        status: settings.aiMode === "ai_off" ? "offline" : "online",
        openChats: aiOpen,
        chatsToday: aiToday,
        avgFirstReplySeconds: await aiFirstReplySeconds(aiSample.map((c) => c.conversationId)).then((v) => (v === null ? null : Math.round(v))),
      },
      timeZone: zone,
    };
  }

  // ── Reports ──────────────────────────────────────────────────────────────────

  function resolveRange(settings, query = {}) {
    const zone = zoneOf(settings);
    const today = dayKey(new Date(now()), zone);
    const from = query.from || today;
    const to = query.to || from;
    if (!isRealDay(from) || !isRealDay(to)) throw new StatsError(400, "invalid_range");
    if (from > to) throw new StatsError(400, "invalid_range");
    const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (span > MAX_RANGE_DAYS) throw new StatsError(400, "range_too_long");
    return { zone, today, from, to, start: zonedDayStart(from, zone), end: zonedDayStart(addDays(to, 1), zone) };
  }

  async function bookingsAfterChat(chats) {
    const withEmail = [];
    for (const c of chats) {
      const email = decryptLiveChatText(c.contact?.email).toLowerCase();
      if (email) withEmail.push({ startedAt: c.startedAt, email });
    }
    if (!withEmail.length) return { chatsWithContact: 0, chatsWithBooking: 0, bookings: 0, windowDays: BOOKING_WINDOW_DAYS };
    const User = require("../../models/User");
    const Appointment = require("../../models/Appointment");
    const emails = [...new Set(withEmail.map((c) => c.email))];
    const users = await User.find({ email: { $in: emails } }).select("_id email").lean();
    const userIdByEmail = new Map(users.map((u) => [u.email, String(u._id)]));
    if (!userIdByEmail.size) return { chatsWithContact: withEmail.length, chatsWithBooking: 0, bookings: 0, windowDays: BOOKING_WINDOW_DAYS };

    const earliest = new Date(Math.min(...withEmail.map((c) => c.startedAt.getTime())));
    const latest = new Date(Math.max(...withEmail.map((c) => c.startedAt.getTime())) + BOOKING_WINDOW_DAYS * 86_400_000);
    const appointments = await Appointment.find({
      patientId: { $in: [...userIdByEmail.values()].map((id) => new mongoose.Types.ObjectId(id)) },
      bookedAt: { $gte: earliest, $lte: latest },
      status: { $ne: "cancelled" },
    })
      .select("patientId bookedAt")
      .lean();
    const byUser = new Map();
    for (const a of appointments) {
      const key = String(a.patientId);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(a.bookedAt.getTime());
    }
    let chatsWithBooking = 0;
    let bookings = 0;
    for (const c of withEmail) {
      const times = byUser.get(userIdByEmail.get(c.email)) || [];
      const from = c.startedAt.getTime();
      const hits = times.filter((t) => t >= from && t <= from + BOOKING_WINDOW_DAYS * 86_400_000).length;
      if (hits) {
        chatsWithBooking += 1;
        bookings += hits;
      }
    }
    return { chatsWithContact: withEmail.length, chatsWithBooking, bookings, windowDays: BOOKING_WINDOW_DAYS };
  }

  async function reports(query) {
    const settings = await loadSettings();
    const range = resolveRange(settings, query);
    const inRange = { startedAt: { $gte: range.start, $lt: range.end } };
    const monthStart = `${range.today.slice(0, 7)}-01`;

    const [totals, ratings, replies, perHour, chats, usageToday, usageMonth, usageRange] = await Promise.all([
      LcConversation.aggregate([
        { $match: inRange },
        { $group: { _id: null, total: { $sum: 1 }, solvedByAi: { $sum: { $cond: [{ $eq: ["$everLive", false] }, 1, 0] } }, withAgent: { $sum: { $cond: ["$everLive", 1, 0] } }, patientLeft: { $sum: { $cond: [{ $eq: ["$closedReason", "patient_left"] }, 1, 0] } } } },
      ]),
      LcConversation.aggregate([
        { $match: { ...inRange, "rating.stars": { $ne: null } } },
        { $group: { _id: "$rating.stars", n: { $sum: 1 } } },
      ]),
      LcConversation.aggregate([
        { $match: { ...inRange, queuedAt: { $ne: null }, firstAgentReplyAt: { $ne: null }, $expr: { $gte: ["$firstAgentReplyAt", "$queuedAt"] } } },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ["$firstAgentReplyAt", "$queuedAt"] } }, n: { $sum: 1 } } },
      ]),
      LcConversation.aggregate([
        { $match: inRange },
        { $group: { _id: { $hour: { date: "$startedAt", timezone: range.zone } }, ai: { $sum: { $cond: [{ $eq: ["$everLive", false] }, 1, 0] } }, agent: { $sum: { $cond: ["$everLive", 1, 0] } } } },
      ]),
      LcConversation.find(inRange).select("conversationId startedAt everLive contact.email").sort({ startedAt: -1 }).limit(CHAT_SAMPLE_LIMIT).lean(),
      LcAiUsage.findOne({ day: range.today }).lean(),
      LcAiUsage.aggregate([{ $match: { day: { $gte: monthStart, $lte: range.today } } }, { $group: { _id: null, cost: { $sum: "$costUsd" }, requests: { $sum: "$requests" } } }]),
      LcAiUsage.aggregate([
        { $match: { day: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: null, cost: { $sum: "$costUsd" }, requests: { $sum: "$requests" }, input: { $sum: "$inputTokens" }, output: { $sum: "$outputTokens" } } },
      ]),
    ]);

    const t = totals[0] || { total: 0, solvedByAi: 0, withAgent: 0, patientLeft: 0 };
    const stars = Object.fromEntries(ratings.map((r) => [r._id, r.n]));
    const ratingCount = Object.values(stars).reduce((a, b) => a + b, 0);
    const ratingSum = Object.entries(stars).reduce((a, [k, n]) => a + Number(k) * n, 0);
    const hourRows = Array.from({ length: 24 }, (_, hour) => {
      const found = perHour.find((h) => h._id === hour);
      return { hour, ai: found?.ai || 0, agent: found?.agent || 0 };
    });
    const todayStart = zonedDayStart(range.today, range.zone);
    const chatsToday = await LcConversation.countDocuments({ startedAt: { $gte: todayStart } });
    const aiAvg = await aiFirstReplySeconds(chats.filter((c) => !c.everLive).slice(0, 500).map((c) => c.conversationId));

    return {
      ok: true,
      range: { from: range.from, to: range.to, timeZone: range.zone, today: range.today },
      chats: {
        today: chatsToday,
        total: t.total,
        solvedByAi: t.solvedByAi,
        withAgent: t.withAgent,
        patientLeft: t.patientLeft,
        solvedByAiPercent: t.total ? Math.round((t.solvedByAi / t.total) * 1000) / 10 : null,
      },
      firstReply: {
        agentAvgSeconds: replies[0] ? Math.round(replies[0].avgMs / 1000) : null,
        agentChats: replies[0]?.n || 0,
        aiAvgSeconds: aiAvg === null ? null : Math.round(aiAvg * 10) / 10,
      },
      rating: {
        average: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        count: ratingCount,
        distribution: [1, 2, 3, 4, 5].map((n) => ({ stars: n, count: stars[n] || 0 })),
      },
      bookings: { ...(await bookingsAfterChat(chats)), truncated: t.total > chats.length },
      aiCost: {
        todayUsd: Math.round((usageToday?.costUsd || 0) * 10000) / 10000,
        monthUsd: Math.round((usageMonth[0]?.cost || 0) * 10000) / 10000,
        rangeUsd: Math.round((usageRange[0]?.cost || 0) * 10000) / 10000,
        rangeRequests: usageRange[0]?.requests || 0,
        rangeInputTokens: usageRange[0]?.input || 0,
        rangeOutputTokens: usageRange[0]?.output || 0,
        dailyCapUsd: settings.dailySpendCapUsd,
      },
      perHour: hourRows,
    };
  }

  return { team, reports, resolveRange };
}

module.exports = { createStatsService, StatsError, zonedDayStart, addDays };
