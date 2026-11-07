// Verifies the files a patient attached to a booking that the storage could not be asked about when the booking was created
// (utils/bookingReports.js "unverified"). The booking and the payment were already done; this only decides whether each file is
// attached: a file that now checks out moves into medicalReports, a file that fails is dropped ([REPORT_DROPPED]), and a file the
// storage still cannot answer for is retried on the next sweep until GIVE_UP_AFTER_MS, then dropped and logged.
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const { checkBookingReports, logReportOutcome } = require("../utils/bookingReports");

const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 25;
let isRunning = false;

async function settle(Model, kind, now) {
  const stats = { scanned: 0, attached: 0, dropped: 0, waiting: 0 };
  const rows = await Model.find({ "reportsUnverified.0": { $exists: true } })
    .select("patientId reportsUnverified reportsUnverifiedAt medicalReports")
    .sort({ reportsUnverifiedAt: 1 })
    .limit(BATCH_SIZE);
  for (const row of rows) {
    stats.scanned += 1;
    const pending = row.reportsUnverified.map((p) => ({ key: p.key, name: p.name }));
    const checked = await checkBookingReports(pending, { userId: row.patientId, attempts: 1, retryDelayMs: 0 });
    const expired = row.reportsUnverifiedAt && now - new Date(row.reportsUnverifiedAt).getTime() > GIVE_UP_AFTER_MS;
    const stillUnverified = expired ? [] : checked.unverified;
    // An expired file the storage never answered for is dropped like any other that cannot be attached.
    const dropped = [...checked.dropped, ...(expired ? checked.unverified.map((u) => ({ ...u, reason: "storage_unavailable" })) : [])];

    const have = new Set((row.medicalReports || []).map((r) => r.key));
    const toAdd = checked.kept.filter((r) => !have.has(r.key));
    row.medicalReports.push(...toAdd);
    row.reportsUnverified = stillUnverified.map((u) => ({ key: u.key, name: u.name }));
    if (!stillUnverified.length) row.reportsUnverifiedAt = null;
    await row.save();

    stats.attached += toAdd.length;
    stats.dropped += dropped.length;
    stats.waiting += stillUnverified.length;
    logReportOutcome({ dropped, unverified: [] }, { patientId: String(row.patientId), bookingId: String(row._id), kind });
  }
  return stats;
}

async function runPendingReports({ now = Date.now() } = {}) {
  if (isRunning) return { skipped: true };
  isRunning = true;
  try {
    const category = await settle(CategoryConsultation, "category", now);
    const appointment = await settle(Appointment, "appointment", now);
    const total = {
      scanned: category.scanned + appointment.scanned,
      attached: category.attached + appointment.attached,
      dropped: category.dropped + appointment.dropped,
      waiting: category.waiting + appointment.waiting,
    };
    if (total.scanned > 0) {
      console.log(`[pending-reports] scanned=${total.scanned} attached=${total.attached} dropped=${total.dropped} waiting=${total.waiting}`);
    }
    return total;
  } finally {
    isRunning = false;
  }
}

function schedulePendingReports() {
  const intervalMs = Number(process.env.PENDING_REPORTS_INTERVAL_MS) || 5 * 60 * 1000;
  setInterval(() => {
    runPendingReports().catch((err) => console.error("pending reports error:", err));
  }, intervalMs).unref();
}

module.exports = { runPendingReports, schedulePendingReports, GIVE_UP_AFTER_MS };
