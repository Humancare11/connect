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
function defaultNotes(documentType, status) {
  if (documentType === "manual") {
    if (status === "paid") {
      return [
        { bold: "Payment received.", rest: " This receipt confirms that payment for the amount above has been processed." },
        { rest: "Please retain this receipt for your records." },
        { rest: "For any questions about this invoice, please contact support@humancareconnect.co." },
        { rest: "Please quote the invoice number in any correspondence regarding this payment." },
      ];
    }
    return [
      { bold: "Payment due.", rest: " Please arrange payment within 15 days of the invoice date shown above." },
      { rest: "Payment can be made by bank transfer or another method agreed with Humancare Connect, referencing the invoice number." },
      { rest: "For any questions about this invoice, please contact support@humancareconnect.co." },
      { rest: "Please quote the invoice number in any correspondence regarding this payment." },
    ];
  }

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
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `Invoice ${invoiceNumber || ""}`.trim(),
          Author: "Humancare Connect",
          Subject: description || "Consultation booking fee",
          Creator: "Humancare Connect",
        },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = PAGE_MARGIN;
      const amountDisplay = formatAmount(amountCents, currency);

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
        ["Currency  ", currencyLabel(currency)],
      ];
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
      const nameH = measureText(doc, nameText, { font: "Helvetica-Bold", size: 13, width: panelTextWidth });
      const emailH = emailText ? measureText(doc, emailText, { font: "Helvetica", size: 10, width: panelTextWidth }) : 0;
      const billToHeight = PANEL_PAD + 12 + nameH + (emailText ? emailH + 6 : 0) + PANEL_PAD;

      doc.roundedRect(left, billToY, CONTENT_WIDTH, billToHeight, 10).fill(PANEL_BLUE);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("BILLED TO", left + 16, billToY + PANEL_PAD, { characterSpacing: 0.5 });
      doc.font("Helvetica-Bold").fontSize(13).fillColor(NAVY).text(nameText, left + 16, billToY + PANEL_PAD + 16, { width: panelTextWidth });
      if (emailText) {
        doc.font("Helvetica").fontSize(10).fillColor(ACCENT).text(emailText, left + 16, doc.y + 4, { width: panelTextWidth });
      }

      // ── Line item table ──
      const tableY = billToY + billToHeight + PANEL_GUTTER;
      doc.rect(left, tableY, CONTENT_WIDTH, 26).fill(NAVY);
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

      // ── Total ──
      // Sits below the *rendered* height of the description. With a fixed
      // offset a two-line description ran straight through this rule.
      const ruleY = itemY + descriptionH + 16;
      const isManual = documentType === "manual";
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

module.exports = { buildInvoicePdfBuffer, formatAmount };