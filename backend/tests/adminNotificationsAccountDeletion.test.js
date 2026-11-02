const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const mailer = require("../utils/sendEmail");
mailer.sendEmail = async () => {};

const User = require("../models/User");
const AdminNotification = require("../models/AdminNotification");
const { requestAccountDeletion, cancelAccountDeletion } = require("../controllers/authController");

const REASON = "private medical reason 12345";
const settle = () => new Promise((r) => setTimeout(r, 150));
const notifications = () => AdminNotification.find({}).lean();

const call = async (handler, req = {}) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ headers: {}, body: {}, params: {}, query: {}, ...req }, res);
  return out;
};

describe("admin notification for patient account deletion requests (in-memory MongoDB)", () => {
  let mongod;
  let n = 0;
  const makeUser = () => {
    n += 1;
    return User.create({ name: `Patient ${n}`, email: `p${n}@example.com`, password: "x", role: "user" });
  };
  const asUser = (u, extra = {}) => ({ user: { id: String(u._id), role: "user" }, ...extra });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), AdminNotification.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AdminNotification.deleteMany({})]);
  });

  test("a successful request creates exactly one notification with the right shape", async () => {
    const u = await makeUser();
    const res = await call(requestAccountDeletion, asUser(u, { body: { reason: REASON } }));
    assert.equal(res.status, 201);
    await settle();
    const rows = await notifications();
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.type, "account_deletion_requested");
    assert.equal(row.title, "Patient account deletion requested");
    assert.equal(row.message, `${u.name} requested account deletion.`);
    assert.equal(row.refType, "user");
    assert.equal(row.refId, String(u._id));
    assert.equal(row.link, "/admin-dashboard/deletion-requests");
    assert.match(row.dedupeKey, new RegExp(`^account_deletion_requested:${u._id}:\\d+$`));
  });

  test("the payload never carries the reason, email or other personal fields", async () => {
    const u = await makeUser();
    await call(requestAccountDeletion, asUser(u, { body: { reason: REASON } }));
    await settle();
    const json = JSON.stringify(await notifications());
    assert.ok(!json.includes(REASON));
    assert.ok(!json.includes(u.email));
  });

  test("a duplicate pending request is refused and adds no notification", async () => {
    const u = await makeUser();
    await call(requestAccountDeletion, asUser(u));
    await settle();
    const again = await call(requestAccountDeletion, asUser(u));
    assert.equal(again.status, 400);
    await settle();
    assert.equal((await notifications()).length, 1);
  });

  test("cancelling does not notify; a new request after cancelling raises a new alert", async () => {
    const u = await makeUser();
    await call(requestAccountDeletion, asUser(u));
    await settle();
    const cancel = await call(cancelAccountDeletion, asUser(u));
    assert.equal(cancel.status, 200);
    await settle();
    assert.equal((await notifications()).length, 1);
    await new Promise((r) => setTimeout(r, 5)); // distinct deletionRequestedAt
    const again = await call(requestAccountDeletion, asUser(u));
    assert.equal(again.status, 201);
    await settle();
    assert.equal((await notifications()).length, 2);
  });

  test("an unknown user gets 404 and no notification", async () => {
    const res = await call(requestAccountDeletion, { user: { id: String(new mongoose.Types.ObjectId()), role: "user" } });
    assert.equal(res.status, 404);
    await settle();
    assert.equal((await notifications()).length, 0);
  });

  test("a notification persistence failure does not fail the request", async () => {
    const u = await makeUser();
    const original = AdminNotification.create;
    const warn = console.warn;
    AdminNotification.create = async () => { throw new Error("notification db down"); };
    console.warn = () => {};
    try {
      const res = await call(requestAccountDeletion, asUser(u, { body: { reason: REASON } }));
      assert.equal(res.status, 201);
      await settle();
    } finally {
      AdminNotification.create = original;
      console.warn = warn;
    }
    assert.equal((await User.findById(u._id)).deletionRequestStatus, "pending");
    assert.equal((await notifications()).length, 0);
  });

  test("the same request notified twice is deduplicated", async () => {
    const u = await makeUser();
    await call(requestAccountDeletion, asUser(u));
    await settle();
    const fresh = await User.findById(u._id);
    const { notifyAdminAccountDeletionRequested } = require("../utils/adminNotifications");
    const result = await notifyAdminAccountDeletionRequested({ user: fresh });
    assert.equal(result.status, "deduplicated");
    assert.equal((await notifications()).length, 1);
  });
});
