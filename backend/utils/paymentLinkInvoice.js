const ManualInvoice = require("../models/ManualInvoice");
const PaymentLink = require("../models/PaymentLink");
const { createManualInvoice, markManualInvoicePaid } = require("./manualInvoiceService");

// A payment link's invoice is an ordinary ManualInvoice (source
// "payment_link", linked by ManualInvoice.paymentLink), so the PDF, S3 key,
// invoice number, download and e-mail all come from manualInvoiceService.js.
// Nothing here ever sends an e-mail — that is always an explicit admin action.

function paymentLinkUrl(req, token) {
  const origin = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/+$/, "")}/pay/${token}`;
}

// The "Pay now" URL for an invoice's e-mail, or "" when it has no link.
async function payUrlForInvoice(req, invoice) {
  if (!invoice?.paymentLink) return "";
  const link = await PaymentLink.findById(invoice.paymentLink).select("token").lean();
  return link ? paymentLinkUrl(req, link.token) : "";
}

// Compact shape the Payment Links pages render. Accepts a populated or lean
// ManualInvoice; returns null for a link that has no invoice.
function serializeLinkInvoice(invoice) {
  if (!invoice || typeof invoice !== "object" || !invoice.invoiceNumber) return null;
  return {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    amountCents: invoice.amountCents,
    dueDate: invoice.dueDate || undefined,
    emailed: Boolean(invoice.emailedAt),
    emailError: invoice.emailError || undefined,
  };
}

// Creates the "due" invoice for a link, once. Safe to call again for the same
// link: an existing invoice is returned as-is, and losing a race against a
// concurrent call (unique partial index on ManualInvoice.paymentLink) falls
// back to the winner's invoice.
async function createInvoiceForPaymentLink(link, { details, items, amountCents, dueDate, createdBy }) {
  const existing = await ManualInvoice.findOne({ paymentLink: link._id });
  if (existing) return existing;

  let invoice;
  try {
    invoice = await createManualInvoice({
      createdBy,
      partner: null,
      ...details,
      dueDate,
      items,
      amountCents,
      currency: link.currency,
      status: "due",
      source: "payment_link",
      paymentLink: link._id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      invoice = await ManualInvoice.findOne({ paymentLink: link._id });
      if (invoice) return invoice;
    }
    await recordInvoiceError(link, err);
    throw err;
  }

  await PaymentLink.updateOne({ _id: link._id }, { $set: { manualInvoice: invoice._id, invoiceError: "" } });
  link.manualInvoice = invoice._id;
  link.invoiceError = "";
  return invoice;
}

// Flips the link's invoice to "paid" (a receipt) after Stripe confirmed the
// payment. Idempotent; returns null for an older link that never had an
// invoice. Throws on failure — the caller records it and still answers the
// payer successfully, since the money has already moved.
async function settlePaymentLinkInvoice(link, paymentIntent) {
  const invoice = await ManualInvoice.findOne({ paymentLink: link._id }).select("_id status");
  if (!invoice) return null;
  if (invoice.status === "paid") return invoice;

  const settled = await markManualInvoicePaid({
    invoiceId: invoice._id,
    paymentMethod: "Card (Stripe)",
    gatewayReference: paymentIntent.id,
  });
  await PaymentLink.updateOne({ _id: link._id }, { $set: { invoiceError: "" } });
  return settled;
}

async function recordInvoiceError(link, err) {
  const message = String(err?.message || "Unknown error").slice(0, 500);
  link.invoiceError = message;
  await PaymentLink.updateOne({ _id: link._id }, { $set: { invoiceError: message } }).catch((saveErr) => {
    console.error(`[payment-link] Failed to persist invoiceError for ${link._id}:`, saveErr.message);
  });
}

module.exports = {
  paymentLinkUrl,
  payUrlForInvoice,
  serializeLinkInvoice,
  createInvoiceForPaymentLink,
  settlePaymentLinkInvoice,
  recordInvoiceError,
};
