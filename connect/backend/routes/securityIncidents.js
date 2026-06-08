const express = require("express");
const router = express.Router();
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { listIncidents, addIncidentAction } = require("../controllers/securityIncidentController");

router.get("/", verifyAdminToken, superAdminOnly, listIncidents);
router.post("/:id/actions", verifyAdminToken, superAdminOnly, addIncidentAction);

module.exports = router;
