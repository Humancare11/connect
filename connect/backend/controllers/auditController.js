const AuditLog = require("../models/AuditLog");
const { logAudit } = require("../utils/auditLogger");

// GET /api/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      userRole,
      success,
      search,
      startDate,
      endDate,
      patientId,
    } = req.query;

    const filter = {};

    if (action)    filter.action   = action;
    if (userRole)  filter.userRole = userRole;
    if (patientId) filter.patientId = patientId;

    if (success !== undefined && success !== "") {
      filter.success = success === "true";
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { userName:  regex },
        { userEmail: regex },
        { action:    regex },
        { resource:  regex },
        { ipAddress: regex },
      ];
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(filter);
    const logs  = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Log the fact that audit logs were viewed
    await logAudit(req, { action: "ADMIN_VIEW_AUDIT_LOGS", resource: "AuditLog", details: { filters: req.query } });

    res.status(200).json({
      logs,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("getAuditLogs error:", err);
    res.status(500).json({ msg: "Failed to fetch audit logs." });
  }
};

// GET /api/audit-logs/stats
const getAuditStats = async (req, res) => {
  try {
    const now   = new Date();
    const day   = new Date(now); day.setHours(0, 0, 0, 0);
    const week  = new Date(now); week.setDate(now.getDate() - 7);
    const month = new Date(now); month.setDate(now.getDate() - 30);

    const [
      totalLogs,
      failedAttempts,
      phiAccesses,
      adminActions,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      byAction,
      byRole,
    ] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ success: false }),
      AuditLog.countDocuments({ action: /^PHI_/ }),
      AuditLog.countDocuments({ action: /^ADMIN_/ }),
      AuditLog.countDocuments({ timestamp: { $gte: day } }),
      AuditLog.countDocuments({ timestamp: { $gte: week } }),
      AuditLog.countDocuments({ timestamp: { $gte: month } }),
      AuditLog.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $group: { _id: "$userRole", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      totalLogs,
      failedAttempts,
      phiAccesses,
      adminActions,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      byAction,
      byRole,
    });
  } catch (err) {
    console.error("getAuditStats error:", err);
    res.status(500).json({ msg: "Failed to fetch audit stats." });
  }
};

module.exports = { getAuditLogs, getAuditStats };
