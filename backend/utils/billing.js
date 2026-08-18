const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const { nextSequenceValue } = require("./idSequence");
const { buildInvoicePdfBuffer, formatAmount } = require("./invoicePdf");
const { storeUploadInS3 } = require("./uploadStorage");
const { sendInvoiceEmail } = require("./sendEmail");

const INVOICE_PREFIX = "HC";

// Invoice numbers look like HC01-2608 (seq=01, year=26, month=08) and reset
// to 01 at the start of every calendar month. Each month gets its own
// Counter document (id "invoice-2608", "invoice-2609", ...), so the reset
// falls out naturally from a fresh counter starting at 0 rather than from
// any explicit "is it a new month yet?" check — that sidesteps the race
// that kind of check would have right at a month boundary. Counting is
// still atomic per period via nextSequenceValue's $inc, so concurrent
// payments in the same month can never receive the same number.
async function nextInvoiceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const period = `${yy}${mm}`;

  const value = await nextSequenceValue(`invoice-${period}`, { initialValue: 0 });
  const seq = String(value).padStart(2, "0");
  return `${INVOICE_PREFIX}${seq}-${period}`;
}

// Generates the PDF, stores it in S3 (private bucket, never a public URL),
// links it to the payment, and emails it to the patient. Safe to call more
// than once for the same payment (the original fire-and-forget call and the
// reconciliation job — see jobs/invoiceReconciliationJob.js — both go
// through this): it never mints a second invoice number/PDF/S3 object for a
// payment that already has one, and it never re-sends an email that already
// went out.
async function generateInvoiceForPayment(payment, { userName, userEmail } = {}) {
  // Idempotency guard #1: an Invoice may already exist for this payment even
  // though payment.invoice is still null — e.g. a previous attempt created
  // the Invoice + uploaded its PDF but crashed/errored before linking it
  // back onto the Payment. Recover and (re)link it instead of generating a
  // duplicate. Email is intentionally NOT re-sent in this branch — it may
  // already have gone out on the attempt that created this invoice.
  const existingInvoice = await Invoice.findOne({ payment: payment._id });
  if (existingInvoice) {
    if (!payment.invoice || String(payment.invoice) !== String(existingInvoice._id)) {
      payment.invoice = existingInvoice._id;
      await payment.save();
    }
    return existingInvoice;
  }

  const invoiceNumber = await nextInvoiceNumber();
  const issuedAt = new Date();

  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber,
    issuedAt,
    billTo: { name: userName, email: userEmail },
    description: payment.description,
    amountCents: payment.amountCents,
    currency: payment.currency,
    gateway: payment.gateway,
    gatewayReference: payment.gatewayReference,
  });

  const filename = `${invoiceNumber}.pdf`;
  // Path already contains "/", so storeUploadInS3 uses it verbatim as the S3
  // key (see uploadKey() in uploadStorage.js) — same private-bucket flow the
  // rest of the app uses for medical-report attachments.
  const { key } = await storeUploadInS3(
    {
      buffer: pdfBuffer,
      filename: `invoices/${payment.user}/${filename}`,
      mimetype: "application/pdf",
      size: pdfBuffer.length,
      originalname: filename,
    },
    { userId: payment.user, role: "system" }
  );

  let invoice;
  try {
    invoice = await Invoice.create({
      invoiceNumber,
      payment: payment._id,
      user: payment.user,
      amountCents: payment.amountCents,
      currency: payment.currency,
      issuedAt,
      pdfKey: key,
    });
  } catch (err) {
    // Idempotency guard #2: lost a race with a concurrent attempt for this
    // exact payment (unique index on Invoice.payment) — reuse the winner's
    // invoice rather than creating a duplicate. The PDF/S3 object we just
    // built above is simply discarded (orphaned in S3, never referenced by
    // any DB record — harmless). Never send an email here either: the
    // winner of the race owns that.
    if (err?.code === 11000) {
      invoice = await Invoice.findOne({ payment: payment._id });
      if (!invoice) throw err;
      if (!payment.invoice || String(payment.invoice) !== String(invoice._id)) {
        payment.invoice = invoice._id;
        await payment.save();
      }
      return invoice;
    }
    throw err;
  }

  payment.invoice = invoice._id;
  await payment.save();

  if (userEmail) {
    try {
      await sendInvoiceEmail(userEmail, {
        name: userName,
        invoiceNumber,
        amountDisplay: formatAmount(payment.amountCents, payment.currency),
        description: payment.description,
        pdfBuffer,
      });
      invoice.emailedAt = new Date();
      await invoice.save();
    } catch (err) {
      // The invoice already exists and is downloadable from the dashboard —
      // a failed email must not undo that, so just record the failure.
      console.error(`[invoice] Failed to email invoice ${invoiceNumber} to ${userEmail}:`, err.message);
      invoice.emailError = String(err.message || "Unknown error").slice(0, 500);
      await invoice.save();
    }
  }

  return invoice;
}

// Records a successful payment and generates its invoice. Intended to be
// called fire-and-forget (with a .catch()) right after a booking response
// has already been sent — payment verification and money movement already
// happened upstream (see paymentVerification.js), so a failure here must
// never surface as a booking failure. It is idempotent: if this ever runs
// twice for the same gateway reference (e.g. a retried call), the unique
// index on Payment recovers the existing record instead of double-billing.
async function recordPaymentAndInvoice({
  userId,
  userName,
  userEmail,
  appointmentId = null,
  categoryConsultationId = null,
  gateway,
  gatewayReference,
  amountCents,
  currency = "usd",
  description,
}) {
  let payment;
  try {
    payment = await Payment.create({
      user: userId,
      appointment: appointmentId,
      categoryConsultation: categoryConsultationId,
      gateway,
      gatewayReference,
      amountCents,
      currency,
      description,
    });
  } catch (err) {
    if (err?.code === 11000) {
      payment = await Payment.findOne({ gateway, gatewayReference });
      if (!payment) throw err;
    } else {
      throw err;
    }
  }

  if (payment.invoice) return payment;

  // Attempt bookkeeping (invoiceAttempts / lastInvoiceAttemptAt / lastInvoiceError)
  // is what lets the reconciliation job (jobs/invoiceReconciliationJob.js)
  // find and cap retries for payments whose invoice never got created —
  // recorded here so every call site (the original booking-time call and
  // every later retry) goes through the same accounting.
  payment.invoiceAttempts = (payment.invoiceAttempts || 0) + 1;
  payment.lastInvoiceAttemptAt = new Date();

  try {
    await generateInvoiceForPayment(payment, { userName, userEmail });
    payment.lastInvoiceError = "";
    await payment.save();
  } catch (err) {
    payment.lastInvoiceError = String(err?.message || "Unknown error").slice(0, 500);
    await payment.save().catch((saveErr) => {
      console.error(`[invoice] Failed to persist invoice-attempt bookkeeping for payment ${payment._id}:`, saveErr.message);
    });
    throw err;
  }

  return payment;
}

module.exports = {
  recordPaymentAndInvoice,
  generateInvoiceForPayment,
  nextInvoiceNumber,
};
