const Gop = require("../models/Gop");
const { buildGopPdfBuffer, formatAmount } = require("./gopPdf");
const { storeUploadInS3, getUploadBuffer } = require("./uploadStorage");
const { sendGopEmail } = require("./sendEmail");
const { nextSequenceValue } = require("./idSequence");

const GOP_PREFIX = "GOP";

// "GOP01-2608" (seq=01, year=26, month=08), resetting to 01 at the start of
// every calendar month — same scheme as billing.js's nextInvoiceNumber, one
// Counter document per period so the reset needs no explicit month-boundary
// check, and nextSequenceValue's atomic $inc keeps it race-free.
async function nextGopNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const period = `${yy}${mm}`;

  const value = await nextSequenceValue(`gop-${period}`, { initialValue: 0 });
  const seq = String(value).padStart(2, "0");
  return `${GOP_PREFIX}${seq}-${period}`;
}

// Creates a Guarantee of Payment, generates its PDF, stores it, and emails
// it to the service provider. Runs synchronously as part of the admin's
// explicit "Generate & Send" action, so failures here surface directly to
// the request instead of being swallowed.
async function createGop({
  createdBy,
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
}) {
  const gopNumber = await nextGopNumber();
  const issuedAt = new Date();

  const pdfBuffer = await buildGopPdfBuffer({
    gopNumber,
    issuedAt,
    caseType,
    patient: {
      name: patientName,
      dob: patientDob,
      phone: patientPhone,
      location: patientLocation,
      complaint: patientComplaint,
    },
    requestedService,
    provider: {
      name: providerName,
      contact: providerContact,
      address: providerAddress,
      email: providerEmail,
    },
    amountCents,
    currency,
    authorizedByName,
  });

  const filename = `${gopNumber}.pdf`;
  const { key } = await storeUploadInS3(
    {
      buffer: pdfBuffer,
      filename: `gop/${filename}`,
      mimetype: "application/pdf",
      size: pdfBuffer.length,
      originalname: filename,
    },
    { role: "system" }
  );

  const gop = await Gop.create({
    gopNumber,
    caseType,
    patientName,
    patientDob: patientDob || null,
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
    pdfKey: key,
    createdBy,
  });

  // The GOP record and its PDF already exist and are downloadable even if
  // the email fails — record the failure rather than losing the GOP.
  try {
    await sendGopEmail(providerEmail, {
      providerName,
      gopNumber,
      patientName,
      caseType,
      amountDisplay: formatAmount(amountCents, currency),
      pdfBuffer,
    });
    gop.emailedAt = new Date();
  } catch (err) {
    console.error(`[gop] Failed to email GOP ${gopNumber} to ${providerEmail}:`, err.message);
    gop.emailError = String(err.message || "Unknown error").slice(0, 500);
  }
  await gop.save();

  return gop;
}

// Re-sends the GOP's email without touching the record itself — no new GOP
// number, no PDF regeneration, no S3 write. Fetches the exact bytes already
// stored at pdfKey (the same file the download endpoint serves). Used for a
// GOP whose original send failed (see its emailError) or was never sent.
async function resendGopEmail({ gopId }) {
  const gop = await Gop.findById(gopId);
  if (!gop) return null;

  try {
    const pdfBuffer = await getUploadBuffer(gop.pdfKey);
    await sendGopEmail(gop.providerEmail, {
      providerName: gop.providerName,
      gopNumber: gop.gopNumber,
      patientName: gop.patientName,
      caseType: gop.caseType,
      amountDisplay: formatAmount(gop.amountCents, gop.currency),
      pdfBuffer,
    });
    gop.emailedAt = new Date();
    gop.emailError = "";
  } catch (err) {
    console.error(`[gop] Resend failed for ${gop.gopNumber} to ${gop.providerEmail}:`, err.message);
    gop.emailError = String(err.message || "Unknown error").slice(0, 500);
    await gop.save();
    throw err;
  }

  await gop.save();
  return gop;
}

module.exports = {
  createGop,
  resendGopEmail,
  nextGopNumber,
};
