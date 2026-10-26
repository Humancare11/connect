const express = require("express");
const mongoose = require("mongoose");
const { verifyAdminToken, entriesViewAccess } = require("../middleware/verifyToken");
const { EntryListQueryError, listBookingEntries, listAllEntryRows, loadEntryRow } = require("../utils/bookingEntryList");
const { buildEntriesCsv } = require("../utils/bookingEntryCsv");
const { MAX_HISTORY, applyEntryEdit } = require("../utils/bookingEntry");
const { toManualRow, validateManualCreate, buildManualDocument, applyManualFormEdit, checkManualDelete, manualDeleteWrite, newCode } = require("../utils/manualEntry");
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
    // A manual row's "doctor" is its free-text service provider.
    const doc = await ManualEntry.findOne({ _id: id, deletedAt: null }).select("entry doctorName").lean();
    return doc && { Model: ManualEntry, doc, hasDoctor: Boolean(String(doc.doctorName || "").trim()), doctorId: "", manual: true };
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

  // GET /api/admin/entries/export.csv?tab=&q=&sort=&doctor=&month=&includeCancelled=&includeTesting=
  // The same filters as the list, every matching row (no paging), as a download. Cut at MAX_EXPORT_ROWS: X-Export-Truncated says so.
  router.get("/export.csv", ...guard, async (req, res) => {
    try {
      const { rows, total, truncated } = await listAllEntryRows(req.query);
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="entries-${istDayKey(now())}.csv"`,
        "Cache-Control": "no-store",
        "X-Export-Rows": String(rows.length),
        "X-Export-Total": String(total),
        "X-Export-Truncated": truncated ? "true" : "false",
        "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Rows, X-Export-Total, X-Export-Truncated",
      });
      res.status(200).send(buildEntriesCsv(rows));
    } catch (error) {
      if (error instanceof EntryListQueryError) return res.status(400).json({ msg: error.message });
      console.error("exportBookingEntries error:", error);
      res.status(500).json({ msg: "Failed to export the entries." });
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
      // Once a manual row is Paid to the provider its doctor's fee is locked too (the status, the date and the comment are not).
      if (loaded.manual && field === "doctorFee" && loaded.doc.entry?.paidStatus === "paid") {
        return res.status(409).json({ msg: "This row is Paid to the provider, so its doctor's fee is locked. Change the status first.", code: "locked_paid", item: await rowOf(kind, id) });
      }
      const result = applyEntryEdit(loaded.doc.entry, { field, value }, {
        hasDoctor: loaded.hasDoctor, doctorId: loaded.doctorId, today: istDayKey(now()), actor, now: new Date(now()),
        ...(loaded.manual ? { noDoctorMessage: "Add a service provider before marking this Paid." } : {}),
      });
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

  // POST /api/admin/entries/manual   the form: { date, company, caseNumber, serviceType, otherService, caseStatus, serviceProvider,
  //   providerNumber, patientName, country, contactNumber, consultationFee, doctorFee, mrStatus, mrSentToCompany, invoiceSent,
  //   paymentReceived, paymentReceivedDate, paymentToProvider, paidDateToProvider, feedbackSent, feedbackReceived, comment }
  // The date, service provider, patient name and consultation fee are required.
  router.post("/manual", ...guard, async (req, res) => {
    try {
      const today = istDayKey(now());
      const check = validateManualCreate(req.body, { today });
      if (!check.ok) return sendError(res, check);
      const actor = await actorOf(req);
      // The short code is 4 random characters with a unique index; on the rare clash, try another.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const built = buildManualDocument(check.value, { actor, code: newCode(), now: new Date(now()), today });
        if (!built.ok) return sendError(res, built);
        try {
          const created = await ManualEntry.create(built.doc);
          return res.status(201).json({ item: toManualRow(created.toObject()) });
        } catch (error) {
          if (!(error?.code === 11000 && error.keyPattern?.code)) throw error;
        }
      }
      res.status(500).json({ msg: "Could not make an id for the entry. Try again." });
    } catch (error) {
      console.error("createManualEntry error:", error);
      res.status(500).json({ msg: "Failed to add the entry." });
    }
  });

  // PATCH /api/admin/entries/manual/:id/details   { version, ...any keys of the form }
  // Edit (the big popup). Once Payment to provider is Paid the case, provider, patient and fee fields are locked (409); the rest can
  // still change. One versioned write for the whole save, and every change goes in the row's log.
  router.patch("/manual/:id/details", ...guard, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(404).json({ msg: "That entry was not found." });
      const { version, ...fields } = req.body || {};
      if (!Number.isInteger(version) || version < 0) return res.status(400).json({ msg: "version must be a whole number.", code: "bad_version" });

      const doc = await ManualEntry.findOne({ _id: id, deletedAt: null }).lean();
      if (!doc) return res.status(404).json({ msg: "That entry was not found." });

      const actor = await actorOf(req);
      const result = applyManualFormEdit(doc, fields, { actor, today: istDayKey(now()), now: new Date(now()) });
      // A locked row comes back with its current state so the page can show it as locked.
      if (!result.ok) return result.code === "locked_paid" ? res.status(result.status).json({ msg: result.msg, code: result.code, item: toManualRow(doc) }) : sendError(res, result);
      if (result.noop) return res.status(200).json({ item: toManualRow(doc), noop: true });

      const written = await ManualEntry.findOneAndUpdate(
        { _id: id, deletedAt: null, ...versionMatch(version) },
        {
          $set: { ...result.set, "entry.v": version + 1 },
          $push: { log: { $each: result.log }, ...(result.history.length ? { "entry.history": { $each: result.history, $slice: -MAX_HISTORY } } : {}) },
        },
        { new: true },
      ).lean();
      if (!written) {
        // Changed since the page loaded it: hand back the current row.
        const current = await ManualEntry.findOne({ _id: id, deletedAt: null }).lean();
        if (!current) return res.status(404).json({ msg: "That entry was not found." });
        return res.status(409).json({ msg: "Someone else changed this row. It has been refreshed.", code: "stale", item: toManualRow(current) });
      }
      res.status(200).json({ item: toManualRow(written), noop: false });
    } catch (error) {
      console.error("editManualEntry error:", error);
      res.status(500).json({ msg: "Failed to save the change." });
    }
  });

  // DELETE /api/admin/entries/manual/:id   Soft delete of a manual row (never a booking), not while it is Paid.
  router.delete("/manual/:id", ...guard, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(404).json({ msg: "That entry was not found." });
      const actor = await actorOf(req);
      const doc = await ManualEntry.findOne({ _id: id, deletedAt: null }).select("entry.paidStatus deletedAt").lean();
      const check = checkManualDelete(doc, actor);
      if (!check.ok) return sendError(res, check);
      const write = manualDeleteWrite(actor, new Date(now()));
      // The filter repeats the "not Paid" rule so a save that lands at the same moment cannot slip a Paid row past it.
      const done = await ManualEntry.findOneAndUpdate(
        { _id: id, deletedAt: null, "entry.paidStatus": { $ne: "paid" } },
        { $set: write.set, $push: { log: write.log } },
        { new: true, projection: { _id: 1 } },
      ).lean();
      if (!done) return res.status(409).json({ msg: "This row is Paid. Change the status first, then delete it.", code: "delete_paid" });
      res.status(200).json({ ok: true, id });
    } catch (error) {
      console.error("deleteManualEntry error:", error);
      res.status(500).json({ msg: "Failed to delete the entry." });
    }
  });

  return router;
}

const router = create();
router.create = create;
module.exports = router;
