const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const PartnerCase = require("../models/PartnerCase");
const Partner = require("../models/Partner");
const Doctor = require("../models/Doctor");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { createS3PresignedGetUrl, DEFAULT_EXPIRY_SECONDS } = require("../utils/s3PresignedUrl");
const { ALLOWED_TRANSITIONS, cleanText } = require("../utils/partnerCaseHelpers");

// Admin + Super Admin only. These endpoints return the FULL case document
// (including adminNotes and billing) — never reuse the partner serializer here.
router.use(verifyAdminToken, adminOnly);

const actor = (req) => ({ id: req.user.id, name: req.user.name || req.user.email || "Admin", role: req.user.role });

const populateCase = (query) =>
  query.populate("partner", "companyName partnerCode status").populate("assignedDoctor", "name email");

// GET /api/admin/partner-cases — list ALL partner cases with filters + pagination
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (PartnerCase.CASE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (["routine", "urgent", "emergency"].includes(req.query.urgency)) filter.urgency = req.query.urgency;
    if (req.query.partner && mongoose.Types.ObjectId.isValid(req.query.partner)) {
      filter.partner = req.query.partner;
    }
    const q = cleanText(req.query.q, 80);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ caseNumber: rx }, { "patient.name": rx }];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const [items, total] = await Promise.all([
      populateCase(PartnerCase.find(filter))
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PartnerCase.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("admin list partner cases error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/admin/partner-cases/stats — status breakdown
router.get("/stats", async (req, res) => {
  try {
    const rows = await PartnerCase.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const stats = Object.fromEntries(PartnerCase.CASE_STATUSES.map((s) => [s, 0]));
    rows.forEach((r) => {
      if (r._id in stats) stats[r._id] = r.count;
    });
    res.json(stats);
  } catch (err) {
    console.error("admin partner case stats error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

async function loadCase(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: "Case not found." });
    }
    const doc = await populateCase(PartnerCase.findById(req.params.id));
    if (!doc) return res.status(404).json({ msg: "Case not found." });
    req.partnerCase = doc;
    next();
  } catch (err) {
    console.error("admin loadCase error:", err);
    res.status(500).json({ msg: "Server error." });
  }
}

// GET /api/admin/partner-cases/:id
router.get("/:id", loadCase, (req, res) => {
  res.json(req.partnerCase);
});

// PATCH /api/admin/partner-cases/:id/status — advance through the flow
router.patch("/:id/status", loadCase, async (req, res) => {
  try {
    const doc = req.partnerCase;
    const next = req.body.status;
    if (!PartnerCase.CASE_STATUSES.includes(next)) {
      return res.status(400).json({ msg: "Invalid status." });
    }
    const legal = ALLOWED_TRANSITIONS[doc.status] || [];
    if (!legal.includes(next)) {
      return res.status(409).json({ msg: `Cannot move a "${doc.status}" case to "${next}".` });
    }

    doc.status = next;
    doc.statusHistory.push({ status: next, at: new Date(), byId: req.user.id, byName: actor(req).name, byRole: req.user.role });
    doc.messages.push({
      body: `Status updated to "${next}".`,
      authorRole: "system",
      createdAt: new Date(),
    });
    await doc.save();
    res.json(await populateCase(PartnerCase.findById(doc._id)));
  } catch (err) {
    console.error("admin update partner case status error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// PATCH /api/admin/partner-cases/:id/assign — assign a doctor
router.patch("/:id/assign", loadCase, async (req, res) => {
  try {
    const doc = req.partnerCase;
    const { doctorId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ msg: "A valid doctor is required." });
    }
    const doctor = await Doctor.findById(doctorId).select("name").lean();
    if (!doctor) return res.status(404).json({ msg: "Doctor not found." });

    if (!["submitted", "assigned", "in-progress"].includes(doc.status)) {
      return res.status(409).json({ msg: `Cannot assign a doctor to a "${doc.status}" case.` });
    }

    doc.assignedDoctor = doctor._id;
    doc.assignedBy = { id: req.user.id, name: actor(req).name, at: new Date() };
    // A video consultation link only applies to teleconsultation cases; ignore
    // it for house-call / in-clinic so it is never sent to the partner.
    const videoLink = cleanText(req.body.videoLink, 1000);
    if (videoLink && doc.serviceType === "teleconsultation") doc.videoLink = videoLink;
    if (doc.status === "submitted") {
      doc.status = "assigned";
      doc.statusHistory.push({ status: "assigned", at: new Date(), byId: req.user.id, byName: actor(req).name, byRole: req.user.role });
    }
    doc.messages.push({
      body: `Doctor ${doctor.name} assigned to this case.`,
      authorRole: "system",
      createdAt: new Date(),
    });
    await doc.save();
    res.json(await populateCase(PartnerCase.findById(doc._id)));
  } catch (err) {
    console.error("admin assign partner case error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// PATCH /api/admin/partner-cases/:id/billing — set amount / currency
router.patch("/:id/billing", loadCase, async (req, res) => {
  try {
    const doc = req.partnerCase;
    const amountCents = Number(req.body.amountCents);
    if (!Number.isFinite(amountCents) || amountCents < 0 || amountCents > 100000000) {
      return res.status(400).json({ msg: "Enter a valid amount." });
    }
    doc.amountCents = Math.round(amountCents);
    const currency = cleanText(req.body.currency, 8).toLowerCase();
    if (currency) doc.currency = currency;
    await doc.save();
    res.json(await populateCase(PartnerCase.findById(doc._id)));
  } catch (err) {
    console.error("admin partner case billing error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// PATCH /api/admin/partner-cases/:id/notes — internal notes (never shown to partner)
router.patch("/:id/notes", loadCase, async (req, res) => {
  try {
    req.partnerCase.adminNotes = cleanText(req.body.adminNotes, 8000);
    await req.partnerCase.save();
    res.json({ msg: "Notes saved.", adminNotes: req.partnerCase.adminNotes });
  } catch (err) {
    console.error("admin partner case notes error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// POST /api/admin/partner-cases/:id/messages — admin reply in the case thread
router.post("/:id/messages", loadCase, async (req, res) => {
  try {
    const body = cleanText(req.body.body, 4000);
    if (!body) return res.status(400).json({ msg: "Message text is required." });
    req.partnerCase.messages.push({
      body,
      authorId: req.user.id,
      authorName: actor(req).name,
      authorRole: "admin",
      createdAt: new Date(),
    });
    await req.partnerCase.save();
    res.status(201).json(await populateCase(PartnerCase.findById(req.partnerCase._id)));
  } catch (err) {
    console.error("admin partner case message error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/admin/partner-cases/:id/attachments/access-url?key=...
router.get("/:id/attachments/access-url", loadCase, async (req, res) => {
  try {
    const key = cleanText(req.query.key, 500);
    if (!key) return res.status(400).json({ msg: "Attachment key is required." });
    const known = new Set((req.partnerCase.attachments || []).map((a) => a.key).filter(Boolean));
    if (!known.has(key)) return res.status(404).json({ msg: "Attachment not found on this case." });
    const signed = await createS3PresignedGetUrl(key, { expiresIn: DEFAULT_EXPIRY_SECONDS });
    res.json({ url: signed.url, expiresAt: signed.expiresAt });
  } catch (err) {
    console.error("admin partner case attachment access-url error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

module.exports = router;
