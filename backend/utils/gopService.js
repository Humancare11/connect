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

// Creates a Guarantee of Payment, generates its PDF, and stores it. The
// provider email is NOT sent here — sending is a separate, explicit action
// (resendGopEmail). Runs synchronously as part of the admin's "Generate GOP"
// action, so failures here surface directly to the request.
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

  // No email is sent automatically. The GOP and its PDF exist and are
  // downloadable immediately; an admin emails it to the provider on demand
  // via resendGopEmail ("Send Email" in the UI).
  return gop;
}

// Re-sends the GOP's email without touching the record itself — no new GOP
// number, no PDF regeneration, no S3 write. Fetches the exact bytes already
// stored at pdfKey (the same file the download endpoint serves). This is both
// the first send and any later resend.
async function resendGopEmail({ gopId }) {
  const gop = await Gop.findById(gopId);
  if (!gop) return null;

  if (!String(gop.providerEmail || "").trim()) {
    const err = new Error("This GOP has no provider email address, so it cannot be sent.");
    err.code = "NO_PROVIDER_EMAIL";
    throw err;
  }

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
