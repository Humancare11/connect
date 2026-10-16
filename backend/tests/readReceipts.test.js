const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { parseGmailMessage, parseDispositionNotification } = require("../services/gmail/mimeParser");
const { ingestParsed } = require("../services/gmail/syncMailbox");
const { buildRawMessage } = require("../services/gmail/mimeBuilder");
const { planReceipt } = require("../services/email/emailTracking");
const { computeReadStatus } = require("../services/email/readStatus");

const b64 = (s) => Buffer.from(s).toString("base64url");
const SENT_AT = new Date("2026-10-05T10:00:00Z");
const RECEIPT_AT = new Date("2026-10-05T12:30:00Z");
const ACTIVE = { active: true, baseUrl: "https://uat.example.com", disclosureEnabled: false, disclosureText: "" };

// A read receipt as Gmail's API returns it (format=full).
function mdn({ id = "rcpt1", original = "<orig-1@humancareconnect.co>", disposition = "manual-action/MDN-sent-manually; displayed", bodyOriginal = true, reportType = "disposition-notification", date = RECEIPT_AT, labels = ["INBOX", "UNREAD"] } = {}) {
  const lines = ["Reporting-UA: Outlook; 16.0", "Final-Recipient: rfc822; Anita@Gmail.com"];
  if (bodyOriginal) lines.push(`Original-Message-ID: ${original}`);
  lines.push(`Disposition: ${disposition}`);
  return {
    id,
    threadId: "THREAD-1",
    labelIds: labels,
    internalDate: String(date.getTime()),
    payload: {
      mimeType: "multipart/report",
      headers: [
        { name: "Content-Type", value: `multipart/report; report-type=${reportType}; boundary="b1"` },
        { name: "From", value: "Anita <anita@gmail.com>" },
        { name: "To", value: "support@humancareconnect.co" },
        { name: "Subject", value: "Read: Hello" },
        { name: "Message-ID", value: `<${id}@gmail.com>` },
        { name: "In-Reply-To", value: original },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: b64("Your message was displayed on Anita's computer.") } },
        { mimeType: reportType === "disposition-notification" ? "message/disposition-notification" : "message/delivery-status", body: { data: b64(lines.join("\r\n") + "\r\n") } },
      ],
    },
  };
}

describe("parsing a read receipt", () => {
  test("a disposition notification is recognised and its fields read", () => {
    const p = parseGmailMessage(mdn());
    assert.deepEqual(p.receipt, { originalMessageId: "<orig-1@humancareconnect.co>", disposition: "displayed", finalRecipient: "anita@gmail.com" });
    assert.equal(p.attachments.length, 0, "the machine part is not an attachment");
    assert.match(p.text, /was displayed/);
  });

  test("a delivery failure report is ordinary mail, not a receipt", () => {
    assert.equal(parseGmailMessage(mdn({ reportType: "delivery-status" })).receipt, null);
  });

  test("ordinary mail has no receipt", () => {
    const p = parseGmailMessage({ id: "m", threadId: "t", labelIds: ["INBOX"], internalDate: "1", payload: { mimeType: "text/plain", headers: [{ name: "From", value: "a@b.co" }], body: { data: b64("hi") } } });
    assert.equal(p.receipt, null);
  });

  test("dispositions: only the type after the semicolon counts; folded lines and junk are tolerated", () => {
    const d = (t) => parseDispositionNotification(t);
    assert.equal(d("Disposition: automatic-action/MDN-sent-automatically; displayed").disposition, "displayed");
    assert.equal(d("Disposition: manual-action/MDN-sent-manually; deleted").disposition, "deleted");
    assert.equal(d("Disposition: manual-action/MDN-sent-manually; displayed/error").disposition, "displayed");
    assert.equal(d("Original-Message-ID:\r\n <folded@x>\r\nDisposition: a/b; DENIED").originalMessageId, "<folded@x>");
    assert.equal(d("Disposition: a/b; denied").disposition, "denied");
    assert.deepEqual(d(""), { originalMessageId: "", disposition: "", finalRecipient: "" });
    assert.equal(d("Final-Recipient: rfc822; not an address").finalRecipient, "");
  });
});

describe("read receipts in the sync and the screens", () => {
  let mongod, server, base, support, priya, original;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const get = async (path) => (await fetch(base + path, { headers: { "x-test-admin": String(priya._id) } })).json();

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailTrackingOptOut.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", adminEmail.create({ guard: [fakeAuth] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailTrackingOptOut.deleteMany({}), User.deleteMany({})]);
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    original = await sentMail();
  });

  async function sentMail(over = {}) {
    const doc = new EmailMessage({
      mailbox: support._id, direction: "out", status: "sent", gmailMessageId: `g${Math.random()}`, gmailThreadId: "THREAD-1",
      rfcMessageId: "<orig-1@humancareconnect.co>", from: { address: support.address }, to: [{ address: "anita@gmail.com" }],
      subject: "Hello", messageDate: SENT_AT, sentByAdmin: priya._id, sentByName: "Priya",
      tracking: { enabled: false, status: "unavailable", unavailableReason: "mail_off", receiptRequested: true }, ...over,
    });
    doc.setContent({ text: "hi", html: "", snippet: "hi" });
    await doc.save();
    return doc;
  }
  const ingest = (msg) => ingestParsed(support, parseGmailMessage(msg));
  const fresh = (id) => EmailMessage.findById(id).lean();

  test("a displayed receipt is attached to the original as 'Read receipt'", async () => {
    assert.equal(await ingest(mdn()), "created");
    const o = await fresh(original._id);
    assert.deepEqual([o.tracking.receiptAt, o.tracking.receiptBy], [RECEIPT_AT, "anita@gmail.com"]);
    assert.equal(o.status, "sent", "a receipt is not a reply");
    assert.equal(o.repliedAt, null);
    assert.equal(computeReadStatus(o).status, "receipt");
  });

  test("the receipt itself is stored (so the sync does not import it twice) but flagged", async () => {
    await ingest(mdn());
    const r = await EmailMessage.findOne({ gmailMessageId: "rcpt1" }).lean();
    assert.equal(r.isReceipt, true);
    assert.equal(await ingest(mdn()), "skipped", "re-syncing it is a no-op");
    assert.equal(await EmailMessage.countDocuments({ gmailMessageId: "rcpt1" }), 1);
  });

  test("it is hidden from Received, Spam, All mail, counts and the thread", async () => {
    // An unread ordinary mail for contrast.
    const real = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "real", from: { address: "c@gmail.com" }, to: [{ address: support.address }], subject: "Question", messageDate: new Date() });
    real.setContent({ text: "q", html: "", snippet: "q" });
    await real.save();
    await ingest(mdn());

    const inbox = await get("/messages?folder=inbox");
    assert.deepEqual(inbox.items.map((i) => i.subject), ["Question"]);
    const all = await get("/messages?folder=all");
    assert.ok(!all.items.some((i) => i.subject === "Read: Hello"));
    assert.equal((await get("/messages?folder=spam")).items.length, 0);
    const boxes = await get("/mailboxes");
    assert.equal(boxes.counts.unread ?? boxes.counts.received ?? boxes.mailboxes[0].unread, 1, "only the real mail is unread");

    const page = await get(`/messages/${original._id}`);
    assert.deepEqual(page.thread.map((m) => m.subject), ["Hello"]);
    const rid = (await EmailMessage.findOne({ gmailMessageId: "rcpt1" }))._id;
    const res = await fetch(`${base}/messages/${rid}`, { headers: { "x-test-admin": String(priya._id) } });
    assert.equal(res.status, 404);
  });

  test("the Sent row and the mail page show Read receipt, with who and when", async () => {
    await ingest(mdn());
    const list = await get("/messages?folder=sent");
    const row = list.items.find((i) => i.subject === "Hello");
    assert.equal(row.tracking.readStatus, "receipt");
    assert.deepEqual([row.tracking.signals.receipt.at, row.tracking.signals.receipt.by], [RECEIPT_AT.toISOString(), "anita@gmail.com"]);
    assert.equal((await get("/messages?folder=sent&readStatus=receipt")).items.length, 1);
    assert.equal((await get("/messages?folder=sent&readStatus=unavailable")).items.length, 0);
  });

  test("'deleted' and 'denied' receipts are hidden but say nothing about a read", async () => {
    await ingest(mdn({ id: "r-del", disposition: "manual-action/MDN-sent-manually; deleted" }));
    await ingest(mdn({ id: "r-den", disposition: "manual-action/MDN-sent-manually; denied" }));
    assert.equal((await fresh(original._id)).tracking.receiptAt, null);
    assert.equal(await EmailMessage.countDocuments({ isReceipt: true }), 2);
    assert.equal((await get("/messages?folder=inbox")).items.length, 0);
  });

  test("a receipt for a mail that never asked for one is ignored (hidden, not recorded)", async () => {
    await EmailMessage.updateOne({ _id: original._id }, { "tracking.receiptRequested": false });
    await ingest(mdn());
    assert.equal((await fresh(original._id)).tracking.receiptAt, null);
    assert.equal(await EmailMessage.countDocuments({ isReceipt: true }), 1);
  });

  test("an unknown Original-Message-ID is hidden and changes nothing", async () => {
    await ingest(mdn({ id: "r-x", original: "<nobody@elsewhere.example>" }));
    assert.equal((await fresh(original._id)).tracking.receiptAt, null);
    assert.equal((await get("/messages?folder=inbox")).items.length, 0);
  });

  test("In-Reply-To is the fallback when the report names no Original-Message-ID", async () => {
    await ingest(mdn({ id: "r-fb", bodyOriginal: false }));
    assert.deepEqual((await fresh(original._id)).tracking.receiptAt, RECEIPT_AT);
  });

  test("the first receipt wins; a later one does not move it", async () => {
    await ingest(mdn({ id: "r1", date: RECEIPT_AT }));
    await ingest(mdn({ id: "r2", date: new Date(RECEIPT_AT.getTime() + 3600_000) }));
    assert.deepEqual((await fresh(original._id)).tracking.receiptAt, RECEIPT_AT);
  });

  test("a recipient who opted out after sending is not recorded", async () => {
    await EmailTrackingOptOut.create({ address: "anita@gmail.com" });
    await ingest(mdn());
    assert.equal((await fresh(original._id)).tracking.receiptAt, null);
    assert.equal((await get("/messages?folder=inbox")).items.length, 0, "still hidden");
  });

  test("a receipt in the same Gmail thread never turns the sent mail into 'replied'", async () => {
    await ingest(mdn());
    assert.equal((await fresh(original._id)).status, "sent");
    assert.equal((await get("/messages?folder=sent&status=noreply")).items.length, 1);
  });

  test("moving a receipt out of Spam in Gmail does not mark mail replied either", async () => {
    await ingest(mdn({ id: "r-spam", labels: ["SPAM", "UNREAD"] }));
    await ingest(mdn({ id: "r-spam", labels: ["INBOX", "UNREAD"] }));
    assert.equal((await fresh(original._id)).status, "sent");
  });
});

describe("asking for a read receipt", () => {
  const mailbox = { _id: new mongoose.Types.ObjectId(), address: "support@humancareconnect.co", isActive: true, signature: "Human Care Connect" };
  const to = [{ name: "", address: "anita@gmail.com" }];

  test("the header names our own mailbox, only when asked", async () => {
    const withIt = (await buildRawMessage({ mailbox, to, subject: "Hi", body: "x", requestReceipt: true })).raw.toString();
    assert.match(withIt, /^Disposition-Notification-To: support@humancareconnect\.co\r?$/m);
    const without = (await buildRawMessage({ mailbox, to, subject: "Hi", body: "x" })).raw.toString();
    assert.ok(!/Disposition-Notification-To/i.test(without));
  });

  test("it works on a plain-text mail with no image or links", async () => {
    const raw = (await buildRawMessage({ mailbox, to, subject: "Hi", body: "x", requestReceipt: true, tracking: null })).raw.toString();
    assert.match(raw, /Disposition-Notification-To/);
    assert.ok(!/multipart\/alternative/i.test(raw));
  });

  describe("planReceipt", () => {
    let mongod;
    before(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      await EmailTrackingOptOut.init();
    });
    after(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    });
    beforeEach(() => EmailTrackingOptOut.deleteMany({}));

    const plan = (over = {}) => planReceipt({ to, cc: [], requested: true, state: ACTIVE, ...over });

    test("default off: only a ticked box asks", async () => {
      assert.deepEqual(await plan({ requested: undefined }), { enabled: false, reason: "not_requested" });
      assert.deepEqual(await plan({ requested: false }), { enabled: false, reason: "not_requested" });
      assert.deepEqual(await plan(), { enabled: true });
    });
    test("needs tracking to be active", async () => {
      assert.equal((await plan({ state: { ...ACTIVE, active: false } })).reason, "tracking_off");
    });
    test("company addresses follow the Super Admin toggle", async () => {
      const internal = [{ address: "boss@humancareconnect.co" }];
      assert.equal((await plan({ to: internal })).enabled, true);
      assert.equal((await plan({ to: internal, state: { ...ACTIVE, trackInternalRecipients: false } })).reason, "internal_recipients");
    });
    test("an opted-out recipient is never asked", async () => {
      await EmailTrackingOptOut.create({ address: "optout@gmail.com" });
      assert.equal((await plan({ cc: [{ address: "OptOut@gmail.com" }] })).reason, "opted_out");
    });
  });
});
