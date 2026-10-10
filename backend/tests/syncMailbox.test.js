const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const { syncMailbox, OUTSIDE_REPLIER } = require("../services/gmail/syncMailbox");
const { HistoryExpiredError } = require("../services/gmail/gmailClient");

const ME = "support@humancareconnect.co";
const b64 = (s) => Buffer.from(s).toString("base64url");
const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);

// Builds a Gmail `format=full` message.
function gm({ id, thread = id, labels = ["INBOX"], from = "Anita <anita@gmail.com>", to = ME, subject = "Hello", body = "Body text", at = 0, messageId, inReplyTo, attachment }) {
  const headers = [
    { name: "From", value: from },
    { name: "To", value: to },
    { name: "Subject", value: subject },
    { name: "Message-ID", value: messageId || `<${id}@mail.test>` },
  ];
  if (inReplyTo) headers.push({ name: "In-Reply-To", value: inReplyTo });
  const parts = [{ mimeType: "text/plain", body: { data: b64(body) } }];
  if (attachment) parts.push({ mimeType: "application/pdf", filename: attachment, partId: "1", body: { attachmentId: `att-${id}`, size: 100 } });
  return { id, threadId: thread, labelIds: labels, internalDate: String(T0 + at * 60_000), payload: { mimeType: "multipart/mixed", headers, parts } };
}

// Fake Gmail: `store` holds messages; scripts for history / profile.
function fakeGmail({ messages = [], historyId = "100", history, expired = false, spamQ, inboxQ } = {}) {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const calls = { getMessage: [], listHistory: 0, listMessageIds: [] };
  return {
    byId,
    calls,
    async getProfile() { return { emailAddress: ME, historyId }; },
    async listHistory() {
      calls.listHistory += 1;
      if (expired) throw new HistoryExpiredError();
      return history || { addedIds: [], labelChangedIds: [], historyId };
    },
    async listMessageIds(opts) {
      calls.listMessageIds.push(opts.q);
      if (opts.q.startsWith("in:spam")) return spamQ || [];
      if (opts.q.startsWith("in:inbox")) return inboxQ || [];
      if (opts.q.startsWith("is:unread")) return [...byId.values()].filter((m) => (m.labelIds || []).includes("UNREAD")).map((m) => m.id);
      return [...byId.keys()];
    },
    async getMessage(id) { calls.getMessage.push(id); return byId.get(id) || null; },
  };
}

describe("syncMailbox", () => {
  let mongod;
  let mailbox;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({})]);
    mailbox = await Mailbox.create({ address: ME, displayName: "Support" });
  });

  const sync = (client, opts = {}) => syncMailbox(mailbox._id, { client, owner: "test", ...opts });
  const rows = (q = {}) => EmailMessage.find({ mailbox: mailbox._id, ...q }).sort({ messageDate: 1 });

  test("first run backfills inbox, spam and sent mail and records the history id", async () => {
    const client = fakeGmail({
      historyId: "500",
      messages: [
        gm({ id: "a", subject: "Report problem", body: "Cannot download my report", at: 1, attachment: "shot.pdf" }),
        gm({ id: "b", labels: ["SPAM"], from: "x@cheap.biz", subject: "WIN", at: 2 }),
        gm({ id: "c", labels: ["SENT"], from: ME, to: "anita@gmail.com", subject: "Re: Report problem", at: 3 }),
        gm({ id: "d", labels: ["DRAFT"], at: 4 }),
        gm({ id: "e", labels: ["TRASH"], at: 5 }),
      ],
    });
    const res = await sync(client);
    assert.equal(res.mode, "backfill");
    assert.equal(res.created, 3);

    const all = await rows();
    assert.deepEqual(all.map((m) => m.gmailMessageId), ["a", "b", "c"]);
    const [inbound, spam, sent] = all;
    assert.equal(inbound.direction, "in");
    assert.equal(inbound.status, "received");
    assert.equal(inbound.isSpam, false);
    assert.equal(inbound.hasAttachments, true);
    assert.equal(inbound.firstViewedAt, null);
    assert.equal(spam.isSpam, true);
    assert.equal(sent.direction, "out");
    assert.equal(sent.sentOutsideDashboard, true);
    assert.equal(sent.sentByAdmin, null);

    // Body is encrypted at rest but readable through the model.
    assert.ok(!JSON.stringify(inbound.toObject().content).includes("download"));
    assert.equal(inbound.getContent().text, "Cannot download my report");
    assert.equal(await EmailAttachment.countDocuments({ message: inbound._id }), 1);

    const fresh = await Mailbox.findById(mailbox._id);
    assert.equal(fresh.gmailHistoryId, "500");
    assert.ok(fresh.lastSyncAt);
    assert.equal(fresh.lastSyncError, "");
    assert.equal(fresh.syncLease.owner, "", "lease released");
  });

  test("running again does not duplicate or re-fetch mail", async () => {
    const client = fakeGmail({ messages: [gm({ id: "a" }), gm({ id: "b", at: 1 })] });
    await sync(client);
    client.calls.getMessage.length = 0;
    const res = await sync(client);
    assert.equal(res.mode, "incremental");
    assert.equal(res.created, 0);
    assert.equal(await EmailMessage.countDocuments(), 2);
    assert.deepEqual(client.calls.getMessage, [], "reconcile skips mail we already hold");
  });

  test("incremental sync stores new mail and moves the history id", async () => {
    await sync(fakeGmail({ historyId: "100", messages: [gm({ id: "a" })] }));
    const client = fakeGmail({
      historyId: "120",
      messages: [gm({ id: "a" }), gm({ id: "n", at: 10, subject: "New one" })],
      history: { addedIds: ["n"], labelChangedIds: [], historyId: "120" },
    });
    const res = await sync(client);
    assert.equal(res.created, 1);
    assert.equal((await Mailbox.findById(mailbox._id)).gmailHistoryId, "120");
  });

  test("an expired history id falls back to a backfill", async () => {
    await sync(fakeGmail({ messages: [gm({ id: "a" })] }));
    const client = fakeGmail({ historyId: "900", expired: true, messages: [gm({ id: "a" }), gm({ id: "z", at: 5 })] });
    const res = await sync(client);
    assert.equal(res.mode, "backfill");
    assert.equal(res.created, 1);
    assert.equal((await Mailbox.findById(mailbox._id)).gmailHistoryId, "900");
  });

  test("a spam label change in Gmail is mirrored", async () => {
    await sync(fakeGmail({ messages: [gm({ id: "a" })] }));
    const client = fakeGmail({
      messages: [gm({ id: "a", labels: ["SPAM"] })],
      history: { addedIds: [], labelChangedIds: ["a"], historyId: "101" },
    });
    const res = await sync(client);
    assert.equal(res.updated, 1);
    assert.equal((await EmailMessage.findOne({ gmailMessageId: "a" })).isSpam, true);
  });

  test("reconcile catches spam that history missed and fixes label drift", async () => {
    await sync(fakeGmail({ messages: [gm({ id: "a" }), gm({ id: "b", at: 1 })] }));
    await Mailbox.updateOne({ _id: mailbox._id }, { $set: { lastReconcileAt: null } });
    const client = fakeGmail({
      messages: [gm({ id: "a" }), gm({ id: "b", at: 1, labels: ["SPAM"] }), gm({ id: "s", at: 2, labels: ["SPAM"] })],
      spamQ: ["b", "s"],
      inboxQ: ["a"],
    });
    const res = await sync(client);
    assert.equal(res.reconciled, true);
    assert.equal(res.created, 1);
    assert.equal((await EmailMessage.findOne({ gmailMessageId: "b" })).isSpam, true);
    assert.equal((await EmailMessage.findOne({ gmailMessageId: "s" })).isSpam, true);
    assert.equal((await EmailMessage.findOne({ gmailMessageId: "a" })).isSpam, false);
  });

  describe("Gmail read state", () => {
    test("new inbound mail stores whether Gmail has it as read; sent mail is not tracked", async () => {
      await sync(fakeGmail({
        messages: [
          gm({ id: "u", labels: ["INBOX", "UNREAD"], at: 1 }),
          gm({ id: "r", labels: ["INBOX"], at: 2 }),
          gm({ id: "s", labels: ["SENT"], from: ME, to: "anita@gmail.com", at: 3 }),
        ],
      }));
      const by = async (id) => (await EmailMessage.findOne({ gmailMessageId: id })).gmailRead;
      assert.deepEqual([await by("u"), await by("r"), await by("s")], [false, true, false]);
    });

    test("label changes keep it current in both directions (read in Gmail, then marked unread again)", async () => {
      await sync(fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX", "UNREAD"] })] }));
      assert.equal((await EmailMessage.findOne({ gmailMessageId: "a" })).gmailRead, false);

      const readNow = fakeGmail({
        messages: [gm({ id: "a", labels: ["INBOX"] })],
        history: { addedIds: [], labelChangedIds: ["a"], historyId: "101" },
      });
      assert.equal((await sync(readNow)).updated, 1);
      assert.equal((await EmailMessage.findOne({ gmailMessageId: "a" })).gmailRead, true);

      const unreadAgain = fakeGmail({
        messages: [gm({ id: "a", labels: ["INBOX", "UNREAD"] })],
        history: { addedIds: [], labelChangedIds: ["a"], historyId: "102" },
      });
      await sync(unreadAgain);
      assert.equal((await EmailMessage.findOne({ gmailMessageId: "a" })).gmailRead, false);
    });

    test("it never touches who viewed the mail in the dashboard, and never writes to Gmail", async () => {
      await sync(fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX", "UNREAD"] })] }));
      const admin = new mongoose.Types.ObjectId();
      await EmailMessage.updateOne({ gmailMessageId: "a" }, { $set: { firstViewedBy: admin, firstViewedByName: "Priya", firstViewedAt: new Date(T0) } });
      const client = fakeGmail({
        messages: [gm({ id: "a", labels: ["INBOX"] })],
        history: { addedIds: [], labelChangedIds: ["a"], historyId: "101" },
      });
      client.modifyLabels = () => { throw new Error("the sync must not write to Gmail"); };
      client.setSpam = client.modifyLabels;
      await sync(client);
      const row = await EmailMessage.findOne({ gmailMessageId: "a" });
      assert.deepEqual([row.gmailRead, String(row.firstViewedBy), row.firstViewedByName], [true, String(admin), "Priya"]);
    });

    test("one-time pass copies Gmail's read state onto mail stored before the flag existed, once only", async () => {
      // Stored earlier (flag defaulted to false), mailbox already synced and reconciled.
      await sync(fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] }), gm({ id: "b", labels: ["INBOX", "UNREAD"], at: 1 })] }));
      await EmailMessage.updateMany({}, { $set: { gmailRead: false } });
      await Mailbox.updateOne({ _id: mailbox._id }, { $set: { readStateBackfillV2At: null, lastReconcileAt: new Date() } });

      const client = fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] }), gm({ id: "b", labels: ["INBOX", "UNREAD"], at: 1 })] });
      const res = await sync(client);
      assert.equal(res.readStateChanged, 1);
      const by = async (id) => (await EmailMessage.findOne({ gmailMessageId: id })).gmailRead;
      assert.deepEqual([await by("a"), await by("b")], [true, false]);
      assert.ok((await Mailbox.findById(mailbox._id)).readStateBackfillV2At, "marked done");
      assert.ok(client.calls.listMessageIds.some((q) => q.startsWith("is:unread newer_than:30d")));

      const again = fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] })] });
      await sync(again);
      assert.equal(again.calls.listMessageIds.some((q) => q.startsWith("is:unread")), false, "not repeated outside reconcile");
    });

    // Mail stored before gmailRead existed has no such field. These rows are inserted straight into the
    // collection (bypassing Mongoose defaults) the way UAT's existing mail looks; {gmailRead:false} would not match them.
    async function legacyRows(ids) {
      await EmailMessage.collection.insertMany(
        ids.map((id, i) => ({
          mailbox: mailbox._id, direction: "in", status: "received", gmailMessageId: id, gmailThreadId: id,
          from: { name: "", address: "c@gmail.com" }, to: [], cc: [], subject: "legacy", messageDate: new Date(T0 + i * 60_000),
          isSpam: false, hasAttachments: false, attachmentCount: 0, firstViewedAt: null,
        }))
      );
      assert.equal(await EmailMessage.collection.countDocuments({ gmailRead: { $exists: true } }), 0, "fixture has no gmailRead field");
    }
    const rawState = async (id) => (await EmailMessage.collection.findOne({ gmailMessageId: id })).gmailRead;

    test("one-time pass reaches legacy mail that has no gmailRead field, and re-runs after the old marker was spent", async () => {
      await legacyRows(["a", "b"]);
      // The first version of the pass already ran (and matched nothing); only the old marker exists.
      await Mailbox.collection.updateOne({ _id: mailbox._id }, { $set: { gmailHistoryId: "100", lastReconcileAt: new Date(), readStateBackfilledAt: new Date() } });

      const client = fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] }), gm({ id: "b", labels: ["INBOX", "UNREAD"], at: 1 })] });
      const res = await sync(client);
      assert.equal(res.readStateChanged, 1, "a (read in Gmail) was updated");
      assert.deepEqual([await rawState("a"), await rawState("b")], [true, undefined], "b stays unread");
      assert.ok((await Mailbox.findById(mailbox._id)).readStateBackfillV2At);

      const again = fakeGmail({ messages: [] });
      await sync(again);
      assert.equal(again.calls.listMessageIds.some((q) => q.startsWith("is:unread")), false, "runs once");
    });

    test("the 10-minute reconcile also reaches legacy mail with no gmailRead field", async () => {
      await legacyRows(["a", "b"]);
      await Mailbox.collection.updateOne({ _id: mailbox._id }, { $set: { gmailHistoryId: "100", lastReconcileAt: null, readStateBackfillV2At: new Date() } });

      const client = fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] }), gm({ id: "b", labels: ["INBOX", "UNREAD"], at: 1 })] });
      const res = await sync(client);
      assert.equal(res.reconciled, true);
      assert.deepEqual([await rawState("a"), await rawState("b")], [true, undefined]);
    });

    test("the reconcile pass fixes read state that history missed, both ways", async () => {
      await sync(fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX", "UNREAD"] }), gm({ id: "b", labels: ["INBOX"], at: 1 })] }));
      assert.deepEqual([(await EmailMessage.findOne({ gmailMessageId: "a" })).gmailRead, (await EmailMessage.findOne({ gmailMessageId: "b" })).gmailRead], [false, true]);
      await Mailbox.updateOne({ _id: mailbox._id }, { $set: { lastReconcileAt: null } });

      // Gmail now says: a was read, b was marked unread; history reported nothing.
      const client = fakeGmail({ messages: [gm({ id: "a", labels: ["INBOX"] }), gm({ id: "b", labels: ["INBOX", "UNREAD"], at: 1 })] });
      const res = await sync(client);
      assert.equal(res.reconciled, true);
      assert.deepEqual([(await EmailMessage.findOne({ gmailMessageId: "a" })).gmailRead, (await EmailMessage.findOne({ gmailMessageId: "b" })).gmailRead], [true, false]);
    });
  });

  test("a client's answer marks our earlier sent mail as replied", async () => {
    const admin = new mongoose.Types.ObjectId();
    await EmailMessage.create({
      mailbox: mailbox._id, direction: "out", gmailMessageId: "out1", gmailThreadId: "t1",
      rfcMessageId: "<out1@humancareconnect.co>", from: { address: ME }, to: [{ address: "anita@gmail.com" }],
      subject: "Appointment", messageDate: new Date(T0), status: "sent", sentByAdmin: admin, sentByName: "Priya Patil",
    });
    const client = fakeGmail({
      messages: [gm({ id: "in1", thread: "t1", subject: "Re: Appointment", at: 5, inReplyTo: "<out1@humancareconnect.co>" })],
    });
    await sync(client);
    const out = await EmailMessage.findOne({ gmailMessageId: "out1" });
    assert.equal(out.status, "replied");
    assert.equal(out.repliedAt.getTime(), T0 + 5 * 60_000);
    assert.equal(String(out.sentByAdmin), String(admin), "attribution untouched");
  });

  test("spam in a thread does not count as the client replying", async () => {
    await EmailMessage.create({
      mailbox: mailbox._id, direction: "out", gmailMessageId: "out1", gmailThreadId: "t1",
      from: { address: ME }, to: [{ address: "anita@gmail.com" }], subject: "Hi", messageDate: new Date(T0), status: "sent",
    });
    await sync(fakeGmail({ messages: [gm({ id: "sp", thread: "t1", labels: ["SPAM"], at: 3 })] }));
    assert.equal((await EmailMessage.findOne({ gmailMessageId: "out1" })).status, "sent");
  });

  test("a mail we created before sending is adopted, not duplicated", async () => {
    const admin = new mongoose.Types.ObjectId();
    await EmailMessage.create({
      mailbox: mailbox._id, direction: "out", gmailMessageId: null, rfcMessageId: "<mine@humancareconnect.co>",
      from: { address: ME }, to: [{ address: "kavita@outlook.com" }], subject: "Welcome",
      messageDate: new Date(T0), status: "sending", sentByAdmin: admin, sentByName: "Aman Verma",
    });
    await sync(fakeGmail({
      messages: [gm({ id: "gsent", thread: "tt", labels: ["SENT"], from: ME, to: "kavita@outlook.com", messageId: "<mine@humancareconnect.co>" })],
    }));
    const all = await EmailMessage.find({ direction: "out" });
    assert.equal(all.length, 1);
    assert.equal(all[0].gmailMessageId, "gsent");
    assert.equal(all[0].gmailThreadId, "tt");
    assert.equal(all[0].status, "sent");
    assert.equal(all[0].sentOutsideDashboard, false);
    assert.equal(String(all[0].sentByAdmin), String(admin));
  });

  test("a reply sent from the Gmail website marks earlier inbound mail as replied", async () => {
    await EmailMessage.create({
      mailbox: mailbox._id, direction: "in", gmailMessageId: "in1", gmailThreadId: "t9", status: "received",
      from: { address: "anita@gmail.com" }, subject: "Help", messageDate: new Date(T0),
    });
    await sync(fakeGmail({
      messages: [gm({ id: "web", thread: "t9", labels: ["SENT"], from: ME, to: "anita@gmail.com", at: 4 })],
    }));
    const inbound = await EmailMessage.findOne({ gmailMessageId: "in1" });
    assert.ok(inbound.repliedAt);
    assert.equal(inbound.repliedByName, OUTSIDE_REPLIER);
    assert.equal(inbound.repliedBy, null);
  });

  test("only one runner holds the lease; a live lease makes the run skip", async () => {
    await Mailbox.acquireLease(mailbox._id, "other-instance", 60_000);
    const client = fakeGmail({ messages: [gm({ id: "a" })] });
    assert.deepEqual(await sync(client), { skipped: true });
    assert.equal(await EmailMessage.countDocuments(), 0);
    assert.equal(await Mailbox.acquireLease(mailbox._id, "third", 60_000), null);
    assert.ok(await Mailbox.acquireLease(mailbox._id, "other-instance", 60_000), "owner can renew");
  });

  test("an expired lease can be taken over", async () => {
    await Mailbox.acquireLease(mailbox._id, "crashed", -1000);
    assert.ok(await Mailbox.acquireLease(mailbox._id, "new-owner", 60_000));
  });

  test("a failure is recorded, keeps the history id, and releases the lease", async () => {
    await sync(fakeGmail({ historyId: "100", messages: [gm({ id: "a" })] }));
    const client = fakeGmail({ messages: [] });
    client.listHistory = async () => { throw new Error("boom: Gmail unavailable"); };
    await assert.rejects(sync(client), /boom/);
    const fresh = await Mailbox.findById(mailbox._id);
    assert.equal(fresh.gmailHistoryId, "100");
    assert.match(fresh.lastSyncError, /boom/);
    assert.equal(fresh.syncLease.owner, "");
  });

  test("an inactive mailbox is never synced", async () => {
    await Mailbox.updateOne({ _id: mailbox._id }, { $set: { isActive: false } });
    assert.deepEqual(await sync(fakeGmail({ messages: [gm({ id: "a" })] })), { skipped: true });
  });
});
