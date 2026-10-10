const express = require("express");
const multer = require("multer");
const path = require("path");
const { sendEmail } = require("../utils/sendEmail");
const { careersLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Defaults to the same support inbox the contact form uses; CAREERS_RECEIVER
// can route applications elsewhere without touching code.
const CAREERS_EMAIL = process.env.CAREERS_RECEIVER || process.env.CONTACT_RECEIVER;

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const MAX_LENGTHS = {
  fullName: 120,
  email: 254,
  phone: 30,
  specialty: 120,
  medicalLicenseNumber: 60,
  statesLicensedIn: 300,
  practiceDescription: 5000,
};

// Extension -> content types file-type may report for a genuine file of that
// kind (.doc is an OLE compound file; .docx is a zip container).
const RESUME_TYPES = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/x-cfb", "application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
};
const RESUME_MIME = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Memory storage: the resume is only ever held in RAM, attached to the email
// and dropped with the request — nothing is written to disk or made public.
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (RESUME_TYPES[ext]) return cb(null, true);
    cb(new Error("Resume must be a PDF, DOC or DOCX file."));
  },
});

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

const clean = (value) => (typeof value === "string" ? value.trim() : "");

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

function safeAttachmentName(fullName, ext) {
  const base = fullName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "applicant";
  return `Resume-${base}${ext}`;
}

function buildApplicationHtml(rows, practiceDescription) {
  const rowHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#5c7099;font-size:13px;width:200px;vertical-align:top;">${label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#0a1f44;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff;padding:16px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dbe4f3;border-radius:14px;overflow:hidden;">
        <div style="background:#0a1f44;padding:18px 24px;">
          <h2 style="margin:0;color:#fff;font-size:18px;">New Careers Application</h2>
        </div>
        <div style="padding:20px 24px;">
          <h3 style="margin:0 0 10px;color:#0a1f44;font-size:15px;">Applicant Information</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;">
            ${rowHtml}
          </table>
          <h3 style="margin:22px 0 8px;color:#0a1f44;font-size:15px;">About Their Practice</h3>
          <p style="margin:0;white-space:pre-wrap;color:#2a3f66;font-size:14px;line-height:1.6;">${
            practiceDescription ? escapeHtml(practiceDescription) : "<em>Not provided</em>"
          }</p>
          <p style="margin:22px 0 0;color:#5c7099;font-size:12px;">
            The applicant's resume is attached. Reply to this email to respond to the applicant directly.
          </p>
        </div>
      </div>
    </div>
  `;
}

// POST /api/careers/apply — multipart/form-data with a single "resume" file.
router.post("/apply", careersLimiter, (req, res) => {
  resumeUpload.single("resume")(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return fail(res, "Resume is too large. Maximum size is 5 MB.");
      }
      if (uploadErr instanceof multer.MulterError) {
        return fail(res, "Invalid upload. Please attach a single resume file.");
      }
      return fail(res, uploadErr.message);
    }

    try {
      const body = req.body || {};
      const fields = {
        fullName: clean(body.fullName),
        email: clean(body.email),
        phone: clean(body.phone),
        specialty: clean(body.specialty),
        medicalLicenseNumber: clean(body.medicalLicenseNumber),
        yearsOfExperience: clean(body.yearsOfExperience),
        statesLicensedIn: clean(body.statesLicensedIn),
        practiceDescription: clean(body.practiceDescription),
      };

      const required = [
        "fullName",
        "email",
        "phone",
        "specialty",
        "medicalLicenseNumber",
        "yearsOfExperience",
        "statesLicensedIn",
      ];
      if (required.some((key) => !fields[key])) {
        return fail(res, "Please fill in all required fields.");
      }
      if (!req.file) {
        return fail(res, "Please attach your resume / CV.");
      }
      if (!EMAIL_RE.test(fields.email)) {
        return fail(res, "Enter a valid email address.");
      }

      const phoneDigits = fields.phone.replace(/\D/g, "");
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        return fail(res, "Enter a valid phone number.");
      }

      const years = Number(fields.yearsOfExperience);
      if (!Number.isInteger(years) || years < 0 || years > 70) {
        return fail(res, "Years of experience must be a whole number between 0 and 70.");
      }

      const tooLong = Object.entries(MAX_LENGTHS).some(
        ([key, max]) => fields[key].length > max
      );
      if (tooLong) {
        return fail(res, "One or more fields exceed the allowed length.");
      }

      // Check the actual bytes, not just the extension/browser-reported type.
      const ext = path.extname(req.file.originalname).toLowerCase();
      const { fileTypeFromBuffer } = await import("file-type");
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !RESUME_TYPES[ext]?.includes(detected.mime)) {
        return fail(res, "Resume file content does not match a PDF, DOC or DOCX file.");
      }

      if (!CAREERS_EMAIL) {
        console.error("careers apply: CAREERS_RECEIVER / CONTACT_RECEIVER is not configured");
        return fail(res, "Applications cannot be received right now. Please try again later.", 500);
      }

      const rows = [
        ["Full Name", fields.fullName],
        ["Email Address", fields.email],
        ["Phone Number", fields.phone],
        ["Specialty", fields.specialty],
        ["Medical License Number", fields.medicalLicenseNumber],
        ["Years of Experience", String(years)],
        ["State(s) Licensed In", fields.statesLicensedIn],
      ];

      await sendEmail({
        to: CAREERS_EMAIL,
        replyTo: fields.email,
        subject: `New Careers Application – ${fields.fullName}`,
        text: [
          "New Careers Application",
          "",
          "Applicant Information",
          ...rows.map(([label, value]) => `${label}: ${value}`),
          "",
          "About Their Practice:",
          fields.practiceDescription || "Not provided",
        ].join("\n"),
        html: buildApplicationHtml(rows, fields.practiceDescription),
        attachments: [
          {
            filename: safeAttachmentName(fields.fullName, ext),
            content: req.file.buffer,
            contentType: RESUME_MIME[ext],
          },
        ],
      });

      return res.status(200).json({
        success: true,
        message: "Application submitted successfully.",
      });
    } catch (error) {
      console.error("careers apply error:", error.message);
      return fail(
        res,
        "We couldn't submit your application right now. Please try again shortly.",
        500
      );
    }
  });
});

module.exports = router;
