const express = require("express");
const { sendEmail } = require("../utils/sendEmail");
const { contactLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const CONTACT_EMAIL =
  process.env.CONTACT_RECEIVER ||
  process.env.CONTACT_EMAIL ||
  process.env.EMAIL_USER ||
  "support@humancareconnect.co";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_LENGTHS = { name: 120, email: 254, phone: 30, subject: 150, message: 5000 };

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

router.post("/", contactLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required.",
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const tooLong =
      name.length > MAX_LENGTHS.name ||
      email.length > MAX_LENGTHS.email ||
      phone.length > MAX_LENGTHS.phone ||
      subject.length > MAX_LENGTHS.subject ||
      message.length > MAX_LENGTHS.message;

    if (tooLong) {
      return res.status(400).json({
        success: false,
        message: "One or more fields exceed the allowed length.",
      });
    }

    const emailSubject = subject
      ? `New Contact Form Submission: ${subject}`
      : `New Consultation Request from ${name}`;

    const detailRows = [
      ["Name", name],
      ["Email", email],
      phone && ["Phone", phone],
      subject && ["Subject", subject],
    ].filter(Boolean);

    await sendEmail({
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: emailSubject,
      text: [
        ...detailRows.map(([label, value]) => `${label}: ${value}`),
        "",
        "Message:",
        message,
      ].join("\n"),
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;color:#0F172A;">
          <h2 style="margin:0 0 12px;">${subject ? "New Contact Form Submission" : "New Consultation Request"}</h2>
          ${detailRows
            .map(
              ([label, value]) =>
                `<p style="margin:0 0 6px;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`
            )
            .join("\n")}
          <p style="margin:16px 0 6px;"><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;margin:0;">${escapeHtml(message)}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Request received successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again shortly.",
    });
  }
});

module.exports = router;
