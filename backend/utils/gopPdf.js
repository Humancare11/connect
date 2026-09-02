const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Same brand contact block every other generated document in this app
// prints (see invoicePdf.js) — duplicated rather than imported so this
// template can never be perturbed by, or accidentally perturb, the invoice
// template. The two are visually unrelated documents that happen to share
// a return address.
const COMPANY_EMAIL = "support@humancareconnect.co";
const COMPANY_PHONE = "+1 (302) 303-9993";
const COMPANY_ADDRESS_LINES = ["4 Peddlers Row, 1091 Newark,", "DE 19702, USA"];

const LOGO_PATH = process.env.INVOICE_LOGO_PATH || path.join(__dirname, "..", "assets", "invoice-logo.png");
let LOGO_BUFFER = null;
try {
  LOGO_BUFFER = fs.readFileSync(LOGO_PATH);
} catch {
  console.warn(`[gop] Logo not found at ${LOGO_PATH} — rendering text wordmark instead.`);
}

// Palette matches the Admin Dashboard's own tokens (ManualInvoices.css
// --mi-navy / --mi-blue / --mi-blue-soft) so the printed GOP reads as the
// same product as the on-screen form it comes from.
const NAVY = "#16305e";
const CAPTION = "#2f6cb0";
const LABEL_BG = "#eaf1fa";
const BORDER = "#c9d3e0";
const INK = "#1c2230";
const MUTED = "#5b6472";
const HAIRLINE = "#d9dee7";

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495; // A4 width (595.28pt) minus left+right margins
const LABEL_COL_WIDTH = 165;
const CELL_PAD_X = 10;
const CELL_PAD_Y = 7;

function formatAmount(amountCents, currency = "usd") {
  const amount = (Number(amountCents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${String(currency || "USD").toUpperCase()} ${amount.toFixed(2)}`;
  }
}

// e.g. "USD ($)" — prints the currency explicitly (not just implied by the
// $/€ symbol already embedded in the formatted amount), same convention as
// the Manual Invoice template's own meta strip.
function currencyLabel(currency) {
  const code = String(currency || "usd").toUpperCase();
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === "currency")?.value;
    return symbol && symbol !== code ? `${code} (${symbol})` : code;
  } catch {
    return code;
  }
}

// "August 22, 2026"
function formatDateLong(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "03.08.1988" — matches the reference document's DD.MM.YYYY convention for
// a date of birth, distinct from the long-form issue date above.
function formatDob(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

function measureText(doc, text, { font = "Helvetica", size = 10, width }) {
  return doc.font(font).fontSize(size).heightOfString(String(text ?? ""), { width });
}

// Adds a page and resets to the top margin if `needed` more points won't
// fit above the footer's reserved band — called before any block whose
// height depends on admin-typed free text (the two paragraph fields),
// since those are the only sections here that can grow unpredictably.
function ensureSpace(doc, y, needed) {
  const bottom = doc.page.height - PAGE_MARGIN - 48;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return PAGE_MARGIN;
}

// A bold navy section number + title, underlined by a short accent rule —
// "1. Patient Information" etc.
function drawSectionCaption(doc, { y, left, title }) {
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(NAVY).text(title, left, y, { width: CONTENT_WIDTH });
  const afterY = doc.y + 4;
  doc.rect(left, afterY, CONTENT_WIDTH, 1.5).fill(CAPTION);
  return afterY + 14;
}

// A bordered label/value table: label cells shaded, value cells white,
// every row full width — the reference document's recurring "fact table"
// (meta strip, Patient Information, Service Provider).
function drawInfoTable(doc, { y, left, rows }) {
  const valueColX = left + LABEL_COL_WIDTH;
  const valueColWidth = CONTENT_WIDTH - LABEL_COL_WIDTH;
  let rowY = y;

  for (const [label, value] of rows) {
    const labelH = measureText(doc, label, { font: "Helvetica-Bold", size: 9.5, width: LABEL_COL_WIDTH - CELL_PAD_X * 2 });
    const valueH = measureText(doc, value || "—", { font: "Helvetica", size: 9.5, width: valueColWidth - CELL_PAD_X * 2 });
    const rowH = Math.max(labelH, valueH) + CELL_PAD_Y * 2;

    doc.rect(left, rowY, LABEL_COL_WIDTH, rowH).fillAndStroke(LABEL_BG, BORDER);
    doc.rect(valueColX, rowY, valueColWidth, rowH).fillAndStroke("#ffffff", BORDER);

    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(NAVY)
      .text(label, left + CELL_PAD_X, rowY + CELL_PAD_Y, { width: LABEL_COL_WIDTH - CELL_PAD_X * 2 });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(INK)
      .text(value || "—", valueColX + CELL_PAD_X, rowY + CELL_PAD_Y, { width: valueColWidth - CELL_PAD_X * 2 });

    rowY += rowH;
  }

  return rowY;
}

// Builds a single Guarantee of Payment PDF as a Buffer. All values are
// rendered via pdfkit's text API (never interpolated into HTML/markup), so
// there is no injection surface here.
function buildGopPdfBuffer({
  gopNumber,
  issuedAt,
  caseType,
  patient,
  requestedService,
  provider,
  amountCents,
  currency,
  authorizedByName,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `Guarantee of Payment ${gopNumber || ""}`.trim(),
          Author: "Humancare Connect",
          Subject: "Case Initiation & Payment Authorization",
          Creator: "Humancare Connect",
        },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = PAGE_MARGIN;
      const amountDisplay = formatAmount(amountCents, currency);
      let y = 36;

      // ── Logo (centered) ──
      const logoWidth = 150;
      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, left + CONTENT_WIDTH / 2 - logoWidth / 2, y, { width: logoWidth });
        y += 66;
      } else {
        doc.font("Helvetica-Bold").fontSize(16).fillColor(NAVY).text("Humancare Connect", left, y, { width: CONTENT_WIDTH, align: "center" });
        y += 30;
      }

      // ── Title + subtitle ──
      doc.font("Helvetica-Bold").fontSize(19).fillColor(NAVY).text("CASE INITIATION & PAYMENT AUTHORIZATION", left, y, {
        width: CONTENT_WIDTH,
        align: "center",
      });
      y = doc.y + 4;
      doc
        .font("Helvetica-Oblique")
        .fontSize(11)
        .fillColor(MUTED)
        .text(`${caseType} — Authorization to Proceed`, left, y, { width: CONTENT_WIDTH, align: "center" });
      y = doc.y + 16;

      doc.rect(left, y, CONTENT_WIDTH, 2).fill(NAVY);
      y += 20;

      // ── Meta table ──
      y = drawInfoTable(doc, {
        y,
        left,
        rows: [
          ["Date Issued:", formatDateLong(issuedAt)],
          ["Case Type:", caseType],
          ["Currency:", currencyLabel(currency)],
          ["Status:", "AUTHORIZED"],
        ],
      });
      y += 20;

      // ── 1. Patient Information ──
      y = drawSectionCaption(doc, { y, left, title: "1. Patient Information" });
      y = drawInfoTable(doc, {
        y,
        left,
        rows: [
          ["Name:", patient?.name],
          ["Date of Birth:", formatDob(patient?.dob)],
          ["Telephone:", patient?.phone],
          ["Patient Location:", patient?.location],
        ],
      });
      y += 22;

      // ── 2. Patient Complaint ──
      const complaintText = patient?.complaint?.trim() || "—";
      const complaintH = measureText(doc, complaintText, { size: 10, width: CONTENT_WIDTH });
      y = ensureSpace(doc, y, 24 + complaintH);
      y = drawSectionCaption(doc, { y, left, title: "2. Patient Complaint" });
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(complaintText, left, y, { width: CONTENT_WIDTH, lineGap: 2 });
      y = doc.y + 22;

      // ── 3. Requested Service ──
      const serviceText = requestedService?.trim() || "—";
      const serviceH = measureText(doc, serviceText, { size: 10, width: CONTENT_WIDTH });
      y = ensureSpace(doc, y, 24 + serviceH);
      y = drawSectionCaption(doc, { y, left, title: "3. Requested Service" });
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(serviceText, left, y, { width: CONTENT_WIDTH, lineGap: 2 });
      y = doc.y + 22;

      // ── 4. Service Provider ──
      y = ensureSpace(doc, y, 24 + 4 * 30);
      y = drawSectionCaption(doc, { y, left, title: "4. Service Provider" });
      y = drawInfoTable(doc, {
        y,
        left,
        rows: [
          ["Provider:", provider?.name],
          ["Contact:", provider?.contact],
          ["Clinic Address:", provider?.address],
          ["Email:", provider?.email],
        ],
      });
      y += 22;

      // ── 5. Payment Authorization ──
      y = ensureSpace(doc, y, 140);
      y = drawSectionCaption(doc, { y, left, title: "5. Payment Authorization" });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(NAVY)
        .text(`Agreed Payment for ${caseType}: ${amountDisplay}`, left, y, { width: CONTENT_WIDTH });
      y = doc.y + 12;

      const authText1 = `Humancare Connect, Inc. is authorized to pay ${provider?.name || "the provider"} only for the service described above, at the agreed amount of ${amountDisplay}. No additional or extra payment is authorized without prior written pre-approval from Humancare Connect, Inc.`;
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(authText1, left, y, { width: CONTENT_WIDTH, lineGap: 2 });
      y = doc.y + 10;

      const authText2 = `Payment of ${amountDisplay} will be made to ${provider?.name || "the provider"} immediately upon completion of the service, via payment link, once the required documentation described below has been received.`;
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(authText2, left, y, { width: CONTENT_WIDTH, lineGap: 2 });
      y = doc.y + 22;

      // ── 6. Required Documentation for Payment Release ──
      y = ensureSpace(doc, y, 70);
      y = drawSectionCaption(doc, { y, left, title: "6. Required Documentation for Payment Release" });
      const REQUIRED_DOCS = [
        "Medical report confirming examination of the patient and services rendered.",
        "Copy of any prescription issued to the patient (if applicable).",
      ];
      for (const [index, item] of REQUIRED_DOCS.entries()) {
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(`${index + 1}.`, left, y, { width: 18, lineBreak: false });
        doc.text(item, left + 18, y, { width: CONTENT_WIDTH - 18, lineGap: 2 });
        y = doc.y + 6;
      }
      y += 14;

      // ── 7. Issuer ──
      y = ensureSpace(doc, y, 90);
      y = drawSectionCaption(doc, { y, left, title: "7. Issuer" });
      doc.font("Helvetica").fontSize(10).fillColor(INK).text("Authorized by:", left, y);
      y = doc.y + 6;
      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(authorizedByName || "Humancare Connect", left, y);
      y = doc.y + 6;
      doc.rect(left, y, 240, 1).fill(HAIRLINE); // signature underline
      y += 10;
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Humancare Connect, Inc.", left, y);
      y = doc.y + 24;

      // ── Footer ──
      const footerY = Math.max(y, doc.page.height - PAGE_MARGIN - 34);
      doc.rect(left, footerY, CONTENT_WIDTH, 1).fill(HAIRLINE);
      doc
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text("Humancare Connect, Inc. — Confidential Case Authorization Document", left, footerY + 12, {
          width: CONTENT_WIDTH,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${COMPANY_ADDRESS_LINES.join(" ")}  |  ${COMPANY_PHONE}  |  ${COMPANY_EMAIL}  |  GOP # ${gopNumber || ""}`,
          left,
          footerY + 24,
          { width: CONTENT_WIDTH, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildGopPdfBuffer, formatAmount };
