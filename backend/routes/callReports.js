const express = require("express");
const router = express.Router();
const { verifyToken, adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const { getCallReport, deleteCallReport } = require("../controllers/callReportController");

// Admin-only. verifyToken (any valid session) + adminOnly, rather than
// verifyAdminToken: a valid doctor / patient / unrelated-user token is then
// answered with 403 "Admins only" (and logged as a security event) instead of
// a generic 401, while no token or an invalid one is still 401.
router.get("/:appointmentId", verifyToken, adminOnly, getCallReport);
router.delete("/:appointmentId", verifyToken, superAdminOnly, deleteCallReport);

module.exports = router;
