const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Gop = require("../models/Gop");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { createGop, resendGopEmail } = require("../utils/gopService");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ALLOWED_CURRENCIES = ["eur", "usd", "gbp", "inr"];
// Fixed dropdown on the frontend — validated here too so the stored/printed
// value can never be arbitrary client-supplied text.
const CASE_TYPES = ["House Call Visit", "Teleconsultation", "In-Clinic"];
const MAX_LENGTHS = {
  patientName: 120,
  patientPhone: 40,
  patientLocation: 200,
  patientComplaint: 1000,
  requestedService: 1000,
  providerName: 120,
  providerContact: 60,
  providerAddress: 200,
  providerEmail: 254,
  authorizedByName: 120,
};
// $1,000,000 ceiling — guards against a fat-finger typo, not a business limit.
const MAX_AMOUNT_CENTS = 100_000_000;

// dob arrives as a "YYYY-MM-DD" date-input string; empty/invalid input is
// fine (it's optional) but a non-empty unparsable string is not.
function parsePatientDob(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { dob: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { error: "Enter a valid date of birth." };
  return { dob: parsed };
}

function serializeGop(doc) {
  const creator = doc.createdBy && typeof doc.createdBy === "object" ? doc.createdBy : null;
  return {
    _id: doc._id,
    gopNumber: doc.gopNumber,
    caseType: doc.caseType,
    patientName: doc.patientName,
    patientDob: doc.patientDob || undefined,
    patientPhone: doc.patientPhone || undefined,
    patientLocation: doc.patientLocation || undefined,
    patientComplaint: doc.patientComplaint || undefined,
    requestedService: doc.requestedService || undefined,
    providerName: doc.providerName,
    providerContact: doc.providerContact || undefined,
    providerAddress: doc.providerAddress || undefined,
    providerEmail: doc.providerEmail,
    amountCents: doc.amountCents,
    currency: doc.currency,
    authorizedByName: doc.authorizedByName,
    emailed: Boolean(doc.emailedAt),
    emailError: doc.emailError || undefined,
    createdBy: creator ? { name: creator.name, email: creator.email } : undefined,
    createdAt: doc.createdAt,
  };
}

/* POST /api/admin/gop
   Creates, PDFs, stores, and emails a Guarantee of Payment to the service
   provider. Admin + superadmin only. Runs synchronously: the admin is
   waiting on the result of an explicit "Generate & Send" action. */
router.post("/", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const caseType = String(req.body.caseType || "").trim();
    const patientName = String(req.body.patientName || "").trim();
    const patientPhone = String(req.body.patientPhone || "").trim();
    const patientLocation = String(req.body.patientLocation || "").trim();
    const patientComplaint = String(req.body.patientComplaint || "").trim();
    const requestedService = String(req.body.requestedService || "").trim();
    const providerName = String(req.body.providerName || "").trim();
    const providerContact = String(req.body.providerContact || "").trim();
    const providerAddress = String(req.body.providerAddress || "").trim();
    const providerEmail = String(req.body.providerEmail || "").trim().toLowerCase();
    const authorizedByName = String(req.body.authorizedByName || "").trim();
    const rawCurrency = String(req.body.currency || "eur").trim().toLowerCase();
    const currency = ALLOWED_CURRENCIES.includes(rawCurrency) ? rawCurrency : "eur";

    if (!patientName || !providerName || !providerEmail || !authorizedByName) {
      return res.status(400).json({ msg: "Patient name, provider name, provider email, and authorized-by name are required." });
    }
    if (!CASE_TYPES.includes(caseType)) {
      return res.status(400).json({ msg: "Select a valid case type." });
    }
    if (!EMAIL_RE.test(providerEmail)) {
      return res.status(400).json({ msg: "Enter a valid provider email address." });
    }
    if (
      patientName.length > MAX_LENGTHS.patientName ||
      patientPhone.length > MAX_LENGTHS.patientPhone ||
      patientLocation.length > MAX_LENGTHS.patientLocation ||
      patientComplaint.length > MAX_LENGTHS.patientComplaint ||
      requestedService.length > MAX_LENGTHS.requestedService ||
      providerName.length > MAX_LENGTHS.providerName ||
      providerContact.length > MAX_LENGTHS.providerContact ||
      providerAddress.length > MAX_LENGTHS.providerAddress ||
      providerEmail.length > MAX_LENGTHS.providerEmail ||
      authorizedByName.length > MAX_LENGTHS.authorizedByName
    ) {
      return res.status(400).json({ msg: "One or more fields exceed the allowed length." });
    }

    const { dob: patientDob, error: dobError } = parsePatientDob(req.body.patientDob);
    if (dobError) {
      return res.status(400).json({ msg: dobError });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Enter a valid agreed payment amount greater than zero." });
    }
    const amountCents = Math.round(amount * 100);
    if (amountCents > MAX_AMOUNT_CENTS) {
      return res.status(400).json({ msg: "Amount is too large. Please double-check the value." });
    }

    const gop = await createGop({
      createdBy: req.user.id,
      caseType,
      patientName,
      patientDob,
      patientPhone,
      patientLocation,
      patientComplaint,
      requestedService,
      providerName,
      providerContact,
      providerAddress,
      providerEmail,
      amountCents,
      currency,
      authorizedByName,
    });

    res.status(201).json({ gop: serializeGop(gop) });
  } catch (err) {
    console.error("create GOP error:", err.message);
    res.status(500).json({ msg: "Failed to generate the Guarantee of Payment. Please try again." });
  }
});

/* GET /api/admin/gop
   History/search — every admin/superadmin sees every GOP (there is no
   per-creator scoping here, unlike Manual Invoices' paymentadmin case,
   since only admin/superadmin can reach this route at all). */
router.get("/", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = {};

    if (req.query.q) {
      const pattern = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { patientName: pattern },
        { providerName: pattern },
        { providerEmail: pattern },
        { gopNumber: pattern },
      ];
    }

    const [gops, total] = await Promise.all([
      Gop.find(query)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gop.countDocuments(query),
    ]);

    res.json({
      gops: gops.map(serializeGop),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("list GOPs error:", err.message);
    res.status(500).json({ msg: "Failed to load GOPs." });
  }
});

/* GET /api/admin/gop/:id/download
   Short-lived presigned S3 URL, same pattern as the manual invoice
   download route. */
router.get("/:id/download", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid GOP id." });
    }

    const gop = await Gop.findById(req.params.id).select("pdfKey gopNumber").lean();
    if (!gop) return res.status(404).json({ msg: "GOP not found." });

    const signed = await createS3PresignedGetUrl(gop.pdfKey, { expiresIn: 300 });
    res.json({ url: signed.url, gopNumber: gop.gopNumber, expiresAt: signed.expiresAt });
  } catch (err) {
    console.error("GOP download error:", err.message);
    res.status(500).json({ msg: "Failed to generate download link." });
  }
});

/* POST /api/admin/gop/:id/resend-email
   Re-sends the GOP's email as-is — no new GOP number, no PDF
   regeneration. For one whose original send failed or was never
   attempted. */
router.post("/:id/resend-email", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid GOP id." });
    }

    const existing = await Gop.findById(req.params.id).select("_id").lean();
    if (!existing) return res.status(404).json({ msg: "GOP not found." });

    const gop = await resendGopEmail({ gopId: existing._id });
    res.json({ gop: serializeGop(gop) });
  } catch (err) {
    console.error("resend GOP email error:", err.message);
    res.status(502).json({ msg: err.message || "Failed to send the email. Please try again." });
  }
});

module.exports = router;
