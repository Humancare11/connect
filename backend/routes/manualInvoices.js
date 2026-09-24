const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ManualInvoice = require("../models/ManualInvoice");
const Partner = require("../models/Partner");
const { verifyAdminToken, manualInvoiceAccess } = require("../middleware/verifyToken");
const { createManualInvoice, markManualInvoicePaid, resendManualInvoiceEmail } = require("../utils/manualInvoiceService");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");

const EMAIL_RE = /^\S+@\S+\.\S+$/;
// INR intentionally excluded — only these three currencies are offered on
// the form (ManualInvoices.jsx), validated here too so a stored/printed
// invoice can never end up in an arbitrary client-supplied currency.
const ALLOWED_CURRENCIES = ["usd", "eur", "gbp"];
const MAX_LENGTHS = {
  clientName: 120,
  clientEmail: 254,
  description: 500,
  paymentMethod: 80,
  companyName: 160,
  registrationNumber: 60,
  address: 200,
  country: 100,
  postalCode: 30,
  paymentTerms: 40,
  itemDescription: 200,
};
// $1,000,000 ceiling — guards against a fat-finger typo (e.g. a stray extra
// digit) minting a wildly oversized invoice; not a business limit.
const MAX_AMOUNT_CENTS = 100_000_000;
const MAX_ITEMS = 50;

// Same rounding rule the form's live preview uses (ManualInvoices.jsx's
// computeItemAmountCents) — computed server-side here too since the client
// total is never trusted as-is.
function computeItemAmountCents(quantity, rate) {
  const rateCents = Math.round(rate * 100);
  return Math.round(quantity * rateCents);
}

// Validates and normalizes the raw items array from the request body.
// Returns { items, amountCents } on success, or { error } on failure.
function parseItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Add at least one invoice item." };
  }
  if (rawItems.length > MAX_ITEMS) {
    return { error: `An invoice can have at most ${MAX_ITEMS} items.` };
  }

  const items = [];
  let amountCents = 0;
  for (const raw of rawItems) {
    const description = String(raw?.description || "").trim();
    const quantity = Number(raw?.quantity);
    const rate = Number(raw?.rate);

    if (!description || description.length > MAX_LENGTHS.itemDescription) {
      return { error: "Each item needs a description under 200 characters." };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: "Each item needs a quantity greater than zero." };
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: "Each item needs a valid, non-negative rate." };
    }

    const itemAmountCents = computeItemAmountCents(quantity, rate);
    items.push({ description, quantity, rate, amountCents: itemAmountCents });
    amountCents += itemAmountCents;
  }

  if (amountCents <= 0) {
    return { error: "Enter a valid amount greater than zero." };
  }
  return { items, amountCents };
}

// dueDate arrives as a "YYYY-MM-DD" date-input string; empty/invalid input
// is fine (dueDate is optional) but a non-empty unparsable string is not.
function parseDueDate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { dueDate: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { error: "Enter a valid due date." };
  return { dueDate: parsed };
}

function serializeManualInvoice(doc) {
  const creator = doc.createdBy && typeof doc.createdBy === "object" ? doc.createdBy : null;
  // Only when populated — a bare ObjectId is also typeof "object".
  const partner =
    doc.partner && typeof doc.partner === "object" && doc.partner.companyName ? doc.partner : null;
  return {
    _id: doc._id,
    invoiceNumber: doc.invoiceNumber,
    partner: partner
      ? { _id: partner._id, companyName: partner.companyName, partnerCode: partner.partnerCode }
      : undefined,
    clientName: doc.clientName,
    clientEmail: doc.clientEmail,
    companyName: doc.companyName || undefined,
    registrationNumber: doc.registrationNumber || undefined,
    address: doc.address || undefined,
    country: doc.country || undefined,
    postalCode: doc.postalCode || undefined,
    paymentTerms: doc.paymentTerms || undefined,
    dueDate: doc.dueDate || undefined,
    items: Array.isArray(doc.items) && doc.items.length ? doc.items : undefined,
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
   Creates a manual B2B invoice and its PDF. Does NOT email the client — that
   is a separate, explicit per-invoice action (POST :id/resend-email). Open
   to superadmin, admin, and paymentadmin (see manualInvoiceAccess). Runs
   synchronously: the admin is waiting on the result of "Generate Invoice". */
router.post("/", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
  try {
    const clientName = String(req.body.name || "").trim();
    const clientEmail = String(req.body.email || "").trim().toLowerCase();
    const companyName = String(req.body.companyName || "").trim();
    const registrationNumber = String(req.body.registrationNumber || "").trim();
    const address = String(req.body.address || "").trim();
    const country = String(req.body.country || "").trim();
    const postalCode = String(req.body.postalCode || "").trim();
    const paymentTerms = String(req.body.paymentTerms || "").trim() || "Due on Receipt";
    // description is now the optional free-text "Notes" field, not a
    // required line-item description — the itemized lines below carry that.
    const description = String(req.body.description || "").trim();
    const status = req.body.status === "paid" ? "paid" : "due";
    const paymentMethod = String(req.body.paymentMethod || "").trim();
    const rawCurrency = String(req.body.currency || "usd").trim().toLowerCase();
    const currency = ALLOWED_CURRENCIES.includes(rawCurrency) ? rawCurrency : "usd";

    if (!clientName || !clientEmail) {
      return res.status(400).json({ msg: "Name and email are required." });
    }
    if (!EMAIL_RE.test(clientEmail)) {
      return res.status(400).json({ msg: "Enter a valid client email address." });
    }
    if (
      clientName.length > MAX_LENGTHS.clientName ||
      clientEmail.length > MAX_LENGTHS.clientEmail ||
      description.length > MAX_LENGTHS.description ||
      paymentMethod.length > MAX_LENGTHS.paymentMethod ||
      companyName.length > MAX_LENGTHS.companyName ||
      registrationNumber.length > MAX_LENGTHS.registrationNumber ||
      address.length > MAX_LENGTHS.address ||
      country.length > MAX_LENGTHS.country ||
      postalCode.length > MAX_LENGTHS.postalCode ||
      paymentTerms.length > MAX_LENGTHS.paymentTerms
    ) {
      return res.status(400).json({ msg: "One or more fields exceed the allowed length." });
    }

    const { items, amountCents, error: itemsError } = parseItems(req.body.items);
    if (itemsError) {
      return res.status(400).json({ msg: itemsError });
    }
    if (amountCents > MAX_AMOUNT_CENTS) {
      return res.status(400).json({ msg: "Amount is too large. Please double-check the value." });
    }

    const { dueDate, error: dueDateError } = parseDueDate(req.body.dueDate);
    if (dueDateError) {
      return res.status(400).json({ msg: dueDateError });
    }

    // Optional: bind this invoice to a Partner Company so it also appears in
    // that partner's Billing section. Validated against a real, active
    // Partner — a bad/inactive id is rejected rather than silently dropped.
    let partnerId = null;
    if (req.body.partnerId) {
      if (!mongoose.isValidObjectId(req.body.partnerId)) {
        return res.status(400).json({ msg: "Invalid partner selected." });
      }
      const partnerDoc = await Partner.findById(req.body.partnerId).select("status").lean();
      if (!partnerDoc || partnerDoc.status !== "active") {
        return res.status(400).json({ msg: "Selected partner company was not found or is inactive." });
      }
      partnerId = req.body.partnerId;
    }

    const invoice = await createManualInvoice({
      createdBy: req.user.id,
      partner: partnerId,
      clientName,
      clientEmail,
      companyName,
      registrationNumber,
      address,
      country,
      postalCode,
      paymentTerms,
      dueDate,
      items,
      description,
      amountCents,
      currency,
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
   (matching the existing Payment Links scoping); admin and superadmin see
   all. */
router.get("/", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = {};

    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;
    if (["due", "paid"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.partner && mongoose.isValidObjectId(req.query.partner)) {
      query.partner = req.query.partner;
    }
    if (req.query.q) {
      const pattern = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ clientName: pattern }, { clientEmail: pattern }, { invoiceNumber: pattern }];
    }

    const [invoices, total] = await Promise.all([
      ManualInvoice.find(query)
        .populate("createdBy", "name email")
        .populate("partner", "companyName partnerCode")
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

/* GET /api/admin/manual-invoices/partners
   Active Partner Companies for the "Bill to a Partner" picker on the invoice
   form. Read-only projection — no credentials or internal fields. */
router.get("/partners", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
  try {
    const partners = await Partner.find({ status: "active" })
      .select("companyName partnerCode contactPersonName contactEmail address country billingCurrency")
      .sort({ companyName: 1 })
      .lean();
    res.json({
      partners: partners.map((p) => ({
        _id: p._id,
        companyName: p.companyName,
        partnerCode: p.partnerCode,
        contactPersonName: p.contactPersonName || "",
        contactEmail: p.contactEmail || "",
        address: p.address || "",
        country: p.country || "",
        billingCurrency: (p.billingCurrency || "usd").toUpperCase(),
      })),
    });
  } catch (err) {
    console.error("list invoice partners error:", err.message);
    res.status(500).json({ msg: "Failed to load partner companies." });
  }
});

/* GET /api/admin/manual-invoices/:id/download
   Short-lived presigned S3 URL, same pattern as the patient invoice
   download route. Ownership-scoped for paymentadmin the same way the list
   endpoint is, so one paymentadmin can't fetch another's invoice by id. */
router.get("/:id/download", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
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
   (replacing the "due" bill — see manualInvoiceService.js). Does NOT email
   the client — sending the updated receipt is a separate, explicit action
   (POST :id/resend-email). */
router.patch("/:id/mark-paid", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid invoice id." });
    }

    const paymentMethod = String(req.body.paymentMethod || "").trim();
    if (paymentMethod.length > MAX_LENGTHS.paymentMethod) {
      return res.status(400).json({ msg: "Payment method is too long." });
    }

    const query = { _id: req.params.id };
    if (req.user.role === "paymentadmin") query.createdBy = req.user.id;

    const existing = await ManualInvoice.findOne(query).select("_id status").lean();
    if (!existing) return res.status(404).json({ msg: "Invoice not found." });
    if (existing.status === "paid") {
      return res.status(400).json({ msg: "Invoice is already marked as paid." });
    }

    const invoice = await markManualInvoicePaid({ invoiceId: existing._id, paymentMethod });
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
router.post("/:id/resend-email", verifyAdminToken, manualInvoiceAccess, async (req, res) => {
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
