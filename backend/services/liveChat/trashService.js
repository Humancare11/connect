// Live Chat > Trash: Super Admin deletes archived chats into Trash (mode "trashed"), keeps them 30 days, can restore
// them, or purges them for good. The daily job purges whatever is older than 30 days.
//
// - Only ARCHIVED chats can be deleted: the update is atomic on mode, so a chat that reopened a moment ago is refused.
// - A trashed chat is invisible everywhere else (lists, Archive, search, reports, the patient's widget): every other
//   query either filters on mode or excludes "trashed" explicitly.
// - Purging uses the same code as the retention job (retention.purgeConversations): S3 objects first, then rows.
// - Every action writes one LcChatDeletionAudit row: who, when, how many, chat IDs, filters. Never PHI.
const { decryptLiveChatText } = require("../../utils/liveChat/crypto");
const { StatsError } = require("./statsService");
const { purgeConversations, pruneVisitors } = require("./retention");

const TRASH_DAYS = 30;
const DAY_MS = 86_400_000;
const CONFIRM_ABOVE = 50; // more than this many chats (or any filter-based action) needs DELETE typed
const MAX_IDS = 5000;
const PAGE_SIZE = 50;
const ID_RE = /^HC[A-Z0-9]{8}$/;

function createTrashService({ models, archive, purge = purgeConversations, now = () => Date.now(), store }) {
  const { LcConversation, LcChatDeletionAudit } = models;

  const bad = (status, code) => new StatsError(status, code);

  function cleanIds(ids) {
    if (!Array.isArray(ids)) throw bad(400, "invalid_ids");
    const unique = [...new Set(ids.map((id) => String(id)))];
    if (unique.some((id) => !ID_RE.test(id))) throw bad(400, "invalid_ids");
    if (unique.length > MAX_IDS) throw bad(400, "too_many");
    return unique;
  }

  function requireConfirm(count, matching, confirm) {
    if ((matching || count > CONFIRM_ABOVE) && confirm !== "DELETE") throw bad(400, "confirm_required");
  }

  async function audit(actor, action, { ids, filters, matching = false, refused = 0 }) {
    await LcChatDeletionAudit.create({
      action,
      actorId: actor?.id || null,
      actorRole: actor?.role || "",
      count: ids.length,
      conversationIds: ids,
      filters: { ...(filters || {}), matching },
      refusedCount: refused,
    });
  }

  // How many chats a delete would take (shown in the confirmation dialog).
  async function preview(query = {}) {
    const found = await archive.matchingIds(query);
    return { ok: true, count: found.ids.length, capped: found.capped };
  }

  // body: { ids } for a selection, or { matching: true, filters: {from,to,type,reason,q} } for "all matching".
  async function remove(actor, body = {}) {
    const matching = body.matching === true;
    let ids;
    let filters = null;
    if (matching) {
      const found = await archive.matchingIds(body.filters || {});
      if (found.capped) throw bad(409, "search_too_broad"); // never delete on a partial scan
      ids = found.ids;
      filters = found.filters;
    } else {
      ids = cleanIds(body.ids);
    }
    if (!ids.length) throw bad(400, "nothing_selected");
    requireConfirm(ids.length, matching, body.confirm);

    const stamp = new Date(now());
    const trash = { at: stamp, byId: actor.id, purgeAfter: new Date(stamp.getTime() + TRASH_DAYS * DAY_MS) };
    const deleted = [];
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      await LcConversation.updateMany({ conversationId: { $in: batch }, mode: "archived" }, { $set: { mode: "trashed", trash } });
      const done = await LcConversation.find({ conversationId: { $in: batch }, mode: "trashed", "trash.at": stamp }).select("conversationId").lean();
      deleted.push(...done.map((d) => d.conversationId));
    }
    const refused = ids.length - deleted.length; // open, in the Queue, with an agent, or not found
    if (deleted.length || refused) await audit(actor, "delete", { ids: deleted, filters, matching, refused });
    return { ok: true, deleted: deleted.length, refused };
  }

  async function list(query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const where = { mode: "trashed" };
    const total = await LcConversation.countDocuments(where);
    const convs = await LcConversation.find(where)
      .sort({ "trash.at": -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    const rows = convs.map((c) => ({
      conversationId: c.conversationId,
      name: decryptLiveChatText(c.contact?.name),
      type: c.everLive ? "live" : "ai",
      closedAt: c.closedAt,
      trashedAt: c.trash?.at || null,
      purgeAfter: c.trash?.purgeAfter || null,
      daysLeft: c.trash?.purgeAfter ? Math.max(0, Math.ceil((new Date(c.trash.purgeAfter).getTime() - now()) / DAY_MS)) : 0,
    }));
    return { ok: true, rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }

  async function restore(actor, body = {}) {
    const ids = cleanIds(body.ids);
    if (!ids.length) throw bad(400, "nothing_selected");
    const restored = [];
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const rows = await LcConversation.find({ conversationId: { $in: batch }, mode: "trashed" }).select("conversationId").lean();
      const found = rows.map((r) => r.conversationId);
      if (!found.length) continue;
      await LcConversation.updateMany(
        { conversationId: { $in: found }, mode: "trashed" },
        { $set: { mode: "archived", trash: { at: null, byId: null, purgeAfter: null } } }
      );
      restored.push(...found);
    }
    if (restored.length) await audit(actor, "restore", { ids: restored, refused: ids.length - restored.length });
    return { ok: true, restored: restored.length, refused: ids.length - restored.length };
  }

  // Only ids that are really in Trash are ever passed to the purge (an archived or open chat can never be hit here).
  async function purgeTrashed(ids) {
    const out = { deletedIds: [], skippedIds: [] };
    for (let i = 0; i < ids.length; i += 200) {
      const rows = await LcConversation.find({ conversationId: { $in: ids.slice(i, i + 200) }, mode: "trashed" })
        .select("conversationId visitorId")
        .lean();
      if (!rows.length) continue;
      const result = await purge(rows.map((r) => r.conversationId), { models, store });
      out.deletedIds.push(...result.deletedIds);
      out.skippedIds.push(...result.skippedIds);
      const gone = new Set(result.deletedIds);
      await pruneVisitors({ models, visitorIds: rows.filter((r) => gone.has(r.conversationId)).map((r) => r.visitorId) });
    }
    return out;
  }

  // body: { ids } or { all: true }.
  async function purgeNow(actor, body = {}) {
    const all = body.all === true;
    let ids;
    if (all) ids = (await LcConversation.find({ mode: "trashed" }).select("conversationId").lean()).map((r) => r.conversationId);
    else ids = cleanIds(body.ids);
    if (!ids.length) throw bad(400, "nothing_selected");
    requireConfirm(ids.length, all, body.confirm);
    const done = await purgeTrashed(ids);
    const refused = ids.length - done.deletedIds.length;
    if (done.deletedIds.length) await audit(actor, "purge", { ids: done.deletedIds, matching: all, refused });
    return { ok: true, purged: done.deletedIds.length, refused, failedStorage: done.skippedIds.length };
  }

  // Daily job: whatever has been in Trash for 30 days goes for good (same path as a manual purge).
  async function autoPurge({ maxBatches = 100 } = {}) {
    const total = { deleted: 0, skipped: 0 };
    const skipped = new Set();
    for (let i = 0; i < maxBatches; i += 1) {
      const due = await LcConversation.find({ mode: "trashed", "trash.purgeAfter": { $lte: new Date(now()) }, conversationId: { $nin: [...skipped] } })
        .select("conversationId")
        .limit(200)
        .lean();
      if (!due.length) break;
      const done = await purgeTrashed(due.map((d) => d.conversationId));
      done.skippedIds.forEach((id) => skipped.add(id));
      total.deleted += done.deletedIds.length;
      total.skipped += done.skippedIds.length;
      if (done.deletedIds.length) await audit(null, "auto_purge", { ids: done.deletedIds });
      if (!done.deletedIds.length) break;
    }
    return total;
  }

  return { preview, remove, list, restore, purge: purgeNow, autoPurge, TRASH_DAYS, CONFIRM_ABOVE };
}

module.exports = { createTrashService, TRASH_DAYS };
