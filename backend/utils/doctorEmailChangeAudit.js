const DoctorEmailChangeAudit = require("../models/DoctorEmailChangeAudit");

const safeCorrelationId = (req) => {
  const raw = req?.id || req?.headers?.["x-request-id"] || "";
  return String(raw).replace(/[^\w.-]/g, "").slice(0, 64);
};

// Writes one audit row. It never throws: a failed audit write is logged (without
// any request data) and must not break, or be mistaken for, the email change itself.
async function recordEmailChangeAudit(req, { doctorId, action, outcome, reason = "" }) {
  try {
    await DoctorEmailChangeAudit.create({
      doctorId,
      action,
      outcome,
      reason,
      correlationId: safeCorrelationId(req),
    });
  } catch (err) {
    console.error("doctor email change audit write failed:", err.message);
  }
}

module.exports = { recordEmailChangeAudit };
