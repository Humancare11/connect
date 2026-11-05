const express = require("express");
const router = express.Router();
const { CategoryPricing } = require("../models/CategoryPricing");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { recordActivity } = require("../utils/activityLogger");
const { parsePrice, isMultiCurrencyEnabled, isInrEnabled, maxPriceFor, minPriceFor } = require("../utils/currencyConfig");

// GET /api/pricing - public, returns all category prices keyed by categoryId:
//   { general: { price, label, currency }, mental: {...}, ... }
// `price` is always the USD price. While MULTI_CURRENCY_ENABLED is off the
// response is exactly the shape it has always had; once on, `priceEur` and
// `priceGbp` are added (null = not set yet, so the site falls back to USD).
// `priceInr` is added only while INR is active (flag on AND Razorpay keys set).
router.get("/", async (req, res) => {
  try {
    const multi = isMultiCurrencyEnabled();
    const inr = isInrEnabled();
    const records = await CategoryPricing.find(
      {},
      `categoryId label price currency${multi ? " priceEur priceGbp" : ""}${inr ? " priceInr" : ""}`,
    ).lean();
    const map = {};
    records.forEach((r) => {
      map[r.categoryId] = { price: r.price, label: r.label, currency: r.currency };
      if (multi) {
        map[r.categoryId].priceEur = r.priceEur ?? null;
        map[r.categoryId].priceGbp = r.priceGbp ?? null;
      }
      if (inr) map[r.categoryId].priceInr = r.priceInr ?? null;
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

// PUT /api/pricing/:categoryId - superadmin only, update a category's prices.
// categoryId is either one of the 11 legacy buckets or a dynamically
// generated HealthcareCategory.pricingSlug (see backend/utils/categoryPricing.js)
// - no longer a fixed list, so the shape is validated here and existence is
// enforced by the lookup below returning null for an unknown id.
//
// Body: any of { price (USD), priceEur, priceGbp, priceInr }, at least one. Every
// price sent must be a number > 0, at most 100,000 (INR: 10,00,000), at most 2 decimals.
//   - USD always exists, so it can be changed but never emptied.
//   - EUR / GBP / INR that are NOT set yet may be left out (or sent as null / "" =
//     "still not set"): older categories only have a USD price and are filled
//     in over time.
//   - EUR / GBP / INR that ARE set can be changed but never cleared: null, "" and 0
//     are rejected, so a price once entered stays.
// Nothing is converted between currencies.
const PRICE_FIELDS = [
  { key: "price", label: "USD price", always: true },
  { key: "priceEur", label: "EUR price" },
  { key: "priceGbp", label: "GBP price" },
  { key: "priceInr", label: "INR price", max: maxPriceFor("INR"), min: minPriceFor("INR") },
];

router.put("/:categoryId", verifyAdminToken, superAdminOnly, async (req, res) => {
  const { categoryId } = req.params;
  if (!/^[a-z0-9-]{1,80}$/.test(categoryId)) {
    return res.status(400).json({ msg: "Invalid category ID." });
  }

  const body = req.body || {};

  try {
    const current = await CategoryPricing.findOne({ categoryId }).lean();
    if (!current) {
      return res.status(404).json({ msg: "Category not found." });
    }

    const set = {};
    for (const { key, label, always, max, min } of PRICE_FIELDS) {
      const raw = body[key];
      if (raw === undefined) continue;

      const isBlank = raw === null || (typeof raw === "string" && raw.trim() === "");
      if (isBlank) {
        const alreadySet = always || (current[key] !== undefined && current[key] !== null);
        if (alreadySet) {
          return res.status(400).json({ msg: `${label} cannot be cleared once it is set.` });
        }
        continue; // not set yet and still not set: nothing to do
      }

      const parsed = parsePrice(raw, max, min);
      if (parsed.error) {
        return res.status(400).json({ msg: `${label} ${parsed.error}` });
      }
      set[key] = parsed.value;
    }

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ msg: "Provide at least one price (USD, EUR, GBP or INR) to update." });
    }

    const updated = await CategoryPricing.findOneAndUpdate(
      { categoryId },
      { $set: { ...set, updatedBy: req.user.id } },
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
      details: {
        categoryId,
        changes: Object.fromEntries(
          Object.entries(set).map(([key, value]) => [key, { from: current[key] ?? null, to: value }]),
        ),
      },
    });

    res.json({ msg: "Price updated successfully.", record: updated });
  } catch (err) {
    console.error("PUT /api/pricing/:categoryId error:", err);
    res.status(500).json({ msg: "Failed to update price." });
  }
});

module.exports = router;
