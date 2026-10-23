const express = require("express");
const mongoose = require("mongoose");
const { verifyAdminToken, adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const User = require("../models/User");
const { LifecycleError } = require("../utils/appointmentLifecycle");
const { ListQueryError, listAdminBookings, loadAdminBookingRow, loadAdminBookingRowById } = require("../utils/adminBookingList");
const actions = require("../utils/adminBookingActions");
const { recordActivity } = require("../utils/activityLogger");

// The acting admin, for assignedBy and the audit log.
async function actorOf(req) {
  const admin = mongoose.isValidObjectId(req.user?.id)
    ? await User.findById(req.user.id).select("name email").lean()
    : null;
  return {
    id: req.user?.id || null,
    name: admin?.name || req.user?.name || req.user?.email || "Admin",
    email: admin?.email || req.user?.email || "",
  };
}

// The unified admin Appointments list and its actions (appointments + category
// consultations). `guard` (admins) and `superGuard` (super admins only: delete) are overridable so tests can
// stand in for the token check.
function create({ guard = [verifyAdminToken, adminOnly], superGuard = [verifyAdminToken, superAdminOnly] } = {}) {
  const router = express.Router();

  // GET /api/admin/bookings?status=&hideTesting=&q=&page=&limit=&sort=
  router.get("/", ...guard, async (req, res) => {
    try {
      res.status(200).json(await listAdminBookings(req.query));
    } catch (error) {
      if (error instanceof ListQueryError) return res.status(400).json({ msg: error.message });
      console.error("listAdminBookings error:", error);
      res.status(500).json({ msg: "Failed to fetch appointments." });
    }
  });

  // One booking as a list row (either kind), for the booking's View page.
  router.get("/:id", ...guard, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid booking id." });
      const booking = await loadAdminBookingRowById(req.params.id);
      if (!booking) return res.status(404).json({ msg: "Appointment not found." });
      res.status(200).json({ booking });
    } catch (error) {
      console.error("getAdminBooking error:", error);
      res.status(500).json({ msg: "Failed to fetch the appointment." });
    }
  });

  // Runs one action and answers with the booking's new list row. `paid` lets the
  // UI warn that a paid booking needs a manual refund.
  const action = (name, message, run) => [
    ...guard,
    async (req, res) => {
      try {
        const actor = await actorOf(req);
        const result = await run(req, actor);
        await recordActivity(req, {
          action: name,
          resource: result.kind === "category" ? "CategoryConsultation" : "Appointment",
          resourceId: result.id,
          details: {
            ...(req.body?.doctorId ? { doctorId: req.body.doctorId } : {}),
            ...(req.body?.reason ? { reason: req.body.reason } : {}),
          },
        });
        res.status(200).json({ msg: message, booking: await loadAdminBookingRow(result.kind, result.id), paid: result.paid });
      } catch (error) {
        if (error instanceof LifecycleError) return res.status(error.statusCode).json({ msg: error.message, ...(error.code ? { code: error.code } : {}) });
        console.error(`${name} error:`, error);
        res.status(500).json({ msg: "Something went wrong. Please try again." });
      }
    },
  ];

  // body: { doctorId: <Enrollment _id>, appointmentTime?: "05:30 PM" }
  router.post("/:id/assign-doctor", ...action("ADMIN_ASSIGN_DOCTOR", "Doctor assigned.",
    (req, actor) => actions.assignDoctor(req.app, req.params.id, req.body, actor)));

  // body: { doctorId: <Enrollment _id> }
  router.post("/:id/alternate-doctor", ...action("ADMIN_ALTERNATE_DOCTOR", "Doctor changed.",
    (req, actor) => actions.alternateDoctor(req.app, req.params.id, req.body, actor)));

  router.post("/:id/revert-doctor", ...action("ADMIN_REVERT_DOCTOR", "Original doctor restored.",
    (req, actor) => actions.revertDoctor(req.app, req.params.id, actor)));

  router.post("/:id/confirm", ...action("ADMIN_CONFIRM_BOOKING", "Booking confirmed.",
    (req, actor) => actions.confirmBooking(req.app, req.params.id, actor)));

  // Assigned or Confirmed -> Complete.
  router.post("/:id/auto-complete", ...action("ADMIN_AUTO_COMPLETE_BOOKING", "Booking marked complete.",
    (req) => actions.autoCompleteBooking(req.app, req.params.id)));

  // body: { action: "auto-complete" | "cancel" | "mark-testing" | "unmark-testing", ids: [up to 100], reason? }
  // Answers per id (ok / not_found / conflict / error). There is no bulk confirm.
  router.post("/bulk", ...guard, async (req, res) => {
    try {
      const actor = await actorOf(req);
      const outcome = await actions.bulkAction(req.app, req.body, actor);
      await recordActivity(req, {
        action: `ADMIN_BULK_${String(req.body.action).replace(/-/g, "_").toUpperCase()}`,
        resource: "Booking",
        details: {
          ...outcome.summary,
          ...(req.body.reason ? { reason: req.body.reason } : {}),
          ids: outcome.results.filter((r) => r.status === "ok").map((r) => r.id),
        },
      });
      res.status(200).json({ msg: `${outcome.summary.ok} of ${outcome.results.length} bookings updated.`, ...outcome });
    } catch (error) {
      if (error instanceof LifecycleError) return res.status(error.statusCode).json({ msg: error.message, ...(error.code ? { code: error.code } : {}) });
      console.error("ADMIN_BULK error:", error);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  });

  // body: { reason: one of the five cancel reasons }. No refund: `paid` says whether one is due.
  router.post("/:id/cancel", ...action("ADMIN_CANCEL_BOOKING", "Booking cancelled.",
    (req, actor) => actions.cancelBooking(req.app, req.params.id, req.body, actor)));

  // body: { ids: [up to 100], value: true | false }. Answers per id.
  router.patch("/testing", ...guard, async (req, res) => {
    try {
      const actor = await actorOf(req);
      const { results, updated } = await actions.setTesting(req.body?.ids, req.body?.value, actor);
      await recordActivity(req, {
        action: req.body.value ? "ADMIN_MARK_TESTING" : "ADMIN_UNMARK_TESTING",
        resource: "Booking",
        details: { count: updated, requested: results.length },
      });
      res.status(200).json({ msg: `${updated} booking${updated === 1 ? "" : "s"} updated.`, updated, results });
    } catch (error) {
      if (error instanceof LifecycleError) return res.status(error.statusCode).json({ msg: error.message, ...(error.code ? { code: error.code } : {}) });
      console.error("ADMIN_SET_TESTING error:", error);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  });

  // Super admin only. A category consultation is deleted for good; a regular appointment is refused (cancel it).
  router.delete("/:id", ...superGuard, async (req, res) => {
    try {
      const result = await actions.deleteBooking(req.app, req.params.id);
      await recordActivity(req, { action: "ADMIN_DELETE_BOOKING", resource: "CategoryConsultation", resourceId: result.id, details: { paid: result.paid } });
      res.status(200).json({ msg: "Booking deleted.", id: result.id, paid: result.paid });
    } catch (error) {
      if (error instanceof LifecycleError) return res.status(error.statusCode).json({ msg: error.message, ...(error.code ? { code: error.code } : {}) });
      console.error("ADMIN_DELETE_BOOKING error:", error);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  });

  return router;
}

module.exports = create();
module.exports.create = create;
