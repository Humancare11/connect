const ManualInvoice = require("../models/ManualInvoice");
const { buildInvoicePdfBuffer, formatAmount, defaultManualNotes } = require("./invoicePdf");
const { storeUploadInS3, getUploadBuffer } = require("./uploadStorage");
const { sendManualInvoiceEmail } = require("./sendEmail");
const { nextInvoiceNumber } = require("./billing");

// Builds the PDF and uploads it to the private S3 bucket under a key
// derived purely from the invoice number (globally unique — enforced by
// ManualInvoice.invoiceNumber's unique index) — so regenerating the same
// invoice (e.g. when it's later marked paid) overwrites the same object
// instead of leaving an old "due" copy behind.
async function generateManualInvoicePdfAndUpload({
  invoiceNumber,
  issuedAt,
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
}) {
  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber,
    issuedAt,
    billTo: {
      name: clientName,
      email: clientEmail,
      company: companyName,
      registrationNumber,
      address,
      country,
      postalCode,
    },
    description,
    notes: buildManualNotes(description, status),
    amountCents,
    currency,
    documentType: "manual",
    status,
    items,
    dueDate,
    paymentTerms,
  });

  const filename = `${invoiceNumber}.pdf`;
  const { key } = await storeUploadInS3(
    {
      buffer: pdfBuffer,
      filename: `manual-invoices/${filename}`,
      mimetype: "application/pdf",
      size: pdfBuffer.length,
      originalname: filename,
    },
    { role: "system" }
  );

  return { pdfBuffer, key };
}

// The admin's free-text "Notes" replace the default intro bullet (which
// otherwise assumes generic boilerplate) while the standard payment-method/
// contact/invoice-number reminders still follow it.
function buildManualNotes(description, status) {
  const custom = String(description || "").trim();
  if (!custom) return undefined; // let the PDF fall back to its own defaults
  return [{ rest: custom }, ...defaultManualNotes(status).slice(1)];
}

// Creates a manual B2B invoice (status "due" or "paid"), generates its PDF,
// and stores it. The client email is NOT sent here — an admin decides
// per-invoice whether to email it, via the "Send Invoice Email" action in
// the history list (which routes to resendManualInvoiceEmail below). Runs
// synchronously as part of the admin's explicit "Generate Invoice" action,
// so failures here surface directly to the request instead of being
// swallowed.
async function createManualInvoice({
  createdBy,
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
  paymentMethod,
}) {
  const invoiceNumber = await nextInvoiceNumber();
  const issuedAt = new Date();
  const normalizedPaymentMethod = status === "paid" ? (paymentMethod || "Received") : "";

  // Only the S3 key is needed here — the PDF is not emailed at creation time,
  // so the buffer generateManualInvoicePdfAndUpload also returns is unused.
  const { key } = await generateManualInvoicePdfAndUpload({
    invoiceNumber,
    issuedAt,
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
  });

  const invoice = await ManualInvoice.create({
    invoiceNumber,
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
    paymentMethod: normalizedPaymentMethod,
    paidAt: status === "paid" ? issuedAt : null,
    pdfKey: key,
    createdBy,
  });

  // No email is sent automatically. The invoice and its PDF exist and are
  // downloadable immediately; an admin emails it to the client on demand
  // via resendManualInvoiceEmail ("Send Invoice Email" in the history list).
  return invoice;
}

// Flips a "due" invoice to "paid": regenerates the PDF as a receipt (same
// invoice number => same S3 key => the "due" bill is replaced, not kept
// alongside the receipt). No email is sent here — the admin decides whether
// to email the updated receipt afterward via resendManualInvoiceEmail
// ("Send Invoice Email").
async function markManualInvoicePaid({ invoiceId, paymentMethod }) {
  const invoice = await ManualInvoice.findById(invoiceId);
  if (!invoice) return null;
  if (invoice.status === "paid") return invoice; // idempotent no-op

  const normalizedPaymentMethod = (paymentMethod || "").trim() || "Received";
  const paidAt = new Date();

  await generateManualInvoicePdfAndUpload({
    invoiceNumber: invoice.invoiceNumber,
    // Keep the ORIGINAL issue date on the receipt — an invoice's issue date
    // is when it was created/sent, not when payment was later confirmed.
    // paidAt (below) is what actually records the payment moment.
    issuedAt: invoice.createdAt,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: invoice.companyName,
    registrationNumber: invoice.registrationNumber,
    address: invoice.address,
    country: invoice.country,
    postalCode: invoice.postalCode,
    paymentTerms: invoice.paymentTerms,
    dueDate: invoice.dueDate,
    items: invoice.items,
    description: invoice.description,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    status: "paid",
  });

  invoice.status = "paid";
  invoice.paymentMethod = normalizedPaymentMethod;
  invoice.paidAt = paidAt;
  // pdfKey is unchanged — generateManualInvoicePdfAndUpload always writes to
  // the same deterministic key for this invoiceNumber.

  // The stored PDF is now a different document (a paid receipt, not the "due"
  // bill that may have been emailed earlier), so clear the sent state: the
  // history row shows "not emailed" again until the admin sends the receipt.
  invoice.emailedAt = null;
  invoice.emailError = "";

  await invoice.save();
  return invoice;
}

// Re-sends the invoice's email without touching the invoice itself — no new
// invoice number, no PDF regeneration, no S3 write. Fetches the exact bytes
// already stored at pdfKey (the same file the download endpoint serves) so
// what the client receives is guaranteed identical to what's on file. Used
// for invoices where the original send failed (e.g. an SMTP outage) — see
// invoice.emailError — or simply hasn't been attempted yet.
async function resendManualInvoiceEmail({ invoiceId }) {
  const invoice = await ManualInvoice.findById(invoiceId);
  if (!invoice) return null;

  try {
    const pdfBuffer = await getUploadBuffer(invoice.pdfKey);
    await sendManualInvoiceEmail(invoice.clientEmail, {
      name: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      amountDisplay: formatAmount(invoice.amountCents, invoice.currency),
      status: invoice.status,
      pdfBuffer,
    });
    invoice.emailedAt = new Date();
    invoice.emailError = "";
  } catch (err) {
    console.error(`[manual-invoice] Resend failed for ${invoice.invoiceNumber} to ${invoice.clientEmail}:`, err.message);
    invoice.emailError = String(err.message || "Unknown error").slice(0, 500);
    await invoice.save();
    throw err;
  }

  await invoice.save();
  return invoice;
}

module.exports = {
  createManualInvoice,
  markManualInvoicePaid,
  resendManualInvoiceEmail,
};
