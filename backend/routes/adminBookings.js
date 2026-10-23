const express = require("express");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { ListQueryError, listAdminBookings } = require("../utils/adminBookingList");

// The unified admin Appointments list (appointments + category consultations).
// `guard` is overridable so tests can stand in for the token check.
function create({ guard = [verifyAdminToken, adminOnly] } = {}) {
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

  return router;
}

module.exports = create();
module.exports.create = create;
