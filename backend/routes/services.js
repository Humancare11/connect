const express = require("express");
const router = express.Router();
const ServicePrice = require("../models/ServicePrice");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Builds a validated service payload.
 * - `existingSlug` (optional): the slug already stored in the DB for this
 *   service, used as a fallback so edits to `name` don't silently change
 *   the slug (and break any frontend page pointing at the old one).
 * - `body.slug` (optional): lets an admin explicitly set/override a slug.
 *   It is always passed through slugify(), so it can never contain
 *   anything other than lowercase letters, digits, and hyphens.
 */
function servicePayload(body, existingSlug) {
  const name = String(body.name || "").trim();
  const icon = String(body.icon || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);

  if (!name) return { error: "Service name is required." };
  if (!icon) return { error: "Service icon is required." };
  if (!description) return { error: "Service description is required." };
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Price must be a non-negative number." };
  }

  // Priority: explicit slug from the request body > existing stored slug
  // (on edit) > derived from name (on create, or if nothing else is set).
  const rawSlug = String(body.slug || existingSlug || name).trim();
  const slug = slugify(rawSlug);

  if (!slug) return { error: "Could not generate a valid slug from the service name." };

  return { value: { name, price, icon, description, slug } };
}

router.get("/", async (_req, res) => {
  try {
    const services = await ServicePrice.find().sort({ name: 1 }).lean();
    res.json(services);
  } catch (err) {
    console.error("GET /api/services error:", err);
    res.status(500).json({ msg: "Failed to fetch services." });
  }
});

router.get("/by-slug/:slug", async (req, res) => {
  try {
    const service = await ServicePrice.findOne({ slug: req.params.slug }).lean();
    if (!service) return res.status(404).json({ msg: "Service not found." });
    res.json(service);
  } catch (err) {
    console.error("GET /api/services/by-slug/:slug error:", err);
    res.status(500).json({ msg: "Failed to fetch service." });
  }
});

router.post("/", verifyAdminToken, superAdminOnly, async (req, res) => {
  const payload = servicePayload(req.body);
  if (payload.error) return res.status(400).json({ msg: payload.error });

  try {
    const service = await ServicePrice.create(payload.value);
    res.status(201).json({ msg: "Service created.", service });
  } catch (err) {
    console.error("POST /api/services error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ msg: "A service with this name or slug already exists." });
    }
    res.status(500).json({ msg: "Failed to create service." });
  }
});

router.put("/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const existing = await ServicePrice.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ msg: "Service not found." });

    const payload = servicePayload(req.body, existing.slug);
    if (payload.error) return res.status(400).json({ msg: payload.error });

    const service = await ServicePrice.findByIdAndUpdate(
      req.params.id,
      payload.value,
      { new: true, runValidators: true },
    );
    res.json({ msg: "Service updated.", service });
  } catch (err) {
    console.error("PUT /api/services/:id error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ msg: "A service with this name or slug already exists." });
    }
    res.status(500).json({ msg: "Failed to update service." });
  }
});

router.delete("/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const service = await ServicePrice.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ msg: "Service not found." });
    res.json({ msg: "Service deleted." });
  } catch (err) {
    console.error("DELETE /api/services/:id error:", err);
    res.status(500).json({ msg: "Failed to delete service." });
  }
});

module.exports = router;