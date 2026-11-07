const express = require("express");
const router = express.Router();
const ServicePrice = require("../models/ServicePrice");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { parsePrice, isMultiCurrencyEnabled, isInrEnabled, maxPriceFor, minPriceFor } = require("../utils/currencyConfig");

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// The prices of a service. `price` is USD. Same rules as the category prices (PUT /api/pricing/:id):
//   - USD is always required and can be changed but never emptied or set to 0.
//   - On create all four are required.
//   - On edit a EUR / GBP / INR price that is already set can be changed but never cleared (null, "" and 0 are rejected); one that
//     was never set may be left out or sent blank ("still not set").
//   - Each is more than 0, at most 2 decimals, at least the minimum (0.01, or 1 rupee) and at most the cap (100,000, INR 10,00,000).
// Nothing is converted between currencies. Returns { set } or { error }.
const PRICE_FIELDS = [
  { key: "price", label: "USD price", currency: "USD", always: true },
  { key: "priceEur", label: "EUR price", currency: "EUR" },
  { key: "priceGbp", label: "GBP price", currency: "GBP" },
  { key: "priceInr", label: "INR price", currency: "INR" },
];

function servicePrices(body, existing) {
  const set = {};
  for (const { key, label, currency, always } of PRICE_FIELDS) {
    const raw = body[key];
    const isBlank = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (isBlank) {
      if (!existing) return { error: `${label} is required.` };
      if (raw === undefined && !always) continue; // not sent: left as it is
      const alreadySet = always || (existing[key] !== undefined && existing[key] !== null);
      if (alreadySet) return { error: `${label} cannot be cleared once it is set.` };
      continue; // never set and still not set
    }
    const parsed = parsePrice(raw, maxPriceFor(currency), minPriceFor(currency));
    if (parsed.error) return { error: `${label} ${parsed.error}` };
    set[key] = parsed.value;
  }
  return { set };
}

// What the public endpoints return: exactly the old shape while multi-currency is off; EUR and GBP (null = not set) once it is on;
// INR only while it is active (flag on AND the Razorpay keys set).
function publicService(service) {
  if (!service) return service;
  const { priceEur, priceGbp, priceInr, ...rest } = service;
  if (isMultiCurrencyEnabled()) {
    rest.priceEur = priceEur ?? null;
    rest.priceGbp = priceGbp ?? null;
    if (isInrEnabled()) rest.priceInr = priceInr ?? null;
  }
  return rest;
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
function servicePayload(body, existing) {
  const existingSlug = existing?.slug;
  const name = String(body.name || "").trim();
  const icon = String(body.icon || "").trim();
  const description = String(body.description || "").trim();

  if (!name) return { error: "Service name is required." };
  if (!icon) return { error: "Service icon is required." };
  if (!description) return { error: "Service description is required." };
  const prices = servicePrices(body, existing);
  if (prices.error) return { error: prices.error };

  // Priority: explicit slug from the request body > existing stored slug
  // (on edit) > derived from name (on create, or if nothing else is set).
  const rawSlug = String(body.slug || existingSlug || name).trim();
  const slug = slugify(rawSlug);

  if (!slug) return { error: "Could not generate a valid slug from the service name." };

  return { value: { name, icon, description, slug, ...prices.set } };
}

router.get("/", async (_req, res) => {
  try {
    const services = await ServicePrice.find().sort({ name: 1 }).lean();
    res.json(services.map(publicService));
  } catch (err) {
    console.error("GET /api/services error:", err);
    res.status(500).json({ msg: "Failed to fetch services." });
  }
});

// Super admin list: always carries all four prices (null = not set yet), whatever the multi-currency switch says, so the prices can
// be filled in before the switch is turned on.
router.get("/admin", verifyAdminToken, superAdminOnly, async (_req, res) => {
  try {
    const services = await ServicePrice.find().sort({ name: 1 }).lean();
    res.json(
      services.map((service) => ({
        ...service,
        priceEur: service.priceEur ?? null,
        priceGbp: service.priceGbp ?? null,
        priceInr: service.priceInr ?? null,
      })),
    );
  } catch (err) {
    console.error("GET /api/services/admin error:", err);
    res.status(500).json({ msg: "Failed to fetch services." });
  }
});

router.get("/by-slug/:slug", async (req, res) => {
  try {
    const service = await ServicePrice.findOne({ slug: req.params.slug }).lean();
    if (!service) return res.status(404).json({ msg: "Service not found." });
    res.json(publicService(service));
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

    const payload = servicePayload(req.body, existing);
    if (payload.error) return res.status(400).json({ msg: payload.error });

    const service = await ServicePrice.findByIdAndUpdate(
      req.params.id,
      { $set: payload.value },
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