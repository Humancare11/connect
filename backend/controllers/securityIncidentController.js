const SecurityIncident = require("../models/SecurityIncident");
const { logAudit } = require("../utils/auditLogger");

const listIncidents = async (req, res) => {
  try {
    const { status, severity, type, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
    const [items, total, summary] = await Promise.all([
      SecurityIncident.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      SecurityIncident.countDocuments(filter),
      SecurityIncident.aggregate([
        { $group: { _id: { status: "$status", severity: "$severity" }, count: { $sum: 1 } } },
      ]),
    ]);

    await logAudit(req, {
      action: "ADMIN_VIEW_SECURITY_INCIDENTS",
      resource: "SecurityIncident",
      details: { filters: req.query },
    });

    res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum), summary });
  } catch (err) {
    console.error("listIncidents error:", err);
    res.status(500).json({ msg: "Failed to fetch security incidents." });
  }
};

const addIncidentAction = async (req, res) => {
  try {
    const { action, notes, status } = req.body;
    if (!action) return res.status(400).json({ msg: "Action is required." });

    const incident = await SecurityIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ msg: "Incident not found." });

    incident.investigationHistory.push({
      action,
      notes: notes || "",
      status: status || incident.status,
      actorId: req.user.id,
      actorEmail: req.user.email || "",
      actorRole: req.user.role,
    });
    if (status) incident.status = status;
    await incident.save();

    await logAudit(req, {
      action: "SECURITY_INCIDENT_INVESTIGATION_UPDATED",
      resource: "SecurityIncident",
      resourceId: incident._id,
      details: { action, status: incident.status },
    });

    res.json({ msg: "Incident updated.", incident });
  } catch (err) {
    console.error("addIncidentAction error:", err);
    res.status(500).json({ msg: "Failed to update incident." });
  }
};

module.exports = { listIncidents, addIncidentAction };
