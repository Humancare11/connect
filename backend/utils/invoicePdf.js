const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// const COMPANY_NAME = "Humancare Connect";
const COMPANY_EMAIL = "support@humancareconnect.co";
const COMPANY_WEB = "humancareconnect.co";
const COMPANY_PHONE = "+1 (302) 303-9993";
const COMPANY_ADDRESS_LINES = ["4 Peddlers Row, 1091 Newark,", "DE 19702, USA"];

// Backend owns its own copy of the logo (backend/assets/) rather than
// reaching into frontend/src/assets/ — the two are separate deployable
// units and frontend/src won't even exist on a production backend host.
// Read once at module load, not per request; if the file is ever missing
// the invoice still renders — a text wordmark is drawn in its place — so a
// bad deploy of this one asset can never break invoice generation.
const LOGO_PATH = process.env.INVOICE_LOGO_PATH || path.join(__dirname, "..", "assets", "invoice-logo.png");
const LOGO_ASPECT_RATIO = 225 / 90; // source Logo.png is 225x90

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
const NAVY = "#12296b";
const ACCENT = "#3f6fd8";
const INK = "#1c2230";
const MUTED = "#667085";
const LINE = "#e2e6f0";
const PANEL_BLUE = "#eef2fc";
const WHITE = "#ffffff";

// Manual-invoice ("Document" template) palette — a deliberate departure from
// the consultation template's NAVY/ACCENT/PANEL_BLUE above, not a variant of
// it, so it gets its own token names rather than reusing/overloading those.
// Kept separate so nothing here can ever change what the consultation
// branch renders.
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

// Shared spacing tokens, so the vertical rhythm between panels is set in one
// place instead of being re-typed as a different magic number at each call
// site. PANEL_PAD is used as both the top and bottom inset of every panel,
// which is what makes their contents look optically centred.
const PANEL_PAD = 14;
const PANEL_GUTTER = 22; // breathing room between two stacked blocks
const FOOTER_BLOCK_H = 56; // rule + two centered lines

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

// Rendered in UTC rather than the host's local zone: issuedAt is stored as a
// UTC instant, so formatting it in (say) US/Pacific would print the previous
// day for anything issued in the early-morning UTC hours, and the printed
// date would then disagree with the Invoice document it was built from.
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Trims a quantity like 2.00 down to "2" or 1.50 down to "1.5" — line-item
// quantities are typed with step="0.01" on the form but are whole numbers
// far more often than not, and "2.00" reads as noise on a printed table.
// "Sep 19, 2026" — short-month variant used only by the manual-invoice
// ("Document" template) layout; the consultation template keeps the
// long-month formatDate above untouched.
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

function centeredSegments(doc, segments, y, centerX = RIGHT / 2 + PAGE_MARGIN / 2) {
  drawSegmentsAt(doc, segments, centerX - measureSegments(doc, segments) / 2, y);
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

function defaultNotes(documentType, status) {
  if (documentType === "manual") return defaultManualNotes(status);

  return [
    { bold: "Booking confirmed.", rest: " Booking details have been sent to the email address provided above." },
    { rest: "For all regular bookings, rescheduling or cancellation requests must be made at least 12 hours before the scheduled consultation time." },
    { rest: "Urgent consultations are subject to availability and cannot be rescheduled or cancelled once the consultation has started." },
    { rest: "Once the consultation has started, cancellation and refunds are not applicable." },
    { rest: "Please quote the invoice number in any correspondence regarding this payment." },
  ];
}

// Builds a single-page invoice PDF as a Buffer. All values are rendered via
// pdfkit's text API (never interpolated into HTML/markup), so there is no
// injection surface here — worst case a weird string just prints as-is.
//
// documentType: "consultation" (default, unchanged behavior — a patient's
// verified Stripe/PayPal payment, shown with a Payment Details panel) or
// "manual" (an admin-created B2B invoice — see manualInvoiceService.js),
// which never shows that panel. For "manual", `status` ("due" or "paid")
// controls the Total label ("Amount Due" vs "Total Paid"). `notes`
// optionally overrides the default Notes & Terms.
function buildInvoicePdfBuffer({
  invoiceNumber,
  issuedAt,
  billTo,
  description,
  amountCents,
  currency,
  gateway,
  gatewayReference,
  documentType = "consultation",
  status,
  notes,
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
      const hasItems = isManual && Array.isArray(items) && items.length > 0;

      // Manual invoices get a fully separate rendering path (drawManualInvoice,
      // defined below) — isolated here rather than interleaved with the
      // consultation drawing so that branch below is never touched by this
      // template and stays byte-identical to before this change.
      if (isManual) {
        drawManualInvoice(doc, {
          invoiceNumber,
          issuedAt,
          billTo,
          description,
          amountCents,
          amountDisplay,
          currency,
          status,
          items,
          hasItems,
          dueDate,
          paymentTerms,
          left,
        });
        doc.end();
        return;
      }

      // ── Top bar ──
      doc.rect(0, 0, doc.page.width, 8).fill(NAVY);

      // ── Logo ── (real brand asset — see LOGO_PATH above — placed directly
      // with no synthetic frame/box around it, same as how the prescription
      // slip and email templates place the logo image on their own)
      const logoY = 30;
      const logoWidth = 150;
      const logoHeight = LOGO_BUFFER ? logoWidth / LOGO_ASPECT_RATIO : 22;

      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, left, logoY, { width: logoWidth });
      } else {
        doc.font("Helvetica-Bold").fontSize(18).fillColor(NAVY).text("Humancare Connect", left, logoY, { lineBreak: false });
      }

      // ── Title + meta (right side) ──
      // Anchored to `left` + CONTENT_WIDTH rather than x=0, so the title's
      // right edge is the same content edge every other right-aligned run
      // uses instead of depending on pdfkit's page-margin defaults.
      doc
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor(NAVY)
        .text("INVOICE", left, 30, { width: CONTENT_WIDTH, align: "right" });

      const META_ROWS = [
        ["Invoice No.  ", invoiceNumber],
        ["Issue Date  ", formatDate(issuedAt)],
      ];
      if (isManual && dueDate) META_ROWS.push(["Due Date  ", formatDate(dueDate)]);
      if (isManual && paymentTerms) META_ROWS.push(["Terms  ", paymentTerms]);
      META_ROWS.push(["Currency  ", currencyLabel(currency)]);
      let metaY = 66;
      for (const [metaLabel, metaValue] of META_ROWS) {
        rightAlignedSegments(
          doc,
          [
            { text: metaLabel, size: 9, color: MUTED, font: "Helvetica" },
            { text: metaValue, size: 9.5, color: NAVY, font: "Helvetica-Bold" },
          ],
          metaY
        );
        metaY += 14;
      }

      // ── Company block ──
      let cy = logoY + logoHeight + 28;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text("Humancare Connect", left, cy);
      cy += 16;
      doc.font("Helvetica").fontSize(9).fillColor(MUTED);
      for (const line of [...COMPANY_ADDRESS_LINES, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_WEB]) {
        doc.text(line, left, cy);
        cy += 12;
      }

      // ── Billed To panel ──
      // Positioned from whichever column actually ends lower rather than a
      // hardcoded y: the left column's height moves with the logo (and
      // collapses entirely on the text-wordmark fallback), so a fixed value
      // is either cramped or gapped depending on which branch ran.
      const billToY = Math.max(cy, metaY) + PANEL_GUTTER;
      const panelTextWidth = CONTENT_WIDTH - 32;

      const nameText = billTo?.name || "Patient";
      const emailText = billTo?.email || "";
      const companyText = billTo?.company || "";
      const registrationText = billTo?.registrationNumber ? `Reg. No. ${billTo.registrationNumber}` : "";
      const addressText = billTo?.address || "";
      const localityText = [billTo?.country, billTo?.postalCode].filter(Boolean).join(" · ");

      // Stacked top-to-bottom: name always first, the rest only when present
      // — a manual invoice with no company/address on file still renders a
      // tight panel instead of empty lines.
      const billToLines = [{ text: nameText, font: "Helvetica-Bold", size: 13, color: NAVY, gapBefore: 0 }];
      if (companyText) billToLines.push({ text: companyText, font: "Helvetica-Bold", size: 10, color: INK, gapBefore: 5 });
      if (emailText) billToLines.push({ text: emailText, font: "Helvetica", size: 10, color: ACCENT, gapBefore: 5 });
      if (addressText) billToLines.push({ text: addressText, font: "Helvetica", size: 9, color: MUTED, gapBefore: 6 });
      if (localityText) billToLines.push({ text: localityText, font: "Helvetica", size: 9, color: MUTED, gapBefore: 2 });
      if (registrationText) billToLines.push({ text: registrationText, font: "Helvetica", size: 9, color: MUTED, gapBefore: 2 });

      const billToLinesHeight = billToLines.reduce(
        (sum, line) => sum + line.gapBefore + measureText(doc, line.text, { font: line.font, size: line.size, width: panelTextWidth }),
        0
      );
      const LABEL_LINE_H = 12; // approx height of the 8.5pt "BILLED TO" label
      const billToHeight = PANEL_PAD + LABEL_LINE_H + 16 + billToLinesHeight + PANEL_PAD;

      doc.roundedRect(left, billToY, CONTENT_WIDTH, billToHeight, 10).fill(PANEL_BLUE);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("BILLED TO", left + 16, billToY + PANEL_PAD, { characterSpacing: 0.5 });
      let billToLineY = billToY + PANEL_PAD + 16;
      for (const line of billToLines) {
        billToLineY += line.gapBefore;
        doc.font(line.font).fontSize(line.size).fillColor(line.color).text(line.text, left + 16, billToLineY, { width: panelTextWidth });
        billToLineY = doc.y;
      }

      // ── Line item table ──
      const tableY = billToY + billToHeight + PANEL_GUTTER;
      doc.rect(left, tableY, CONTENT_WIDTH, 26).fill(NAVY);

      let lastRowBottom;

      if (hasItems) {
        // Fixed-width QTY/RATE/AMOUNT columns, right-aligned; DESCRIPTION
        // takes whatever's left so it's the only column that wraps.
        const amountColRight = RIGHT - 16;
        const rateColRight = amountColRight - 85 - 14;
        const qtyColRight = rateColRight - 65 - 14;
        const itemDescWidth = qtyColRight - 45 - 14 - (left + 16);

        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(WHITE).text("DESCRIPTION", left + 16, tableY + 9, { characterSpacing: 0.4 });
        rightAlignedSegments(doc, [{ text: "QTY", size: 9.5, color: WHITE, font: "Helvetica-Bold", spacing: 0.4 }], tableY + 9, qtyColRight);
        rightAlignedSegments(doc, [{ text: "RATE", size: 9.5, color: WHITE, font: "Helvetica-Bold", spacing: 0.4 }], tableY + 9, rateColRight);
        rightAlignedSegments(doc, [{ text: "AMOUNT", size: 9.5, color: WHITE, font: "Helvetica-Bold", spacing: 0.4 }], tableY + 9, amountColRight);

        let rowY = tableY + 26 + 14;
        items.forEach((item, index) => {
          const rowDescText = item.description || "";
          const rowDescH = measureText(doc, rowDescText, { font: "Helvetica-Bold", size: 10, width: itemDescWidth });

          doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(rowDescText, left + 16, rowY, { width: itemDescWidth });
          rightAlignedSegments(doc, [{ text: formatQuantity(item.quantity), size: 10, color: INK, font: "Helvetica" }], rowY, qtyColRight);
          rightAlignedSegments(
            doc,
            [{ text: formatAmount(Math.round((Number(item.rate) || 0) * 100), currency), size: 10, color: INK, font: "Helvetica" }],
            rowY,
            rateColRight
          );
          rightAlignedSegments(
            doc,
            [{ text: formatAmount(item.amountCents, currency), size: 10, color: INK, font: "Helvetica-Bold" }],
            rowY,
            amountColRight
          );

          rowY += rowDescH + 12;
          if (index < items.length - 1) {
            doc.rect(left + 16, rowY - 6, CONTENT_WIDTH - 32, 0.75).fill(LINE);
          }
        });
        lastRowBottom = rowY;
      } else {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(WHITE).text("DESCRIPTION", left + 16, tableY + 9, { characterSpacing: 0.4 });
        rightAlignedSegments(doc, [{ text: "AMOUNT", size: 9.5, color: WHITE, font: "Helvetica-Bold", spacing: 0.4 }], tableY + 9, RIGHT - 16);

        const itemY = tableY + 26 + 16;
        const descriptionText = description || "Consultation booking fee";
        // Wide enough to use the space the amount column doesn't need, but
        // still short of it — the amount is right-aligned at RIGHT - 16.
        const descriptionWidth = CONTENT_WIDTH - 32 - 120;
        const descriptionH = measureText(doc, descriptionText, { font: "Helvetica-Bold", size: 11, width: descriptionWidth });

        doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(descriptionText, left + 16, itemY, { width: descriptionWidth });
        rightAlignedSegments(doc, [{ text: amountDisplay, size: 11, color: INK, font: "Helvetica-Bold" }], itemY, RIGHT - 16);
        lastRowBottom = itemY + descriptionH + 4;
      }

      // ── Total ──
      // Sits below the *rendered* height of the last row. With a fixed
      // offset a two-line description (or a multi-row item table) ran
      // straight through this rule.
      const ruleY = lastRowBottom + 12;
      const totalLabel = isManual && status === "due" ? "Amount Due   " : "Total Paid   ";
      doc.rect(left + CONTENT_WIDTH * 0.4, ruleY, CONTENT_WIDTH * 0.6, 1.5).fill(NAVY);
      rightAlignedSegments(
        doc,
        [
          { text: totalLabel, size: 12, color: NAVY, font: "Helvetica-Bold" },
          { text: amountDisplay, size: 14, color: NAVY, font: "Helvetica-Bold" },
        ],
        ruleY + 14
      );

      // ── Payment details (left accent border, like the site's ribbon
      // sections but flatter to match this template) ──
      // A "manual" (admin-created B2B) invoice never shows this panel —
      // due or paid — since there is no gateway transaction to report and
      // the admin-entered payment method isn't shown on the document.
      // Only a "consultation" invoice (a patient's verified Stripe/PayPal
      // payment) has a real transaction reference to display here.
      const payY = ruleY + 48;
      let ny;

      if (isManual) {
        ny = payY + 6;
      } else {
        const payLabelX = left + 16;
        const payValueX = left + 150;
        const payValueWidth = CONTENT_WIDTH - (payValueX - left) - 16;

        const methodText = gateway === "paypal" ? "PayPal" : "Card";
        const referenceText = gatewayReference || "—";
        const methodH = measureText(doc, methodText, { font: "Helvetica-Bold", size: 9.5, width: payValueWidth });
        const referenceH = measureText(doc, referenceText, { font: "Helvetica-Bold", size: 9.5, width: payValueWidth });
        // Grows with a reference long enough to wrap (PayPal's are), so the
        // second line can't sit on or below the panel's bottom edge.
        const payH = PANEL_PAD + 12 + 10 + methodH + 10 + referenceH + PANEL_PAD;

        doc.roundedRect(left, payY, CONTENT_WIDTH, payH, 8).fill(PANEL_BLUE);
        // Clipped to the panel's rounded outline — an unclipped square bar
        // overhangs the two rounded corners it shares with the panel.
        doc.save();
        doc.roundedRect(left, payY, CONTENT_WIDTH, payH, 8).clip();
        doc.rect(left, payY, 4, payH).fill(ACCENT);
        doc.restore();

        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("PAYMENT DETAILS", payLabelX, payY + PANEL_PAD, { characterSpacing: 0.5 });

        const methodY = payY + PANEL_PAD + 22;
        doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Payment Method", payLabelX, methodY);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(methodText, payValueX, methodY, { width: payValueWidth });

        const referenceY = methodY + methodH + 10;
        doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Transaction Ref.", payLabelX, referenceY);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(referenceText, payValueX, referenceY, { width: payValueWidth });

        ny = payY + payH + 30;
      }

      // ── Notes & terms ──
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("NOTES & TERMS", left, ny, { characterSpacing: 0.5 });
      ny += 18;

      // Longer notes than before, so these wrap (width + pdfkit's default
      // line-break behavior) instead of the fixed-line-height + lineBreak:
      // false approach used elsewhere in this file — that combo would run
      // this text straight off the page. ny advances by doc.y (the actual
      // rendered height) after each note, so wrapped notes never overlap.
      const noteTextX = left + 16;
      const noteTextWidth = CONTENT_WIDTH - 16;
      const effectiveNotes = notes || defaultNotes(documentType, status);
      for (const note of effectiveNotes) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("•", left + 5, ny, { lineBreak: false });
        if (note.bold) {
          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(INK)
            .text(note.bold, noteTextX, ny, { width: noteTextWidth, lineGap: 1.5, continued: true });
          doc.font("Helvetica").fillColor(MUTED).text(note.rest, { width: noteTextWidth, lineGap: 1.5 });
        } else {
          doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(note.rest, noteTextX, ny, { width: noteTextWidth, lineGap: 1.5 });
        }
        ny = doc.y + 7;
      }

      // ── Thank-you line ──
      ny += 12;
      drawSegmentsAt(
        doc,
        [
          { text: "Thank you for choosing ", size: 9.5, color: INK, font: "Helvetica" },
          { text: "Humancare Connect", size: 9.5, color: NAVY, font: "Helvetica-Bold" },
          { text: " — your Global Health Passport.", size: 9.5, color: INK, font: "Helvetica" },
        ],
        left,
        ny
      );

      // ── Footer ──
      // Pinned to the bottom of the page rather than trailing the last note,
      // so the footer rule lands in the same place on every invoice instead
      // of floating mid-page whenever the content above happens to be short.
      // The Math.max keeps it below the content if the notes ever grow past
      // the pin point.
      const footerRuleY = Math.max(ny + 32, doc.page.height - PAGE_MARGIN - FOOTER_BLOCK_H);
      doc.rect(left, footerRuleY, CONTENT_WIDTH, 1).fill(LINE);
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(
          "This is a computer-generated invoice for services rendered by Humancare Connect and is valid without a signature.",
          left,
          footerRuleY + 16,
          { width: CONTENT_WIDTH, align: "center" }
        );
      centeredSegments(
        doc,
        [
          { text: "Questions about this invoice? Contact ", size: 8.5, color: MUTED, font: "Helvetica" },
          { text: COMPANY_EMAIL, size: 8.5, color: ACCENT, font: "Helvetica-Bold" },
          { text: `  ·  ${COMPANY_PHONE}`, size: 8.5, color: MUTED, font: "Helvetica" },
        ],
        footerRuleY + 32
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Manual-invoice ("Document" template) ────────────────────────────────
// Renders documentType: "manual" only. Fully separate from the consultation
// drawing code above — different palette (MAN_* tokens), different font
// family (Times/serif vs Helvetica) — so nothing here can perturb that
// template. Only pure, non-branching helpers are shared (formatAmount,
// formatDateShort, formatQuantity, currencyLabel, measureText, the segment
// helpers) and none of them read documentType, so this function is the only
// place manual-invoice styling lives.
//
// All values are still drawn via pdfkit's text API, never interpolated into
// markup, so there is no injection surface — same invariant as the
// consultation branch.
function drawManualInvoice(doc, ctx) {
  const { invoiceNumber, issuedAt, billTo, description, amountDisplay, currency, status, items, hasItems, dueDate, paymentTerms, left } = ctx;

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

  // ── Meta strip: Issue Date | Due Date | Payment Terms | Currency ──
  const colW = CONTENT_WIDTH / 4;
  const metaCols = [
    { label: "ISSUE DATE", value: formatDateShort(issuedAt), bold: false },
    { label: "DUE DATE", value: dueDate ? formatDateShort(dueDate) : "—", bold: true },
    { label: "PAYMENT TERMS", value: paymentTerms || "—", bold: false },
    { label: "CURRENCY", value: currencyLabel(currency), bold: false },
  ];
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
  const amountColW = 90;
  const rateColW = 80;
  const qtyColW = 50;
  const amountColRight = RIGHT - 14;
  const rateColRight = amountColRight - amountColW - 12;
  const qtyColLeft = rateColRight - rateColW - 12 - qtyColW;
  const descWidth = qtyColLeft - 12 - (left + 14);

  function drawTableHeader(headerY) {
    doc.rect(left, headerY, CONTENT_WIDTH, 24).fill(MAN_NAVY);
    doc.font("Times-Bold").fontSize(9.5).fillColor(WHITE).text("DESCRIPTION", left + 14, headerY + 7, { characterSpacing: 0.3, lineBreak: false });
    doc.font("Times-Bold").fontSize(9.5).fillColor(WHITE).text("QTY", qtyColLeft, headerY + 7, { width: qtyColW, align: "center" });
    doc
      .font("Times-Bold")
      .fontSize(9.5)
      .fillColor(WHITE)
      .text("RATE", rateColRight - rateColW, headerY + 7, { width: rateColW, align: "right" });
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
    drawRow({
      descText: description || "Invoice",
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

  // ── Terms ──
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

  const closingText = description && String(description).trim() ? String(description).trim() : "Thank you for your business.";
  doc.font("Times-Italic").fontSize(9.5).fillColor(MAN_MUTED).text(closingText, left, y, { width: CONTENT_WIDTH, lineGap: 1.5 });
  y = doc.y + 16;

  // ── Footer ──
  const footerY = Math.max(y, doc.page.height - PAGE_MARGIN - 30);
  doc.rect(left, footerY, CONTENT_WIDTH, 1).fill(MAN_HAIRLINE);
  const footerText = `Humancare Connect  |  24/7 Support: ${COMPANY_EMAIL}  |  ${COMPANY_ADDRESS_LINES.join(" ")}  |  ${COMPANY_PHONE}`;
  doc.font("Times-Roman").fontSize(8).fillColor(MAN_MUTED).text(footerText, left, footerY + 12, { width: CONTENT_WIDTH, align: "center" });
}

module.exports = { buildInvoicePdfBuffer, formatAmount, defaultManualNotes };