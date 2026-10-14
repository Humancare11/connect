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

// store.removeMany(keys) -> array of keys that could NOT be deleted
async function runLiveChatRetention({ cutoff, models, store, maxBatches = 500 }) {
  const m = models || {
    LcConversation: require("../../models/LcConversation"),
    LcMessage: require("../../models/LcMessage"),
    LcFile: require("../../models/LcFile"),
    LcPageVisit: require("../../models/LcPageVisit"),
    LcVisitor: require("../../models/LcVisitor"),
  };
  const result = { chats: 0, messages: 0, files: 0, pageVisits: 0, contacts: 0, skippedChats: 0 };
  let fileStore = store || null;
  const getStore = () => (fileStore ||= require("./fileService").createS3FileStore());
  const skipped = new Set();

  for (let i = 0; i < maxBatches; i += 1) {
    const convs = await m.LcConversation.find({ lastMessageAt: { $lt: cutoff }, conversationId: { $nin: [...skipped] } })
      .select("conversationId")
      .limit(BATCH)
      .lean();
    if (!convs.length) break;
    const ids = convs.map((c) => c.conversationId);

    // 1. S3 objects first
    const files = await m.LcFile.find({ conversationId: { $in: ids } }).select("conversationId s3Key").lean();
    const failedKeys = new Set();
    if (files.length) {
      try {
        for (const key of await getStore().removeMany(files.map((f) => f.s3Key))) failedKeys.add(key);
      } catch {
        files.forEach((f) => failedKeys.add(f.s3Key)); // storage unreachable: keep everything for the next run
      }
    }
    const blocked = new Set(files.filter((f) => failedKeys.has(f.s3Key)).map((f) => f.conversationId));
    blocked.forEach((id) => skipped.add(id));
    result.skippedChats += blocked.size;

    // 2. then the database rows of the chats whose files are all gone
    const doomed = ids.filter((id) => !blocked.has(id));
    if (!doomed.length) continue;
    result.files += (await m.LcFile.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    result.messages += (await m.LcMessage.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    result.pageVisits += (await m.LcPageVisit.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
    result.chats += (await m.LcConversation.deleteMany({ conversationId: { $in: doomed } })).deletedCount || 0;
  }

  // 3. contacts: not seen for the whole period AND no chat left
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
    if (doomed.length) result.contacts += (await m.LcVisitor.deleteMany({ visitorId: { $in: doomed } })).deletedCount || 0;
  }
  return result;
}

module.exports = { runLiveChatRetention };
