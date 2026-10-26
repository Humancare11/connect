const express = require("express");
const mongoose = require("mongoose");
const { verifyAdminToken, entriesViewAccess } = require("../middleware/verifyToken");
const { EntryListQueryError, listBookingEntries, loadEntryRow } = require("../utils/bookingEntryList");
const { MAX_HISTORY, applyEntryEdit } = require("../utils/bookingEntry");
const { toManualRow } = require("../utils/manualEntry");
const { istDayKey } = require("../services/liveChat/istDay");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ManualEntry = require("../models/ManualEntry");
const User = require("../models/User");

const KINDS = ["appointment", "category", "manual"];

// The signed-in admin as the audit trail records them.
async function actorOf(req) {
  const admin = mongoose.isValidObjectId(req.user?.id) ? await User.findById(req.user.id).select("name email").lean() : null;
  return {
    id: req.user?.id || null,
    name: admin?.name || req.user?.name || req.user?.email || "Admin",
    email: admin?.email || req.user?.email || "",
    role: req.user?.role || "",
  };
}

// The same stored version the page saw. A booking that has never been edited has no version yet and reads as 0.
const versionMatch = (version) =>
  version === 0 ? { $or: [{ "entry.v": 0 }, { "entry.v": null }, { "entry.v": { $exists: false } }] } : { "entry.v": version };

// Loads what one edit needs to know about the stored row, or null when the row is not one the page lists.
async function loadForEdit(kind, id) {
  if (kind === "manual") {
    const doc = await ManualEntry.findOne({ _id: id, deletedAt: null }).select("entry doctorEnrollmentId").lean();
    return doc && { Model: ManualEntry, doc, hasDoctor: Boolean(doc.doctorEnrollmentId), doctorId: doc.doctorEnrollmentId || "" };
  }
  if (kind === "category") {
    const doc = await CategoryConsultation.findOne({ _id: id, paymentStatus: "paid" }).select("entry assignedDoctorId").lean();
    return doc && { Model: CategoryConsultation, doc, hasDoctor: Boolean(doc.assignedDoctorId), doctorId: doc.assignedDoctorId || "" };
  }
  const doc = await Appointment.findById(id).select("entry doctorId").lean();
  return doc && { Model: Appointment, doc, hasDoctor: Boolean(doc.doctorId), doctorId: doc.doctorId || "" };
}

const rowOf = async (kind, id) => {
  if (kind === "manual") {
    const doc = await ManualEntry.findOne({ _id: id, deletedAt: null }).lean();
    return doc ? toManualRow(doc) : null;
  }
  return loadEntryRow(kind, id);
};

const sendError = (res, r) => res.status(r.status).json({ msg: r.msg, code: r.code });

// Appointment entries: the doctor fee / payout record kept on each booking, and the manual rows added by hand. `guard` is
// overridable so tests can stand in for the token check; `now` so they can pin "today". Everyone who passes the guard
// (admin, super admin) can look and edit.
function create({ guard = [verifyAdminToken, entriesViewAccess], now = () => Date.now() } = {}) {
  const router = express.Router();

  // GET /api/admin/entries?tab=&q=&page=&limit=&sort=&doctor=&month=&includeCancelled=&includeTesting=
  router.get("/", ...guard, async (req, res) => {
    try {
      res.status(200).json(await listBookingEntries(req.query));
    } catch (error) {
      if (error instanceof EntryListQueryError) return res.status(400).json({ msg: error.message });
      console.error("listBookingEntries error:", error);
      res.status(500).json({ msg: "Failed to fetch appointment entries." });
    }
  });

  // PATCH /api/admin/entries/:kind/:id   { field: "doctorFee"|"paidStatus"|"paidOn"|"comment", value, version }
  // One field per request. `version` is the one the page saw: if someone else saved since, the answer is 409 with the current row.
  router.patch("/:kind/:id", ...guard, async (req, res) => {
    try {
      const { kind, id } = req.params;
      if (!KINDS.includes(kind) || !mongoose.isValidObjectId(id)) return res.status(404).json({ msg: "That entry was not found." });
      const { field, value, version } = req.body || {};
      if (!Number.isInteger(version) || version < 0) return res.status(400).json({ msg: "version must be a whole number.", code: "bad_version" });

      const loaded = await loadForEdit(kind, id);
      if (!loaded) return res.status(404).json({ msg: "That entry was not found." });

      const actor = await actorOf(req);
      const result = applyEntryEdit(loaded.doc.entry, { field, value }, { hasDoctor: loaded.hasDoctor, doctorId: loaded.doctorId, today: istDayKey(now()), actor, now: new Date(now()) });
      if (!result.ok) return sendError(res, result);
      if (result.noop) return res.status(200).json({ item: await rowOf(kind, id), noop: true });

      const written = await loaded.Model.findOneAndUpdate(
        { _id: id, ...(kind === "manual" ? { deletedAt: null } : {}), ...versionMatch(version) },
        { $set: { ...result.set, "entry.v": version + 1 }, $push: { "entry.history": { $each: result.history, $slice: -MAX_HISTORY } } },
        // A payout edit is not a change to the booking: leave its updatedAt alone.
        { new: true, timestamps: false, projection: { _id: 1 } },
      ).lean();
      if (!written) {
        const current = await rowOf(kind, id);
        if (!current) return res.status(404).json({ msg: "That entry was not found." });
        return res.status(409).json({ msg: "Someone else changed this row. It has been refreshed.", code: "stale", item: current });
      }
      res.status(200).json({ item: await rowOf(kind, id), noop: false });
    } catch (error) {
      console.error("updateBookingEntry error:", error);
      res.status(500).json({ msg: "Failed to save the change." });
    }
  });

  return router;
}

const router = create();
router.create = create;
module.exports = router;
