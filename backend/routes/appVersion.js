// routes/appVersion.js — GET /api/app/version
//
// Public (the app calls it before anyone is logged in). Tells the mobile app
// the minimum build it may run, the latest build, and the store link. See
// utils/appVersion.js for the env vars behind it.
const express = require("express");
const { getAppVersionConfig } = require("../utils/appVersion");
const { appVersionLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.get("/version", appVersionLimiter, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(getAppVersionConfig());
});

module.exports = router;
