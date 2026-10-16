// Super Admin chat deletion: archived chats go to Trash (30 days), can be restored or purged; the daily job purges
// what is older than 30 days. Admins get 403, open / Queue chats are refused, a trashed chat is invisible everywhere
// and the audit log never holds patient data.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A, SUPER_S, FILES } = require("./helpers/liveChatServer");
const { makeUserLimiter } = require("../routes/adminLiveChat");
const { createTrashService } = require("../services/liveChat/trashService");

const DAY = 86_400_000;
const NAME = "Zelda Quartermain";
const EMAIL = "zelda.quartermain@example.org";
const TEXT = "my knee hurts after the surgery";

describe("live chat: Super Admin delete, Trash, restore, purge", () => {
  let lc;
  let limiter = () => true;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { followUpJobMs: 60_000, graceMs: 600_000, trashLimiter: (key) => limiter(key) },
    });
  });
  after(async () => {
    await lc.close();
  });

  const SA = { user: SUPER_S, role: "superadmin" };
  const AD = { user: AGENT_A, role: "admin" };
  const rest = (method, path, who = SA, body) => lc.rest(method, path, { ...who, ...(body === undefined ? {} : { body }) });
  const conv = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const audits = () => lc.models.LcChatDeletionAudit.find().sort({ createdAt: 1 }).lean();

  // A real chat with a message (and optionally a file), then archived with the wanted shape.
  async function chat({ archived = true, reason = "resolved", live = false, closedAt = new Date(Date.now() - 2 * 86_400_000), withFile = false, email = EMAIL, ip } = {}) {
    const contact = await lc.submitContact({ name: NAME, email });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: TEXT });
    socket.close();
    let fileKey = null;
    if (withFile) {
      const up = await lc.upload(contact.token, { name: "scan.pdf", buffer: FILES.pdf, type: "application/pdf" });
      assert.equal(up.status, 200, JSON.stringify(up.body));
      fileKey = (await lc.models.LcFile.findOne({ conversationId: id }).lean()).s3Key;
      assert.ok(lc.store.has(fileKey));
    }
    if (archived) {
      await lc.models.LcConversation.updateOne(
        { conversationId: id },
        { $set: { mode: "archived", closedReason: reason, closedAt, everLive: live, lastMessageAt: closedAt, lastActivityAt: closedAt, ...(ip ? { ip } : {}) } }
      );
    }
    return { id, visitorId: contact.visitorId, token: contact.token, fileKey };
  }

  describe("access", () => {
    test("admins get 403 on every delete / trash endpoint, no session is 401", async () => {
      const c = await chat();
      for (const [method, path, body] of [
        ["POST", "/archive/delete", { ids: [c.id] }],
        ["POST", "/archive/delete-preview", { filters: {} }],
        ["GET", "/trash"],
        ["POST", "/trash/restore", { ids: [c.id] }],
        ["POST", "/trash/purge", { ids: [c.id] }],
      ]) {
        const res = await rest(method, path, AD, body);
        assert.equal(res.status, 403, `${method} ${path}`);
      }
      assert.equal((await conv(c.id)).mode, "archived", "nothing changed");
      assert.equal((await rest("GET", "/trash", { user: SUPER_S, role: "user" })).status, 403);
    });
  });

  describe("delete", () => {
    test("a Super Admin moves archived chats to Trash; they vanish from lists, Archive and search", async () => {
      const c = await chat({ email: "findme.trash@example.org" });
      const before = await rest("GET", "/archive?q=findme.trash%40example.org", SA);
      assert.equal(before.body.rows.length, 1);

      const res = await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual({ deleted: res.body.deleted, refused: res.body.refused }, { deleted: 1, refused: 0 });
      const doc = await conv(c.id);
      assert.equal(doc.mode, "trashed");
      assert.ok(doc.trash.purgeAfter - doc.trash.at >= 29.9 * DAY);

      const after = await rest("GET", "/archive?q=findme.trash%40example.org", SA);
      assert.equal(after.body.rows.length, 0);
      const lists = [(await rest("GET", "/conversations?view=ai", SA)).body, (await rest("GET", "/conversations?view=live", SA)).body];
      for (const body of lists) assert.ok(!body.conversations.some((x) => x.conversationId === c.id));
      assert.equal((await rest("GET", `/conversations/${c.id}`, SA)).status, 404);
      assert.equal((await rest("GET", `/conversations/${c.id}/transcript`, SA)).status, 404);
      const trash = await rest("GET", "/trash", SA);
      assert.ok(trash.body.rows.some((r) => r.conversationId === c.id && r.daysLeft === 30));
    });

    test("open and Queue chats are refused; only the archived one is deleted", async () => {
      const archived = await chat();
      const open = await chat({ archived: false });
      const queued = await chat({ archived: false });
      await lc.models.LcConversation.updateOne({ conversationId: queued.id }, { $set: { mode: "queue", everLive: true } });
      const live = await chat({ archived: false });
      await lc.models.LcConversation.updateOne({ conversationId: live.id }, { $set: { mode: "live", everLive: true } });

      const res = await rest("POST", "/archive/delete", SA, { ids: [archived.id, open.id, queued.id, live.id] });
      assert.equal(res.status, 200);
      assert.deepEqual({ deleted: res.body.deleted, refused: res.body.refused }, { deleted: 1, refused: 3 });
      assert.equal((await conv(archived.id)).mode, "trashed");
      assert.equal((await conv(open.id)).mode, "ai");
      assert.equal((await conv(queued.id)).mode, "queue");
      assert.equal((await conv(live.id)).mode, "live");
    });

    test("malformed ids are rejected and nothing is deleted", async () => {
      const c = await chat();
      assert.equal((await rest("POST", "/archive/delete", SA, { ids: [c.id, "x"] })).status, 400);
      assert.equal((await rest("POST", "/archive/delete", SA, { ids: [{ $ne: "" }] })).status, 400);
      assert.equal((await rest("POST", "/archive/delete", SA, { ids: [] })).status, 400);
      assert.equal((await conv(c.id)).mode, "archived");
    });

    test("filter-based delete takes exactly the matching archived chats and needs DELETE typed", async () => {
      const day = new Date(Date.now() - 40 * DAY);
      const hit1 = await chat({ closedAt: day, reason: "inactive", live: true });
      const hit2 = await chat({ closedAt: day, reason: "inactive", live: true });
      const wrongReason = await chat({ closedAt: day, reason: "resolved", live: true });
      const wrongType = await chat({ closedAt: day, reason: "inactive", live: false });
      const wrongDay = await chat({ closedAt: new Date(Date.now() - 80 * DAY), reason: "inactive", live: true });
      const open = await chat({ archived: false });
      const from = new Date(day.getTime() - 3600_000).toISOString().slice(0, 10);
      const to = new Date(day.getTime() + 3600_000).toISOString().slice(0, 10);
      const filters = { from, to, type: "live", reason: "inactive" };

      const preview = await rest("POST", "/archive/delete-preview", SA, { filters });
      assert.equal(preview.body.count, 2, JSON.stringify(preview.body));

      const noConfirm = await rest("POST", "/archive/delete", SA, { matching: true, filters });
      assert.equal(noConfirm.status, 400);
      assert.equal(noConfirm.body.error, "confirm_required");
      assert.equal((await conv(hit1.id)).mode, "archived");

      const res = await rest("POST", "/archive/delete", SA, { matching: true, filters, confirm: "DELETE" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.deleted, 2);
      for (const id of [hit1.id, hit2.id]) assert.equal((await conv(id)).mode, "trashed");
      for (const c of [wrongReason, wrongType, wrongDay]) assert.equal((await conv(c.id)).mode, "archived");
      assert.equal((await conv(open.id)).mode, "ai");

      const last = (await audits()).at(-1);
      assert.equal(last.action, "delete");
      assert.equal(last.filters.matching, true);
      assert.equal(last.filters.type, "live");
      assert.deepEqual([...last.conversationIds].sort(), [hit1.id, hit2.id].sort());
    });

    test("more than 50 chats in a selection needs DELETE typed", async () => {
      const real = await chat();
      const ids = [real.id, ...Array.from({ length: 50 }, (_, i) => `HC${String(i).padStart(8, "0")}`)];
      const res = await rest("POST", "/archive/delete", SA, { ids });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "confirm_required");
      assert.equal((await conv(real.id)).mode, "archived");
      const ok = await rest("POST", "/archive/delete", SA, { ids, confirm: "DELETE" });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.deleted, 1);
      assert.equal(ok.body.refused, 50);
    });
  });

  describe("trashed chats are excluded everywhere", () => {
    test("reports, the visitor panel, unread, translations, files, IP blocking and the jobs ignore a trashed chat", async () => {
      const ip = "203.0.113.77";
      const keep = await chat({ ip });
      const gone = await chat({ withFile: true, ip });
      // the same visitor: give the trashed chat the visitor of the kept one
      await lc.models.LcConversation.updateOne({ conversationId: gone.id }, { $set: { visitorId: keep.visitorId } });
      const today = new Date().toISOString().slice(0, 10);

      const totalBefore = (await rest("GET", `/reports?from=${today}&to=${today}`, SA)).body.chats.total;
      const panelBefore = (await rest("GET", `/visitors/${keep.visitorId}/panel`, SA)).body.panel;

      await rest("POST", "/archive/delete", SA, { ids: [gone.id] });
      // stale due dates must not make the jobs touch it
      await lc.models.LcConversation.updateOne(
        { conversationId: gone.id },
        { $set: { followUpDueAt: new Date(Date.now() - 1000), inactiveDueAt: new Date(Date.now() - 1000), patientMessageCount: 5 } }
      );

      const totalAfter = (await rest("GET", `/reports?from=${today}&to=${today}`, SA)).body.chats.total;
      assert.equal(totalAfter, totalBefore - 1, "reports no longer count it");

      const panelAfter = (await rest("GET", `/visitors/${keep.visitorId}/panel`, SA)).body.panel;
      assert.equal(panelAfter.counts.chats, panelBefore.counts.chats - 1);
      assert.ok(!panelAfter.recent.some((r) => r.conversationId === gone.id));
      const detail = (await rest("GET", `/conversations/${keep.id}`, SA)).body;
      assert.ok(!detail.panel.recent.some((r) => r.conversationId === gone.id));
      assert.equal(detail.panel.counts.chats, 1, "the chat panel count ignores it too");

      const unread = (await rest("GET", "/unread", SA)).body;
      assert.ok(Number.isInteger(unread.ai));
      const unreadBefore = unread.ai;
      await lc.models.LcConversation.updateOne({ conversationId: gone.id }, { $set: { patientMessageCount: 500 } });
      assert.equal((await rest("GET", "/unread", SA)).body.ai, unreadBefore, "its unread count is not added");

      for (const [method, path, body] of [
        ["POST", `/conversations/${gone.id}/translate`, {}],
        ["POST", `/conversations/${gone.id}/messages`, { text: "hi" }],
        ["POST", `/conversations/${gone.id}/takeover`],
        ["POST", `/conversations/${gone.id}/resolve`],
        ["POST", `/conversations/${gone.id}/block-ip`, { reason: "x" }],
        ["POST", `/conversations/${gone.id}/summary`],
      ]) {
        assert.equal((await rest(method, path, SA, body)).status, 404, `${method} ${path}`);
      }
      const file = await lc.models.LcFile.findOne({ conversationId: gone.id }).lean();
      assert.equal((await rest("GET", `/files/${file._id}/url`, SA)).status, 404);

      // follow-up and inactivity jobs leave it alone
      const snapshot = await conv(gone.id);
      await lc.livechat.chat.runFollowUpDue();
      await lc.livechat.chat.runInactiveDue();
      const afterJobs = await conv(gone.id);
      assert.equal(afterJobs.mode, "trashed");
      assert.equal(String(afterJobs.followUp?.status || ""), String(snapshot.followUp?.status || ""));
      assert.ok(afterJobs.inactiveDueAt, "the inactivity job did not touch it");

      // blocking the IP from the kept chat closes open chats on that IP but never touches Trash
      await lc.models.LcConversation.updateOne({ conversationId: keep.id }, { $set: { mode: "ai" } });
      await rest("POST", `/conversations/${keep.id}/block-ip`, SA, { reason: "spam" });
      assert.equal((await conv(gone.id)).mode, "trashed");
      assert.equal((await conv(gone.id)).closedReason, "resolved");
    });

    test("a deleted chat cannot be reopened by the patient, by message or by file", async () => {
      const c = await chat({ reason: "patient_left" });
      await lc.models.LcConversation.updateOne({ conversationId: c.id }, { $set: { leftAt: new Date(), modeBeforeLeft: "ai" } });
      await rest("POST", "/archive/delete", SA, { ids: [c.id] });

      const socket = await lc.chatSocket(c.token);
      const started = await lc.call(socket, "chat:start", {});
      assert.ok(started.conversation?.conversationId, JSON.stringify(started));
      assert.notEqual(started.conversation.conversationId, c.id, "a NEW chat, never the deleted one");
      socket.close();
      assert.equal((await conv(c.id)).mode, "trashed");

      const inactive = await chat({ reason: "inactive" });
      await rest("POST", "/archive/delete", SA, { ids: [inactive.id] });
      const socket2 = await lc.chatSocket(inactive.token);
      const resumed = await lc.call(socket2, "chat:resume", {}).catch(() => ({}));
      assert.notEqual(resumed?.conversation?.conversationId, inactive.id);
      await lc.call(socket2, "chat:message", { text: "are you there?" }).catch(() => ({}));
      socket2.close();
      assert.equal((await conv(inactive.id)).mode, "trashed");
      assert.equal(await lc.models.LcMessage.countDocuments({ conversationId: inactive.id, text: { $exists: true }, sender: "patient" }), 1, "no new message on the deleted chat");
    });
  });

  describe("restore", () => {
    test("restore brings the chat back to Archive and to reports", async () => {
      const c = await chat();
      await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      const res = await rest("POST", "/trash/restore", SA, { ids: [c.id] });
      assert.equal(res.status, 200);
      assert.equal(res.body.restored, 1);
      const doc = await conv(c.id);
      assert.equal(doc.mode, "archived");
      assert.equal(doc.trash.at, null);
      assert.ok((await rest("GET", `/archive?q=${c.id}`, SA)).body.rows.some((r) => r.conversationId === c.id));
      assert.equal((await rest("GET", `/conversations/${c.id}`, SA)).status, 200);
      assert.equal((await audits()).at(-1).action, "restore");
      // restoring something that is not in Trash is refused, not an error
      const again = await rest("POST", "/trash/restore", SA, { ids: [c.id] });
      assert.equal(again.body.restored, 0);
    });
  });

  describe("purge", () => {
    test("purge removes messages, files, S3 objects and the contact; only Trash can be purged", async () => {
      const c = await chat({ withFile: true });
      const other = await chat(); // archived, NOT in Trash
      const visitor = await lc.models.LcVisitor.findOne({ visitorId: c.visitorId }).lean();
      assert.ok(visitor);
      assert.ok((await lc.models.LcMessage.countDocuments({ conversationId: c.id })) > 0);

      const refused = await rest("POST", "/trash/purge", SA, { ids: [other.id] });
      assert.equal(refused.body.purged, 0);
      assert.equal((await conv(other.id)).mode, "archived");

      await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      const res = await rest("POST", "/trash/purge", SA, { ids: [c.id] });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.purged, 1);

      assert.equal(await conv(c.id), null);
      assert.equal(await lc.models.LcMessage.countDocuments({ conversationId: c.id }), 0);
      assert.equal(await lc.models.LcFile.countDocuments({ conversationId: c.id }), 0);
      assert.equal(await lc.models.LcPageVisit.countDocuments({ conversationId: c.id }), 0);
      assert.equal(lc.store.has(c.fileKey), false, "the S3 object is gone");
      assert.equal(await lc.models.LcVisitor.findOne({ visitorId: c.visitorId }), null, "contact removed with its last chat");
      assert.equal((await audits()).at(-1).action, "purge");
    });

    test("a storage failure keeps the chat in Trash and the contact", async () => {
      const c = await chat({ withFile: true });
      await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      lc.failures.removeKeys = new Set([c.fileKey]);
      const res = await rest("POST", "/trash/purge", SA, { ids: [c.id] });
      lc.failures.removeKeys = null;
      assert.equal(res.body.purged, 0);
      assert.equal(res.body.failedStorage, 1);
      assert.equal((await conv(c.id)).mode, "trashed");
      assert.ok(lc.store.has(c.fileKey));
      assert.ok(await lc.models.LcVisitor.findOne({ visitorId: c.visitorId }));
      const retry = await rest("POST", "/trash/purge", SA, { ids: [c.id] });
      assert.equal(retry.body.purged, 1);
      assert.equal(lc.store.has(c.fileKey), false);
    });

    test("purging all of Trash needs DELETE typed", async () => {
      const c = await chat();
      await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      const res = await rest("POST", "/trash/purge", SA, { all: true });
      assert.equal(res.status, 400);
      assert.equal((await conv(c.id)).mode, "trashed");
      const ok = await rest("POST", "/trash/purge", SA, { all: true, confirm: "DELETE" });
      assert.equal(ok.status, 200);
      assert.equal(await conv(c.id), null);
    });

    test("the daily job purges only chats that have been in Trash 30 days", async () => {
      const old = await chat({ withFile: true });
      const fresh = await chat({ withFile: true });
      await rest("POST", "/archive/delete", SA, { ids: [old.id, fresh.id] });
      await lc.models.LcConversation.updateOne({ conversationId: old.id }, { $set: { "trash.purgeAfter": new Date(Date.now() - 1000) } });

      const removed = [];
      const store = { removeMany: async (keys) => (removed.push(...keys), []) };
      const svc = createTrashService({ models: lc.models, archive: null, store });
      const out = await svc.autoPurge();
      assert.equal(out.deleted, 1);
      assert.equal(await conv(old.id), null);
      assert.deepEqual(removed, [old.fileKey]);
      assert.equal((await conv(fresh.id)).mode, "trashed");
      const last = (await audits()).at(-1);
      assert.equal(last.action, "auto_purge");
      assert.equal(last.actorId, null);
    });
  });

  describe("audit log and rate limit", () => {
    test("audit entries hold who, when, how many and ids, and no patient data", async () => {
      const c = await chat({ email: "audit.check@example.org" });
      await rest("POST", "/archive/delete", SA, { ids: [c.id] });
      await rest("POST", "/trash/restore", SA, { ids: [c.id] });
      await rest("POST", "/archive/delete", SA, { matching: true, filters: { q: "audit.check@example.org" }, confirm: "DELETE" });
      await rest("POST", "/trash/purge", SA, { ids: [c.id] });

      const rows = await audits();
      const mine = rows.filter((r) => r.conversationIds.includes(c.id));
      assert.deepEqual(mine.map((r) => r.action), ["delete", "restore", "delete", "purge"]);
      for (const row of mine) {
        assert.equal(String(row.actorId), SUPER_S);
        assert.equal(row.actorRole, "superadmin");
        assert.ok(row.createdAt);
        assert.equal(row.count, row.conversationIds.length);
      }
      assert.equal(mine[2].filters.hasSearch, true);
      const dump = JSON.stringify(rows);
      for (const secret of [NAME, "Zelda", "Quartermain", EMAIL, "audit.check", "example.org", TEXT, "knee"]) {
        assert.ok(!dump.toLowerCase().includes(secret.toLowerCase()), `audit log must not contain ${secret}`);
      }
    });

    test("the delete endpoints are rate limited per Super Admin", async () => {
      limiter = makeUserLimiter({ max: 3 });
      try {
        const statuses = [];
        for (let i = 0; i < 5; i += 1) statuses.push((await rest("POST", "/archive/delete", SA, { ids: ["HC00000000"] })).status);
        assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
        // reading Trash is not limited
        assert.equal((await rest("GET", "/trash", SA)).status, 200);
      } finally {
        limiter = () => true;
      }
    });
  });
});
