const express = require("express");
const router = express.Router();
const ServicePrice = require("../models/ServicePrice");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");

function servicePayload(body) {
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

  return { value: { name, price, icon, description } };
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

router.post("/", verifyAdminToken, superAdminOnly, async (req, res) => {
  const payload = servicePayload(req.body);
  if (payload.error) return res.status(400).json({ msg: payload.error });

  try {
    const service = await ServicePrice.create(payload.value);
    res.status(201).json({ msg: "Service created.", service });
  } catch (err) {
    console.error("POST /api/services error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ msg: "A service with this name already exists." });
    }
    res.status(500).json({ msg: "Failed to create service." });
  }
});

router.put("/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  const payload = servicePayload(req.body);
  if (payload.error) return res.status(400).json({ msg: payload.error });

  try {
    const service = await ServicePrice.findByIdAndUpdate(
      req.params.id,
      payload.value,
      { new: true, runValidators: true },
    );
    if (!service) return res.status(404).json({ msg: "Service not found." });
    res.json({ msg: "Service updated.", service });
  } catch (err) {
    console.error("PUT /api/services/:id error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ msg: "A service with this name already exists." });
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
