const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Layout mirrors the official "HCC Medical Report" Word template: logo + wordmark
// header, navy "MEDICAL REPORT" title, blue section captions with an underline rule,
// shaded label/value tables, and the confidentiality footer on every page.

const LOGO_CANDIDATES = [
  process.env.MEDICAL_REPORT_LOGO_PATH,
  path.join(__dirname, "..", "assets", "medical-report-logo.png"),
  process.env.INVOICE_LOGO_PATH,
  path.join(__dirname, "..", "assets", "invoice-logo.png"),
].filter(Boolean);
let LOGO_BUFFER = null;
for (const candidate of LOGO_CANDIDATES) {
  try {
    LOGO_BUFFER = fs.readFileSync(candidate);
    break;
  } catch {
    // try the next candidate
  }
}
if (!LOGO_BUFFER) console.warn("[medical-report] Logo not found — rendering header without it.");

// Colours and sizes taken from the Word template.
const NAVY = "#0b1f5c";
const BLUE = "#1b4fa0";
const LABEL_BG = "#eaf1fb";
const BORDER = "#cccccc";
const INK = "#000000";
const MUTED = "#555555";

const FONT = "Times-Roman";
const FONT_BOLD = "Times-Bold";
const FONT_ITALIC = "Times-Italic";

// US Letter, 50pt side margins (1000 twips) → 512pt content width.
const PAGE_SIZE = "LETTER";
const MARGIN_X = 50;
const CONTENT_WIDTH = 512;
const BODY_TOP = 124;
const BODY_BOTTOM = 690;
// Logo widths (the PNG is cropped to the artwork, so height follows its ~2.1:1 aspect).
const HEADER_LOGO = 120;
const FOOTER_LOGO = 56;
const FOOTER_TEXT_X = MARGIN_X + 70;
const HEADER_RULE_Y = 113;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4;
const BODY_SIZE = 10;

const DEFAULT_DOCTOR_NAME = "Issued by Humancare";
const SERVICE_PROVIDER = "Humancare Connect";

// Clinical sections, in print order. Keys match the encrypted payload. The first four are
// the template's own sections; the rest are older fields that are still accepted and, when
// present, printed inside the matching template section.
const SECTIONS = [
  ["chiefComplaint", "Chief Complaint"],
  ["examination", "Clinical Findings"],
  ["diagnosis", "Diagnosis"],
  ["treatment", "Plan / Disposition / Treatment"],
  ["history", "History"],
  ["investigations", "Investigations"],
  ["followUp", "Follow-up"],
  ["remarks", "Remarks"],
];

// Non-clinical details printed in the information tables. Also stored encrypted with the
// clinical content, but they alone don't count as "report content".
const INFO_FIELDS = [
  ["requestType", "Request Type"],
  ["patientDob", "Date of Birth"],
  ["patientContact", "Contact number"],
  ["patientLocation", "Patient Location"],
];

const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

// "24th October, 2026" — as written in the template.
function formatServiceDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${ordinal(d.getUTCDate())} ${month}, ${d.getUTCFullYear()}`;
}

// The template prints dates of birth as DD/MM/YYYY. Free-text values are kept as typed.
function formatDob(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

function physicianName(doctorName) {
  const name = String(doctorName || "").trim();
  if (!name || name === DEFAULT_DOCTOR_NAME) return name || DEFAULT_DOCTOR_NAME;
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

const clean = (value) => String(value ?? "").trim();

// Built-in Times only covers WinAnsi. A value with anything outside it (Hindi, Arabic, CJK...)
// is drawn with the bundled DejaVu Serif instead; everything else keeps the template look.
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const UNICODE_FONTS = {
  [FONT]: ["HCC-DV", "DejaVuSerif.ttf"],
  [FONT_BOLD]: ["HCC-DV-Bold", "DejaVuSerif-Bold.ttf"],
  [FONT_ITALIC]: ["HCC-DV-Italic", "DejaVuSerif-Italic.ttf"],
};
const NON_WINANSI = /[^\u0009\u000A\u000D -~ -ÿ‘’‚“”„–—•…†‡‰‹›€™ŒœŠšŸŽžƒˆ˜]/;
const needsUnicodeFont = (text) => NON_WINANSI.test(String(text ?? ""));

function registerUnicodeFonts(doc) {
  const available = new Set();
  for (const [base, [name, file]] of Object.entries(UNICODE_FONTS)) {
    try {
      doc.registerFont(name, path.join(FONT_DIR, file));
      available.add(base);
    } catch {
      // Font file missing: that style falls back to Times.
    }
  }
  doc.__unicodeFonts = available;
}

// The font to use for this text: the requested Times face, or its DejaVu twin when needed.
function pickFont(doc, font, text) {
  if (doc.__unicodeFonts?.has(font) && needsUnicodeFont(text)) return UNICODE_FONTS[font][0];
  return font;
}

function textHeight(doc, text, { font = FONT, size = BODY_SIZE, width }) {
  return doc.font(pickFont(doc, font, text)).fontSize(size).heightOfString(String(text ?? ""), { width });
}

// Longest prefix of `text` (cut at a space where possible) that fits in maxHeight.
function splitToFit(doc, text, { font, width, maxHeight }) {
  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textHeight(doc, text.slice(0, mid), { font, width }) <= maxHeight) lo = mid;
    else hi = mid - 1;
  }
  let cut = lo;
  if (cut < text.length) {
    const space = text.lastIndexOf(" ", cut);
    if (space > cut * 0.5) cut = space;
  }
  return [text.slice(0, cut).trimEnd(), text.slice(cut).trimStart()];
}

function ensureSpace(doc, y, needed) {
  if (y + needed <= BODY_BOTTOM) return y;
  doc.addPage();
  return BODY_TOP;
}

// One table row. cells: [{ text, width, label?, fill?, bold?, color? }]
// A row that fits on a page is never split. A cell taller than a whole page is split across
// pages; each continuation row repeats the label as "<label> (cont.)", so no text can run
// into the footer.
function drawRow(doc, { y, cells }) {
  const cellFont = (cell) => (cell.bold || cell.label ? FONT_BOLD : FONT);
  const innerWidth = (cell) => cell.width - CELL_PAD_X * 2;
  const rowHeight = (list) =>
    Math.max(...list.map((cell) => textHeight(doc, cell.text || " ", { font: cellFont(cell), width: innerWidth(cell) }))) +
    CELL_PAD_Y * 2 +
    2;
  const pageCapacity = BODY_BOTTOM - BODY_TOP;

  let pending = cells;
  for (;;) {
    let rowCells = pending;
    let rest = null;

    if (rowHeight(pending) > pageCapacity) {
      // Start an oversized row on a fresh page unless a decent amount of room is left.
      if (BODY_BOTTOM - y < 120) {
        doc.addPage();
        y = BODY_TOP;
      }
      const maxInner = BODY_BOTTOM - y - CELL_PAD_Y * 2 - 2;
      rest = [];
      rowCells = pending.map((cell) => {
        const font = cellFont(cell);
        const width = innerWidth(cell);
        if (cell.label || textHeight(doc, cell.text || " ", { font, width }) <= maxInner) {
          rest.push(cell.label ? { ...cell, text: `${cell.baseLabel || cell.text} (cont.)`, baseLabel: cell.baseLabel || cell.text } : { ...cell, text: "" });
          return cell;
        }
        const [head, tail] = splitToFit(doc, cell.text, { font, width, maxHeight: maxInner });
        rest.push({ ...cell, text: tail });
        return { ...cell, text: head };
      });
    }

    const rowH = rowHeight(rowCells);
    y = ensureSpace(doc, y, rowH);
    let x = MARGIN_X;
    for (const cell of rowCells) {
      const fill = cell.fill || (cell.label ? LABEL_BG : "#ffffff");
      doc.save().lineWidth(0.5).rect(x, y, cell.width, rowH).fillAndStroke(fill, BORDER).restore();
      if (cell.text) {
        doc.font(pickFont(doc, cellFont(cell), cell.text))
          .fontSize(BODY_SIZE)
          .fillColor(cell.color || (cell.label ? NAVY : INK))
          .text(cell.text, x + CELL_PAD_X, y + CELL_PAD_Y + 1, { width: innerWidth(cell) });
      }
      x += cell.width;
    }
    y += rowH;

    if (!rest || !rest.some((cell) => !cell.label && cell.text)) return y;
    doc.addPage();
    y = BODY_TOP;
    pending = rest;
  }
}

// Blue caps caption with the blue underline rule.
function drawSectionCaption(doc, y, title) {
  y = ensureSpace(doc, y + 15, 40);
  doc.font(FONT_BOLD).fontSize(11).fillColor(BLUE).text(title.toUpperCase(), MARGIN_X, y, { width: CONTENT_WIDTH });
  const ruleY = doc.y + 4;
  doc.save().lineWidth(0.75).strokeColor(BLUE).moveTo(MARGIN_X, ruleY).lineTo(MARGIN_X + CONTENT_WIDTH, ruleY).stroke().restore();
  return ruleY + 10;
}

function drawParagraph(doc, y, text, { font = FONT, color = INK, size = BODY_SIZE, indent = 0 } = {}) {
  const width = CONTENT_WIDTH - indent;
  const h = textHeight(doc, text, { font, size, width });
  y = ensureSpace(doc, y, Math.min(h, 60));
  doc.font(pickFont(doc, font, text)).fontSize(size).fillColor(color).text(text, MARGIN_X + indent, y, { width, lineGap: 1 });
  return doc.y;
}

// "Label: value" with a bold label, as in "Diagnosis: …".
function drawLabelled(doc, y, label, value) {
  y = ensureSpace(doc, y, 16);
  doc.font(FONT_BOLD).fontSize(BODY_SIZE).fillColor(INK)
    .text(`${label}: `, MARGIN_X, y, { width: CONTENT_WIDTH, continued: Boolean(value), lineGap: 1 });
  if (value) doc.font(pickFont(doc, FONT, value)).text(value, { lineGap: 1 });
  return doc.y;
}

function drawBullets(doc, y, items) {
  for (const item of items) {
    const h = textHeight(doc, item, { width: CONTENT_WIDTH - 36 });
    y = ensureSpace(doc, y, Math.min(h, 40));
    doc.font(FONT).fontSize(BODY_SIZE).fillColor(INK).text("•", MARGIN_X + 18, y);
    doc.font(pickFont(doc, FONT, item)).text(item, MARGIN_X + 36, y, { width: CONTENT_WIDTH - 36, lineGap: 1 });
    y = doc.y + 3;
  }
  return y;
}

function drawHeader(doc) {
  if (LOGO_BUFFER) doc.image(LOGO_BUFFER, MARGIN_X, 50, { width: HEADER_LOGO });
  doc.font(FONT_BOLD).fontSize(12).fillColor(NAVY)
    .text("Humancare Connect", MARGIN_X, 62, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
  doc.font(FONT_ITALIC).fontSize(8).fillColor(BLUE)
    .text("Global Health Passport", MARGIN_X, 77, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
  doc.save().lineWidth(1).strokeColor(BLUE).moveTo(MARGIN_X, HEADER_RULE_Y).lineTo(MARGIN_X + CONTENT_WIDTH, HEADER_RULE_Y).stroke().restore();
}

function drawFooter(doc, reportNumber) {
  const ruleY = 706;
  doc.save().lineWidth(1).strokeColor(BLUE).moveTo(MARGIN_X, ruleY).lineTo(MARGIN_X + CONTENT_WIDTH, ruleY).stroke().restore();
  if (LOGO_BUFFER) doc.image(LOGO_BUFFER, MARGIN_X, 714, { width: FOOTER_LOGO });
  doc.font(FONT).fontSize(7).fillColor(MUTED)
    .text("Humancare Connect, Inc. | Global Health Passport", FOOTER_TEXT_X, 722, { lineBreak: false });
  doc.text(
    "This medical report is confidential and intended solely for the named patient and authorized parties.",
    FOOTER_TEXT_X,
    731,
    { lineBreak: false }
  );
  if (reportNumber) {
    doc.text(`Report No. ${reportNumber}`, MARGIN_X, 722, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
  }
}

// Builds a generated medical report PDF as a Buffer. Every value goes through
// pdfkit's text API (never markup), so there is no injection surface.
function buildMedicalReportPdfBuffer({ reportNumber, title, reportDate, patient = {}, doctorName, content = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margins: { top: BODY_TOP, bottom: 792 - BODY_BOTTOM, left: MARGIN_X, right: MARGIN_X },
        bufferPages: true,
        info: {
          Title: `${title || "Medical Report"} ${reportNumber || ""}`.trim(),
          Author: "Humancare Connect",
          Subject: "Medical Report",
          Creator: "Humancare Connect",
        },
      });
      registerUnicodeFonts(doc);
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const c = Object.fromEntries(Object.entries(content || {}).map(([k, v]) => [k, clean(v)]));
      const doctor = physicianName(doctorName);
      const location =
        c.patientLocation || [patient.city, patient.state, patient.country].map(clean).filter(Boolean).join(", ");

      // ── Title ──
      let y = BODY_TOP;
      doc.font(FONT_BOLD).fontSize(20).fillColor(NAVY).text("MEDICAL REPORT", MARGIN_X, y, { width: CONTENT_WIDTH, align: "center" });
      y = doc.y + 3;
      doc.font(FONT_ITALIC).fontSize(BODY_SIZE).fillColor(BLUE)
        .text("Issued by Humancare Connect", MARGIN_X, y, { width: CONTENT_WIDTH, align: "center" });
      y = doc.y;

      // ── Report information ──
      y = drawSectionCaption(doc, y, "Report Information");
      y = drawRow(doc, {
        y,
        cells: [
          { text: "Request Type", width: 153.6, label: true },
          { text: c.requestType || "", width: 153.6 },
          { text: "", width: 204.8 },
        ],
      });
      y = drawRow(doc, {
        y,
        cells: [
          { text: "Service Provider", width: 153.6, label: true },
          { text: SERVICE_PROVIDER, width: 358.4 },
        ],
      });
      y = drawRow(doc, {
        y,
        cells: [
          { text: "Assigned Doctor", width: 153.6, label: true },
          { text: doctor, width: 153.6 },
          { text: `Date of Service: ${formatServiceDate(reportDate)}`, width: 204.8, label: true },
        ],
      });

      // ── Patient details ──
      y = drawSectionCaption(doc, y, "Patient Details");
      const patientRows = [
        ["Name", clean(patient.name)],
        ["Date of Birth", formatDob(patient.dob) || "N/A"],
        ["Contact number", c.patientContact || clean(patient.mobile) || "N/A"],
        ["Patient Location", location || "N/A"],
      ];
      for (const [label, value] of patientRows) {
        y = drawRow(doc, { y, cells: [{ text: label, width: 153.6, label: true }, { text: value, width: 358.4 }] });
      }

      // ── Chief complaint ──
      y = drawSectionCaption(doc, y, "Chief Complaint");
      y = drawParagraph(doc, y, c.chiefComplaint || "—");

      // ── Clinical findings (+ older history / investigations fields) + diagnosis ──
      y = drawSectionCaption(doc, y, "Clinical Findings");
      if (c.examination) y = drawParagraph(doc, y, c.examination) + 2;
      if (c.history) y = drawLabelled(doc, y, "History", c.history) + 2;
      if (c.investigations) y = drawLabelled(doc, y, "Investigations", c.investigations) + 2;
      y = drawLabelled(doc, y, "Diagnosis", c.diagnosis);

      // ── Plan: one bullet per line ──
      y = drawSectionCaption(doc, y, "Plan / Disposition / Treatment");
      const planItems = (c.treatment || "")
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean);
      if (c.followUp) planItems.push(`Follow-up: ${c.followUp}`);
      if (c.remarks) planItems.push(`Remarks: ${c.remarks}`);
      y = drawBullets(doc, y, planItems.length ? planItems : [""]);

      // ── Attending physician ──
      y = drawSectionCaption(doc, y, "Attending Physician");
      y = ensureSpace(doc, y, 30);
      doc.font(pickFont(doc, FONT, doctor)).fontSize(BODY_SIZE).fillColor(INK).text(doctor, MARGIN_X, y, { width: CONTENT_WIDTH });
      doc.font(FONT_ITALIC).fontSize(9.5).fillColor(MUTED).text("On behalf of Humancare Connect", MARGIN_X, doc.y, { width: CONTENT_WIDTH });

      // Header and footer on every page (drawn last, with the bottom margin lifted so
      // pdfkit never paginates while writing into the footer band).
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        drawHeader(doc);
        drawFooter(doc, reportNumber);
        doc.page.margins.bottom = savedBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildMedicalReportPdfBuffer, SECTIONS, INFO_FIELDS, formatServiceDate, formatDob, physicianName, needsUnicodeFont };
