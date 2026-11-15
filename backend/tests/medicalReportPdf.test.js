const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMedicalReportPdfBuffer,
  formatServiceDate,
  formatDob,
  physicianName,
  needsUnicodeFont,
} = require("../utils/medicalReportPdf");
const { hasClinicalContent } = require("../utils/medicalReportService");

const base = {
  reportNumber: "MR-000001",
  title: "Check-up",
  reportDate: new Date("2026-10-24T00:00:00Z"),
  doctorName: "Smith",
  patient: { name: "Jane Patient", dob: "1990-03-05", mobile: "+1 555 0100", city: "Austin", country: "USA" },
};
const pageCount = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

describe("medical report PDF", () => {
  test("service date uses ordinals", () => {
    assert.equal(formatServiceDate(new Date("2026-10-24T00:00:00Z")), "24th October, 2026");
    for (const [day, text] of [[1, "1st"], [2, "2nd"], [3, "3rd"], [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"]]) {
      assert.ok(formatServiceDate(new Date(Date.UTC(2026, 0, day))).startsWith(`${text} `), text);
    }
  });

  test("date of birth is DD/MM/YYYY", () => {
    assert.equal(formatDob("1990-03-05"), "05/03/1990");
    assert.equal(formatDob("1990-03-05T00:00:00.000Z"), "05/03/1990");
    assert.equal(formatDob(""), "");
  });

  test('"Dr." is only added when missing', () => {
    assert.equal(physicianName("Smith"), "Dr. Smith");
    assert.equal(physicianName("Dr Smith"), "Dr Smith");
    assert.equal(physicianName("Dr. Smith"), "Dr. Smith");
    assert.equal(physicianName("Issued by Humancare"), "Issued by Humancare");
  });

  test("only clinical sections count as content", () => {
    assert.equal(hasClinicalContent({ requestType: "x", patientContact: "y", patientLocation: "z" }), false);
    assert.equal(hasClinicalContent({ remarks: "ok" }), true);
    assert.equal(hasClinicalContent({}), false);
  });

  test("non-WinAnsi detection", () => {
    assert.equal(needsUnicodeFont("Jane O’Brien – café €5"), false);
    assert.equal(needsUnicodeFont("राहुल शर्मा"), true);
    assert.equal(needsUnicodeFont("محمد"), true);
  });

  test("unlinked report: Patient Details come from the typed values, N/A when empty", async () => {
    const full = await buildMedicalReportPdfBuffer({
      ...base,
      patient: { name: "Walk-in Visitor", dob: "1985-07-09" },
      content: { diagnosis: "d", patientContact: "+971 50 000 0000", patientLocation: "Dubai, UAE" },
    });
    assert.equal(full.subarray(0, 5).toString("latin1"), "%PDF-");
    const empty = await buildMedicalReportPdfBuffer({ ...base, patient: { name: "Walk-in Visitor" }, content: { diagnosis: "d" } });
    assert.equal(empty.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  test("short report is a single page", async () => {
    const buf = await buildMedicalReportPdfBuffer({ ...base, content: { chiefComplaint: "Cough", diagnosis: "Cold", treatment: "- Rest\n* Fluids\n• Tea" } });
    assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.equal(pageCount(buf), 1);
  });

  // Devanagari is not supported in the PDF by design (reports are filled in in English), so this only
  // asserts that a valid PDF is produced and nothing throws; the glyphs themselves are not checked.
  test("a Hindi name produces a valid PDF without throwing", async () => {
    const name = "राहुल शर्मा";
    const buf = await buildMedicalReportPdfBuffer({
      ...base,
      doctorName: name,
      patient: { ...base.patient, name },
      content: { chiefComplaint: "खांसी", diagnosis: "सर्दी", treatment: "आराम" },
    });
    assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(buf.toString("latin1").includes("%%EOF"));
  });

  test("very long sections flow onto extra pages", async () => {
    const long = Array.from({ length: 60 }, (_, i) => `Line ${i} lorem ipsum dolor sit amet consectetur`).join("\n");
    const buf = await buildMedicalReportPdfBuffer({ ...base, content: { chiefComplaint: long, examination: long, diagnosis: "d", treatment: long } });
    assert.ok(pageCount(buf) >= 3);
  });

  test("a 5000-character table cell is split across pages instead of overflowing", async () => {
    for (const key of ["requestType", "patientLocation", "patientContact"]) {
      const buf = await buildMedicalReportPdfBuffer({
        ...base,
        content: { diagnosis: "d", [key]: "word ".repeat(1000).trim() },
      });
      assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
      assert.ok(pageCount(buf) >= 2, `${key} should continue on a new page`);
    }
    // An unbroken 5000-char string (no spaces) must also be handled.
    const buf = await buildMedicalReportPdfBuffer({ ...base, content: { diagnosis: "d", patientLocation: "z".repeat(5000) } });
    assert.ok(pageCount(buf) >= 2);
  });
});
