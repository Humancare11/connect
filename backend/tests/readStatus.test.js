const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailMessage = require("../models/EmailMessage");
const Mailbox = require("../models/Mailbox");
const { READ_STATUSES, computeReadStatus, readStatusClause } = require("../services/email/readStatus");

const D = (day) => new Date(`2026-10-0${day}T10:00:00Z`);

// One mail per case. `expect` is the status the rule must give.
const CASES = [
  { name: "replied beats everything", expect: "replied", status: "replied", repliedAt: D(9), tracking: { status: "opened", openCount: 2, clickCount: 1, downloadCount: 1, receiptAt: D(3) } },
  { name: "downloaded beats clicked", expect: "downloaded", tracking: { status: "opened", clickCount: 2, downloadCount: 1, lastDownloadedAt: D(5) } },
  { name: "clicked beats receipt", expect: "clicked", tracking: { status: "opened", clickCount: 1, lastClickedAt: D(4), receiptAt: D(3) } },
  { name: "receipt beats opened", expect: "receipt", tracking: { status: "opened", openCount: 1, receiptAt: D(3) } },
  { name: "opened beats opened (Apple)", expect: "opened", tracking: { status: "opened", openCount: 1, lastOpenedAt: D(2), appleOpenCount: 4 } },
  { name: "Apple hits alone", expect: "opened_apple", tracking: { status: "pending", appleOpenCount: 1, lastAppleOpenedAt: D(2) } },
  { name: "Apple hit beats automated-only", expect: "opened_apple", tracking: { status: "unavailable", unavailableReason: "automated_only", appleOpenCount: 1 } },
  { name: "click on a mail whose pixel was never seen", expect: "clicked", tracking: { status: "pending", clickCount: 1 } },
  { name: "pending", expect: "pending", tracking: { status: "pending" } },
  { name: "automated only", expect: "automated", tracking: { status: "unavailable", unavailableReason: "automated_only" } },
  { name: "mail off", expect: "unavailable", tracking: { enabled: false, status: "unavailable", unavailableReason: "mail_off" } },
  { name: "no tracking block", expect: "unavailable", tracking: undefined },
  { name: "reply on an untracked mail", expect: "replied", status: "replied", repliedAt: D(6), tracking: undefined },
  { name: "failed mail has no status", expect: null, status: "failed", tracking: { status: "pending" } },
  { name: "still sending has no status", expect: null, status: "sending", tracking: { status: "pending" } },
];

describe("combined Read status", () => {
  let mongod, rows;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await EmailMessage.init();
    const mb = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    rows = [];
    for (const [i, c] of CASES.entries()) {
      const doc = new EmailMessage({
        mailbox: mb._id, direction: "out", status: c.status || "sent", gmailMessageId: `g${i}`, gmailThreadId: `t${i}`,
        from: { address: mb.address }, to: [{ address: `c${i}@gmail.com` }], subject: c.name, messageDate: new Date(),
        repliedAt: c.repliedAt || null, tracking: c.tracking,
      });
      doc.setContent({ text: "x", html: "", snippet: "x" });
      await doc.save();
      rows.push({ doc, c });
    }
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("the order is Replied > Downloaded > Clicked > Read receipt > Opened > Opened (Apple) > then the no-signal states", () => {
    assert.deepEqual(READ_STATUSES, ["replied", "downloaded", "clicked", "receipt", "opened", "opened_apple", "pending", "automated", "unavailable"]);
  });

  for (const [i, c] of CASES.entries()) {
    test(`computeReadStatus: ${c.name}`, () => {
      const got = computeReadStatus(rows[i].doc);
      assert.equal(got ? got.status : null, c.expect);
    });
  }

  test("signal time is the last time of the winning signal", () => {
    assert.equal(computeReadStatus(rows[1].doc).at.toISOString(), D(5).toISOString());
    assert.equal(computeReadStatus(rows[2].doc).at.toISOString(), D(4).toISOString());
    assert.equal(computeReadStatus(rows[3].doc).at.toISOString(), D(3).toISOString());
  });

  test("the list filter and the screen rule agree for every mail: each mail is in exactly one bucket", async () => {
    const buckets = {};
    for (const key of READ_STATUSES) {
      const found = await EmailMessage.find(readStatusClause(key)).select("subject").lean();
      buckets[key] = found.map((f) => f.subject);
    }
    for (const { doc, c } of rows) {
      const inBuckets = READ_STATUSES.filter((k) => buckets[k].includes(doc.subject));
      assert.deepEqual(inBuckets, c.expect ? [c.expect] : [], c.name);
    }
  });

  test("an unknown status has no clause", () => {
    assert.equal(readStatusClause("seen"), null);
  });
});
