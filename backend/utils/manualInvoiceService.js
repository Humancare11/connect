const ManualInvoice = require("../models/ManualInvoice");
const { buildInvoicePdfBuffer, formatAmount } = require("./invoicePdf");
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
  description,
  amountCents,
  currency,
  status,
}) {
  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber,
    issuedAt,
    billTo: { name: clientName, email: clientEmail },
    description,
    amountCents,
    currency,
    documentType: "manual",
    status,
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

// Creates a manual B2B invoice (status "due" or "paid"), generates its PDF,
// stores it, and emails it to the client. Runs synchronously as part of the
// admin's explicit "Generate & Send" action (unlike the patient-booking
// invoice flow, this isn't a background side effect of something else — the
// admin is waiting on the result), so failures here surface directly to the
// request instead of being swallowed.
async function createManualInvoice({
  createdBy,
  clientName,
  clientEmail,
  description,
  amountCents,
  status,
  paymentMethod,
}) {
  const invoiceNumber = await nextInvoiceNumber();
  const issuedAt = new Date();
  const currency = "usd";
  const normalizedPaymentMethod = status === "paid" ? (paymentMethod || "Received") : "";

  const { pdfBuffer, key } = await generateManualInvoicePdfAndUpload({
    invoiceNumber,
    issuedAt,
    clientName,
    clientEmail,
    description,
    amountCents,
    currency,
    status,
  });

  const invoice = await ManualInvoice.create({
    invoiceNumber,
    clientName,
    clientEmail,
    description,
    amountCents,
    currency,
    status,
    paymentMethod: normalizedPaymentMethod,
    paidAt: status === "paid" ? issuedAt : null,
    pdfKey: key,
    createdBy,
  });

  // The invoice record and its PDF already exist and are downloadable even
  // if the email fails — record the failure rather than losing the invoice.
  try {
    await sendManualInvoiceEmail(clientEmail, {
      name: clientName,
      invoiceNumber,
      description,
      amountDisplay: formatAmount(amountCents, currency),
      status,
      pdfBuffer,
    });
    invoice.emailedAt = new Date();
  } catch (err) {
    console.error(`[manual-invoice] Failed to email invoice ${invoiceNumber} to ${clientEmail}:`, err.message);
    invoice.emailError = String(err.message || "Unknown error").slice(0, 500);
  }
  await invoice.save();

  return invoice;
}

// Flips a "due" invoice to "paid": regenerates the PDF as a receipt (same
// invoice number => same S3 key => the "due" bill is replaced, not kept
// alongside the receipt) and optionally re-emails it to the client.
async function markManualInvoicePaid({ invoiceId, paymentMethod, resendEmail }) {
  const invoice = await ManualInvoice.findById(invoiceId);
  if (!invoice) return null;
  if (invoice.status === "paid") return invoice; // idempotent no-op

  const normalizedPaymentMethod = (paymentMethod || "").trim() || "Received";
  const paidAt = new Date();

  const { pdfBuffer } = await generateManualInvoicePdfAndUpload({
    invoiceNumber: invoice.invoiceNumber,
    // Keep the ORIGINAL issue date on the receipt — an invoice's issue date
    // is when it was created/sent, not when payment was later confirmed.
    // paidAt (below) is what actually records the payment moment.
    issuedAt: invoice.createdAt,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
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

  if (resendEmail) {
    try {
      await sendManualInvoiceEmail(invoice.clientEmail, {
        name: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber,
        description: invoice.description,
        amountDisplay: formatAmount(invoice.amountCents, invoice.currency),
        status: "paid",
        pdfBuffer,
      });
      invoice.emailedAt = new Date();
      invoice.emailError = "";
    } catch (err) {
      console.error(`[manual-invoice] Failed to resend receipt ${invoice.invoiceNumber} to ${invoice.clientEmail}:`, err.message);
      invoice.emailError = String(err.message || "Unknown error").slice(0, 500);
    }
  }

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
      description: invoice.description,
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
