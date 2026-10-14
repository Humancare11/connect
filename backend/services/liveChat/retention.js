// Live Chat retention: chats, messages, page timelines, files (including the S3 objects) and contacts are deleted once
// they are older than the "liveChat" retention policy (12 months by default). Run by jobs/retentionJobs.js with the
// other policies, whether or not the module is switched on.
//
// It only ever touches the Lc* collections and the livechat/ S3 prefix. The existing clinical ChatMessage
// retention, the medical-record retention and the uploads/ cleanup are separate and unaffected.
//
// Kept on purpose: the daily AI usage totals (cost and token counts, no patient data), the blocked IP list and the
// settings change log.
//
// Safety: a chat's database rows are deleted only after ALL of its S3 objects are gone. If S3 fails for a chat, that
// chat is left for the next run, so nothing is orphaned in the bucket.
const BATCH = 200;

const defaultModels = () => ({
  LcConversation: require("../../models/LcConversation"),
  LcMessage: require("../../models/LcMessage"),
  LcFile: require("../../models/LcFile"),
  LcPageVisit: require("../../models/LcPageVisit"),
  LcVisitor: require("../../models/LcVisitor"),
});

// Deletes the given chats completely: S3 objects first, then files, messages (with their translations), page
// timelines and the conversation rows (contact and context fields live on the conversation). Shared by the
// retention job and by the Super Admin Trash purge, so both behave identically.
// Returns { deletedIds, skippedIds, files, messages, pageVisits, chats }.
async function purgeConversations(ids, { models, store } = {}) {
  const m = models || defaultModels();
  const out = { deletedIds: [], skippedIds: [], files: 0, messages: 0, pageVisits: 0, chats: 0 };
  let fileStore = store || null;
  const getStore = () => (fileStore ||= require("./fileService").createS3FileStore());
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const files = await m.LcFile.find({ conversationId: { $in: batch } }).select("conversationId s3Key").lean();
    const failedKeys = new Set();
    if (files.length) {
      try {
        for (const key of await getStore().removeMany(files.map((f) => f.s3Key))) failedKeys.add(key);
      } catch {
        files.forEach((f) => failedKeys.add(f.s3Key)); // storage unreachable: keep everything for the next run
      }
    }
    const blocked = new Set(files.filter((f) => failedKeys.has(f.s3Key)).map((f) => f.conversationId));
    out.skippedIds.push(...blocked);
    const doomed = batch.filter((id) => !blocked.has(id));
    if (!doomed.length) continue;
    out.files += (await m.LcFile.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    out.messages += (await m.LcMessage.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    out.pageVisits += (await m.LcPageVisit.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    out.chats += (await m.LcConversation.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    out.deletedIds.push(...doomed);
  }
  return out;
}

// Contacts (LcVisitor) with no chat left. `visitorIds` limits the check to those visitors (Trash purge); without it
// every contact not seen since `cutoff` is considered (retention).
async function pruneVisitors({ models, cutoff, visitorIds, maxBatches = 500 } = {}) {
  const m = models || defaultModels();
  let deleted = 0;
  if (visitorIds) {
    const ids = [...new Set(visitorIds)];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const still = new Set((await m.LcConversation.find({ visitorId: { $in: batch } }).select("visitorId").lean()).map((c) => c.visitorId));
      const doomed = batch.filter((id) => !still.has(id));
      if (doomed.length) deleted += (await m.LcVisitor.deleteMany({ visitorId: { $in: doomed } })).deletedCount || 0;
    }
    return deleted;
  }
  let lastId = null;
  for (let i = 0; i < maxBatches; i += 1) {
    const stale = await m.LcVisitor.find({ lastSeenAt: { $lt: cutoff }, ...(lastId ? { _id: { $gt: lastId } } : {}) })
      .sort({ _id: 1 })
      .select("visitorId")
      .limit(BATCH)
      .lean();
    if (!stale.length) break;
    lastId = stale[stale.length - 1]._id;
    const ids = stale.map((v) => v.visitorId);
    // a contact whose chat is still here (waiting on a failed S3 delete) stays until that chat is gone
    const stillChatting = new Set((await m.LcConversation.find({ visitorId: { $in: ids } }).select("visitorId").lean()).map((c) => c.visitorId));
    const doomed = ids.filter((id) => !stillChatting.has(id));
    if (doomed.length) deleted += (await m.LcVisitor.deleteMany({ visitorId: { $in: doomed } })).deletedCount || 0;
  }
  return deleted;
}

// store.removeMany(keys) -> array of keys that could NOT be deleted
async function runLiveChatRetention({ cutoff, models, store, maxBatches = 500 }) {
  const m = models || defaultModels();
  const result = { chats: 0, messages: 0, files: 0, pageVisits: 0, contacts: 0, skippedChats: 0 };
  const skipped = new Set();

  for (let i = 0; i < maxBatches; i += 1) {
    const convs = await m.LcConversation.find({ lastMessageAt: { $lt: cutoff }, conversationId: { $nin: [...skipped] } })
      .select("conversationId")
      .limit(BATCH)
      .lean();
    if (!convs.length) break;
    const purged = await purgeConversations(convs.map((c) => c.conversationId), { models: m, store });
    purged.skippedIds.forEach((id) => skipped.add(id));
    result.skippedChats += purged.skippedIds.length;
    result.files += purged.files;
    result.messages += purged.messages;
    result.pageVisits += purged.pageVisits;
    result.chats += purged.chats;
  }

  result.contacts = await pruneVisitors({ models: m, cutoff, maxBatches });
  return result;
}

module.exports = { runLiveChatRetention, purgeConversations, pruneVisitors };
