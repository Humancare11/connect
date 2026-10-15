// AI Review: human review of chats the safety layer flagged as medical (conversation.flags.medical).
//
//   list     flagged chats, newest first, filter Unreviewed / Reviewed / All and a date range (India days)
//   detail   one flagged chat's transcript (no internal notes) with its review history
//   review   a reviewer marks the chat OK or Issue with a note -> one NEW row in the append-only LcReviewLog
//   log      the review log itself, newest first; still names the chat (id and date) after the chat is deleted
//
// Who may use it is decided by the routes (Super Admin, or an admin with the liveChatReviewer permission). Transcript
// reads and every review are logged in the review log or counted on the chat; nothing here edits or deletes a review.
const mongoose = require("mongoose");
const { decryptLiveChatText, encryptLiveChatText } = require("../../utils/liveChat/crypto");
const { istDayStart, DAY_MS } = require("./istDay");
const { AgentError, CONVERSATION_ID_RE } = require("./agentService");

const STATUSES = ["unreviewed", "reviewed", "all"];
const OUTCOMES = ["ok", "issue"];
const NOTE_MAX = 1000;
const LIST_LIMIT = 200;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function createReviewService({ models, now = () => Date.now() } = {}) {
  const { LcConversation, LcMessage, LcReviewLog } = models;

  const reviewOf = (conv) => ({
    status: conv.review?.status || (conv.flags?.medical ? "unreviewed" : ""),
    lastOutcome: conv.review?.lastOutcome || "",
    lastAt: conv.review?.lastAt || null,
    count: conv.review?.count || 0,
  });

  const flagsOf = (conv) => ({
    medical: Boolean(conv.flags?.medical),
    reasons: conv.flags?.reasons || [],
    firstAt: conv.flags?.firstAt || null,
    lastAt: conv.flags?.lastAt || null,
  });

  async function list({ status = "unreviewed", from, to } = {}) {
    const wanted = STATUSES.includes(status) ? status : "unreviewed";
    const query = { "flags.medical": true, mode: { $ne: "trashed" } };
    if (wanted === "reviewed") query["review.status"] = "reviewed";
    if (wanted === "unreviewed") query["review.status"] = { $ne: "reviewed" };
    const range = {};
    if (typeof from === "string" && DAY_RE.test(from)) range.$gte = istDayStart(from);
    if (typeof to === "string" && DAY_RE.test(to)) range.$lt = new Date(istDayStart(to).getTime() + DAY_MS);
    if (Object.keys(range).length) query["flags.lastAt"] = range;
    const rows = await LcConversation.find(query).sort({ "flags.lastAt": -1 }).limit(LIST_LIMIT).lean();
    return {
      ok: true,
      chats: rows.map((c) => ({
        conversationId: c.conversationId,
        startedAt: c.startedAt,
        topic: c.topic || "",
        mode: c.mode,
        language: c.language?.name || "",
        flags: flagsOf(c),
        review: reviewOf(c),
      })),
    };
  }

  const entryOf = (row) => ({
    id: String(row._id),
    conversationId: row.conversationId,
    chatStartedAt: row.chatStartedAt,
    flagReasons: row.flagReasons || [],
    reviewer: { id: String(row.reviewerId), name: row.reviewerName || "" },
    outcome: row.outcome,
    note: decryptLiveChatText(row.note),
    at: row.at,
  });

  async function loadFlagged(conversationId) {
    if (!CONVERSATION_ID_RE.test(String(conversationId))) throw new AgentError(404, "not_found");
    const conv = await LcConversation.findOne({ conversationId });
    if (!conv || conv.mode === "trashed" || !conv.flags?.medical) throw new AgentError(404, "not_found");
    return conv;
  }

  async function detail(conversationId) {
    const conv = await loadFlagged(conversationId);
    const [rows, log] = await Promise.all([
      LcMessage.find({ conversationId, sender: { $in: ["patient", "ai", "agent", "system"] }, internal: { $ne: true } })
        .sort({ createdAt: 1 })
        .limit(500)
        .lean(),
      LcReviewLog.find({ conversationId }).sort({ at: -1 }).lean(),
    ]);
    return {
      ok: true,
      chat: {
        conversationId,
        startedAt: conv.startedAt,
        mode: conv.mode,
        topic: conv.topic || "",
        language: conv.language?.name || "",
        flags: flagsOf(conv),
        review: reviewOf(conv),
      },
      // Fixed strings and the model's text are shown exactly as the patient saw them; safetyBlocked marks a fixed safe reply.
      messages: rows.map((m) => ({
        id: String(m._id),
        sender: m.sender,
        text: m.fileId ? "(file)" : decryptLiveChatText(m.text), // a file message's text is the file name
        at: m.createdAt,
        safetyBlocked: Boolean(m.safetyBlocked),
      })),
      reviews: log.map(entryOf),
    };
  }

  async function review(actor, conversationId, { outcome, note } = {}) {
    if (!OUTCOMES.includes(outcome)) throw new AgentError(400, "invalid_outcome");
    const cleaned = String(note ?? "").replace(/\r\n?/g, "\n").replace(CONTROL_RE, "").trim();
    if (cleaned.length > NOTE_MAX) throw new AgentError(400, "note_too_long", { max: NOTE_MAX });
    if (outcome === "issue" && !cleaned) throw new AgentError(400, "note_required"); // an Issue needs a few words
    const conv = await loadFlagged(conversationId);
    const user = await require("../../models/User").findById(actor.id).select("name").lean();
    const stamp = new Date(now());
    const row = await LcReviewLog.create({
      conversationId,
      chatStartedAt: conv.startedAt,
      flagReasons: conv.flags?.reasons || [],
      reviewerId: new mongoose.Types.ObjectId(String(actor.id)),
      reviewerName: user?.name || "",
      outcome,
      note: encryptLiveChatText(cleaned),
      at: stamp,
    });
    await LcConversation.updateOne(
      { _id: conv._id },
      { $set: { "review.status": "reviewed", "review.lastOutcome": outcome, "review.lastAt": stamp }, $inc: { "review.count": 1 } }
    );
    return { ok: true, entry: entryOf(row.toObject()) };
  }

  // The log, newest first. chatAvailable: the chat still exists (the log row outlives it).
  async function log({ before } = {}) {
    const query = {};
    const cursor = before ? new Date(before) : null;
    if (cursor && !Number.isNaN(cursor.getTime())) query.at = { $lt: cursor };
    const rows = await LcReviewLog.find(query).sort({ at: -1 }).limit(LIST_LIMIT).lean();
    const ids = [...new Set(rows.map((r) => r.conversationId))];
    const alive = new Set((await LcConversation.find({ conversationId: { $in: ids }, mode: { $ne: "trashed" } }).select("conversationId").lean()).map((c) => c.conversationId));
    return { ok: true, entries: rows.map((r) => ({ ...entryOf(r), chatAvailable: alive.has(r.conversationId) })) };
  }

  return { list, detail, review, log };
}

module.exports = { createReviewService, OUTCOMES, STATUSES, NOTE_MAX };
