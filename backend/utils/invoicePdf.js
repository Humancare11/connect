const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// const COMPANY_NAME = "Humancare Connect";
const COMPANY_EMAIL = "support@humancareconnect.co";
const COMPANY_PHONE = "+1 (302) 303-9993";
const COMPANY_ADDRESS_LINES = ["4 Peddlers Row, 1091 Newark,", "DE 19702, USA"];

// Backend owns its own copy of the logo (backend/assets/) rather than
// reaching into frontend/src/assets/ — the two are separate deployable
// units and frontend/src won't even exist on a production backend host.
// Read once at module load, not per request; if the file is ever missing
// the invoice still renders — a text wordmark is drawn in its place — so a
// bad deploy of this one asset can never break invoice generation.
const LOGO_PATH = process.env.INVOICE_LOGO_PATH || path.join(__dirname, "..", "assets", "invoice-logo.png");

let LOGO_BUFFER = null;
try {
  LOGO_BUFFER = fs.readFileSync(LOGO_PATH);
} catch {
  console.warn(`[invoice] Logo not found at ${LOGO_PATH} — rendering text wordmark instead.`);
}

// Brand palette — same tokens as the prescription letterhead
// (frontend/src/components/RxSlip.css) so every document a patient
// receives reads as one consistent brand, plus a lighter blue-tinted panel
// shade for the info boxes on this template.
const INK = "#1c2230";
const WHITE = "#ffffff";

// "Document" template palette — the single invoice design used for every
// invoice this app generates: the admin's manual B2B invoices and a
// patient's consultation-payment invoices alike (see drawInvoiceDocument
// below). Token names keep their historical MAN_ prefix (from when this
// template was manual-invoice-only) rather than being renamed wholesale,
// to keep this file's diff scoped to unifying the two render paths.
const MAN_NAVY = "#16305e";
const MAN_CAPTION = "#2f6cb0";
const MAN_GREY_BAND = "#eef0f4";
const MAN_HAIRLINE = "#d5d9e0";
const MAN_RED = "#c0392b";
const MAN_RED_BG = "#fdeced";
const MAN_GREEN = "#0f7047";
const MAN_GREEN_BG = "#edf7f1";
const MAN_INK = "#1c2230";
const MAN_MUTED = "#5b6472";

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495; // A4 width (595.28pt) minus left+right margins
const RIGHT = PAGE_MARGIN + CONTENT_WIDTH;

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

// Trims a quantity like 2.00 down to "2" or 1.50 down to "1.5" — line-item
// quantities are typed with step="0.01" on the form but are whole numbers
// far more often than not, and "2.00" reads as noise on a printed table.
// Rendered in UTC rather than the host's local zone: issuedAt is stored as a
// UTC instant, so formatting it in (say) US/Pacific would print the previous
// day for anything issued in the early-morning UTC hours, and the printed
// date would then disagree with the Invoice document it was built from.
// "Sep 19, 2026" — short-month format used by the Document template.
function formatDateShort(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatQuantity(quantity) {
  const n = Number(quantity) || 0;
  return String(parseFloat(n.toFixed(2)));
}

// e.g. "USD ($)" — derives the symbol from Intl so this stays correct for
// any currency without hand-maintaining a symbol table.
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

// ── Mixed-style text helpers ──────────────────────────────────────────────
// pdfkit doesn't support per-fragment color/weight within one right-aligned
// or centered .text() call, so these measure each fragment's width first
// (via widthOfString) and place them at exact, non-overlapping x offsets.
//
// characterSpacing is passed to widthOfString as well as to text(): pdfkit
// adds it between glyphs when drawing, so leaving it out of the measurement
// under-reports the width and any right-aligned run drawn with spacing (the
// AMOUNT column header) creeps past its right edge.
function segmentWidth(doc, seg) {
  const text = String(seg.text ?? "");
  doc.font(seg.font || "Helvetica").fontSize(seg.size || 10);
  return doc.widthOfString(text, { characterSpacing: seg.spacing || 0 });
}

function measureSegments(doc, segments) {
  let total = 0;
  for (const seg of segments) total += segmentWidth(doc, seg);
  return total;
}

function drawSegmentsAt(doc, segments, x, y) {
  let cursorX = x;
  for (const seg of segments) {
    const text = String(seg.text ?? "");
    const width = segmentWidth(doc, seg);
    doc
      .fillColor(seg.color || INK)
      .text(text, cursorX, y, { lineBreak: false, characterSpacing: seg.spacing || 0 });
    cursorX += width;
  }
}

function rightAlignedSegments(doc, segments, y, rightX = RIGHT) {
  drawSegmentsAt(doc, segments, rightX - measureSegments(doc, segments), y);
}

// Height one string will occupy once wrapped at `width`, in the given font.
// Used to size panels around their contents instead of assuming every value
// is one line — a long transaction reference or a wrapped description would
// otherwise spill past a fixed panel height.
function measureText(doc, text, { font = "Helvetica", size = 10, width }) {
  return doc.font(font).fontSize(size).heightOfString(String(text ?? ""), { width });
}

// Default Notes & Terms per document type/status. `documentType: "manual"`
// is the admin-created B2B invoice (see manualInvoiceService.js); its notes
// are generic billing terms rather than the teleconsultation cancellation
// policy below, since a B2B invoice isn't necessarily for a consultation.
// Exported so manualInvoiceService.js can splice the admin's own "Notes"
// text in ahead of the standard reminders (see buildManualNotes there)
// instead of duplicating this copy.
function defaultManualNotes(status) {
  if (status === "paid") {
    return [
      { bold: "Payment received.", rest: " This receipt confirms that payment for the amount above has been processed." },
      { rest: "Please retain this receipt for your records." },
      { rest: "For any questions about this invoice, please contact support@humancareconnect.co." },
      { rest: "Please quote the invoice number in any correspondence regarding this payment." },
    ];
  }
  return [
    // "the due date above" rather than a hardcoded day count — the actual
    // due date/terms are now shown in the document's meta rows and can be
    // any of the admin's chosen payment terms, not always 15 days.
    { bold: "Payment due.", rest: " Please arrange payment by the due date shown above." },
    { rest: "Payment can be made by bank transfer or another method agreed with Humancare Connect, referencing the invoice number." },
    { rest: "For any questions about this invoice, please contact support@humancareconnect.co." },
    { rest: "Please quote the invoice number in any correspondence regarding this payment." },
  ];
}

// Builds a single-page invoice PDF as a Buffer. All values are rendered via
// pdfkit's text API (never interpolated into HTML/markup), so there is no
// injection surface here — worst case a weird string just prints as-is.
//
// Every invoice — a patient's consultation-payment invoice (documentType:
// "consultation", the default) or the admin's manually-created B2B invoice
// (documentType: "manual" — see manualInvoiceService.js) — renders through
// the same Document template (drawInvoiceDocument below), so the app never
// shows two different invoice designs. A consultation invoice is always
// generated after a verified payment, so it always renders as "paid"; for
// "manual", the caller's `status` ("due" or "paid") controls the Total
// label and the status band.
function buildInvoicePdfBuffer({
  invoiceNumber,
  issuedAt,
  billTo,
  description,
  amountCents,
  currency,
  documentType = "consultation",
  status,
  // "manual" only: itemized lines (each { description, quantity, rate,
  // amountCents }), plus the due date/payment terms shown in the meta rows.
  items,
  dueDate,
  paymentTerms,
}) {
  return new Promise((resolve, reject) => {
    try {
      const isManual = documentType === "manual";
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `Invoice ${invoiceNumber || ""}`.trim(),
          Author: "Humancare Connect",
          Subject: description || (isManual ? "Invoice" : "Consultation booking fee"),
          Creator: "Humancare Connect",
        },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = PAGE_MARGIN;
      const amountDisplay = formatAmount(amountCents, currency);
      const hasItems = Array.isArray(items) && items.length > 0;

      // A consultation invoice is only ever built after a verified payment
      // (see billing.js), so there is no "due" consultation invoice — it
      // always renders as paid. A manual invoice honors whatever status the
      // admin chose ("due" or "paid").
      drawInvoiceDocument(doc, {
        invoiceNumber,
        issuedAt,
        billTo,
        description,
        amountCents,
        amountDisplay,
        currency,
        status: isManual ? status : "paid",
        items,
        hasItems,
        dueDate,
        paymentTerms,
        left,
        isManual,
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Invoice "Document" template ──────────────────────────────────────────
// The single rendering path for every invoice PDF this app produces: the
// admin's manual B2B invoices and a patient's consultation-payment
// invoices both draw through here (see the buildInvoicePdfBuffer callers
// above) — there is no second template to keep in sync.
//
// All values are drawn via pdfkit's text API, never interpolated into
// markup, so there is no injection surface here.
function drawInvoiceDocument(doc, ctx) {
  const { invoiceNumber, issuedAt, billTo, description, amountDisplay, currency, status, items, hasItems, dueDate, paymentTerms, left, isManual } = ctx;

  const isPaid = status === "paid";

  // ── Logo + title ──
  const logoY = 30;
  const logoHeight = 74;

  if (LOGO_BUFFER) {
    doc.image(LOGO_BUFFER, left, logoY, { height: logoHeight });
  } else {
    doc.font("Times-Bold").fontSize(20).fillColor(MAN_NAVY).text("Humancare Connect", left, logoY, { lineBreak: false });
  }

  doc.font("Times-Bold").fontSize(24).fillColor(MAN_NAVY).text("INVOICE", left, logoY, { width: CONTENT_WIDTH, align: "right" });
  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor(MAN_MUTED)
    .text(`# ${invoiceNumber || ""}`, left, logoY + 30, { width: CONTENT_WIDTH, align: "right" });

  // ── Rule ──
  let y = logoY + logoHeight + 18;
  doc.rect(left, y, CONTENT_WIDTH, 2).fill(MAN_NAVY);
  y += 24;

  // ── FROM / BILL TO ──
  const colGap = 24;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const fromX = left;
  const billX = left + colWidth + colGap;
  const captionY = y;

  doc.font("Times-Bold").fontSize(8.5).fillColor(MAN_CAPTION).text("FROM", fromX, captionY, { characterSpacing: 0.5 });
  doc.font("Times-Bold").fontSize(8.5).fillColor(MAN_CAPTION).text("BILL TO", billX, captionY, { characterSpacing: 0.5 });

  let fromY = captionY + 16;
  doc.font("Times-Bold").fontSize(11).fillColor(MAN_INK).text("Humancare Connect, Inc.", fromX, fromY, { width: colWidth });
  fromY = doc.y + 4;
  doc.font("Times-Roman").fontSize(9.5).fillColor(MAN_MUTED);
  for (const line of [...COMPANY_ADDRESS_LINES, COMPANY_PHONE, COMPANY_EMAIL]) {
    doc.text(line, fromX, fromY, { width: colWidth });
    fromY = doc.y + 1;
  }

  // Company name first if present, else the contact's own name carries the
  // bold line — a manual invoice with no company on file still gets a
  // sensible BILL TO block instead of a blank bold line.
  const hasCompany = Boolean(billTo?.company);
  const billLines = [{ text: hasCompany ? billTo.company : billTo?.name || "—", font: "Times-Bold", size: 11, color: MAN_INK, gap: 4 }];
  if (hasCompany && billTo?.name) billLines.push({ text: billTo.name, font: "Times-Roman", size: 9.5, color: MAN_MUTED, gap: 1 });
  if (billTo?.email) billLines.push({ text: billTo.email, font: "Times-Roman", size: 9.5, color: MAN_MUTED, gap: 1 });
  if (billTo?.address) billLines.push({ text: billTo.address, font: "Times-Roman", size: 9.5, color: MAN_MUTED, gap: 1 });
  const locality = [billTo?.country, billTo?.postalCode].filter(Boolean).join(" · ");
  if (locality) billLines.push({ text: locality, font: "Times-Roman", size: 9.5, color: MAN_MUTED, gap: 1 });
  if (billTo?.registrationNumber) billLines.push({ text: `Reg. No. ${billTo.registrationNumber}`, font: "Times-Roman", size: 9.5, color: MAN_MUTED, gap: 1 });

  let billY = captionY + 16;
  for (const line of billLines) {
    doc.font(line.font).fontSize(line.size).fillColor(line.color).text(line.text, billX, billY, { width: colWidth });
    billY = doc.y + line.gap;
  }

  y = Math.max(fromY, billY) + 12;

  // ── Meta strip: Issue Date | [Due Date | Payment Terms —  manual only] | Currency ──
  // A patient's consultation invoice is always paid in full at booking time,
  // so a due date/payment terms are meaningless on it — only the admin's
  // manual (B2B, may be "due") invoice shows those two columns.
  const metaCols = [{ label: "ISSUE DATE", value: formatDateShort(issuedAt), bold: false }];
  if (isManual) {
    metaCols.push({ label: "DUE DATE", value: dueDate ? formatDateShort(dueDate) : "—", bold: true });
    metaCols.push({ label: "PAYMENT TERMS", value: paymentTerms || "—", bold: false });
  }
  metaCols.push({ label: "CURRENCY", value: currencyLabel(currency), bold: false });
  const colW = CONTENT_WIDTH / metaCols.length;
  doc.rect(left, y, CONTENT_WIDTH, 20).fill(MAN_GREY_BAND);
  metaCols.forEach((col, i) => {
    doc
      .font("Times-Bold")
      .fontSize(7.5)
      .fillColor(MAN_MUTED)
      .text(col.label, left + i * colW + 10, y + 6, { characterSpacing: 0.3, width: colW - 16, lineBreak: false });
  });
  y += 20;
  metaCols.forEach((col, i) => {
    doc
      .font(col.bold ? "Times-Bold" : "Times-Roman")
      .fontSize(9.5)
      .fillColor(col.bold ? MAN_NAVY : MAN_INK)
      .text(col.value, left + i * colW + 10, y + 6, { width: colW - 16, lineBreak: false });
  });
  y += 20 + 22;

  // ── Line-item table (paginates: the header bar is redrawn on any new
  // page the rows spill onto, so it never ends up alone at a page bottom) ──
  // QTY/RATE only apply to a manual invoice's itemized breakdown — a
  // consultation invoice is always a single flat fee, so those columns (and
  // their header labels) are dropped for it and DESCRIPTION simply takes
  // the extra width.
  const amountColW = 90;
  const rateColW = 80;
  const qtyColW = 50;
  const amountColRight = RIGHT - 14;
  const rateColRight = amountColRight - amountColW - 12;
  const qtyColLeft = rateColRight - rateColW - 12 - qtyColW;
  const descWidth = (isManual ? qtyColLeft - 12 : amountColRight - amountColW - 12) - (left + 14);

  function drawTableHeader(headerY) {
    doc.rect(left, headerY, CONTENT_WIDTH, 24).fill(MAN_NAVY);
    doc.font("Times-Bold").fontSize(9.5).fillColor(WHITE).text("DESCRIPTION", left + 14, headerY + 7, { characterSpacing: 0.3, lineBreak: false });
    if (isManual) {
      doc.font("Times-Bold").fontSize(9.5).fillColor(WHITE).text("QTY", qtyColLeft, headerY + 7, { width: qtyColW, align: "center" });
      doc
        .font("Times-Bold")
        .fontSize(9.5)
        .fillColor(WHITE)
        .text("RATE", rateColRight - rateColW, headerY + 7, { width: rateColW, align: "right" });
    }
    doc
      .font("Times-Bold")
      .fontSize(9.5)
      .fillColor(WHITE)
      .text("AMOUNT", amountColRight - amountColW, headerY + 7, { width: amountColW, align: "right" });
    return headerY + 24;
  }

  const PAGE_BOTTOM = doc.page.height - PAGE_MARGIN;
  let rowY = drawTableHeader(y) + 12;

  function drawRow({ descText, qtyText, rateText, amountText, boldDesc }) {
    const rowH = Math.max(16, measureText(doc, descText, { font: boldDesc ? "Times-Bold" : "Times-Roman", size: 9.5, width: descWidth }));
    if (rowY + rowH + 14 > PAGE_BOTTOM - 30) {
      doc.addPage();
      rowY = drawTableHeader(PAGE_MARGIN) + 12;
    }
    doc
      .font(boldDesc ? "Times-Bold" : "Times-Roman")
      .fontSize(9.5)
      .fillColor(MAN_INK)
      .text(descText, left + 14, rowY, { width: descWidth });
    if (qtyText !== null) doc.font("Times-Roman").fontSize(9.5).fillColor(MAN_INK).text(qtyText, qtyColLeft, rowY, { width: qtyColW, align: "center" });
    if (rateText !== null) doc.font("Times-Roman").fontSize(9.5).fillColor(MAN_INK).text(rateText, rateColRight - rateColW, rowY, { width: rateColW, align: "right" });
    doc.font("Times-Bold").fontSize(9.5).fillColor(MAN_INK).text(amountText, amountColRight - amountColW, rowY, { width: amountColW, align: "right" });
    rowY += rowH + 10;
    doc.rect(left + 14, rowY - 5, CONTENT_WIDTH - 28, 0.75).fill(MAN_HAIRLINE);
  }

  if (hasItems) {
    for (const item of items) {
      drawRow({
        descText: item.description || "",
        qtyText: formatQuantity(item.quantity),
        rateText: formatAmount(Math.round((Number(item.rate) || 0) * 100), currency),
        amountText: formatAmount(item.amountCents, currency),
        boldDesc: false,
      });
    }
  } else {
    // The direct user-facing (consultation) invoice always shows a fixed
    // "Tele Consultation" line, regardless of the booking's own internal
    // description — the admin's manual-invoice fallback text is untouched.
    drawRow({
      descText: isManual ? description || "Consultation booking fee" : "Tele Consultation",
      qtyText: null,
      rateText: null,
      amountText: amountDisplay,
      boldDesc: true,
    });
  }

  y = rowY + 10;

  // ── Total box ──
  const totalBoxW = 220;
  const totalBoxX = RIGHT - totalBoxW;
  const totalBoxH = 34;
  if (y + totalBoxH > PAGE_BOTTOM - 140) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.rect(totalBoxX, y, totalBoxW, totalBoxH).fill(MAN_GREY_BAND);
  doc.font("Times-Roman").fontSize(10).fillColor(MAN_INK).text(isPaid ? "Total Paid:" : "Total Due:", totalBoxX + 14, y + 11, { lineBreak: false });
  rightAlignedSegments(doc, [{ text: amountDisplay, size: 13, color: MAN_NAVY, font: "Times-Bold" }], y + 9, totalBoxX + totalBoxW - 14);
  y += totalBoxH + 20;

  // ── Status band ──
  const bandColor = isPaid ? MAN_GREEN : MAN_RED;
  const bandBg = isPaid ? MAN_GREEN_BG : MAN_RED_BG;
  const bandText = isPaid ? "STATUS: PAID — Payment received in full. No balance outstanding." : "STATUS: UNPAID — Payment is outstanding and due.";
  const bandH = 30;
  doc.rect(left, y, CONTENT_WIDTH, bandH).fill(bandBg);
  doc.rect(left, y, 4, bandH).fill(bandColor);
  doc.font("Times-Bold").fontSize(10).fillColor(bandColor).text(bandText, left + 16, y + 10, { width: CONTENT_WIDTH - 30, lineBreak: false });
  y += bandH + 22;

  // ── Terms ── manual (admin) invoices only — a consultation invoice is
  // always paid in full already, so due-date/payment-terms language would
  // be meaningless (and this whole section, including its "Payment Due
  // Date"/"Payment Terms" lines, is dropped for it).
  if (isManual) {
    doc.font("Times-Bold").fontSize(8.5).fillColor(MAN_CAPTION).text("TERMS", left, y, { characterSpacing: 0.5 });
    y += 14;

    // Mirrors the admin form's own preview copy (ManualInvoices.jsx) so the
    // printed PDF never disagrees with what the admin saw before sending.
    const termsLine =
      !paymentTerms || paymentTerms === "Due on Receipt"
        ? "Payment is due immediately on receipt of this invoice. Please remit payment for the amount above without delay."
        : `Payment is due within ${String(paymentTerms).replace(/\D/g, "")} days from the invoice date (${String(paymentTerms).replace(" Days", "")}). Please remit payment for the amount above by the due date indicated.`;
    doc.font("Times-Roman").fontSize(9.5).fillColor(MAN_INK).text(termsLine, left, y, { width: CONTENT_WIDTH, lineGap: 1.5 });
    y = doc.y + 10;

    drawSegmentsAt(
      doc,
      [
        { text: "Payment Due Date: ", font: "Times-Bold", size: 9.5, color: MAN_INK },
        { text: dueDate ? formatDateShort(dueDate) : "—", font: "Times-Roman", size: 9.5, color: MAN_INK },
      ],
      left,
      y
    );
    y += 15;
    drawSegmentsAt(
      doc,
      [
        { text: "Payment Terms: ", font: "Times-Bold", size: 9.5, color: MAN_INK },
        { text: paymentTerms || "—", font: "Times-Roman", size: 9.5, color: MAN_INK },
      ],
      left,
      y
    );
    y += 22;
  }

  // `description` already appears as the single line item above when there's
  // no item breakdown (the consultation case) — reusing it here too would
  // print the same text twice, so only a manual invoice's closing note
  // (paired with a real item table) echoes it; a consultation invoice gets
  // the brand's standard thank-you line instead.
  const closingText = hasItems
    ? description && String(description).trim()
      ? String(description).trim()
      : "Thank you for your business."
    : "Thank you for choosing Humancare Connect — your Global Health Passport.";
  doc.font("Times-Italic").fontSize(9.5).fillColor(MAN_MUTED).text(closingText, left, y, { width: CONTENT_WIDTH, lineGap: 1.5 });
  y = doc.y + 16;

  // ── Footer ──
  const footerY = Math.max(y, doc.page.height - PAGE_MARGIN - 30);
  doc.rect(left, footerY, CONTENT_WIDTH, 1).fill(MAN_HAIRLINE);
  const footerText = `Humancare Connect  |  24/7 Support: ${COMPANY_EMAIL}  |  ${COMPANY_ADDRESS_LINES.join(" ")}  |  ${COMPANY_PHONE}`;
  doc.font("Times-Roman").fontSize(8).fillColor(MAN_MUTED).text(footerText, left, footerY + 12, { width: CONTENT_WIDTH, align: "center" });
}

module.exports = { buildInvoicePdfBuffer, formatAmount, defaultManualNotes };