const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const User = require("../models/User");
const superadminMailboxes = require("../routes/superadminMailboxes");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { syncMailbox } = require("../services/gmail/syncMailbox");
const { checkMailboxConnection } = require("../services/gmail/connectionCheck");

const noLimit = (req, res, next) => next();

describe("superadmin mailboxes API", () => {
  let mongod, server, base, root, calls, checkResult;

  // Stands in for the verified session: role + id come from headers. The REAL
  // superAdminOnly guard runs after it.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(root._id), role };
    next();
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use(
      "/api/superadmin/email/mailboxes",
      superadminMailboxes.create({
        guard: [fakeAuth, superAdminOnly],
        limiter: noLimit,
        check: async (address) => {
          calls.push(address);
          return checkResult(address);
        },
      })
    );
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/superadmin/email/mailboxes`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), User.deleteMany({})]);
    root = await User.create({ name: "Rahul", email: "rahul@x.co", role: "superadmin" });
    calls = [];
    checkResult = (address) => ({ ok: true, address, historyId: "1", latestIds: [] });
  });

  const call = async (method, path = "", body, role = "superadmin") => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json };
  };

  const add = (over = {}) =>
    call("POST", "", { address: "accounts@humancareconnect.co", displayName: "Accounts", color: "#336699", ...over });

  describe("access", () => {
    test("only a Super Admin gets through; everyone else is refused", async () => {
      for (const [method, path, body] of [
        ["GET", ""],
        ["POST", "/check", { address: "a@humancareconnect.co" }],
        ["POST", "", { address: "a@humancareconnect.co", displayName: "A" }],
        ["PATCH", `/${new mongoose.Types.ObjectId()}`, { displayName: "X" }],
      ]) {
        for (const role of ["admin", "paymentadmin", "partner", "doctor", "user"]) {
          assert.equal((await call(method, path, body, role)).status, 403, `${method} as ${role}`);
        }
        assert.equal((await call(method, path, body, null)).status, 401, `${method} anonymous`);
      }
      assert.equal(calls.length, 0, "Gmail must never be touched for a refused request");
      assert.equal((await call("GET")).status, 200);
    });

    test("the mounted router is guarded by the real session check and the Super Admin check", () => {
      const [first, second] = superadminMailboxes.stack;
      assert.equal(first.handle, verifyAdminToken);
      assert.equal(second.handle, superAdminOnly);
    });

    test("there is no way to delete a mailbox", async () => {
      const { body } = await add();
      const res = await call("DELETE", `/${body.mailbox.id}`);
      assert.equal(res.status, 404);
      assert.equal(await Mailbox.countDocuments({ address: "accounts@humancareconnect.co" }), 1);
    });
  });

  describe("list", () => {
    test("shows inactive mailboxes, sync state and message counts, and nothing internal", async () => {
      const [a, b] = await Mailbox.create([
        { address: "support@humancareconnect.co", displayName: "Support", sortOrder: 1, gmailHistoryId: "99", lastSyncAt: new Date(), syncLease: { owner: "x", until: new Date() } },
        { address: "hr@humancareconnect.co", displayName: "HR", sortOrder: 2, isActive: false, lastSyncError: "boom" },
      ]);
      await EmailMessage.create({ mailbox: a._id, direction: "in", status: "received", from: { address: "x@y.co" }, messageDate: new Date(), gmailMessageId: "g1" });

      const { status, body } = await call("GET");
      assert.equal(status, 200);
      assert.deepEqual(body.mailboxes.map((m) => [m.address, m.isActive, m.messageCount]), [
        ["support@humancareconnect.co", true, 1],
        ["hr@humancareconnect.co", false, 0],
      ]);
      assert.equal(body.mailboxes[1].lastSyncError, "boom");
      const keys = Object.keys(body.mailboxes[0]);
      for (const secret of ["gmailHistoryId", "syncLease", "allowedAdmins", "__v"]) assert.ok(!keys.includes(secret), secret);
      assert.equal(String(b._id), body.mailboxes[1].id);
    });
  });

  describe("check (dry run)", () => {
    test("rejects an address outside the company domain without calling Google", async () => {
      const res = await call("POST", "/check", { address: "someone@gmail.com" });
      assert.equal(res.status, 400);
      assert.match(res.body.msg, /@humancareconnect\.co/);
      assert.equal(calls.length, 0);
    });

    test("rejects non-string and malformed input", async () => {
      assert.equal((await call("POST", "/check", { address: { $ne: "" } })).status, 400);
      assert.equal((await call("POST", "/check", {})).status, 400);
      assert.equal((await call("POST", "/check", { address: "a@b@humancareconnect.co" })).status, 400);
      assert.equal(calls.length, 0);
    });

    test("reports a failed check clearly and saves nothing", async () => {
      checkResult = () => ({ ok: false, code: "NO_USER_MAILBOX", message: "Google found no user mailbox for hr@humancareconnect.co." });
      const res = await call("POST", "/check", { address: "hr@humancareconnect.co" });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { ok: false, code: "NO_USER_MAILBOX", message: "Google found no user mailbox for hr@humancareconnect.co." });
      assert.equal(await Mailbox.countDocuments(), 0);
    });

    test("reports success, and tells when the mailbox already exists", async () => {
      assert.deepEqual((await call("POST", "/check", { address: "HR@humancareconnect.co " })).body, { ok: true, address: "hr@humancareconnect.co" });
      await Mailbox.create({ address: "hr@humancareconnect.co", displayName: "HR", isActive: false });
      const again = await call("POST", "/check", { address: "hr@humancareconnect.co" });
      assert.equal(again.body.code, "EXISTS");
      assert.equal(calls.length, 1, "no Google call for a mailbox we already hold");
    });
  });

  describe("add", () => {
    test("runs the Gmail check on the server, then saves an active mailbox attributed to the Super Admin", async () => {
      const res = await add({ signature: "Accounts, Human Care Connect" });
      assert.equal(res.status, 201);
      assert.deepEqual(calls, ["accounts@humancareconnect.co"]);
      const saved = await Mailbox.findOne({ address: "accounts@humancareconnect.co" });
      assert.equal(saved.isActive, true);
      assert.equal(saved.color, "#336699");
      assert.equal(saved.signature, "Accounts, Human Care Connect");
      assert.equal(String(saved.createdBy), String(root._id));
      assert.equal(saved.gmailHistoryId, "", "no history id yet → the sync job does the 30-day backfill");
      assert.equal(res.body.mailbox.firstSyncPending, true);
    });

    test("a failed check blocks saving (422) and says why", async () => {
      checkResult = () => ({ ok: false, code: "ALIAS", message: "hr@humancareconnect.co is an alias of people@humancareconnect.co." });
      const res = await add({ address: "hr@humancareconnect.co" });
      assert.equal(res.status, 422);
      assert.equal(res.body.code, "ALIAS");
      assert.match(res.body.msg, /alias/);
      assert.equal(await Mailbox.countDocuments(), 0);
    });

    test("refuses a non-company address before any Google call", async () => {
      assert.equal((await add({ address: "x@gmail.com" })).status, 400);
      assert.equal((await add({ address: "x@humancareconnect.co.evil.com" })).status, 400);
      assert.equal((await add({ address: "x@evilhumancareconnect.co" })).status, 400);
      assert.equal(calls.length, 0);
      assert.equal(await Mailbox.countDocuments(), 0);
    });

    test("validates name, colour and footer", async () => {
      assert.equal((await add({ displayName: "" })).status, 400);
      assert.equal((await add({ displayName: "x".repeat(61) })).status, 400);
      assert.equal((await add({ displayName: 5 })).status, 400);
      assert.equal((await add({ color: "red" })).status, 400);
      assert.equal((await add({ signature: "x".repeat(501) })).status, 400);
      assert.equal(await Mailbox.countDocuments(), 0);
    });

    test("a duplicate is a 409 and never reaches Google; an inactive one points to reactivation", async () => {
      assert.equal((await add()).status, 201);
      const dup = await add();
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, "EXISTS");
      await Mailbox.updateOne({ address: "accounts@humancareconnect.co" }, { isActive: false });
      const inactive = await add();
      assert.equal(inactive.status, 409);
      assert.match(inactive.body.msg, /inactive/);
      assert.equal(calls.length, 1);
    });

    test("ignores fields it must not accept (isActive, createdBy, sync state)", async () => {
      const res = await add({ isActive: false, gmailHistoryId: "123", createdBy: new mongoose.Types.ObjectId() });
      assert.equal(res.status, 201);
      const saved = await Mailbox.findOne({ address: "accounts@humancareconnect.co" });
      assert.equal(saved.isActive, true);
      assert.equal(saved.gmailHistoryId, "");
      assert.equal(String(saved.createdBy), String(root._id));
    });

    test("a newly added mailbox is picked up by the sync job's query and does a backfill", async () => {
      const { body } = await add();
      const active = await Mailbox.find({ isActive: true }).select("_id address").lean();
      assert.deepEqual(active.map((m) => m.address), ["accounts@humancareconnect.co"]);

      let listed = 0;
      const client = {
        async getProfile() { return { emailAddress: "accounts@humancareconnect.co", historyId: "7" }; },
        async listMessageIds(opts) { listed += 1; assert.match(opts.q, /^newer_than:30d$|^in:|^newer_than:2d$/); return []; },
        async getMessage() { return null; },
        async listHistory() { throw new Error("must not do an incremental sync first"); },
      };
      const stats = await syncMailbox(body.mailbox.id, { client, owner: "t" });
      assert.equal(stats.mode, "backfill");
      assert.ok(listed > 0);
      const after = await Mailbox.findById(body.mailbox.id);
      assert.equal(after.gmailHistoryId, "7");
    });
  });

  describe("edit, deactivate, reactivate", () => {
    let id;
    beforeEach(async () => {
      id = (await add()).body.mailbox.id;
      calls.length = 0;
    });

    test("edits display name, colour and footer; records who", async () => {
      const res = await call("PATCH", `/${id}`, { displayName: "Accounts Team", color: "#AABBCC", signature: "Line 1\nLine 2" });
      assert.equal(res.status, 200);
      const saved = await Mailbox.findById(id);
      assert.equal(saved.displayName, "Accounts Team");
      assert.equal(saved.color, "#aabbcc");
      assert.equal(saved.signature, "Line 1\nLine 2");
      assert.equal(String(saved.updatedBy), String(root._id));
      assert.equal(calls.length, 0, "an ordinary edit does not call Google");
    });

    test("the address can never be changed, and unknown fields are refused", async () => {
      assert.equal((await call("PATCH", `/${id}`, { address: "other@humancareconnect.co" })).status, 400);
      assert.equal((await call("PATCH", `/${id}`, { gmailHistoryId: "1" })).status, 400);
      assert.equal((await call("PATCH", `/${id}`, { syncLease: { owner: "x" } })).status, 400);
      assert.equal((await call("PATCH", `/${id}`, {})).status, 400);
      assert.equal((await call("PATCH", `/${id}`, { color: "blue" })).status, 400);
      assert.equal((await Mailbox.findById(id)).address, "accounts@humancareconnect.co");
    });

    test("404 for an unknown or malformed id", async () => {
      assert.equal((await call("PATCH", `/${new mongoose.Types.ObjectId()}`, { displayName: "X" })).status, 404);
      assert.equal((await call("PATCH", "/not-an-id", { displayName: "X" })).status, 404);
    });

    test("deactivating keeps the row and its mail, stops the sync, and stamps the time", async () => {
      await EmailMessage.create({ mailbox: id, direction: "in", status: "received", from: { address: "x@y.co" }, messageDate: new Date(), gmailMessageId: "g1" });
      const res = await call("PATCH", `/${id}`, { isActive: false });
      assert.equal(res.status, 200);
      assert.equal(res.body.mailbox.isActive, false);
      assert.equal(res.body.mailbox.messageCount, 1);
      const saved = await Mailbox.findById(id);
      assert.ok(saved.deactivatedAt);
      assert.equal(await EmailMessage.countDocuments({ mailbox: id }), 1);
      assert.deepEqual(await syncMailbox(id, { client: {}, owner: "t" }), { skipped: true });
      assert.equal(calls.length, 0, "deactivating needs no Google call");
    });

    test("reactivating re-runs the Gmail check; a failure keeps it inactive", async () => {
      await call("PATCH", `/${id}`, { isActive: false });
      checkResult = () => ({ ok: false, code: "DELEGATION", message: "Delegation does not cover this address." });
      const blocked = await call("PATCH", `/${id}`, { isActive: true });
      assert.equal(blocked.status, 422);
      assert.equal((await Mailbox.findById(id)).isActive, false);

      checkResult = (address) => ({ ok: true, address });
      const ok = await call("PATCH", `/${id}`, { isActive: true });
      assert.equal(ok.status, 200);
      const saved = await Mailbox.findById(id);
      assert.equal(saved.isActive, true);
      assert.equal(saved.deactivatedAt, null);
    });
  });
});

describe("admin Email module only sees active mailboxes", () => {
  const adminEmail = require("../routes/adminEmail");
  let mongod, server, base, admin, root, support, hr, msgSupport, msgHr;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), User.init()]);
    const fakeAuth = (req, res, next) => {
      req.user = { id: req.headers["x-test-admin"], role: req.headers["x-test-role"] };
      next();
    };
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", adminEmail.create({
      guard: [fakeAuth],
      getGmail: () => { throw new Error("Gmail must not be used"); },
      store: { put: async () => {}, get: async () => null, remove: async () => {} },
    }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("an inactive mailbox disappears for admins AND superadmin: lists, mail pages, send and reply", async () => {
    [admin, root] = await User.create([
      { name: "Priya", email: "p@x.co", role: "admin" },
      { name: "Rahul", email: "r@x.co", role: "superadmin" },
    ]);
    [support, hr] = await Mailbox.create([
      { address: "support@humancareconnect.co", displayName: "Support" },
      { address: "hr@humancareconnect.co", displayName: "HR", isActive: false },
    ]);
    const mk = (box, id) => EmailMessage.create({ mailbox: box._id, direction: "in", status: "received", gmailMessageId: id, gmailThreadId: id, from: { address: "c@gmail.com" }, subject: id, messageDate: new Date() });
    [msgSupport, msgHr] = await Promise.all([mk(support, "S1"), mk(hr, "H1")]);

    for (const [user, role] of [[admin, "admin"], [root, "superadmin"]]) {
      const headers = { "x-test-admin": String(user._id), "x-test-role": role };
      const mailboxes = await (await fetch(`${base}/mailboxes`, { headers })).json();
      assert.deepEqual(mailboxes.mailboxes.map((m) => m.address), ["support@humancareconnect.co"], role);

      const list = await (await fetch(`${base}/messages?folder=all`, { headers })).json();
      assert.deepEqual(list.items.map((i) => i.subject), ["S1"], role);

      assert.equal((await fetch(`${base}/messages/${msgSupport._id}`, { headers })).status, 200);
      assert.equal((await fetch(`${base}/messages/${msgHr._id}`, { headers })).status, 404, `${role}: direct URL`);
      assert.equal((await fetch(`${base}/messages/${msgHr._id}/view`, { method: "POST", headers })).status, 404);
      assert.equal((await fetch(`${base}/messages/${msgHr._id}/spam`, { method: "POST", headers })).status, 404);
      assert.equal((await fetch(`${base}/messages/${msgHr._id}/reply`, { method: "POST", headers })).status, 404);

      const send = await fetch(`${base}/send`, {
        method: "POST", headers,
        body: (() => { const f = new FormData(); f.set("from", String(hr._id)); f.set("to", "c@gmail.com"); f.set("subject", "s"); f.set("body", "b"); return f; })(),
      });
      assert.equal(send.status, 400, `${role}: cannot send from an inactive mailbox`);
    }
  });
});

describe("checkMailboxConnection", () => {
  const ME = "hr@humancareconnect.co";
  const api = ({ profile, list } = {}) => ({
    users: {
      getProfile: async () => (profile instanceof Error ? Promise.reject(profile) : { data: profile || { emailAddress: ME, historyId: "42" } }),
      messages: { list: async () => (list instanceof Error ? Promise.reject(list) : { data: list || { messages: [{ id: "a" }, { id: "b" }] } }) },
    },
  });
  const googleError = (data, code = 400) => Object.assign(new Error("x"), { code, response: { status: code, data } });

  test("succeeds with the profile and only a read-only listing", async () => {
    const seen = [];
    const res = await checkMailboxConnection("HR@humancareconnect.co", {
      getApi: (mb) => { seen.push(mb); return api(); },
    });
    assert.deepEqual(res, { ok: true, address: ME, historyId: "42", latestIds: ["a", "b"] });
    assert.deepEqual(seen, [{ address: ME, isActive: true }]);
  });

  test("never builds an API for a non-company address", async () => {
    let built = 0;
    for (const bad of ["x@gmail.com", "", null, "a@humancareconnect.co.evil.com", "hr@humancare\nconnect.co", "hr@humancareconnect.co,x@y.co"]) {
      const res = await checkMailboxConnection(bad, { getApi: () => { built += 1; return api(); } });
      assert.equal(res.ok, false);
      assert.equal(res.code, "INVALID_ADDRESS");
    }
    assert.equal(built, 0);
  });

  test("detects an alias (Gmail answers with the primary address)", async () => {
    const res = await checkMailboxConnection(ME, { getApi: () => api({ profile: { emailAddress: "people@humancareconnect.co", historyId: "1" } }) });
    assert.equal(res.code, "ALIAS");
    assert.match(res.message, /people@humancareconnect\.co/);
  });

  test("explains a Group / unknown user (invalid_grant)", async () => {
    const res = await checkMailboxConnection(ME, { getApi: () => api({ profile: googleError({ error: "invalid_grant", error_description: "Invalid email or User ID" }) }) });
    assert.equal(res.code, "NO_USER_MAILBOX");
    assert.match(res.message, /Group/);
    assert.equal(res.detail, "invalid_grant");
  });

  test("explains missing delegation (unauthorized_client) and a 403", async () => {
    const a = await checkMailboxConnection(ME, { getApi: () => api({ profile: googleError({ error: "unauthorized_client" }) }) });
    assert.equal(a.code, "DELEGATION");
    const b = await checkMailboxConnection(ME, { getApi: () => api({ profile: googleError({ error: { code: 403, message: "denied", errors: [{ reason: "forbidden" }] } }, 403) }) });
    assert.equal(b.code, "DELEGATION");
  });

  test("explains a user without Gmail", async () => {
    const res = await checkMailboxConnection(ME, { getApi: () => api({ list: googleError({ error: { code: 400, message: "Mail service not enabled", errors: [{ reason: "failedPrecondition" }] } }) }) });
    assert.equal(res.code, "NO_GMAIL");
  });

  test("reports missing server credentials, timeouts and unknown errors without leaking details", async () => {
    const notConfigured = await checkMailboxConnection(ME, { getApi: () => { throw new Error("Gmail is not configured. Set GOOGLE_SA_JSON_B64 or GOOGLE_SA_JSON_PATH."); } });
    assert.equal(notConfigured.code, "NOT_CONFIGURED");

    const slow = { users: { getProfile: () => new Promise(() => {}), messages: { list: async () => ({ data: {} }) } } };
    assert.equal((await checkMailboxConnection(ME, { getApi: () => slow, timeoutMs: 20 })).code, "TIMEOUT");

    const unknown = await checkMailboxConnection(ME, { getApi: () => api({ profile: Object.assign(new Error("secret-token-abc leaked here"), { code: 418 }) }) });
    assert.equal(unknown.code, "UNKNOWN");
    assert.ok(!JSON.stringify(unknown).includes("secret-token-abc"));
  });
});
