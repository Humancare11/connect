const express = require("express");
const router = express.Router();
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { getPolicies, updatePolicies, runCleanup } = require("../controllers/retentionController");

router.get("/", verifyAdminToken, superAdminOnly, getPolicies);
router.put("/", verifyAdminToken, superAdminOnly, updatePolicies);
router.post("/cleanup", verifyAdminToken, superAdminOnly, runCleanup);

module.exports = router;
