const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { encryptLiveChatText } = require("../utils/liveChat/crypto");

const DAY = 24 * 3_600_000;
const ago = (days) => new Date(Date.now() - days * DAY);

describe("live chat retention (12 months)", () => {
  let mongod;
  let m;
  let RetentionPolicy;
  let runRetentionCleanup;
  let runLiveChatRetention;
  let seq = 0;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    m = {
      LcConversation: require("../models/LcConversation"),
      LcMessage: require("../models/LcMessage"),
      LcFile: require("../models/LcFile"),
      LcPageVisit: require("../models/LcPageVisit"),
      LcVisitor: require("../models/LcVisitor"),
      LcAiUsage: require("../models/LcAiUsage"),
      LcBlockedIp: require("../models/LcBlockedIp"),
      LcSettingsAudit: require("../models/LcSettingsAudit"),
    };
    RetentionPolicy = require("../models/RetentionPolicy");
    ({ runRetentionCleanup } = require("../jobs/retentionJobs"));
    ({ runLiveChatRetention } = require("../services/liveChat/retention"));
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  // The real clinical chat collection (doctor-patient appointment chat). Raw inserts: the live-chat run must never touch it.
  const clinicalChat = () => mongoose.connection.db.collection("chatmessages");

  beforeEach(async () => {
    await Promise.all(Object.values(m).map((model) => model.deleteMany({})));
    await RetentionPolicy.deleteMany({});
    await clinicalChat().deleteMany({});
    process.env.LIVECHAT_ENABLED = "false"; // the module is switched OFF: retention must still purge
  });

  // A fake S3: the keys that exist, and the keys it refuses to delete.
  function fakeStore(existing, refuse = []) {
    const removed = [];
    return {
      removed,
      removeMany: async (keys) => {
        const failed = [];
        for (const key of keys) {
          if (refuse.includes(key)) failed.push(key);
          else {
            existing.delete(key);
            removed.push(key);
          }
        }
        return failed;
      },
    };
  }

  async function chatWith({ ageDays, files = 0, visitor = true, lastSeenDays = ageDays }) {
    seq += 1;
    const conversationId = `HCRET${String(seq).padStart(5, "0")}`;
    const visitorId = `visitor-retention-${seq}-0123456789`;
    const at = ago(ageDays);
    await m.LcConversation.create({
      conversationId, visitorId, mode: "archived", startedAt: at, lastMessageAt: at,
      contact: { name: encryptLiveChatText("Emma"), email: encryptLiveChatText("e@example.com"), phone: encryptLiveChatText("") },
    });
    await m.LcMessage.insertMany([1, 2, 3].map((i) => ({ conversationId, sender: "patient", text: encryptLiveChatText(`m${i}`), createdAt: at })));
    await m.LcPageVisit.create({ conversationId, visitorId, path: "/", enteredAt: at });
    const keys = [];
    for (let i = 0; i < files; i += 1) {
      const s3Key = `livechat/${conversationId}/file-${i}.pdf`;
      keys.push(s3Key);
      await m.LcFile.create({ conversationId, visitorId, s3Key, name: encryptLiveChatText(`report${i}.pdf`), mimeType: "application/pdf", size: 100 });
    }
    if (visitor) await m.LcVisitor.create({ visitorId, name: encryptLiveChatText("Emma"), email: encryptLiveChatText("e@example.com"), phone: encryptLiveChatText(""), lastSeenAt: ago(lastSeenDays) });
    return { conversationId, visitorId, keys };
  }
  const counts = async () => ({
    chats: await m.LcConversation.countDocuments(),
    messages: await m.LcMessage.countDocuments(),
    files: await m.LcFile.countDocuments(),
    pages: await m.LcPageVisit.countDocuments(),
    contacts: await m.LcVisitor.countDocuments(),
  });

  test("chats older than the cutoff go with their messages, page timelines, files and contacts; newer ones stay", async () => {
    const old = await chatWith({ ageDays: 400, files: 2 });
    const recent = await chatWith({ ageDays: 30, files: 1 });
    const s3 = new Set([...old.keys, ...recent.keys]);
    const store = fakeStore(s3);

    const result = await runLiveChatRetention({ cutoff: ago(365), store });
    assert.deepEqual([result.chats, result.messages, result.files, result.pageVisits, result.contacts], [1, 3, 2, 1, 1]);
    assert.deepEqual(await counts(), { chats: 1, messages: 3, files: 1, pages: 1, contacts: 1 });
    assert.deepEqual([...s3], recent.keys, "the old chat's S3 objects are gone, the recent chat's are not");
    assert.ok(await m.LcConversation.findOne({ conversationId: recent.conversationId }));
    assert.equal(await m.LcConversation.findOne({ conversationId: old.conversationId }), null);
    assert.equal(await m.LcVisitor.findOne({ visitorId: old.visitorId }), null);
  });

  test("a contact with no chat left and not seen for the period is deleted; one with a recent chat is kept", async () => {
    await m.LcVisitor.create({ visitorId: "visitor-stale-no-chat-0123456", lastSeenAt: ago(500) });
    await m.LcVisitor.create({ visitorId: "visitor-fresh-no-chat-0123456", lastSeenAt: ago(5) });
    const returning = await chatWith({ ageDays: 20, lastSeenDays: 500 }); // seen long ago, but chatted recently
    const result = await runLiveChatRetention({ cutoff: ago(365), store: fakeStore(new Set()) });
    assert.equal(result.contacts, 1);
    assert.equal(await m.LcVisitor.findOne({ visitorId: "visitor-stale-no-chat-0123456" }), null);
    assert.ok(await m.LcVisitor.findOne({ visitorId: "visitor-fresh-no-chat-0123456" }));
    assert.ok(await m.LcVisitor.findOne({ visitorId: returning.visitorId }));
  });

  test("S3 deletion comes first: if S3 refuses a file, that chat stays whole and the rest are deleted; the next run finishes", async () => {
    const stuck = await chatWith({ ageDays: 400, files: 2 });
    const fine = await chatWith({ ageDays: 410, files: 1 });
    const s3 = new Set([...stuck.keys, ...fine.keys]);
    const store = fakeStore(s3, [stuck.keys[1]]);

    const first = await runLiveChatRetention({ cutoff: ago(365), store });
    assert.deepEqual([first.chats, first.skippedChats], [1, 1]);
    assert.ok(await m.LcConversation.findOne({ conversationId: stuck.conversationId }), "its rows are kept so nothing is orphaned in S3");
    assert.equal(await m.LcFile.countDocuments({ conversationId: stuck.conversationId }), 2);
    assert.equal(await m.LcMessage.countDocuments({ conversationId: stuck.conversationId }), 3);
    assert.ok(await m.LcVisitor.findOne({ visitorId: stuck.visitorId }), "its contact stays until the chat is gone");
    assert.equal(await m.LcConversation.findOne({ conversationId: fine.conversationId }), null);

    const second = await runLiveChatRetention({ cutoff: ago(365), store: fakeStore(s3) });
    assert.equal(second.chats, 1);
    assert.deepEqual(await counts(), { chats: 0, messages: 0, files: 0, pages: 0, contacts: 0 });
    assert.equal(s3.size, 0);
  });

  test("an unreachable S3 keeps everything for the next run (no rows deleted)", async () => {
    const old = await chatWith({ ageDays: 400, files: 1 });
    const store = { removeMany: async () => { throw new Error("S3 down"); } };
    const result = await runLiveChatRetention({ cutoff: ago(365), store });
    assert.equal(result.chats, 0);
    assert.equal(await m.LcFile.countDocuments({ conversationId: old.conversationId }), 1);
    assert.equal(await m.LcMessage.countDocuments({ conversationId: old.conversationId }), 3);
  });

  test("chats without files never touch S3", async () => {
    await chatWith({ ageDays: 400 });
    const store = { removeMany: async () => assert.fail("S3 must not be called when there are no files") };
    const result = await runLiveChatRetention({ cutoff: ago(365), store });
    assert.equal(result.chats, 1);
  });

  test("kept on purpose: AI usage totals, blocked IPs and the settings change log", async () => {
    await chatWith({ ageDays: 400 });
    await m.LcAiUsage.create({ day: "2025-01-15", requests: 5, inputTokens: 1, outputTokens: 1, costUsd: 0.4 });
    await m.LcBlockedIp.create({ ip: "203.0.113.1", reason: "spam", createdAt: ago(800) });
    await m.LcSettingsAudit.create({ actorName: "Super Admin", changes: [{ field: "aiMode", before: "a", after: "b" }], createdAt: ago(800) });
    await runLiveChatRetention({ cutoff: ago(365), store: fakeStore(new Set()) });
    assert.equal(await m.LcAiUsage.countDocuments(), 1);
    assert.equal(await m.LcBlockedIp.countDocuments(), 1);
    assert.equal(await m.LcSettingsAudit.countDocuments(), 1);
  });

  describe("through the existing retention job and policies", () => {
    test("the 'liveChat' policy (12 months) runs with the other policies, even though the module is switched off", async () => {
      assert.equal(process.env.LIVECHAT_ENABLED, "false");
      await chatWith({ ageDays: 400 });
      await chatWith({ ageDays: 10 });
      await RetentionPolicy.create({ key: "liveChat", label: "Website live chat", retentionDays: 365, enabled: true });
      const { deleted } = await runRetentionCleanup();
      assert.equal(deleted.liveChat, 2, "one chat and its contact");
      assert.equal(await m.LcConversation.countDocuments(), 1);
    });

    test("it does NOT touch the existing clinical ChatMessage retention, and that does not touch live chat", async () => {
      await chatWith({ ageDays: 400 });
      await clinicalChat().insertMany([
        { text: "old clinical message", createdAt: ago(400), updatedAt: ago(400) },
        { text: "new clinical message", createdAt: ago(1), updatedAt: ago(1) },
      ]);

      // live chat policy only: clinical messages untouched
      await RetentionPolicy.create({ key: "liveChat", label: "Website live chat", retentionDays: 365, enabled: true });
      await runRetentionCleanup();
      assert.equal(await clinicalChat().countDocuments(), 2, "ChatMessage is untouched by the live-chat policy");
      assert.equal(await m.LcConversation.countDocuments(), 0);

      // clinical policy only: live chat untouched
      await chatWith({ ageDays: 400 });
      await RetentionPolicy.deleteMany({});
      await RetentionPolicy.create({ key: "chatMessages", label: "Clinical chat messages", retentionDays: 30, enabled: true });
      await runRetentionCleanup();
      assert.equal(await clinicalChat().countDocuments(), 1, "the clinical policy still deletes old clinical messages");
      assert.equal(await m.LcConversation.countDocuments(), 1, "...and leaves live chat alone");
      assert.equal(await m.LcMessage.countDocuments(), 3);
    });

    test("a disabled policy deletes nothing; the retention period is configurable", async () => {
      await chatWith({ ageDays: 400 });
      await chatWith({ ageDays: 100 });
      await RetentionPolicy.create({ key: "liveChat", label: "Website live chat", retentionDays: 365, enabled: false });
      await runRetentionCleanup();
      assert.equal(await m.LcConversation.countDocuments(), 2);

      await RetentionPolicy.updateOne({ key: "liveChat" }, { enabled: true, retentionDays: 90 });
      await runRetentionCleanup();
      assert.equal(await m.LcConversation.countDocuments(), 0, "with 90 days both chats are old enough");
    });

    test("the default policy is 365 days under its own key", async () => {
      const { ensureDefaults } = require("../controllers/retentionController");
      await ensureDefaults();
      const policy = await RetentionPolicy.findOne({ key: "liveChat" }).lean();
      assert.deepEqual([policy.retentionDays, policy.enabled], [365, true]);
      assert.equal((await RetentionPolicy.findOne({ key: "chatMessages" }).lean()).retentionDays, 2555, "the clinical policy is unchanged");
    });

    test("live-chat files live under livechat/, outside the uploads/ prefix the old file cleanup works on", () => {
      const source = require("node:fs").readFileSync(require.resolve("../utils/uploadStorage"), "utf8");
      assert.match(source, /UPLOAD_PREFIX = \(process\.env\.AWS_S3_UPLOAD_PREFIX \|\| process\.env\.S3_UPLOAD_PREFIX \|\| "uploads"\)/);
      const files = require("node:fs").readFileSync(require.resolve("../services/liveChat/fileService"), "utf8");
      assert.match(files, /`livechat\/\$\{conv\.conversationId\}\//);
    });
  });
});
