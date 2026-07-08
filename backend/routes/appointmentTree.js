const express = require("express");
const router = express.Router();
const { getAppointmentTree } = require("../controllers/healthcareManagementController");

router.get("/", getAppointmentTree);

module.exports = router;
