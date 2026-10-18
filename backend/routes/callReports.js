const express = require("express");
const router = express.Router();
const { verifyToken, adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const { getCallReport, deleteCallReport } = require("../controllers/callReportController");

// Admin-only, the same role guard as the direct-call report (adminOnly), with
// one difference: verifyToken (any valid session) instead of verifyAdminToken.
// verifyAdminToken only ever accepts an admin-role token, so a valid doctor /
// patient / unrelated-user token would be answered "401 invalid session" - the
// requirement here is a clear 403 "Admins only" for them (no token or a bad
// token is still 401).
//
// DELETE chains adminOnly BEFORE superAdminOnly on purpose: a doctor / patient /
// stranger is refused by adminOnly (a "high" security event, which does NOT
// revoke their sessions). Only a real admin who is not a superadmin reaches
// superAdminOnly, whose critical privilege_escalation event is the platform's
// existing behaviour (it revokes that admin's sessions).
router.get("/:appointmentId", verifyToken, adminOnly, getCallReport);
router.delete("/:appointmentId", verifyToken, adminOnly, superAdminOnly, deleteCallReport);

module.exports = router;
