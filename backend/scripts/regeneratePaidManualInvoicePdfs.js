const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const { CopyObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const connectDB = require("../config/db");
const { s3Client, getBucketName } = require("../config/s3");
const ManualInvoice = require("../models/ManualInvoice");
const { generateManualInvoicePdfAndUpload } = require("../utils/manualInvoiceService");

// One-time migration: paid manual invoices no longer print a Due Date, but
// their stored PDFs were rendered before that change. This re-renders each
// one through the same path markManualInvoicePaid uses
// (generateManualInvoicePdfAndUpload), overwriting the object at its existing
// S3 key.
//
// PDF-only: no ManualInvoice document is modified (status, dueDate, pdfKey,
// emailedAt are untouched) and no email is sent. Copies already emailed to
// clients are not changed.
//
// --backup: before overwriting, copy each current S3 object (server-side,
// content + metadata preserved) to
//   backup/<run-timestamp>/<original key>
// in the same bucket. If the backup of an invoice fails (or its current
// object is missing), that invoice is NOT regenerated. Each run gets its own
// timestamp folder, so re-running never overwrites an earlier backup.
//
// Usage (from backend/):
//   node scripts/regeneratePaidManualInvoicePdfs.js --dry-run
//   node scripts/regeneratePaidManualInvoicePdfs.js --backup --dry-run
//   node scripts/regeneratePaidManualInvoicePdfs.js --backup
//   node scripts/regeneratePaidManualInvoicePdfs.js
const DRY_RUN = process.argv.includes("--dry-run");
const BACKUP = process.argv.includes("--backup");
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const backupKeyFor = (key) => `backup/${RUN_STAMP}/${key}`;

async function backupObject(key) {
  const bucket = getBucketName();
  // Fail clearly if there is nothing to back up (CopyObject would also fail,
  // but with a less obvious message).
  await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      // Keys here are plain "manual-invoices/INV-….pdf"; encode defensively.
      CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
      Key: backupKeyFor(key),
    })
  );
}

async function main() {
  await connectDB();

  const invoices = await ManualInvoice.find({ status: "paid" }).sort({ createdAt: 1 });
  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Found ${invoices.length} paid manual invoice(s).` +
      (BACKUP ? ` Backups -> backup/${RUN_STAMP}/` : " No backup (--backup not set).")
  );

  let ok = 0;
  let failed = 0;

  for (const invoice of invoices) {
    if (DRY_RUN) {
      console.log(
        `  would ${BACKUP ? `back up to ${backupKeyFor(invoice.pdfKey)} and ` : ""}regenerate ${invoice.invoiceNumber}  (${invoice.pdfKey})`
      );
      continue;
    }

    if (BACKUP) {
      try {
        await backupObject(invoice.pdfKey);
      } catch (err) {
        failed += 1;
        console.error(`  FAILED backup of ${invoice.invoiceNumber} (${invoice.pdfKey}) — not regenerated: ${err.message}`);
        continue;
      }
    }

    try {
      const { key } = await generateManualInvoicePdfAndUpload({
        invoiceNumber: invoice.invoiceNumber,
        // Same arguments as markManualInvoicePaid: original issue date kept.
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
      if (key !== invoice.pdfKey) {
        // Not expected (key derives from invoiceNumber). Surface it rather
        // than silently leaving the document pointing at the old object.
        console.warn(`  ! ${invoice.invoiceNumber}: new key ${key} differs from stored ${invoice.pdfKey}`);
      }
      ok += 1;
      console.log(`  ${BACKUP ? "backed up + " : ""}regenerated ${invoice.invoiceNumber}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${invoice.invoiceNumber}: ${err.message}`);
    }
  }

  if (!DRY_RUN) console.log(`Done. Regenerated ${ok}, failed ${failed}.`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("Paid manual invoice PDF regeneration failed:", error);
  process.exit(1);
});
