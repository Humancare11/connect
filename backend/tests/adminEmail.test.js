const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailView = require("../models/EmailView");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { adminOnly } = require("../middleware/verifyToken");

const NOW = Date.now();
const ago = (h) => new Date(NOW - h * 3_600_000);

describe("admin email read API", () => {
  let mongod, server, base;
  let support, tech, priya, aman, rahul;
  let ids;

  // Test auth: the acting admin id comes from a header, standing in for the verified session.
  const fakeAuth = (req, res, next) => {
    const id = req.headers["x-test-admin"];
    if (!id) return res.status(401).json({ msg: "No token provided." });
    req.user = { id, role: "admin" };
    next();
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailView.init(), User.init()]);
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

  const get = async (path, as) => {
    const res = await fetch(base + path, { headers: as ? { "x-test-admin": String(as._id) } : {} });
    return { status: res.status, body: await res.json(), raw: null };
  };
  const post = async (path, as) => {
    const res = await fetch(base + path, { method: "POST", headers: as ? { "x-test-admin": String(as._id) } : {} });
    return { status: res.status, body: await res.json() };
  };

  let seq = 0;
  async function mk(box, o) {
    seq += 1;
    const doc = new EmailMessage({
      mailbox: box._id,
      direction: "in",
      status: "received",
      gmailMessageId: `g${seq}`,
      gmailThreadId: o.thread || `t${seq}`,
      from: { name: o.name || "Client", address: o.from || "client@gmail.com" },
      to: o.to || [{ address: box.address }],
      subject: o.subject || "Subject",
      messageDate: o.at ?? ago(1),
      ...o.fields,
    });
    if (doc.direction === "out") {
      doc.from = { name: "Human Care Connect", address: box.address };
      if (!o.fields?.status) doc.status = "sent";
    }
    doc.setContent({ text: o.body || "Body", html: o.html || "", snippet: o.snippet || o.body || "Body" });
    await doc.save();
    return doc;
  }

  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailView.deleteMany({}), User.deleteMany({})]);
    [rahul, priya, aman] = await User.create([
      { name: "Rahul Sharma", email: "rahul@x.co", role: "superadmin" },
      { name: "Priya Patil", email: "priya@x.co", role: "admin" },
      { name: "Aman Verma", email: "aman@x.co", role: "admin" },
    ]);
    [support, tech] = await Mailbox.create([
      { address: "support@humancareconnect.co", displayName: "Support", sortOrder: 1 },
      { address: "tech@humancareconnect.co", displayName: "Tech", sortOrder: 2 },
    ]);
    ids = {};
    ids.in1 = (await mk(support, { name: "Anita Joshi", from: "anita.joshi@gmail.com", subject: "Re: Appointment", body: "Thank you, I will come on time", at: ago(0.1), thread: "T-appt" }))._id;
    ids.spam1 = (await mk(tech, { name: "SEO Experts", from: "offers@cheap-seo.biz", subject: "Rank #1 in 7 days", at: ago(0.8), fields: { isSpam: true } }))._id;
    ids.in2 = (await mk(support, { name: "Meera Desai", from: "meera@gmail.com", subject: "Report download problem", at: ago(1), fields: { hasAttachments: true, attachmentCount: 1 } }))._id;
    ids.in3 = (await mk(support, { name: "Vikram Rao", from: "vikram@outlook.com", subject: "Invoice copy", at: ago(6), fields: { repliedAt: ago(5), repliedBy: aman._id, repliedByName: "Aman Verma" } }))._id;
    ids.out1 = (await mk(support, { subject: "Appointment confirmed", to: [{ address: "anita.joshi@gmail.com" }], at: ago(3), thread: "T-appt",
      fields: { direction: "out", sentByAdmin: priya._id, sentByName: "Priya Patil", hasAttachments: true, attachmentCount: 1, status: "replied", repliedAt: ago(0.1) } }))._id;
    ids.out2 = (await mk(tech, { subject: "Server downtime RCA", to: [{ address: "vendor@cloudhost.in" }], at: ago(2),
      fields: { direction: "out", sentByAdmin: rahul._id, sentByName: "Rahul Sharma" } }))._id;
    ids.out3 = (await mk(support, { subject: "Welcome", to: [{ address: "kavita@outlook.com" }], at: ago(4),
      fields: { direction: "out", sentByAdmin: aman._id, sentByName: "Aman Verma", status: "failed", failureReason: "Recipient address rejected" } }))._id;
    await EmailAttachment.create({ message: ids.out1, mailbox: support._id, filename: "Appointment_Slip.pdf", mimeType: "application/pdf", size: 182000 });
  });

  const subjects = (res) => res.body.items.map((i) => i.subject);

  describe("access", () => {
    test("rejects requests without a session", async () => {
      assert.equal((await get("/messages")).status, 401);
      assert.equal((await get("/mailboxes")).status, 401);
    });

    test("rejects a session whose user no longer exists or is disabled", async () => {
      await User.updateOne({ _id: priya._id }, { $set: { accountDisabled: true } });
      assert.equal((await get("/messages", priya)).status, 401);
      assert.equal((await get("/messages", { _id: new mongoose.Types.ObjectId() })).status, 401);
    });

    test("the production guard is verifyAdminToken + adminOnly, and adminOnly refuses paymentadmin", () => {
      let status;
      const res = { status(s) { status = s; return this; }, json() { return this; } };
      let passed = false;
      adminOnly({ user: { role: "paymentadmin" }, originalUrl: "/x", headers: {}, ip: "1.1.1.1", socket: {} }, res, () => { passed = true; });
      assert.equal(passed, false);
      assert.equal(status, 403);
      adminOnly({ user: { role: "admin" } }, res, () => { passed = true; });
      assert.equal(passed, true);
      passed = false;
      adminOnly({ user: { role: "superadmin" } }, res, () => { passed = true; });
      assert.equal(passed, true);
    });
  });

  describe("GET /mailboxes", () => {
    test("returns unread counts: not viewed by anyone, spam excluded", async () => {
      const { body } = await get("/mailboxes", priya);
      const bySupport = body.mailboxes.find((m) => m.address === support.address);
      const byTech = body.mailboxes.find((m) => m.address === tech.address);
      assert.equal(bySupport.unread, 3);
      assert.equal(byTech.unread, 0);
      assert.deepEqual(body.counts, { received: 3, spam: 1 });
      assert.deepEqual(body.mailboxes.map((m) => m.displayName), ["Support", "Tech"]);
    });

    test("a mail viewed by any admin stops counting as unread for everyone", async () => {
      await post(`/messages/${ids.in2}/view`, aman);
      const { body } = await get("/mailboxes", priya);
      assert.equal(body.mailboxes.find((m) => m.address === support.address).unread, 2);
    });

    test("a mailbox limited to specific admins is hidden from the others", async () => {
      await Mailbox.updateOne({ _id: tech._id }, { $set: { allowedAdmins: [rahul._id] } });
      assert.deepEqual((await get("/mailboxes", priya)).body.mailboxes.map((m) => m.displayName), ["Support"]);
      assert.deepEqual((await get("/mailboxes", rahul)).body.mailboxes.map((m) => m.displayName), ["Support", "Tech"]);
      assert.equal((await get(`/messages?folder=spam`, priya)).body.total, 0);
      assert.equal((await get(`/messages/${ids.out2}`, priya)).status, 404);
      assert.equal((await post(`/messages/${ids.out2}/view`, priya)).status, 404);
    });

    test("inactive mailboxes are not shown", async () => {
      await Mailbox.updateOne({ _id: tech._id }, { $set: { isActive: false } });
      assert.equal((await get("/mailboxes", priya)).body.mailboxes.length, 1);
    });
  });

  describe("GET /admins", () => {
    test("lists admins and superadmins by name", async () => {
      await User.create({ name: "A Patient", email: "p@x.co", role: "user" });
      const { body } = await get("/admins", priya);
      assert.deepEqual(body.admins.map((a) => a.name), ["Aman Verma", "Priya Patil", "Rahul Sharma"]);
      assert.ok(!JSON.stringify(body).includes("@x.co"), "no email addresses exposed");
    });
  });

  describe("GET /messages — folders", () => {
    test("Received excludes spam, newest first", async () => {
      const res = await get("/messages?folder=inbox", priya);
      assert.deepEqual(subjects(res), ["Re: Appointment", "Report download problem", "Invoice copy"]);
      assert.equal(res.body.total, 3);
    });

    test("Spam holds only spam; Sent holds only sent", async () => {
      assert.deepEqual(subjects(await get("/messages?folder=spam", priya)), ["Rank #1 in 7 days"]);
      assert.deepEqual(subjects(await get("/messages?folder=sent", priya)), ["Server downtime RCA", "Appointment confirmed", "Welcome"]);
    });

    test("All mail is received (not spam) plus sent", async () => {
      const res = await get("/messages?folder=all", priya);
      assert.equal(res.body.total, 6);
      assert.ok(!subjects(res).includes("Rank #1 in 7 days"));
    });

    test("rows carry mailbox chip, sender attribution and a decrypted snippet", async () => {
      const res = await get("/messages?folder=sent", priya);
      const welcome = res.body.items.find((i) => i.subject === "Welcome");
      assert.equal(welcome.mailbox.displayName, "Support");
      assert.equal(welcome.mailbox.address, support.address);
      assert.deepEqual(welcome.sentBy, { id: String(aman._id), name: "Aman Verma" });
      assert.equal(welcome.status, "failed");
      assert.equal(welcome.failureReason, "Recipient address rejected");
      const inbound = (await get("/messages?folder=inbox", priya)).body.items.find((i) => i.subject === "Re: Appointment");
      assert.equal(inbound.snippet, "Thank you, I will come on time");
      assert.equal(inbound.unread, true);
      assert.equal(inbound.firstViewed, null);
    });

    test("responses never leak ciphertext, Gmail ids or other internals", async () => {
      const res = await fetch(`${base}/messages?folder=all`, { headers: { "x-test-admin": String(priya._id) } });
      const text = await res.text();
      for (const banned of ["cipherText", "authTag", "gmailMessageId", "gmailThreadId", "clientRequestId", "g1"]) {
        assert.ok(!text.includes(`"${banned}"`), `leaked ${banned}`);
      }
    });
  });

  describe("GET /messages — filters", () => {
    test("by mailbox", async () => {
      assert.deepEqual(subjects(await get(`/messages?folder=all&mailbox=${tech._id}`, priya)), ["Server downtime RCA"]);
    });

    test("sent by admin", async () => {
      assert.deepEqual(subjects(await get(`/messages?folder=sent&sentBy=${aman._id}`, priya)), ["Welcome"]);
    });

    test("sent status: no reply / replied / failed", async () => {
      assert.deepEqual(subjects(await get("/messages?folder=sent&status=noreply", priya)), ["Server downtime RCA"]);
      assert.deepEqual(subjects(await get("/messages?folder=sent&status=replied", priya)), ["Appointment confirmed"]);
      assert.deepEqual(subjects(await get("/messages?folder=sent&status=failed", priya)), ["Welcome"]);
    });

    test("received reply status: pending vs already replied", async () => {
      assert.deepEqual(subjects(await get("/messages?folder=inbox&status=replied", priya)), ["Invoice copy"]);
      assert.deepEqual(subjects(await get("/messages?folder=inbox&status=noreply", priya)), ["Re: Appointment", "Report download problem"]);
    });

    test("first viewed by an admin, or by nobody", async () => {
      await post(`/messages/${ids.in2}/view`, aman);
      await post(`/messages/${ids.in1}/view`, priya);
      assert.deepEqual(subjects(await get(`/messages?folder=inbox&viewedBy=${aman._id}`, priya)), ["Report download problem"]);
      assert.deepEqual(subjects(await get("/messages?folder=inbox&viewedBy=none", priya)), ["Invoice copy"]);
    });

    test("date from (today / 7 days / this month are computed by the browser)", async () => {
      const dateFrom = encodeURIComponent(ago(2.5).toISOString());
      assert.deepEqual(subjects(await get(`/messages?folder=inbox&dateFrom=${dateFrom}`, priya)), ["Re: Appointment", "Report download problem"]);
    });

    test("has attachment", async () => {
      assert.deepEqual(subjects(await get("/messages?folder=all&hasAttachment=1", priya)), ["Report download problem", "Appointment confirmed"]);
    });

    test("filters combine", async () => {
      const res = await get(`/messages?folder=sent&mailbox=${support._id}&status=failed&sentBy=${aman._id}`, priya);
      assert.deepEqual(subjects(res), ["Welcome"]);
      assert.equal((await get(`/messages?folder=sent&mailbox=${tech._id}&status=failed`, priya)).body.total, 0);
    });
  });

  describe("GET /messages — search", () => {
    test("partial and case-insensitive over subject, addresses, names and sender", async () => {
      // finds her mail and the mail we sent to her
      assert.deepEqual(subjects(await get("/messages?folder=all&q=ANIT", priya)), ["Re: Appointment", "Appointment confirmed"]);
      assert.ok(subjects(await get("/messages?folder=all&q=vendor%40cloud", priya)).includes("Server downtime RCA"));
      assert.deepEqual(subjects(await get("/messages?folder=all&q=priya", priya)), ["Appointment confirmed"]);
      assert.deepEqual(subjects(await get("/messages?folder=all&q=downtime", priya)), ["Server downtime RCA"]);
    });

    test("body text is not searchable (encrypted at rest)", async () => {
      assert.equal((await get("/messages?folder=all&q=on%20time", priya)).body.total, 0);
    });

    test("regex characters are treated literally", async () => {
      assert.equal((await get("/messages?folder=all&q=" + encodeURIComponent("(.*"), priya)).status, 200);
      assert.equal((await get("/messages?folder=all&q=" + encodeURIComponent(".*"), priya)).body.total, 0);
      assert.equal((await get("/messages?folder=spam&q=" + encodeURIComponent("#1"), priya)).body.total, 1);
    });
  });

  describe("GET /messages — pagination and validation", () => {
    test("pages through results", async () => {
      const p1 = await get("/messages?folder=all&limit=4&page=1", priya);
      const p2 = await get("/messages?folder=all&limit=4&page=2", priya);
      assert.equal(p1.body.items.length, 4);
      assert.equal(p1.body.hasMore, true);
      assert.equal(p2.body.items.length, 2);
      assert.equal(p2.body.hasMore, false);
      assert.equal(new Set([...p1.body.items, ...p2.body.items].map((i) => i.id)).size, 6);
    });

    test("caps the page size", async () => {
      assert.equal((await get("/messages?limit=100000", priya)).body.limit, 100);
    });

    test("rejects malformed filters with 400", async () => {
      for (const qs of ["folder=trash", "status=bogus", "mailbox=not-an-id", "sentBy=123", "viewedBy=zzz", "dateFrom=garbage", `q=${"x".repeat(101)}`]) {
        assert.equal((await get(`/messages?${qs}`, priya)).status, 400, qs);
      }
    });

    test("query-operator injection is ignored, not executed", async () => {
      const res = await get("/messages?folder=all&q[$ne]=x&sentBy[$ne]=1", priya);
      assert.ok([200, 400].includes(res.status));
      if (res.status === 200) assert.equal(res.body.total, 6);
    });
  });

  describe("GET /messages/:id", () => {
    test("returns the thread oldest first with attachments and who sent each mail", async () => {
      const { status, body } = await get(`/messages/${ids.in1}`, priya);
      assert.equal(status, 200);
      assert.deepEqual(body.thread.map((m) => m.subject), ["Appointment confirmed", "Re: Appointment"]);
      const sent = body.thread[0];
      assert.deepEqual(sent.sentBy, { id: String(priya._id), name: "Priya Patil", role: "admin" });
      assert.equal(sent.attachments[0].filename, "Appointment_Slip.pdf");
      assert.equal(sent.attachments[0].size, 182000);
      assert.equal(body.message.text, "Thank you, I will come on time");
      assert.equal(body.message.mailbox.address, support.address);
    });

    test("reply goes to the client from the same company ID, subject gets Re:", async () => {
      const inbound = (await get(`/messages/${ids.in2}`, priya)).body.reply;
      assert.deepEqual(inbound, { allowed: true, mailboxId: String(support._id), to: { name: "Meera Desai", address: "meera@gmail.com" }, subject: "Re: Report download problem" });
      const fromSent = (await get(`/messages/${ids.out1}`, priya)).body.reply;
      assert.equal(fromSent.to.address, "anita.joshi@gmail.com");
      assert.equal(fromSent.subject, "Re: Appointment confirmed");
      const noClientReply = (await get(`/messages/${ids.out2}`, priya)).body.reply;
      assert.equal(noClientReply.to.address, "vendor@cloudhost.in");
      assert.equal(noClientReply.mailboxId, String(tech._id));
    });

    test("a spam mail stands alone and cannot be replied to", async () => {
      const { body } = await get(`/messages/${ids.spam1}`, priya);
      assert.equal(body.thread.length, 1);
      assert.equal(body.reply.allowed, false);
    });

    test("spam inside a thread is hidden from the thread", async () => {
      await mk(support, { subject: "junk", thread: "T-appt", fields: { isSpam: true } });
      const { body } = await get(`/messages/${ids.in1}`, priya);
      assert.deepEqual(body.thread.map((m) => m.subject), ["Appointment confirmed", "Re: Appointment"]);
    });

    test("404 for unknown or malformed ids", async () => {
      assert.equal((await get(`/messages/${new mongoose.Types.ObjectId()}`, priya)).status, 404);
      assert.equal((await get("/messages/not-an-id", priya)).status, 404);
    });

    test("reading does not record a view", async () => {
      await get(`/messages/${ids.in2}`, priya);
      await get(`/messages/${ids.in2}`, priya);
      assert.equal(await EmailView.countDocuments(), 0);
      assert.equal((await EmailMessage.findById(ids.in2)).firstViewedAt, null);
    });
  });

  describe("POST /messages/:id/view", () => {
    test("first open stamps first viewer and logs the view", async () => {
      const { status, body } = await post(`/messages/${ids.in2}/view`, priya);
      assert.equal(status, 200);
      assert.equal(body.recorded, true);
      assert.equal(body.firstViewed.by.name, "Priya Patil");
      assert.equal(body.views.length, 1);
      const row = (await get("/messages?folder=inbox", aman)).body.items.find((i) => i.id === String(ids.in2));
      assert.equal(row.unread, false);
      assert.equal(row.firstViewed.by.name, "Priya Patil");
    });

    test("later viewers are added, but the first viewer never changes", async () => {
      await post(`/messages/${ids.in2}/view`, priya);
      const second = await post(`/messages/${ids.in2}/view`, aman);
      assert.equal(second.body.firstViewed.by.name, "Priya Patil");
      assert.deepEqual(second.body.views.map((v) => v.admin.name), ["Priya Patil", "Aman Verma"]);
      const detail = await get(`/messages/${ids.in2}`, rahul);
      assert.deepEqual(detail.body.views.map((v) => v.admin.name), ["Priya Patil", "Aman Verma"]);
    });

    test("a quick re-open by the same admin is not logged twice", async () => {
      await post(`/messages/${ids.in2}/view`, priya);
      const again = await post(`/messages/${ids.in2}/view`, priya);
      assert.equal(again.body.recorded, false);
      assert.equal(await EmailView.countDocuments({ message: ids.in2 }), 1);
    });

    test("a re-open after the dedupe window is logged and counted", async () => {
      await post(`/messages/${ids.in2}/view`, priya);
      await EmailView.updateMany({}, { $set: { viewedAt: new Date(Date.now() - 10 * 60_000) } });
      const again = await post(`/messages/${ids.in2}/view`, priya);
      assert.equal(again.body.recorded, true);
      assert.equal(again.body.views.length, 1);
      assert.equal(again.body.views[0].count, 2);
    });

    test("the sender opening their own sent mail is not recorded; others are", async () => {
      const own = await post(`/messages/${ids.out1}/view`, priya);
      assert.equal(own.body.recorded, false);
      assert.equal(own.body.firstViewed, null);
      const other = await post(`/messages/${ids.out1}/view`, aman);
      assert.equal(other.body.recorded, true);
      assert.equal(other.body.firstViewed.by.name, "Aman Verma");
    });

    test("two admins opening at the same moment: exactly one first viewer, both logged", async () => {
      await Promise.all([post(`/messages/${ids.in3}/view`, priya), post(`/messages/${ids.in3}/view`, aman)]);
      const msg = await EmailMessage.findById(ids.in3);
      assert.ok(["Priya Patil", "Aman Verma"].includes(msg.firstViewedByName));
      assert.equal(await EmailView.countDocuments({ message: ids.in3 }), 2);
    });

    test("opening a spam mail is also recorded", async () => {
      const res = await post(`/messages/${ids.spam1}/view`, priya);
      assert.equal(res.body.recorded, true);
      assert.equal((await get("/mailboxes", priya)).body.counts.spam, 0);
    });

    test("404 for an unknown mail", async () => {
      assert.equal((await post(`/messages/${new mongoose.Types.ObjectId()}/view`, priya)).status, 404);
    });
  });
});
