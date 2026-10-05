const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// adminController builds a Stripe client at load time; this key is never used.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const mailer = require("../utils/sendEmail");
const events = [];
let mailFails = false;
mailer.sendEmail = async (message) => {
  if (mailFails) throw new Error("smtp down");
  events.push(`mail:${message.subject}`);
};

const User = require("../models/User");
const AccountDeletionRequest = require("../models/AccountDeletionRequest");
const { requestAccountDeletion, cancelAccountDeletion } = require("../controllers/authController");
const {
  approveUserDeleteRequest, rejectUserDeleteRequest, deleteUser,
} = require("../controllers/adminController");
const { getDeletionRequests } = require("../controllers/deletionRequestController");

const originalDelete = User.findByIdAndDelete.bind(User);
const originalFindOneAndUpdate = AccountDeletionRequest.findOneAndUpdate.bind(AccountDeletionRequest);

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const call = async (handler, req = {}) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ headers: {}, body: {}, params: {}, query: {}, ...req }, res);
  return out;
};

describe("account deletion history", () => {
  let mongod;
  let admin;
  let n = 0;

  const makeUser = (over = {}) => {
    n += 1;
    return User.create({ name: `Patient ${n}`, email: `p${n}@example.com`, password: "x", role: "user", ...over });
  };
  const asUser = (u, extra = {}) => ({ user: { id: String(u._id), role: "user" }, ...extra });
  const asAdmin = (extra = {}) => ({ user: { id: String(admin._id), role: "admin", email: admin.email }, ...extra });
  const rowsFor = (u) => AccountDeletionRequest.find({ userId: u._id }).sort({ createdAt: 1 }).lean();

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), AccountDeletionRequest.init()]);
    admin = await User.create({ name: "Ada Admin", email: "ada@example.com", password: "x", role: "admin" });
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    events.length = 0;
    mailFails = false;
    User.findByIdAndDelete = originalDelete;
    AccountDeletionRequest.findOneAndUpdate = originalFindOneAndUpdate;
    await AccountDeletionRequest.deleteMany({});
    await User.deleteMany({ role: "user" });
  });

  describe("request and cancel", () => {
    test("a request creates a pending row with a minimal snapshot and where it came from", async () => {
      const u = await makeUser();
      const res = await call(requestAccountDeletion, asUser(u, {
        body: { reason: " moving abroad " },
        headers: { "user-agent": CHROME_WIN, "x-forwarded-for": "203.0.113.9" },
      }));
      assert.equal(res.status, 201);
      const [row] = await rowsFor(u);
      assert.equal(row.status, "pending");
      assert.equal(String(row.userId), String(u._id));
      assert.equal(row.patientId, u.patientId);
      assert.equal(row.name, u.name);
      assert.equal(row.email, u.email);
      assert.equal(row.reason, "moving abroad");
      assert.ok(row.requestedAt instanceof Date);
      assert.equal(row.decidedAt, null);
      assert.equal(row.backfilled, false);
      assert.equal(row.emails.requested, true);
      assert.equal(row.requestSource.platform, "web");
      assert.match(row.requestSource.subType, /Chrome on Windows/);
      assert.equal(row.requestSource.source, "user-agent");
      // Never the IP or the raw User-Agent.
      const stored = JSON.stringify(row);
      assert.ok(!stored.includes("203.0.113.9"));
      assert.ok(!stored.includes("Mozilla/5.0"));
      assert.deepEqual(
        Object.keys(AccountDeletionRequest.schema.paths).filter((p) => /^(ip|ipAddress|userAgent)$/i.test(p)),
        []
      );
    });

    test("an app request records platform, subType, version and source", async () => {
      const u = await makeUser();
      await call(requestAccountDeletion, asUser(u, {
        headers: { "user-agent": "Dart/3.5 (dart:io)", "x-client-platform": "android", "x-app-version": "1.0.0+16" },
      }));
      const [row] = await rowsFor(u);
      assert.deepEqual(
        { ...row.requestSource },
        { platform: "app", subType: "android", appVersion: "1.0.0+16", source: "header" }
      );
      // An old build that doesn't send the header is inferred.
      const u2 = await makeUser();
      await call(requestAccountDeletion, asUser(u2, { headers: { "user-agent": "okhttp/4.12.0" } }));
      const [row2] = await rowsFor(u2);
      assert.equal(row2.requestSource.platform, "app");
      assert.equal(row2.requestSource.source, "inferred");
    });

    test("emails.requested is false when the email could not be sent, and the request still succeeds", async () => {
      mailFails = true;
      const u = await makeUser();
      const res = await call(requestAccountDeletion, asUser(u));
      assert.equal(res.status, 201);
      const [row] = await rowsFor(u);
      assert.equal(row.emails.requested, false);
    });

    test("a second request while one is pending is refused and does not add a row", async () => {
      const u = await makeUser();
      await call(requestAccountDeletion, asUser(u));
      const again = await call(requestAccountDeletion, asUser(u));
      assert.equal(again.status, 400);
      assert.equal((await rowsFor(u)).length, 1);
    });

    test("cancel marks the row cancelled, keeps the reason, and a new request adds a second row", async () => {
      const u = await makeUser();
      await call(requestAccountDeletion, asUser(u, { body: { reason: "just testing" } }));
      const res = await call(cancelAccountDeletion, asUser(u));
      assert.equal(res.status, 200);

      const [row] = await rowsFor(u);
      assert.equal(row.status, "cancelled");
      assert.equal(row.reason, "just testing"); // history keeps it
      assert.ok(row.decidedAt instanceof Date);
      assert.equal(row.decidedBy, null);
      const live = await User.findById(u._id).lean();
      assert.equal(live.deletionReason, ""); // the live user fields reset

      await call(requestAccountDeletion, asUser(u, { body: { reason: "again" } }));
      const rows = await rowsFor(u);
      assert.deepEqual(rows.map((r) => r.status), ["cancelled", "pending"]);
    });

    test("cancelling a request made before the history existed still records it", async () => {
      const u = await makeUser({
        deletionRequestStatus: "pending", deletionReason: "old request", deletionRequestedAt: new Date("2026-01-02"),
      });
      assert.equal((await rowsFor(u)).length, 0);
      await call(cancelAccountDeletion, asUser(u));
      const [row] = await rowsFor(u);
      assert.equal(row.status, "cancelled");
      assert.equal(row.reason, "old request");
      assert.equal(row.backfilled, true);
    });
  });

  describe("admin decisions", () => {
    const pendingUser = async (reason = "bye") => {
      const u = await makeUser();
      await call(requestAccountDeletion, asUser(u, { body: { reason }, headers: { "user-agent": CHROME_WIN } }));
      events.length = 0;
      return u;
    };

    test("approve: the row survives the deleted user, with who decided and when; email goes out BEFORE the delete", async () => {
      const u = await pendingUser();
      User.findByIdAndDelete = async (...args) => { events.push("delete"); return originalDelete(...args); };

      const res = await call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 200);

      assert.equal(await User.findById(u._id), null);
      const [row] = await rowsFor(u);
      assert.equal(row.status, "approved");
      assert.equal(row.name, u.name);
      assert.equal(row.email, u.email);
      assert.equal(row.patientId, u.patientId);
      assert.equal(row.reason, "bye");
      assert.ok(row.decidedAt instanceof Date);
      assert.deepEqual(
        { id: row.decidedBy.id, name: row.decidedBy.name, email: row.decidedBy.email, role: row.decidedBy.role },
        { id: String(admin._id), name: "Ada Admin", email: "ada@example.com", role: "admin" }
      );
      assert.equal(row.decidedVia, "review");
      assert.equal(row.emails.decision, true);

      const mailAt = events.findIndex((e) => e.startsWith("mail:"));
      assert.ok(mailAt >= 0 && events.indexOf("delete") > mailAt, JSON.stringify(events));
    });

    test("approve is refused (nothing deleted) when the history cannot be written", async () => {
      const u = await pendingUser();
      AccountDeletionRequest.findOneAndUpdate = async () => { throw new Error("db down"); };
      const res = await call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 500);
      assert.ok(await User.findById(u._id), "user must still exist");
      assert.equal(events.filter((e) => e.startsWith("mail:")).length, 0, "no approval email either");
      AccountDeletionRequest.findOneAndUpdate = originalFindOneAndUpdate;
      assert.equal((await rowsFor(u))[0].status, "pending");
    });

    test("if the delete itself fails, the request goes back to pending", async () => {
      const u = await pendingUser();
      User.findByIdAndDelete = async () => { throw new Error("delete failed"); };
      const res = await call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 500);
      assert.ok(await User.findById(u._id));
      const [row] = await rowsFor(u);
      assert.equal(row.status, "pending");
      assert.equal(row.decidedAt, null);
      assert.equal(row.decidedBy, null);
    });

    test("two admins approving at once: exactly one wins", async () => {
      const u = await pendingUser();
      const make = () => call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      const results = await Promise.all([make(), make()]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, results.find((r) => r.status !== 200).status].sort());
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      const rows = await rowsFor(u);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "approved");
      assert.equal(await User.findById(u._id), null);
    });

    test("reject: the user stays, the row records the decider, and they can ask again", async () => {
      const u = await pendingUser();
      const res = await call(rejectUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 200);
      const live = await User.findById(u._id).lean();
      assert.equal(live.deletionRequestStatus, "rejected");
      const [row] = await rowsFor(u);
      assert.equal(row.status, "rejected");
      assert.equal(row.decidedBy.name, "Ada Admin");
      assert.equal(row.emails.decision, true);

      await call(requestAccountDeletion, asUser(u, { body: { reason: "second try" } }));
      assert.deepEqual((await rowsFor(u)).map((r) => r.status), ["rejected", "pending"]);
    });

    test("deciding a request that was made before the history existed creates its row on the fly", async () => {
      const u = await makeUser({
        deletionRequestStatus: "pending", deletionReason: "legacy", deletionRequestedAt: new Date("2026-02-03"),
      });
      const res = await call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 200);
      const [row] = await rowsFor(u);
      assert.equal(row.status, "approved");
      assert.equal(row.reason, "legacy");
      assert.equal(row.backfilled, true);
      assert.equal(row.requestedAt.toISOString().slice(0, 10), "2026-02-03");
    });

    test("nothing pending → 400 and no row is written", async () => {
      const u = await makeUser();
      assert.equal((await call(approveUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }))).status, 400);
      assert.equal((await call(rejectUserDeleteRequest, asAdmin({ params: { id: String(u._id) } }))).status, 400);
      assert.equal((await rowsFor(u)).length, 0);
    });
  });

  describe("direct 'Delete User'", () => {
    test("with no request: recorded as deleted_by_admin", async () => {
      const u = await makeUser();
      const res = await call(deleteUser, asAdmin({ params: { id: String(u._id) } }));
      assert.equal(res.status, 200);
      assert.equal(await User.findById(u._id), null);
      const [row] = await rowsFor(u);
      assert.equal(row.status, "deleted_by_admin");
      assert.equal(row.decidedBy.name, "Ada Admin");
      assert.equal(row.decidedVia, "direct_delete");
      assert.equal(row.email, u.email);
    });

    test("with a pending request: that request is marked approved", async () => {
      const u = await makeUser();
      await call(requestAccountDeletion, asUser(u, { body: { reason: "x" } }));
      await call(deleteUser, asAdmin({ params: { id: String(u._id) } }));
      const rows = await rowsFor(u);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "approved");
      assert.equal(rows[0].decidedVia, "direct_delete");
      assert.equal(rows[0].reason, "x");
    });

    test("refused (nothing deleted) when the record cannot be written", async () => {
      const u = await makeUser();
      const create = AccountDeletionRequest.create;
      AccountDeletionRequest.create = async () => { throw new Error("db down"); };
      try {
        const res = await call(deleteUser, asAdmin({ params: { id: String(u._id) } }));
        assert.equal(res.status, 500);
        assert.ok(await User.findById(u._id));
      } finally {
        AccountDeletionRequest.create = create;
      }
    });

    test("non-patient accounts are deleted as before, without a history row", async () => {
      const doc = await User.create({ name: "Dr X", email: "drx@example.com", password: "x", role: "doctor" });
      const res = await call(deleteUser, asAdmin({ params: { id: String(doc._id) } }));
      assert.equal(res.status, 200);
      assert.equal(await AccountDeletionRequest.countDocuments({ userId: doc._id }), 0);
    });
  });

  describe("admin list", () => {
    let alice; let bob; let carol;
    beforeEach(async () => {
      [alice, bob, carol] = [
        await makeUser({ name: "Alice Rao", email: "alice@example.com" }),
        await makeUser({ name: "Bob Stone", email: "bob@sample.org" }),
        await makeUser({ name: "Carol Diaz", email: "carol@example.com" }),
      ];
      await call(requestAccountDeletion, asUser(alice, { headers: { "user-agent": CHROME_WIN } }));
      await call(requestAccountDeletion, asUser(bob, { headers: { "x-client-platform": "ios", "x-app-version": "1.0.0+16" } }));
      await call(requestAccountDeletion, asUser(carol, { headers: { "user-agent": CHROME_WIN } }));
      await call(approveUserDeleteRequest, asAdmin({ params: { id: String(bob._id) } })); // bob: approved, deleted
      await call(rejectUserDeleteRequest, asAdmin({ params: { id: String(carol._id) } })); // carol: rejected
    });

    const list = (query) => call(getDeletionRequests, { query });

    test("shows every status, including requests whose user is gone, newest first, with counts", async () => {
      const { body } = await list({});
      assert.equal(body.total, 3);
      assert.deepEqual(body.counts, { all: 3, pending: 1, approved: 1, rejected: 1, cancelled: 0, deleted_by_admin: 0 });
      const byName = Object.fromEntries(body.items.map((i) => [i.name, i]));
      assert.equal(byName["Bob Stone"].status, "approved");
      assert.equal(byName["Bob Stone"].userExists, false);
      assert.equal(byName["Alice Rao"].userExists, true);
      assert.equal(byName["Carol Diaz"].status, "rejected");
      assert.equal(byName["Bob Stone"].decidedBy.name, "Ada Admin");
      assert.equal(byName["Bob Stone"].requestSource.platform, "app");
    });

    test("filters by status and by source (web / app)", async () => {
      assert.deepEqual((await list({ status: "pending" })).body.items.map((i) => i.name), ["Alice Rao"]);
      assert.deepEqual((await list({ status: "approved" })).body.items.map((i) => i.name), ["Bob Stone"]);
      assert.equal((await list({ source: "app" })).body.total, 1);
      assert.equal((await list({ source: "web" })).body.total, 2);
      // Tab counts follow the source filter.
      assert.equal((await list({ source: "web" })).body.counts.all, 2);
      // Unknown status falls back to "all".
      assert.equal((await list({ status: "bogus" })).body.total, 3);
    });

    test("search by name, email and patient ID; regex characters are literal", async () => {
      assert.deepEqual((await list({ q: "alice" })).body.items.map((i) => i.name), ["Alice Rao"]);
      assert.deepEqual((await list({ q: "sample.org" })).body.items.map((i) => i.name), ["Bob Stone"]);
      assert.deepEqual((await list({ q: String(carol.patientId) })).body.items.map((i) => i.name), ["Carol Diaz"]);
      assert.equal((await list({ q: ".*" })).body.total, 0);
    });

    test("paginates", async () => {
      const first = (await list({ limit: "2", page: "1" })).body;
      const second = (await list({ limit: "2", page: "2" })).body;
      assert.equal(first.items.length, 2);
      assert.equal(second.items.length, 1);
      assert.equal(first.pages, 2);
      assert.equal(first.total, 3);
    });

    test("is for admins and superadmins only", () => {
      const router = require("../routes/admin");
      const { adminOnly, verifyAdminToken } = require("../middleware/verifyToken");
      const layer = router.stack.find((l) => l.route && l.route.path === "/deletion-requests");
      assert.ok(layer && layer.route.methods.get);
      const handlers = layer.route.stack.map((l) => l.handle);
      assert.ok(handlers.includes(verifyAdminToken));
      assert.ok(handlers.includes(adminOnly));
    });
  });

  describe("model", () => {
    test("purgeAt is empty by default (nothing auto-deleted) and the legal-review TODO is in the code", () => {
      const row = new AccountDeletionRequest({ userId: new mongoose.Types.ObjectId(), requestedAt: new Date() });
      assert.equal(row.purgeAt, null);
      const fs = require("node:fs");
      for (const f of ["../models/AccountDeletionRequest.js", "../utils/accountDeletionHistory.js"]) {
        const src = fs.readFileSync(path.join(__dirname, f), "utf8");
        if (f.includes("models")) assert.match(src, /TODO\(legal review\)/);
        assert.doesNotMatch(src, /require\([^)]*activityLogger|recordActivity\(/, `${f} must not rely on recordActivity`);
      }
    });

    test("only one pending row per user", async () => {
      const u = await makeUser();
      await AccountDeletionRequest.create({ userId: u._id, requestedAt: new Date(), status: "pending" });
      await assert.rejects(
        AccountDeletionRequest.create({ userId: u._id, requestedAt: new Date(), status: "pending" }),
        (err) => err.code === 11000
      );
      // …but finished rows are unlimited.
      await AccountDeletionRequest.create({ userId: u._id, requestedAt: new Date(), status: "rejected" });
      await AccountDeletionRequest.create({ userId: u._id, requestedAt: new Date(), status: "rejected" });
    });
  });

  describe("backfill script", () => {
    const script = path.join(__dirname, "..", "scripts", "backfillDeletionRequests.js");
    const run = (...args) =>
      spawnSync(process.execPath, [script, ...args], {
        env: { ...process.env, MONGO_URI: mongod.getUri(), NODE_ENV: "production" },
        encoding: "utf8",
        timeout: 60000,
      });

    test("dry run writes nothing; --apply writes pending/rejected users once; re-running is a no-op", async () => {
      const pending = await makeUser({
        deletionRequestStatus: "pending", deletionReason: "r1", deletionRequestedAt: new Date("2026-03-01"),
      });
      const rejected = await makeUser({
        deletionRequestStatus: "rejected", deletionReason: "r2",
        deletionRequestedAt: new Date("2026-03-02"), deletionRejectedAt: new Date("2026-03-05"),
      });
      await makeUser(); // no request: ignored

      const dry = run();
      assert.equal(dry.status, 0, dry.stderr);
      assert.match(dry.stdout, /DRY RUN/);
      assert.match(dry.stdout, /rows to create:\s+2 \(pending 1, rejected 1\)/);
      assert.doesNotMatch(dry.stdout, /\bp\d+@/, "only masked emails are printed");
      assert.match(dry.stdout, /p\*\*\*@example\.com/);
      assert.equal(await AccountDeletionRequest.countDocuments({}), 0);

      const applied = run("--apply");
      assert.equal(applied.status, 0, applied.stderr);
      assert.match(applied.stdout, /Inserted 2 of 2 rows/);
      const [p] = await rowsFor(pending);
      const [r] = await rowsFor(rejected);
      assert.equal(p.status, "pending");
      assert.equal(p.reason, "r1");
      assert.equal(p.backfilled, true);
      assert.equal(p.decidedBy, null);
      assert.equal(p.requestSource.platform, "");
      assert.equal(r.status, "rejected");
      assert.equal(r.decidedAt.toISOString().slice(0, 10), "2026-03-05");
      assert.equal(r.requestedAt.toISOString().slice(0, 10), "2026-03-02");

      const again = run("--apply");
      assert.match(again.stdout, /already in the history \(skipped\):\s+2/);
      assert.match(again.stdout, /Nothing to write/);
      assert.equal(await AccountDeletionRequest.countDocuments({}), 2);
    });
  });
});
