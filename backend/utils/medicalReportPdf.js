const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Same header/footer look as the Guarantee of Payment (gopPdf.js): centered
// logo, navy title with a rule, shaded label/value tables, hairline footer.
// Duplicated rather than imported so the two templates can't perturb each other.
const COMPANY_EMAIL = "support@humancareconnect.co";
const COMPANY_PHONE = "+1 (302) 303-9993";
const COMPANY_ADDRESS_LINES = ["4 Peddlers Row, 1091 Newark,", "DE 19702, USA"];

const LOGO_PATH = process.env.INVOICE_LOGO_PATH || path.join(__dirname, "..", "assets", "invoice-logo.png");
let LOGO_BUFFER = null;
try {
  LOGO_BUFFER = fs.readFileSync(LOGO_PATH);
} catch {
  console.warn(`[medical-report] Logo not found at ${LOGO_PATH} — rendering text wordmark instead.`);
}

const NAVY = "#16305e";
const CAPTION = "#2f6cb0";
const LABEL_BG = "#eaf1fa";
const BORDER = "#c9d3e0";
const INK = "#1c2230";
const MUTED = "#5b6472";
const HAIRLINE = "#d9dee7";

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495;
const LABEL_COL_WIDTH = 165;
const CELL_PAD_X = 10;
const CELL_PAD_Y = 7;

// Narrative sections of the template, in print order. Keys match the encrypted payload.
const SECTIONS = [
  ["chiefComplaint", "Chief Complaint"],
  ["history", "History"],
  ["examination", "Examination Findings"],
  ["investigations", "Investigations"],
  ["diagnosis", "Diagnosis"],
  ["treatment", "Treatment & Recommendations"],
  ["followUp", "Follow-up"],
  ["remarks", "Remarks"],
];

function formatDateLong(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function measureText(doc, text, { font = "Helvetica", size = 10, width }) {
  return doc.font(font).fontSize(size).heightOfString(String(text ?? ""), { width });
}

function ensureSpace(doc, y, needed) {
  const bottom = doc.page.height - PAGE_MARGIN - 48;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return PAGE_MARGIN;
}

function drawSectionCaption(doc, { y, left, title }) {
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(NAVY).text(title, left, y, { width: CONTENT_WIDTH });
  const afterY = doc.y + 4;
  doc.rect(left, afterY, CONTENT_WIDTH, 1.5).fill(CAPTION);
  return afterY + 14;
}

function drawInfoTable(doc, { y, left, rows }) {
  const valueColX = left + LABEL_COL_WIDTH;
  const valueColWidth = CONTENT_WIDTH - LABEL_COL_WIDTH;
  let rowY = y;

  for (const [label, value] of rows) {
    const labelH = measureText(doc, label, { font: "Helvetica-Bold", size: 9.5, width: LABEL_COL_WIDTH - CELL_PAD_X * 2 });
    const valueH = measureText(doc, value || "—", { font: "Helvetica", size: 9.5, width: valueColWidth - CELL_PAD_X * 2 });
    const rowH = Math.max(labelH, valueH) + CELL_PAD_Y * 2;
    rowY = ensureSpace(doc, rowY, rowH);

    doc.rect(left, rowY, LABEL_COL_WIDTH, rowH).fillAndStroke(LABEL_BG, BORDER);
    doc.rect(valueColX, rowY, valueColWidth, rowH).fillAndStroke("#ffffff", BORDER);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NAVY)
      .text(label, left + CELL_PAD_X, rowY + CELL_PAD_Y, { width: LABEL_COL_WIDTH - CELL_PAD_X * 2 });
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
      .text(value || "—", valueColX + CELL_PAD_X, rowY + CELL_PAD_Y, { width: valueColWidth - CELL_PAD_X * 2 });
    rowY += rowH;
  }
  return rowY;
}

// Builds a generated medical report PDF as a Buffer. Every value goes through
// pdfkit's text API (never markup), so there is no injection surface.
function buildMedicalReportPdfBuffer({ reportNumber, title, reportDate, patient, doctorName, content = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `${title || "Medical Report"} ${reportNumber || ""}`.trim(),
          Author: "Humancare Connect",
          Subject: "Medical Report",
          Creator: "Humancare Connect",
        },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = PAGE_MARGIN;
      let y = 36;

      const logoWidth = 150;
      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, left + CONTENT_WIDTH / 2 - logoWidth / 2, y, { width: logoWidth });
        y += 66;
      } else {
        doc.font("Helvetica-Bold").fontSize(16).fillColor(NAVY).text("Humancare Connect", left, y, { width: CONTENT_WIDTH, align: "center" });
        y += 30;
      }

      doc.font("Helvetica-Bold").fontSize(19).fillColor(NAVY).text("MEDICAL REPORT", left, y, { width: CONTENT_WIDTH, align: "center" });
      y = doc.y + 4;
      doc.font("Helvetica-Oblique").fontSize(11).fillColor(MUTED)
        .text(title || "", left, y, { width: CONTENT_WIDTH, align: "center" });
      y = doc.y + 16;
      doc.rect(left, y, CONTENT_WIDTH, 2).fill(NAVY);
      y += 20;

      y = drawInfoTable(doc, {
        y,
        left,
        rows: [
          ["Report No.:", reportNumber],
          ["Report Date:", formatDateLong(reportDate)],
          ["Issued By:", doctorName || "Issued by Humancare"],
        ],
      });
      y += 20;

      y = drawSectionCaption(doc, { y, left, title: "Patient Information" });
      y = drawInfoTable(doc, {
        y,
        left,
        rows: [
          ["Name:", patient?.name],
          ["Patient ID:", patient?.patientId ? String(patient.patientId) : ""],
          ["Date of Birth:", patient?.dob],
          ["Gender:", patient?.gender],
        ],
      });
      y += 22;

      for (const [key, caption] of SECTIONS) {
        const text = String(content[key] || "").trim();
        if (!text) continue;
        const h = measureText(doc, text, { size: 10, width: CONTENT_WIDTH });
        y = ensureSpace(doc, y, 24 + Math.min(h, 120));
        y = drawSectionCaption(doc, { y, left, title: caption });
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(text, left, y, { width: CONTENT_WIDTH, lineGap: 2 });
        y = doc.y + 20;
      }

      y = ensureSpace(doc, y, 90);
      doc.font("Helvetica").fontSize(10).fillColor(INK).text("Issued by:", left, y);
      y = doc.y + 6;
      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(doctorName || "Issued by Humancare", left, y);
      y = doc.y + 6;
      doc.rect(left, y, 240, 1).fill(HAIRLINE);
      y += 10;
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Humancare Connect, Inc.", left, y);
      y = doc.y + 24;

      const footerY = Math.max(y, doc.page.height - PAGE_MARGIN - 34);
      doc.rect(left, footerY, CONTENT_WIDTH, 1).fill(HAIRLINE);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(MUTED)
        .text("Humancare Connect, Inc. — Confidential Medical Document", left, footerY + 12, { width: CONTENT_WIDTH, align: "center" });
      doc.font("Helvetica").fontSize(8).fillColor(MUTED)
        .text(
          `${COMPANY_ADDRESS_LINES.join(" ")}  |  ${COMPANY_PHONE}  |  ${COMPANY_EMAIL}  |  Report # ${reportNumber || ""}`,
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

module.exports = { buildMedicalReportPdfBuffer, SECTIONS };
