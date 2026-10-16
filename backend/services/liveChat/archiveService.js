// Live Chat > Archive: every archived chat (AI and Live agent), any age until retention deletes it, with filters and a
// search over data that is encrypted at rest.
//
// Search design (nothing readable is ever stored for it):
//   - chat ID, IP and city are plain fields: normal indexed prefix queries;
//   - an exact email or phone is found through the blind indexes on the conversation (`searchKeys`, keyed HMACs);
//   - a partial name / email / phone is found by decrypting the contact of the chats inside the chosen filters, in
//     memory, for this request only (capped at SCAN_CAP chats; the answer says when the cap was hit).
const { decryptLiveChatText, hashLiveChatEmail, hashLiveChatPhone, normalizePhone } = require("../../utils/liveChat/crypto");
const { StatsError, zonedDayStart, addDays } = require("./statsService");
const { dayKey } = require("./limits");
const { activityLt, activityIn, activityOf } = require("./buckets");
const { istTodayStart } = require("./istDay");

const PAGE_SIZE = 50;
const SCAN_CAP = 5000;
const ZONE = "America/New_York"; // the same fixed zone Reports uses for days
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REASON_VALUES = { inactive: ["inactive"], patient_left: ["patient_left"], patient_ended: ["patient_ended"], blocked: ["blocked"], resolved: ["resolved", "", "offline_request", "ai_unavailable"] };
const REASON_KEY = (closedReason) => (["inactive", "patient_left", "patient_ended", "blocked"].includes(closedReason) ? closedReason : "resolved");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isRealDay = (value) => {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
};

function createArchiveService({ models, now = () => Date.now() }) {
  // The Archive page holds every chat whose last message is before today (India time): see buckets.js.
  const beforeToday = () => activityLt(istTodayStart(now()));
  const { LcConversation, LcMessage } = models;

  function baseFilter(query) {
    const filter = { mode: { $nin: ["trashed"] }, $and: [beforeToday()] };
    const range = {};
    let from = query.from || "";
    let to = query.to || "";
    if (from && !isRealDay(from)) throw new StatsError(400, "invalid_range");
    if (to && !isRealDay(to)) throw new StatsError(400, "invalid_range");
    if (from && to && from > to) throw new StatsError(400, "invalid_range");
    if (from) range.$gte = zonedDayStart(from, ZONE);
    if (to) range.$lt = zonedDayStart(addDays(to, 1), ZONE);
    if (range.$gte || range.$lt) filter.$and.push(activityIn(range));
    const type = query.type;
    if (type === "ai") filter.everLive = false;
    else if (type === "live") filter.everLive = true;
    else if (type && type !== "all") throw new StatsError(400, "invalid_type");
    const reason = query.reason;
    if (reason && reason !== "all") {
      if (!REASON_VALUES[reason]) throw new StatsError(400, "invalid_reason");
      filter.closedReason = { $in: REASON_VALUES[reason] };
    }
    return { filter, from, to };
  }

  async function messageCounts(ids) {
    if (!ids.length) return new Map();
    const rows = await LcMessage.aggregate([
      { $match: { conversationId: { $in: ids }, sender: { $in: ["patient", "ai", "agent"] }, internal: { $ne: true } } },
      { $group: { _id: "$conversationId", n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.n]));
  }

  // Ids of the chats matching the search text inside `filter`.
  async function searchIds(filter, q, { from, to }) {
    const upper = q.toUpperCase();
    const lower = q.toLowerCase();
    const digits = normalizePhone(q);
    const idLike = /^HC[A-Z0-9]{1,8}$/.test(upper);
    const fullId = /^HC[A-Z0-9]{8}$/.test(upper);
    const ipLike = /^[0-9a-f:.]+$/i.test(q) && /[.:]/.test(q);
    const emailLike = q.includes("@");
    const phoneLike = /^[+\d\s().-]+$/.test(q) && digits.length >= 7;
    const letters = /\p{L}/u.test(q);

    const or = [];
    if (idLike) or.push({ conversationId: { $regex: `^${escapeRegex(upper)}` } });
    if (ipLike) or.push({ ip: { $regex: `^${escapeRegex(q)}` } });
    if (emailLike) or.push({ "searchKeys.emailHash": hashLiveChatEmail(q) });
    if (phoneLike) or.push({ "searchKeys.phoneHash": hashLiveChatPhone(q) });
    if (letters && q.length >= 2) or.push({ "geo.city": { $regex: `^${escapeRegex(q)}`, $options: "i" } });

    const ids = new Set();
    let exactHit = false;
    if (or.length) {
      const hits = await LcConversation.find({ ...filter, $or: or }).select("conversationId").limit(SCAN_CAP).lean();
      hits.forEach((h) => ids.add(h.conversationId));
      exactHit = hits.length > 0 && (fullId || emailLike || phoneLike);
    }

    // Partial matches on the encrypted contact: decrypt in memory, inside the filters only.
    let capped = false;
    let defaulted = null;
    if (!exactHit) {
      const scanFilter = { ...filter };
      if (!from && !to) {
        // a scan always needs a window: the last 30 days when none was chosen
        const today = dayKey(new Date(now()), ZONE);
        defaulted = { from: addDays(today, -29), to: today };
        scanFilter.$and = [...filter.$and, activityIn({ $gte: zonedDayStart(defaulted.from, ZONE), $lt: zonedDayStart(addDays(today, 1), ZONE) })];
      }
      const wantsDigits = /^[+\d\s().-]+$/.test(q) && digits.length >= 3;
      let scanned = 0;
      const cursor = LcConversation.find(scanFilter).sort({ lastMessageAt: -1 }).select("conversationId contact").lean().cursor();
      for await (const row of cursor) {
        scanned += 1;
        if (scanned > SCAN_CAP) {
          capped = true;
          break;
        }
        const name = decryptLiveChatText(row.contact?.name).toLowerCase();
        const email = decryptLiveChatText(row.contact?.email).toLowerCase();
        let hit = (letters || emailLike) && (name.includes(lower) || email.includes(lower));
        if (!hit && wantsDigits) hit = normalizePhone(decryptLiveChatText(row.contact?.phone)).includes(digits);
        if (hit) ids.add(row.conversationId);
      }
      if (capped) await cursor.close?.();
    }
    return { ids: [...ids], capped, defaulted };
  }

  async function list(query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const { filter, from, to } = baseFilter(query);
    const q = String(query.q || "").trim().slice(0, 100);

    let where = filter;
    let capped = false;
    let defaulted = null;
    let total;
    if (q) {
      const found = await searchIds(filter, q, { from, to });
      capped = found.capped;
      defaulted = found.defaulted;
      where = { ...filter, conversationId: { $in: found.ids } };
      total = found.ids.length; // indexed hits are not windowed; only the decrypt scan used the default window
    } else {
      total = await LcConversation.countDocuments(where);
    }

    const convs = await LcConversation.find(where)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    const counts = await messageCounts(convs.map((c) => c.conversationId));
    const rows = convs.map((c) => ({
      conversationId: c.conversationId,
      name: decryptLiveChatText(c.contact?.name),
      email: decryptLiveChatText(c.contact?.email),
      type: c.everLive ? "live" : "ai",
      reason: REASON_KEY(c.closedReason),
      assignee: c.assigneeId || c.agentName ? c.agentName || "Agent" : "",
      startedAt: c.startedAt,
      closedAt: c.closedAt || new Date(activityOf(c)),
      messages: counts.get(c.conversationId) || 0,
    }));
    return {
      ok: true,
      rows,
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      capped,
      appliedRange: defaulted,
      timeZone: ZONE,
    };
  }

  // Every archived chat the same filters show (used by "delete all matching filters"): the SAME filter code as the
  // list, so what is deleted is exactly what the Archive page lists. `capped` means the search hit its scan cap.
  async function matchingIds(query = {}) {
    const { filter, from, to } = baseFilter(query);
    const q = String(query.q || "").trim().slice(0, 100);
    if (q) {
      const found = await searchIds(filter, q, { from, to });
      return { ids: found.ids, capped: found.capped, filters: { from, to, type: query.type || "", reason: query.reason || "", hasSearch: true } };
    }
    const rows = await LcConversation.find(filter).select("conversationId").lean();
    return { ids: rows.map((r) => r.conversationId), capped: false, filters: { from, to, type: query.type || "", reason: query.reason || "", hasSearch: false } };
  }

  return { list, matchingIds, PAGE_SIZE, SCAN_CAP };
}

module.exports = { createArchiveService };
