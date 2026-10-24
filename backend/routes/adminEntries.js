const express = require("express");
const { verifyAdminToken, entriesViewAccess } = require("../middleware/verifyToken");
const { EntryListQueryError, listBookingEntries } = require("../utils/bookingEntryList");

// Appointment entries: the doctor fee / payout record kept on each booking. `guard` is overridable so tests can stand in for
// the token check. Everyone who passes it can look (admin, super admin, payment admin); who may type is decided per edit.
function create({ guard = [verifyAdminToken, entriesViewAccess] } = {}) {
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

  return router;
}

const router = create();
router.create = create;
module.exports = router;
