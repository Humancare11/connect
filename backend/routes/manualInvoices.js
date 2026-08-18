const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ManualInvoice = require("../models/ManualInvoice");
const { verifyAdminToken, paymentAdminOnly } = require("../middleware/verifyToken");
const { createManualInvoice, markManualInvoicePaid, resendManualInvoiceEmail } = require("../utils/manualInvoiceService");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_LENGTHS = { clientName: 120, clientEmail: 254, description: 500, paymentMethod: 80 };
// $1,000,000 ceiling — guards against a fat-finger typo (e.g. a stray extra
// digit) minting a wildly oversized invoice; not a business limit.
const MAX_AMOUNT_CENTS = 100_000_000;

function serializeManualInvoice(doc) {
  const creator = doc.createdBy && typeof doc.createdBy === "object" ? doc.createdBy : null;
  return {
    _id: doc._id,
    invoiceNumber: doc.invoiceNumber,
    clientName: doc.clientName,
    clientEmail: doc.clientEmail,
    description: doc.description,
    amountCents: doc.amountCents,
    currency: doc.currency,
    status: doc.status,
    paymentMethod: doc.paymentMethod,
    paidAt: doc.paidAt,
    emailed: Boolean(doc.emailedAt),
    emailError: doc.emailError || undefined,
    createdBy: creator ? { name: creator.name, email: creator.email } : undefined,
    createdAt: doc.createdAt,
  };
}

/* POST /api/admin/manual-invoices
   Creates and emails a manual B2B invoice. Restricted to superadmin +
   paymentadmin (same role gate as the existing Payment Links feature) —
   never plain "admin". Runs synchronously: the admin is waiting on the
   result of an explicit "Generate & Send" action. */
router.post("/", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    const clientName = String(req.body.name || "").trim();
    const clientEmail = String(req.body.email || "").trim().toLowerCase();
    const description = String(req.body.description || "").trim();
    const status = req.body.status === "paid" ? "paid" : "due";
    const paymentMethod = String(req.body.paymentMethod || "").trim();
    const amount = Number(req.body.amount);

    if (!clientName || !clientEmail || !description) {
      return res.status(400).json({ msg: "Name, email, and description are required." });
    }
    if (!EMAIL_RE.test(clientEmail)) {
      return res.status(400).json({ msg: "Enter a valid client email address." });
    }
    if (
      clientName.length > MAX_LENGTHS.clientName ||
      clientEmail.length > MAX_LENGTHS.clientEmail ||
      description.length > MAX_LENGTHS.description ||
      paymentMethod.length > MAX_LENGTHS.paymentMethod
    ) {
      return res.status(400).json({ msg: "One or more fields exceed the allowed length." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Enter a valid amount greater than zero." });
    }

    const amountCents = Math.round(amount * 100);
    if (amountCents > MAX_AMOUNT_CENTS) {
      return res.status(400).json({ msg: "Amount is too large. Please double-check the value." });
    }

    const invoice = await createManualInvoice({
      createdBy: req.user.id,
      clientName,
      clientEmail,
      description,
      amountCents,
      status,
      paymentMethod: status === "paid" ? paymentMethod : "",
    });

    res.status(201).json({ invoice: serializeManualInvoice(invoice) });
  } catch (err) {
    console.error("create manual invoice error:", err.message);
    res.status(500).json({ msg: "Failed to generate invoice. Please try again." });
  }
});

/* GET /api/admin/manual-invoices
   History/search. A paymentadmin only ever sees invoices they created
   (matching the existing Payment Links scoping); superadmin sees all. */
router.get("/", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = {};

    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;
    if (["due", "paid"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.q) {
      const pattern = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ clientName: pattern }, { clientEmail: pattern }, { invoiceNumber: pattern }];
    }

    const [invoices, total] = await Promise.all([
      ManualInvoice.find(query)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ManualInvoice.countDocuments(query),
    ]);

    res.json({
      invoices: invoices.map(serializeManualInvoice),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("list manual invoices error:", err.message);
    res.status(500).json({ msg: "Failed to load invoices." });
  }
});

/* GET /api/admin/manual-invoices/:id/download
   Short-lived presigned S3 URL, same pattern as the patient invoice
   download route. Ownership-scoped for paymentadmin the same way the list
   endpoint is, so one paymentadmin can't fetch another's invoice by id. */
router.get("/:id/download", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid invoice id." });
    }

    const query = { _id: req.params.id };
    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;

    const invoice = await ManualInvoice.findOne(query).select("pdfKey invoiceNumber").lean();
    if (!invoice) return res.status(404).json({ msg: "Invoice not found." });

    const signed = await createS3PresignedGetUrl(invoice.pdfKey, { expiresIn: 300 });
    res.json({ url: signed.url, invoiceNumber: invoice.invoiceNumber, expiresAt: signed.expiresAt });
  } catch (err) {
    console.error("manual invoice download error:", err.message);
    res.status(500).json({ msg: "Failed to generate download link." });
  }
});

/* PATCH /api/admin/manual-invoices/:id/mark-paid
   Flips a "due" invoice to "paid", regenerating its PDF as a receipt
   (replacing the "due" bill — see manualInvoiceService.js) and optionally
   re-emailing it to the client. */
router.patch("/:id/mark-paid", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid invoice id." });
    }

    const paymentMethod = String(req.body.paymentMethod || "").trim();
    if (paymentMethod.length > MAX_LENGTHS.paymentMethod) {
      return res.status(400).json({ msg: "Payment method is too long." });
    }
    const resendEmail = Boolean(req.body.resendEmail);

    const query = { _id: req.params.id };
    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;

    const existing = await ManualInvoice.findOne(query).select("_id status").lean();
    if (!existing) return res.status(404).json({ msg: "Invoice not found." });
    if (existing.status === "paid") {
      return res.status(400).json({ msg: "Invoice is already marked as paid." });
    }

    const invoice = await markManualInvoicePaid({ invoiceId: existing._id, paymentMethod, resendEmail });
    res.json({ invoice: serializeManualInvoice(invoice) });
  } catch (err) {
    console.error("mark manual invoice paid error:", err.message);
    res.status(500).json({ msg: "Failed to update invoice." });
  }
});

/* POST /api/admin/manual-invoices/:id/resend-email
   Re-sends the invoice's email as-is — no new invoice number, no PDF
   regeneration, no change to status/amount/anything else. For an invoice
   whose original send failed (e.g. an SMTP outage) or was never attempted. */
router.post("/:id/resend-email", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid invoice id." });
    }

    const query = { _id: req.params.id };
    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;

    const existing = await ManualInvoice.findOne(query).select("_id").lean();
    if (!existing) return res.status(404).json({ msg: "Invoice not found." });

    const invoice = await resendManualInvoiceEmail({ invoiceId: existing._id });
    res.json({ invoice: serializeManualInvoice(invoice) });
  } catch (err) {
    console.error("resend manual invoice email error:", err.message);
    // 502: the request itself was valid, but the downstream email send
    // failed — distinct from a validation/not-found error on this endpoint.
    res.status(502).json({ msg: err.message || "Failed to send the email. Please try again." });
  }
});

module.exports = router;
