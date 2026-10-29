const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const CountryChangeLog = require("../models/CountryChangeLog");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

router.use(verifyAdminToken, adminOnly);

const MAX_LIMIT = 100;

// GET /api/admin/country-changes?needsReview=true&user=<id>&page=1&limit=25
// Profile country changes, newest first. `needsReview=true` shows only the
// ones flagged because the user already had a paid booking and have not been
// reviewed yet.
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (String(req.query.needsReview || "") === "true") filter.needsReview = true;
    if (req.query.user !== undefined) {
      if (!mongoose.isValidObjectId(req.query.user)) return res.status(400).json({ msg: "Invalid user ID." });
      filter.user = req.query.user;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const [rows, total] = await Promise.all([
      CountryChangeLog.find(filter)
        .sort({ changedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email patientId country")
        .populate("reviewedBy", "name email")
        .lean(),
      CountryChangeLog.countDocuments(filter),
    ]);

    res.json({ rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET /api/admin/country-changes error:", err.message);
    res.status(500).json({ msg: "Failed to load country changes." });
  }
});

// GET /api/admin/country-changes/summary -> { needsReviewCount }
router.get("/summary", async (_req, res) => {
  try {
    res.json({ needsReviewCount: await CountryChangeLog.countDocuments({ needsReview: true }) });
  } catch (err) {
    console.error("GET /api/admin/country-changes/summary error:", err.message);
    res.status(500).json({ msg: "Failed to load country changes." });
  }
});

// PATCH /api/admin/country-changes/:id/review - mark one change as reviewed.
// Idempotent: reviewing an already reviewed change returns it unchanged.
router.patch("/:id/review", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid ID." });
  try {
    const row = await CountryChangeLog.findOneAndUpdate(
      { _id: req.params.id, needsReview: true },
      { $set: { needsReview: false, reviewedAt: new Date(), reviewedBy: req.user.id } },
      { new: true },
    ).lean();
    if (row) return res.json({ msg: "Marked as reviewed.", row });

    const existing = await CountryChangeLog.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ msg: "Country change not found." });
    res.json({ msg: "Already reviewed.", row: existing });
  } catch (err) {
    console.error("PATCH /api/admin/country-changes/:id/review error:", err.message);
    res.status(500).json({ msg: "Failed to update." });
  }
});

module.exports = router;
