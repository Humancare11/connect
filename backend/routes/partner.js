const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const PartnerCase = require("../models/PartnerCase");
const {
  verifyPartnerToken,
  partnerOnly,
  attachPartnerCompany,
} = require("../middleware/verifyToken");
const { createS3PresignedGetUrl, DEFAULT_EXPIRY_SECONDS } = require("../utils/s3PresignedUrl");
const {
  sanitizeCaseInput,
  serializeCaseForPartner,
  cleanText,
} = require("../utils/partnerCaseHelpers");
const { generatePartnerCaseNumber } = require("../utils/idSequence");

// Every route in this router is authenticated as a Partner account AND scoped
// to that account's active Partner Company (req.partnerId).
router.use(verifyPartnerToken, partnerOnly, attachPartnerCompany);

const ACTIVE_STATUSES = ["submitted", "assigned", "in-progress"];
const DONE_STATUSES = ["completed", "invoiced"];

// GET /api/partner/dashboard — KPI summary for this company only
router.get("/dashboard", async (req, res) => {
  try {
    const partner = new mongoose.Types.ObjectId(req.partnerId);
    const rows = await PartnerCase.aggregate([
      { $match: { partner } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ["$status", ACTIVE_STATUSES] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $in: ["$status", DONE_STATUSES] }, 1, 0] } },
          billedCents: {
            $sum: { $cond: [{ $isNumber: "$amountCents" }, "$amountCents", 0] },
          },
        },
      },
    ]);
    const s = rows[0] || { total: 0, active: 0, completed: 0, billedCents: 0 };
    res.json({
      total: s.total,
      active: s.active,
      completed: s.completed,
      billedCents: s.billedCents,
    });
  } catch (err) {
    console.error("partner dashboard error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/partner/cases — this company's cases (list view)
router.get("/cases", async (req, res) => {
  try {
    const filter = { partner: req.partnerId };
    if (PartnerCase.CASE_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const q = cleanText(req.query.q, 80);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ caseNumber: rx }, { "patient.name": rx }];
    }

    const cases = await PartnerCase.find(filter)
      .populate("assignedDoctor", "name")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.json(cases.map(serializeCaseForPartner));
  } catch (err) {
    console.error("partner list cases error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// Loads a case and enforces company ownership. 404 (not 403) on mismatch so a
// partner can't enumerate other companies' case ids.
async function loadOwnedCase(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: "Case not found." });
    }
    const doc = await PartnerCase.findOne({ _id: req.params.id, partner: req.partnerId }).populate(
      "assignedDoctor",
      "name"
    );
    if (!doc) return res.status(404).json({ msg: "Case not found." });
    req.partnerCase = doc;
    next();
  } catch (err) {
    console.error("loadOwnedCase error:", err);
    res.status(500).json({ msg: "Server error." });
  }
}

// POST /api/partner/cases — Submit Care
router.post("/cases", async (req, res) => {
  try {
    const input = sanitizeCaseInput(req.body);

    if (!input.serviceType) return res.status(400).json({ msg: "A valid service type is required." });
    if (!input.patient.name) return res.status(400).json({ msg: "Patient name is required." });
    if (!input.patient.complaint) {
      return res.status(400).json({ msg: "A chief complaint / reason for the case is required." });
    }
    if (!input.location.country) return res.status(400).json({ msg: "Patient country is required." });

    const now = new Date();
    const caseNumber = await generatePartnerCaseNumber();

    const created = await PartnerCase.create({
      caseNumber,
      partner: req.partnerId,
      submittedBy: req.user.id,
      ...input,
      status: "submitted",
      statusHistory: [
        { status: "submitted", at: now, byId: req.user.id, byName: req.partnerName, byRole: "partner" },
      ],
      messages: [{ body: "Case submitted.", authorRole: "system", createdAt: now }],
    });

    res.status(201).json(serializeCaseForPartner(created));
  } catch (err) {
    console.error("partner create case error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/partner/cases/:id
router.get("/cases/:id", loadOwnedCase, (req, res) => {
  res.json(serializeCaseForPartner(req.partnerCase));
});

// PATCH /api/partner/cases/:id/cancel — only while still "submitted"
router.patch("/cases/:id/cancel", loadOwnedCase, async (req, res) => {
  try {
    const doc = req.partnerCase;
    if (doc.status !== "submitted") {
      return res.status(409).json({ msg: "This case can no longer be cancelled." });
    }
    doc.status = "cancelled";
    doc.statusHistory.push({
      status: "cancelled",
      at: new Date(),
      byId: req.user.id,
      byName: req.partnerName,
      byRole: "partner",
    });
    doc.messages.push({ body: "Case cancelled by partner.", authorRole: "system", createdAt: new Date() });
    await doc.save();
    res.json(serializeCaseForPartner(doc));
  } catch (err) {
    console.error("partner cancel case error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// POST /api/partner/cases/:id/messages — append a chat message
router.post("/cases/:id/messages", loadOwnedCase, async (req, res) => {
  try {
    const body = cleanText(req.body.body, 4000);
    if (!body) return res.status(400).json({ msg: "Message text is required." });

    req.partnerCase.messages.push({
      body,
      authorId: req.user.id,
      authorName: req.partnerName,
      authorRole: "partner",
      createdAt: new Date(),
    });
    await req.partnerCase.save();
    res.status(201).json(serializeCaseForPartner(req.partnerCase));
  } catch (err) {
    console.error("partner add message error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/partner/cases/:id/attachments/access-url?key=... — signed GET url
router.get("/cases/:id/attachments/access-url", loadOwnedCase, async (req, res) => {
  try {
    const key = cleanText(req.query.key, 500);
    if (!key) return res.status(400).json({ msg: "Attachment key is required." });

    const known = new Set((req.partnerCase.attachments || []).map((a) => a.key).filter(Boolean));
    if (!known.has(key)) return res.status(404).json({ msg: "Attachment not found on this case." });

    const signed = await createS3PresignedGetUrl(key, { expiresIn: DEFAULT_EXPIRY_SECONDS });
    res.json({ url: signed.url, expiresAt: signed.expiresAt });
  } catch (err) {
    console.error("partner attachment access-url error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

module.exports = router;
