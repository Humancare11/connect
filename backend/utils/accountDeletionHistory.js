// utils/accountDeletionHistory.js
//
// Reads and writes the AccountDeletionRequest history (see the model for what
// is kept and why, including the legal-review TODO).
//
// This feature does NOT use utils/activityLogger: that is a deliberate no-op,
// so the history collection is the only record of who requested deletion and
// what was decided.
//
// Most functions here return what they wrote or null and never throw (callers
// decide what failing means: a user's request still goes through, but an admin
// approval is refused if it can't be recorded). The exception is decide(), which
// THROWS on a database error so "no pending request to decide" (null) can be told
// apart from "the database failed" — see its comment.
const AccountDeletionRequest = require("../models/AccountDeletionRequest");
const User = require("../models/User");
const { detectRegistrationClient } = require("./clientInfo");

const REASON_MAX = 500;
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Where a request came from, using the same logic as signup (X-Client-Platform /
// X-App-Version, then native User-Agent, then browser). Only the derived fields
// are stored — never the IP or the raw User-Agent.
function requestSourceFromReq(req) {
  const client = detectRegistrationClient(req);
  return {
    platform: client.registrationPlatform || "",
    subType: client.registrationSubType || "",
    appVersion: client.registrationAppVersion || "",
    source: client.registrationPlatformSource || "",
  };
}

const snapshotOfUser = (user) => ({
  userId: user._id,
  patientId: Number.isFinite(Number(user.patientId)) && user.patientId != null ? Number(user.patientId) : null,
  name: user.name || "",
  email: user.email || "",
});

const isDuplicateKey = (err) => err && err.code === 11000;

// Who is making this admin request, as stored on the history row. The name is
// looked up (the token only carries id/email/role); if that fails the row still
// gets the id, email and role.
async function adminSnapshot(req) {
  const snapshot = {
    id: String(req?.user?.id || ""),
    name: "",
    email: req?.user?.email || "",
    role: req?.user?.role || "",
  };
  try {
    const admin = await User.findById(req.user.id).select("name email role").lean();
    if (admin) {
      snapshot.name = admin.name || "";
      snapshot.email = admin.email || snapshot.email;
      snapshot.role = admin.role || snapshot.role;
    }
  } catch (_) { /* keep the token's values */ }
  return snapshot;
}

// Records that `user` has just asked for deletion. Returns the pending row (an
// existing one if there already is one), or null if the history couldn't be
// written.
async function openRequest(user, { reason = "", requestedAt = new Date(), requestSource } = {}) {
  try {
    return await AccountDeletionRequest.create({
      ...snapshotOfUser(user),
      reason: String(reason || "").trim().slice(0, REASON_MAX),
      status: "pending",
      requestedAt,
      requestSource: requestSource || {},
    });
  } catch (err) {
    if (isDuplicateKey(err)) return AccountDeletionRequest.findOne({ userId: user._id, status: "pending" });
    console.error("accountDeletionHistory.openRequest failed:", err.message);
    return null;
  }
}

// The user's pending row. If there isn't one — the request was made before this
// history existed, or its write failed — it is created now from the user record
// (marked backfilled: request source unknown). Null only if that fails too.
async function ensurePendingRecord(user) {
  try {
    const existing = await AccountDeletionRequest.findOne({ userId: user._id, status: "pending" });
    if (existing) return existing;
  } catch (err) {
    console.error("accountDeletionHistory.ensurePendingRecord lookup failed:", err.message);
    return null;
  }
  const created = await openRequest(user, {
    reason: user.deletionReason,
    requestedAt: user.deletionRequestedAt || new Date(),
  });
  if (created && !created.backfilled) {
    try {
      await AccountDeletionRequest.updateOne({ _id: created._id }, { $set: { backfilled: true } });
      created.backfilled = true;
    } catch (_) { /* cosmetic */ }
  }
  return created;
}

// Atomically moves the user's pending row to a final status. Returns the
// updated row, or null if there was no pending row (already decided / not
// pending) — so two admins clicking at once cannot both win. Throws if the
// database call itself fails.
async function decide(userId, status, { decidedBy = null, via = "review", decisionEmailSent = false, at = new Date() } = {}) {
  return AccountDeletionRequest.findOneAndUpdate(
    { userId, status: "pending" },
    {
      $set: {
        status,
        decidedAt: at,
        decidedBy: decidedBy || null,
        decidedVia: decidedBy ? via : "",
        "emails.decision": Boolean(decisionEmailSent),
      },
    },
    { new: true }
  );
}

// Puts a row that was just decided back to pending (used to undo a decision when
// the follow-up step — deleting the user — fails).
async function revertToPending(id) {
  try {
    return await AccountDeletionRequest.findOneAndUpdate(
      { _id: id },
      { $set: { status: "pending", decidedAt: null, decidedBy: null, decidedVia: "", "emails.decision": false } },
      { new: true }
    );
  } catch (err) {
    console.error("accountDeletionHistory.revertToPending failed:", err.message);
    return null;
  }
}

async function setEmailFlag(id, which, sent) {
  if (!id || !["requested", "decision"].includes(which)) return;
  try {
    await AccountDeletionRequest.updateOne({ _id: id }, { $set: { [`emails.${which}`]: Boolean(sent) } });
  } catch (err) {
    console.error("accountDeletionHistory.setEmailFlag failed:", err.message);
  }
}

// A deletion that was not the user's request: an admin used "Delete User".
async function recordDirectDelete(user, decidedBy, at = new Date()) {
  try {
    return await AccountDeletionRequest.create({
      ...snapshotOfUser(user),
      status: "deleted_by_admin",
      requestedAt: at,
      decidedAt: at,
      decidedBy,
      decidedVia: "direct_delete",
    });
  } catch (err) {
    console.error("accountDeletionHistory.recordDirectDelete failed:", err.message);
    return null;
  }
}

async function removeRecord(id) {
  try {
    await AccountDeletionRequest.deleteOne({ _id: id });
  } catch (err) {
    console.error("accountDeletionHistory.removeRecord failed:", err.message);
  }
}

// ── Admin list ───────────────────────────────────────────────────────────────
// status: all | pending | approved | rejected | cancelled | deleted_by_admin
// source: all | web | app
// q: name / email (partial) or patient ID (exact digits)
function buildFilter({ status, source, q } = {}) {
  const filter = {};
  if (source === "web" || source === "app") filter["requestSource.platform"] = source;

  const text = String(q || "").trim();
  if (text) {
    const rx = new RegExp(escapeRegex(text), "i");
    const or = [{ name: rx }, { email: rx }];
    if (/^\d{1,5}$/.test(text)) or.push({ patientId: Number(text) });
    filter.$or = or;
  }
  return { base: filter, status: AccountDeletionRequest.STATUSES.includes(status) ? status : null };
}

async function listRequests({ status, source, q, page = 1, limit = PAGE_SIZE_DEFAULT } = {}) {
  const { base, status: statusFilter } = buildFilter({ status, source, q });
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const query = statusFilter ? { ...base, status: statusFilter } : base;

  const [items, total, grouped] = await Promise.all([
    AccountDeletionRequest.find(query)
      .sort({ requestedAt: -1, _id: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AccountDeletionRequest.countDocuments(query),
    // Tab counts follow the search and source filter, not the selected tab.
    AccountDeletionRequest.aggregate([{ $match: base }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const counts = { all: 0 };
  for (const s of AccountDeletionRequest.STATUSES) counts[s] = 0;
  for (const g of grouped) {
    counts[g._id] = g.n;
    counts.all += g.n;
  }

  return { items, total, page: pageNumber, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1), counts };
}

module.exports = {
  REASON_MAX,
  requestSourceFromReq,
  adminSnapshot,
  openRequest,
  ensurePendingRecord,
  decide,
  revertToPending,
  setEmailFlag,
  recordDirectDelete,
  removeRecord,
  listRequests,
  snapshotOfUser,
};
