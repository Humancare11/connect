const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// adminController builds a Stripe client at load time; this key is never used.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// The handlers talk to Mongo, the mailer and the activity log. Replace those
// seams BEFORE the controllers are required (they destructure at load time).
const events = []; // ordered log of side effects
const activity = [];

const activityLogger = require("../utils/activityLogger");
activityLogger.recordActivity = async (_req, entry) => { activity.push(entry); };

const tokenRevocation = require("../utils/tokenRevocation");
tokenRevocation.revokeUserSessions = async () => { events.push("revoke"); };

const mailer = require("../utils/sendEmail");
let mailFails = false;
const sent = [];
mailer.sendEmail = async (message) => {
  if (mailFails) throw new Error("smtp down");
  events.push(`mail:${message.subject}`);
  sent.push(message);
};

const User = require("../models/User");
const { requestAccountDeletion, cancelAccountDeletion } = require("../controllers/authController");
const { approveUserDeleteRequest, rejectUserDeleteRequest } = require("../controllers/adminController");
const { buildHtml, buildText } = require("../utils/accountDeletionEmail");

let current;
const makeUser = (over = {}) => ({
  _id: "u1",
  name: "Asha Rao",
  email: "asha@example.com",
  role: "user",
  deletionRequestStatus: "none",
  deletionReason: "",
  deletionRequestedAt: null,
  deletionApprovedAt: null,
  deletionRejectedAt: null,
  async save() { events.push("save"); },
  toObject() { return { ...this }; },
  ...over,
});
User.findById = async () => current;
User.findByIdAndDelete = async () => { events.push("delete"); return current; };

const call = async (handler, req = {}) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ user: { id: "u1" }, params: { id: "u1" }, body: {}, headers: {}, ...req }, res);
  return out;
};

test.beforeEach(() => {
  events.length = 0;
  activity.length = 0;
  sent.length = 0;
  mailFails = false;
  current = makeUser();
});

test("request: marks pending, emails 'received', and returns deletionRequestedAt", async () => {
  const res = await call(requestAccountDeletion, { body: { reason: "  moving away " } });
  assert.equal(res.status, 201);
  assert.equal(current.deletionRequestStatus, "pending");
  assert.equal(current.deletionReason, "moving away");
  assert.ok(current.deletionRequestedAt instanceof Date);
  assert.equal(res.body.user.deletionRequestStatus, "pending");
  assert.equal(res.body.user.deletionRequestedAt, current.deletionRequestedAt);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "asha@example.com");
  assert.match(sent[0].subject, /received your account deletion request/);
});

test("request: a second request while one is pending is refused (no second email)", async () => {
  await call(requestAccountDeletion);
  sent.length = 0;
  const again = await call(requestAccountDeletion);
  assert.equal(again.status, 400);
  assert.match(again.body.msg, /already pending/);
  assert.equal(sent.length, 0);
});

test("request still succeeds when the email cannot be sent", async () => {
  mailFails = true;
  const res = await call(requestAccountDeletion);
  assert.equal(res.status, 201);
  assert.equal(current.deletionRequestStatus, "pending");
});

test("cancel: pending → none, clears reason and date, and a new request is allowed", async () => {
  await call(requestAccountDeletion, { body: { reason: "x" } });
  const res = await call(cancelAccountDeletion);
  assert.equal(res.status, 200);
  assert.equal(current.deletionRequestStatus, "none");
  assert.equal(current.deletionReason, "");
  assert.equal(current.deletionRequestedAt, null);
  assert.equal(res.body.user.deletionRequestStatus, "none");
  assert.ok(activity.some((a) => a.action === "USER_CANCEL_ACCOUNT_DELETION"));

  const again = await call(requestAccountDeletion);
  assert.equal(again.status, 201);
});

test("cancel: nothing pending → 400 and nothing changes", async () => {
  for (const status of ["none", "rejected", "approved"]) {
    current = makeUser({ deletionRequestStatus: status });
    const res = await call(cancelAccountDeletion);
    assert.equal(res.status, 400, status);
    assert.equal(current.deletionRequestStatus, status);
  }
});

test("cancel: unknown user → 404", async () => {
  current = null;
  assert.equal((await call(cancelAccountDeletion)).status, 404);
});

test("approve: the email goes out BEFORE the account is deleted", async () => {
  current = makeUser({ deletionRequestStatus: "pending", deletionRequestedAt: new Date() });
  const res = await call(approveUserDeleteRequest);
  assert.equal(res.status, 200);
  const mailAt = events.findIndex((e) => e.startsWith("mail:"));
  const deleteAt = events.indexOf("delete");
  assert.ok(mailAt >= 0 && deleteAt > mailAt, JSON.stringify(events));
  assert.match(sent[0].subject, /approved/);
  assert.equal(sent[0].to, "asha@example.com");
  const log = activity.find((a) => a.action === "ADMIN_APPROVE_USER_DELETE_REQUEST");
  assert.equal(log.details.emailSent, true);
});

test("approve: a mail failure never blocks the deletion, and is recorded", async () => {
  current = makeUser({ deletionRequestStatus: "pending" });
  mailFails = true;
  const res = await call(approveUserDeleteRequest);
  assert.equal(res.status, 200);
  assert.ok(events.includes("delete"));
  const log = activity.find((a) => a.action === "ADMIN_APPROVE_USER_DELETE_REQUEST");
  assert.equal(log.details.emailSent, false);
});

test("approve: nothing pending → 400, no email, no delete", async () => {
  current = makeUser({ deletionRequestStatus: "none" });
  const res = await call(approveUserDeleteRequest);
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
  assert.ok(!events.includes("delete"));
});

test("reject: status rejected, account kept, 'declined' email sent", async () => {
  current = makeUser({ deletionRequestStatus: "pending" });
  const res = await call(rejectUserDeleteRequest);
  assert.equal(res.status, 200);
  assert.equal(current.deletionRequestStatus, "rejected");
  assert.ok(current.deletionRejectedAt instanceof Date);
  assert.ok(!events.includes("delete"));
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /account deletion request$/);
  assert.match(sent[0].text, /remains active/);
  // The user can ask again after a rejection.
  const again = await call(requestAccountDeletion);
  assert.equal(again.status, 201);
});

test("emails: accurate retention wording, no invented retention period, name escaped", () => {
  for (const kind of ["requested", "approved"]) {
    const text = buildText(kind, { name: "Asha" });
    assert.match(text, /kept where we are required to retain them by law/);
    assert.doesNotMatch(text, /\b\d+\s*(years?|months?|days?)\b/i, kind);
  }
  assert.ok(!buildText("rejected", {}).includes("kept where"));
  const html = buildHtml("requested", { name: '<script>alert("x")</script>' });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("routes: cancel is POST /account-delete-request/cancel, behind login", () => {
  const router = require("../routes/auth");
  const authMiddleware = require("../middleware/authMiddleware");
  const layer = router.stack.find((l) => l.route && l.route.path === "/account-delete-request/cancel");
  assert.ok(layer, "route missing");
  assert.ok(layer.route.methods.post);
  assert.ok(layer.route.stack.some((l) => l.handle === authMiddleware));
});
