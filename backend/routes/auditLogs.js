const express = require("express");
const router  = express.Router();
const { getAuditLogs, getAuditStats } = require("../controllers/auditController");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");

// Both endpoints are super-admin only — no other role may view audit logs
router.get("/",      verifyAdminToken, superAdminOnly, getAuditLogs);
router.get("/stats", verifyAdminToken, superAdminOnly, getAuditStats);

module.exports = router;
