// GET /api/admin/deletion-requests — the account-deletion history for admins
// (admin + superadmin; see routes/admin.js). Includes requests whose user has
// since been deleted. Responds with the stored snapshot only.
const User = require("../models/User");
const { listRequests } = require("../utils/accountDeletionHistory");

const toDto = (row, existingUserIds) => ({
  _id: row._id,
  userId: row.userId,
  // Pending and rejected users still exist; approved / deleted ones do not.
  userExists: existingUserIds.has(String(row.userId)),
  patientId: row.patientId ?? null,
  name: row.name || "",
  email: row.email || "",
  reason: row.reason || "",
  status: row.status,
  requestedAt: row.requestedAt,
  decidedAt: row.decidedAt || null,
  decidedBy: row.decidedBy
    ? { name: row.decidedBy.name || "", email: row.decidedBy.email || "", role: row.decidedBy.role || "" }
    : null,
  decidedVia: row.decidedVia || "",
  emails: { requested: Boolean(row.emails?.requested), decision: Boolean(row.emails?.decision) },
  requestSource: {
    platform: row.requestSource?.platform || "",
    subType: row.requestSource?.subType || "",
    appVersion: row.requestSource?.appVersion || "",
    source: row.requestSource?.source || "",
  },
  backfilled: Boolean(row.backfilled),
});

const getDeletionRequests = async (req, res) => {
  try {
    const { status, source, q, page, limit } = req.query;
    const result = await listRequests({ status, source, q, page, limit });

    const ids = result.items.map((row) => row.userId);
    const existing = ids.length
      ? await User.find({ _id: { $in: ids } }).select("_id").lean()
      : [];
    const existingUserIds = new Set(existing.map((u) => String(u._id)));

    res.json({
      items: result.items.map((row) => toDto(row, existingUserIds)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pages: result.pages,
      counts: result.counts,
    });
  } catch (err) {
    console.error("getDeletionRequests error:", err);
    res.status(500).json({ msg: "Failed to load deletion requests." });
  }
};

module.exports = { getDeletionRequests, toDto };
