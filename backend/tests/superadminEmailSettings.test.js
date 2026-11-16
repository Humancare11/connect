const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailSettings = require("../models/EmailSettings");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const settingsRouter = require("../routes/superadminEmailSettings");
const mailboxesRouter = require("../routes/superadminMailboxes");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");

const ENV_ON = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: "https://api.uat.example.com" };
const DISCLOSURE = "This email may include an image that tells us when it was opened.";

describe("superadmin email settings (open tracking switches, opt-outs)", () => {
  let mongod, server, base, root, env;
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(root._id), role };
    next();
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailSettings.init(), EmailTrackingOptOut.init(), Mailbox.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use("/settings", settingsRouter.create({ guard: [fakeAuth, superAdminOnly], getState: (o) => getTrackingState({ ...o, env }) }));
    app.use("/mailboxes", mailboxesRouter.create({ guard: [fakeAuth, superAdminOnly], limiter: (q, r, n) => n(), check: async (address) => ({ ok: true, address }) }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => { server.close(r); server.closeAllConnections(); });
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([EmailSettings.deleteMany({}), EmailTrackingOptOut.deleteMany({}), Mailbox.deleteMany({}), User.deleteMany({})]);
    root = await User.create({ name: "Rahul", email: "r@x.co", role: "superadmin" });
    clearSettingsCache();
    env = {};
  });

  const call = async (method, path, body, role = "superadmin") => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  test("only a Super Admin gets through", async () => {
    for (const [method, path, body] of [["GET", "/settings"], ["PATCH", "/settings", { trackingEnabled: true }], ["POST", "/settings/opt-outs", { address: "a@b.co" }], ["DELETE", `/settings/opt-outs/${new mongoose.Types.ObjectId()}`]]) {
      for (const role of ["admin", "paymentadmin", "partner", "doctor", "user"]) assert.equal((await call(method, path, body, role)).status, 403, `${method} ${role}`);
      assert.equal((await call(method, path, body, null)).status, 401, `${method} anonymous`);
    }
    assert.equal(await EmailSettings.countDocuments(), 0, "refused requests change nothing");
    const [first, second] = settingsRouter.stack;
    assert.equal(first.handle, verifyAdminToken);
    assert.equal(second.handle, superAdminOnly);
  });

  test("starts OFF everywhere, and the screen has no footer-notice setting", async () => {
    const { body } = await call("GET", "/settings");
    assert.equal(body.tracking.switchOn, false);
    assert.equal(body.tracking.active, false);
    assert.equal(body.tracking.envEnabled, false);
    for (const key of ["disclosureEnabled", "disclosureText", "disclosureCustom", "defaultDisclosure", "disclosureExamples"]) {
      assert.equal(body.tracking[key], undefined, key);
    }
    assert.deepEqual(body.optOuts, []);
  });

  test("the Super Admin switch alone does not activate tracking: the server gate must be open too", async () => {
    // No custom line is needed: the automatic wording is used.
    let r = await call("PATCH", "/settings", { trackingEnabled: true });
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.tracking.switchOn, r.body.tracking.envEnabled, r.body.tracking.active], [true, false, false]);
    env = { ...ENV_ON };
    r = await call("GET", "/settings");
    assert.deepEqual([r.body.tracking.switchOn, r.body.tracking.envEnabled, r.body.tracking.baseUrlOk, r.body.tracking.active], [true, true, true, true]);
    env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: "http://not-https.example.com" };
    r = await call("GET", "/settings");
    assert.deepEqual([r.body.tracking.baseUrlOk, r.body.tracking.active], [false, false]);
  });

  test("switching off takes effect at once (settings cache is cleared)", async () => {
    env = { ...ENV_ON };
    await call("PATCH", "/settings", { trackingEnabled: true });
    assert.equal((await getTrackingState({ env })).active, true);
    await call("PATCH", "/settings", { trackingEnabled: false });
    assert.equal((await getTrackingState({ env })).active, false);
  });

  test("records who changed it", async () => {
    await call("PATCH", "/settings", { trackingEnabled: true });
    assert.equal(String((await EmailSettings.findOne({ key: "email" })).updatedBy), String(root._id));
  });

  test("the footer notice cannot be edited any more", async () => {
    for (const patch of [{ disclosureEnabled: true }, { disclosureText: "We may track." }]) {
      const r = await call("PATCH", "/settings", patch);
      assert.equal(r.status, 400, JSON.stringify(patch));
    }
  });

  test("'Track mail to company addresses' defaults ON, can be switched off, and is honoured by the sender state", async () => {
    let r = await call("GET", "/settings");
    assert.equal(r.body.tracking.trackInternalRecipients, true);
    r = await call("PATCH", "/settings", { trackInternalRecipients: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.tracking.trackInternalRecipients, false);
    assert.equal((await getTrackingState({ env, full: true })).trackInternalRecipients, false);
    r = await call("PATCH", "/settings", { trackInternalRecipients: true });
    assert.equal(r.body.tracking.trackInternalRecipients, true);
    assert.equal((await call("PATCH", "/settings", { trackInternalRecipients: "no" })).status, 400);
  });

  test("validation: types, unknown fields, empty body", async () => {
    assert.equal((await call("PATCH", "/settings", { trackingEnabled: "yes" })).status, 400);
    assert.equal((await call("PATCH", "/settings", { key: "other" })).status, 400);
    assert.equal((await call("PATCH", "/settings", { updatedBy: "x" })).status, 400);
    assert.equal((await call("PATCH", "/settings", {})).status, 400);
    assert.equal((await call("PATCH", "/settings", [1])).status, 400);
  });

  describe("opt-out list", () => {
    test("add, list, duplicate, remove", async () => {
      let r = await call("POST", "/settings/opt-outs", { address: "  Patient <Patient@Example.com> ", note: "asked on phone" });
      assert.equal(r.status, 201);
      assert.deepEqual(r.body.optOuts.map((o) => [o.address, o.note]), [["patient@example.com", "asked on phone"]]);
      assert.equal((await call("POST", "/settings/opt-outs", { address: "PATIENT@example.com" })).status, 409);
      const id = r.body.optOuts[0].id;
      r = await call("DELETE", `/settings/opt-outs/${id}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.optOuts, []);
      assert.equal((await call("DELETE", `/settings/opt-outs/${id}`)).status, 404);
    });
    test("rejects bad input", async () => {
      for (const address of ["", "not-an-email", "a@b.co, c@d.co", 5, null, { $ne: 1 }]) {
        assert.equal((await call("POST", "/settings/opt-outs", { address })).status, 400, JSON.stringify(address));
      }
      assert.equal((await call("DELETE", "/settings/opt-outs/not-an-id")).status, 404);
      assert.equal(await EmailTrackingOptOut.countDocuments(), 0);
    });
  });

  describe("per-mailbox default (Mail IDs): removed", () => {
    test("the mailbox API no longer has trackOpensDefault; an old client sending it is ignored", async () => {
      let r = await call("POST", "/mailboxes", { address: "accounts@humancareconnect.co", displayName: "Accounts" });
      assert.equal(r.status, 201);
      assert.equal(r.body.mailbox.trackOpensDefault, undefined);
      const id = r.body.mailbox.id;
      // A cached old page may still send it: ignored, no error, nothing changes.
      r = await call("PATCH", `/mailboxes/${id}`, { trackOpensDefault: false });
      assert.equal(r.status, 200);
      assert.equal(r.body.mailbox.trackOpensDefault, undefined);
      r = await call("PATCH", `/mailboxes/${id}`, { displayName: "Accounts team", trackOpensDefault: false });
      assert.equal(r.status, 200);
      assert.equal(r.body.mailbox.displayName, "Accounts team");
      r = await call("POST", "/mailboxes", { address: "hr@humancareconnect.co", displayName: "HR", trackOpensDefault: false });
      assert.equal(r.status, 201);
      const list = await call("GET", "/mailboxes");
      assert.ok(list.body.mailboxes.every((m) => m.trackOpensDefault === undefined));
    });
  });
});
