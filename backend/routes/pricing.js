const express = require("express");
const router = express.Router();
const { CategoryPricing, CATEGORY_IDS } = require("../models/CategoryPricing");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { recordActivity } = require("../utils/activityLogger");

// GET /api/pricing - public, returns all category prices keyed by categoryId:
//   { general: { price, label, currency }, mental: {...}, ... }
router.get("/", async (req, res) => {
  try {
    const records = await CategoryPricing.find({}, "categoryId label price currency").lean();
    const map = {};
    records.forEach((r) => {
      map[r.categoryId] = { price: r.price, label: r.label, currency: r.currency };
    });
    res.json(map);
  } catch (err) {
    console.error("GET /api/pricing error:", err);
    res.status(500).json({ msg: "Failed to fetch pricing." });
  }
});

// GET /api/pricing/all - superadmin only, full records with metadata
router.get("/all", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const records = await CategoryPricing.find()
      .populate("updatedBy", "name email")
      .sort({ categoryId: 1 })
      .lean();
    res.json(records);
  } catch (err) {
    console.error("GET /api/pricing/all error:", err);
    res.status(500).json({ msg: "Failed to fetch pricing." });
  }
});

// PUT /api/pricing/:categoryId - superadmin only, update a category price
router.put("/:categoryId", verifyAdminToken, superAdminOnly, async (req, res) => {
  const { categoryId } = req.params;
  if (!CATEGORY_IDS.includes(categoryId)) {
    return res.status(400).json({ msg: "Invalid category ID." });
  }

  const price = Number(req.body.price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ msg: "Price must be a non-negative number." });
  }

  try {
    const updated = await CategoryPricing.findOneAndUpdate(
      { categoryId },
      { price, updatedBy: req.user.id },
      { new: true, runValidators: true },
    ).populate("updatedBy", "name email");

    if (!updated) {
      return res.status(404).json({ msg: "Category not found." });
    }

    await recordActivity(req, {
      action: "PRICING_UPDATE",
      resource: "CategoryPricing",
      resourceId: categoryId,
      success: true,
      details: { categoryId, newPrice: price },
    });

    res.json({ msg: "Price updated successfully.", record: updated });
  } catch (err) {
    console.error("PUT /api/pricing/:categoryId error:", err);
    res.status(500).json({ msg: "Failed to update price." });
  }
});

module.exports = router;
