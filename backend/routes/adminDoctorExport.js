const express = require("express");
const ExcelJS = require("exceljs");
const Doctor = require("../models/Doctor");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { recordActivity } = require("../utils/activityLogger");

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TYPES = ["all", "active"];
const FIELD_SETS = ["full", "basic"];

const joinText = (...parts) => parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(" ");
const list = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : "");
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Name/email prefer the enrollment; the bare Doctor account fills in when none exists yet.
const pick = (d) => {
  const e = d.enrollment || {};
  return {
    name: joinText(e.firstName, e.surname) || d.name || "",
    email: e.email || d.email || "",
    phone: e.phoneNumber ? joinText(e.countryCode, e.phoneNumber) : "",
  };
};

// Only whitelisted columns exist here, so nothing else (password, tokens, payout, files...) can reach a sheet.
const COLUMNS = {
  basic: [
    { header: "Name", width: 28, get: (d) => pick(d).name },
    { header: "Phone Number", width: 20, get: (d) => pick(d).phone },
    { header: "Email", width: 32, get: (d) => pick(d).email },
    { header: "State", width: 20, get: (d) => d.enrollment?.state || "" },
  ],
  full: [
    { header: "Doctor ID", width: 10, get: (d) => d.doctorId ?? "" },
    { header: "Name", width: 28, get: (d) => pick(d).name },
    { header: "Email", width: 32, get: (d) => pick(d).email },
    { header: "Phone Number", width: 20, get: (d) => pick(d).phone },
    { header: "Gender", width: 10, get: (d) => d.enrollment?.gender || "" },
    { header: "Date of Birth", width: 14, get: (d) => d.enrollment?.dob || "" },
    { header: "Country", width: 16, get: (d) => d.enrollment?.country || "" },
    { header: "State", width: 20, get: (d) => d.enrollment?.state || "" },
    { header: "City", width: 18, get: (d) => d.enrollment?.city || "" },
    { header: "Zip", width: 10, get: (d) => d.enrollment?.zip || "" },
    { header: "Address", width: 36, get: (d) => d.enrollment?.address || "" },
    { header: "Qualification", width: 22, get: (d) => d.enrollment?.qualification || "" },
    { header: "Specialization", width: 22, get: (d) => d.enrollment?.specialization || "" },
    { header: "Sub-specialization", width: 22, get: (d) => d.enrollment?.subSpecialization || "" },
    { header: "Experience (years)", width: 12, get: (d) => d.enrollment?.experience ?? "" },
    { header: "Consultation Fee", width: 12, get: (d) => d.enrollment?.consultantFees ?? "" },
    { header: "Fee Currency", width: 10, get: (d) => (d.enrollment?.consultantFees != null ? d.enrollment?.feeCurrency || "" : "") },
    { header: "Languages", width: 24, get: (d) => list(d.enrollment?.languagesKnown) },
    { header: "Licensed States", width: 24, get: (d) => list(d.enrollment?.licensedStates) },
    { header: "International Licenses", width: 24, get: (d) => list(d.enrollment?.internationalLicenses) },
    { header: "Clinic Name", width: 24, get: (d) => d.enrollment?.clinicName || "" },
    { header: "Clinic Address", width: 36, get: (d) => d.enrollment?.clinicAddress || "" },
    { header: "Medical School", width: 26, get: (d) => d.enrollment?.medicalSchool || "" },
    { header: "Registration Number", width: 22, get: (d) => d.enrollment?.medicalRegistrationNumber || "" },
    { header: "Medical Council", width: 24, get: (d) => d.enrollment?.medicalCouncilName || "" },
    { header: "Registration Year", width: 12, get: (d) => d.enrollment?.registrationYear || "" },
    { header: "Timezone", width: 20, get: (d) => d.enrollment?.timezone || "" },
    { header: "Enrollment Status", width: 16, get: (d) => (d.enrollment ? cap(d.enrollment.approvalStatus || "pending") : "Not started") },
    { header: "Account Status", width: 14, get: (d) => (d.accountDisabled ? "Disabled" : "Active") },
    { header: "Online", width: 8, get: (d) => (d.enrollment ? (d.enrollment.isOnline ? "Yes" : "No") : "") },
    { header: "Registered On", width: 14, get: (d) => dateOnly(d.createdAt) },
    { header: "Last Updated", width: 14, get: (d) => dateOnly(d.updatedAt) },
  ],
};

// Fields pulled from Doctor + Enrollment. Anything not listed is never read out of the database.
const DOCTOR_PROJECTION = { doctorId: 1, name: 1, email: 1, accountDisabled: 1, createdAt: 1, updatedAt: 1 };
const ENROLLMENT_FIELDS = [
  "firstName", "surname", "email", "countryCode", "phoneNumber", "gender", "dob", "country", "state", "city", "zip",
  "address", "qualification", "specialization", "subSpecialization", "experience", "consultantFees", "feeCurrency",
  "languagesKnown", "licensedStates", "internationalLicenses", "clinicName", "clinicAddress", "medicalSchool",
  "medicalRegistrationNumber", "medicalCouncilName", "registrationYear", "timezone", "approvalStatus", "isOnline",
];

function buildPipeline(type) {
  const pipeline = [
    {
      $lookup: {
        from: "enrollments",
        localField: "_id",
        foreignField: "doctorId",
        pipeline: [{ $project: Object.fromEntries(ENROLLMENT_FIELDS.map((f) => [f, 1])) }],
        as: "enrollment",
      },
    },
    { $set: { enrollment: { $first: "$enrollment" } } },
  ];
  if (type === "active") {
    pipeline.push({ $match: { "enrollment.approvalStatus": "approved", accountDisabled: { $ne: true } } });
  }
  pipeline.push({ $sort: { createdAt: -1, _id: -1 } }, { $project: { ...DOCTOR_PROJECTION, enrollment: 1 } });
  return pipeline;
}

// Super Admin only. GET /export?type=all|active&fields=full|basic — streams an .xlsx.
function createAdminDoctorExportRouter({ guard = [verifyAdminToken, superAdminOnly] } = {}) {
  const router = express.Router();

  router.get("/export", ...guard, async (req, res) => {
    const { type, fields } = req.query;
    if (!TYPES.includes(type) || !FIELD_SETS.includes(fields)) {
      return res.status(400).json({ msg: `Invalid export. type must be one of ${TYPES.join("|")} and fields one of ${FIELD_SETS.join("|")}.` });
    }
    // "all" has no "basic" variant in the product spec; keep the combination unambiguous.
    if (type === "all" && fields === "basic") {
      return res.status(400).json({ msg: "The basic export is only available for active doctors." });
    }

    const columns = COLUMNS[fields];
    const filename = `${type === "all" ? "all_doctors" : `active_doctors_${fields}`}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    let rows = 0;
    try {
      res.status(200);
      res.setHeader("Content-Type", XLSX_TYPE);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      // Cross-origin deployments (UAT frontend on another origin than the API): lets the browser read the filename.
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
      const sheet = workbook.addWorksheet("Doctors", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();

      const cursor = Doctor.aggregate(buildPipeline(type)).allowDiskUse(true).cursor({ batchSize: 500 });
      for await (const doc of cursor) {
        sheet.addRow(columns.map((c) => c.get(doc))).commit();
        rows += 1;
      }
      sheet.commit();
      await workbook.commit();

      console.info("[doctor-export]", { adminId: req.user?.id, type, fields, rows, at: new Date().toISOString() });
      await recordActivity(req, {
        action: "EXPORT_DOCTORS",
        resource: "Doctor",
        details: { type, fields, rows },
      });
    } catch (err) {
      console.error("[doctor-export]", err?.message || err);
      if (!res.headersSent) res.status(500).json({ msg: "Export failed. Please try again." });
      else res.destroy(err);
    }
  });

  return router;
}

module.exports = createAdminDoctorExportRouter();
module.exports.create = createAdminDoctorExportRouter;
