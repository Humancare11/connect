const nodemailer = require("nodemailer");
//import miniLogo from "../assets/single-logo.png";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE =
  process.env.SMTP_SECURE === undefined
    ? SMTP_PORT === 465
    : process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.EMAIL_USER || "alert@humancareconnect.co";

const createTransporter = (overrides = {}) => {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !MAIL_FROM) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and EMAIL_USER.");
  }
  return nodemailer.createTransport({
    host: overrides.host || SMTP_HOST,
    port: overrides.port || SMTP_PORT,
    secure: Object.prototype.hasOwnProperty.call(overrides, "secure")
      ? overrides.secure
      : SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendMail = async (message) => {
  try {
    const transporter = createTransporter();
    return await transporter.sendMail(message);
  } catch (err) {
    console.error("SMTP send failed:", {
      code: err.code,
      command: err.command,
      responseCode: err.responseCode,
      response: err.response,
      to: message.to,
      subject: message.subject,
    });
    throw err;
  }
};

const buildEmailHTML = (otp, type, name) => {
  const greeting = name ? `Hello ${name},` : `Hello,`;
  const isRegister = type === "register";
  const badgeText = isRegister ? "Email Verification" : "Password Reset";
  const bodyText = isRegister
  ? `
    Thank you for choosing Humancare Connect.
    <br>
    To ensure the security of your account, please use the verification code below to confirm your email address and complete your registration.
    <br>
    Please note that this code will expire in 10 minutes and should not be shared with anyone.
  `
  : `
    We received a request to reset your Humancare Connect account password.
    <br>
    Please use the one-time verification code below to proceed with resetting your password.
    <br>
    For your security, this code is valid for 10 minutes and should not be shared with anyone.
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${badgeText} — Humancare Connect</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff; padding: 10px 10px;">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden; border: 1px solid #0a1f44">

  <div style="background:#dcebff;padding:20px 32px;text-align:center;;
    border-radius: 16px 16px 0 0;">
    <img src="https://humancareconnect.co/logo-email.png" alt="Humancare Connect" style="display:block;margin:0 auto 12px;object-fit:contain; width:220px; height:72px;"/>
    <span style="display:inline-block;background:rgba(255,255,255,0.18);color: #0a1f44;;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:5px 14px;border-radius:20px; border: 1px solid #0a1f44">${badgeText}</span>
  </div>

  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">${greeting}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">${bodyText}</p>

    <div style="background:#0a62f126;border:1.5px dashed #312e81;border-radius:14px;padding:24px 16px;text-align:center;margin:0 0 18px;">
      <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;font-weight:600;margin:0 0 10px;">Your one-time secure code</p>
      <p style="font-size:44px;font-weight:800;letter-spacing:14px;color:#0b0443;font-family:monospace;margin:0 0 6px;padding-left:14px;user-select:all;">${otp}</p>
      <span style="display:inline-block;background:#fff;border:1px solid #dde2f0;border-radius:20px;padding:5px 12px;font-size:12px;color:#4b5563;margin:0 3px;">⏱ Valid for <strong>10 minutes</strong></span>
      <span style="display:inline-block;background:#fff;border:1px solid #dde2f0;border-radius:20px;padding:5px 12px;font-size:12px;color:#4b5563;margin:0 3px;">🔒 Do not share this code</span>
    </div>
  </div>

  <div style="background:#f8f9ff;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:140px;">
          <img src="https://humancareconnect.co/logo-footer.png" alt="Humancare Connect"  style="display:block;object-fit:contain;width:140px;height:44px;"/>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
            <tr><td style="padding:2px 0;font-size:12px;"><a href="mailto:support@humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">support@humancareconnect.co</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="tel:+13023039993" style="color:#4b5db8;text-decoration:none;font-weight:500;">+1 302-303-9993</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="https://humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">humancareconnect.co</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;">
      <span style="font-size:12px;">
        <a href="https://humancareconnect.co/privacy" style="color:#4b5db8;text-decoration:none;font-weight:500;">Privacy Policy</a>
        <span style="margin:0 5px;color:#d1d5db;">·</span>
        <a href="https://humancareconnect.co/support" style="color:#4b5db8;text-decoration:none;font-weight:500;">Support</a>
      </span>
      <p style="margin:4px 0 0;font-size:11px;color:#b0b7c9;">© ${new Date().getFullYear()} Humancare Connect. All rights reserved.</p>
    </div>
  </div>

</div>
</body>
</html>`;
};

const sendOTPEmail = async (to, otp, type = "register", name) => {
  const subject =
    type === "register"
      ? "Humancare Connect — Email Verification OTP"
      : "Humancare Connect — Password Reset OTP";

  await sendMail({
    from: `"Humancare Connect" <${MAIL_FROM}>`,
    to,
    subject,
    html: buildEmailHTML(otp, type, name),
  });
};

const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  await sendMail({
    from: `"Humancare Connect" <${MAIL_FROM}>`,
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
};

const buildInvoiceEmailHTML = ({ name, invoiceNumber, amountDisplay, description }) => {
  const greeting = name ? `Hello ${name},` : `Hello,`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Payment Receipt — Humancare Connect</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff; padding: 10px 10px;">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden; border: 1px solid #0a1f44">

  <div style="background:#dcebff;padding:20px 32px;text-align:center;border-radius: 16px 16px 0 0;">
    <img src="https://humancareconnect.co/logo-email.png" alt="Humancare Connect" style="display:block;margin:0 auto 12px;object-fit:contain; width:220px; height:72px;"/>
    <span style="display:inline-block;background:rgba(255,255,255,0.18);color: #0a1f44;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:5px 14px;border-radius:20px; border: 1px solid #0a1f44">Payment Receipt</span>
  </div>

  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">${greeting}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Thank you for your payment to Humancare Connect. Your invoice is attached to this email as a PDF, and is always available for download from your account under <strong>Payment History</strong>.
    </p>

    <div style="background:#0a62f126;border:1.5px dashed #312e81;border-radius:14px;padding:20px 24px;margin:0 0 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Invoice Number</td><td style="font-size:13px;color:#1e1b4b;font-weight:700;text-align:right;padding:4px 0;">${invoiceNumber}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Description</td><td style="font-size:13px;color:#1e1b4b;text-align:right;padding:4px 0;">${description || "Consultation booking fee"}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Amount Paid</td><td style="font-size:16px;color:#0a1f44;font-weight:800;text-align:right;padding:4px 0;">${amountDisplay}</td></tr>
      </table>
    </div>
  </div>

  <div style="background:#f8f9ff;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:140px;">
          <img src="https://humancareconnect.co/logo-footer.png" alt="Humancare Connect"  style="display:block;object-fit:contain;width:140px;height:44px;"/>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
            <tr><td style="padding:2px 0;font-size:12px;"><a href="mailto:support@humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">support@humancareconnect.co</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="tel:+13023039993" style="color:#4b5db8;text-decoration:none;font-weight:500;">+1 302-303-9993</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="https://humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">humancareconnect.co</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:4px 0 0;font-size:11px;color:#b0b7c9;">© ${new Date().getFullYear()} Humancare Connect. All rights reserved.</p>
    </div>
  </div>

</div>
</body>
</html>`;
};

const sendInvoiceEmail = async (to, { name, invoiceNumber, amountDisplay, description, pdfBuffer }) => {
  await sendMail({
    from: `"Humancare Connect" <${MAIL_FROM}>`,
    to,
    subject: `Humancare Connect — Payment Receipt (${invoiceNumber})`,
    html: buildInvoiceEmailHTML({ name, invoiceNumber, amountDisplay, description }),
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

// clientName/description here are admin-typed free text about a third party
// (not validated internal data like the fields above), so — unlike
// buildInvoiceEmailHTML — this escapes them before HTML interpolation.
// Same escaping contact.js already uses for its user-submitted fields.
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

const buildManualInvoiceEmailHTML = ({ name, invoiceNumber, amountDisplay, status }) => {
  const greeting = name ? `Hello ${escapeHtml(name)},` : `Hello,`;
  const isPaid = status === "paid";
  const badgeText = isPaid ? "Payment Receipt" : "Invoice";
  const introText = isPaid
    ? "This receipt confirms the payment below. Your invoice is attached to this email as a PDF."
    : "Please find your invoice attached to this email as a PDF. Payment details are included on the document.";
  const amountRowLabel = isPaid ? "Amount Paid" : "Amount Due";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${badgeText} — Humancare Connect</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff; padding: 10px 10px;">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden; border: 1px solid #0a1f44">

  <div style="background:#dcebff;padding:20px 32px;text-align:center;border-radius: 16px 16px 0 0;">
    <img src="https://humancareconnect.co/logo-email.png" alt="Humancare Connect" style="display:block;margin:0 auto 12px;object-fit:contain; width:220px; height:72px;"/>
    <span style="display:inline-block;background:rgba(255,255,255,0.18);color: #0a1f44;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:5px 14px;border-radius:20px; border: 1px solid #0a1f44">${badgeText}</span>
  </div>

  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">${greeting}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">${introText}</p>

    <div style="background:#0a62f126;border:1.5px dashed #312e81;border-radius:14px;padding:20px 24px;margin:0 0 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Invoice Number</td><td style="font-size:13px;color:#1e1b4b;font-weight:700;text-align:right;padding:4px 0;">${escapeHtml(invoiceNumber)}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">${amountRowLabel}</td><td style="font-size:16px;color:#0a1f44;font-weight:800;text-align:right;padding:4px 0;">${escapeHtml(amountDisplay)}</td></tr>
      </table>
    </div>
  </div>

  <div style="background:#f8f9ff;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:140px;">
          <img src="https://humancareconnect.co/logo-footer.png" alt="Humancare Connect"  style="display:block;object-fit:contain;width:140px;height:44px;"/>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
            <tr><td style="padding:2px 0;font-size:12px;"><a href="mailto:support@humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">support@humancareconnect.co</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="tel:+13023039993" style="color:#4b5db8;text-decoration:none;font-weight:500;">+1 302-303-9993</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="https://humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">humancareconnect.co</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:4px 0 0;font-size:11px;color:#b0b7c9;">© ${new Date().getFullYear()} Humancare Connect. All rights reserved.</p>
    </div>
  </div>

</div>
</body>
</html>`;
};

// status: "due" (bill — not yet paid) or "paid" (receipt). Recipient is an
// admin-entered client address, not necessarily a registered platform user.
const sendManualInvoiceEmail = async (to, { name, invoiceNumber, amountDisplay, status, pdfBuffer }) => {
  await sendMail({
    from: `"Humancare Connect" <${MAIL_FROM}>`,
    to,
    subject: status === "paid"
      ? `Humancare Connect — Payment Receipt (${invoiceNumber})`
      : `Humancare Connect — Invoice ${invoiceNumber}`,
    html: buildManualInvoiceEmailHTML({ name, invoiceNumber, amountDisplay, status }),
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

// Recipient is the service provider (a doctor, typically) the GOP is
// issued to — an admin-entered address, not necessarily a registered
// platform user (see routes/gop.js / models/Gop.js).
const buildGopEmailHTML = ({ providerName, gopNumber, patientName, caseType, amountDisplay }) => {
  const greeting = providerName ? `Hello ${escapeHtml(providerName)},` : `Hello,`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Guarantee of Payment — Humancare Connect</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff; padding: 10px 10px;">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden; border: 1px solid #0a1f44">

  <div style="background:#dcebff;padding:20px 32px;text-align:center;border-radius: 16px 16px 0 0;">
    <img src="https://humancareconnect.co/logo-email.png" alt="Humancare Connect" style="display:block;margin:0 auto 12px;object-fit:contain; width:220px; height:72px;"/>
    <span style="display:inline-block;background:rgba(255,255,255,0.18);color: #0a1f44;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:5px 14px;border-radius:20px; border: 1px solid #0a1f44">Guarantee of Payment</span>
  </div>

  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">${greeting}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Please find attached the Case Initiation &amp; Payment Authorization (Guarantee of Payment) for the case below. Please review the attached PDF for the full authorization terms and required documentation.</p>

    <div style="background:#0a62f126;border:1.5px dashed #312e81;border-radius:14px;padding:20px 24px;margin:0 0 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">GOP Number</td><td style="font-size:13px;color:#1e1b4b;font-weight:700;text-align:right;padding:4px 0;">${escapeHtml(gopNumber)}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Patient</td><td style="font-size:13px;color:#1e1b4b;text-align:right;padding:4px 0;">${escapeHtml(patientName || "—")}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Case Type</td><td style="font-size:13px;color:#1e1b4b;text-align:right;padding:4px 0;">${escapeHtml(caseType || "—")}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Agreed Payment</td><td style="font-size:16px;color:#0a1f44;font-weight:800;text-align:right;padding:4px 0;">${escapeHtml(amountDisplay)}</td></tr>
      </table>
    </div>
  </div>

  <div style="background:#f8f9ff;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:140px;">
          <img src="https://humancareconnect.co/logo-footer.png" alt="Humancare Connect"  style="display:block;object-fit:contain;width:140px;height:44px;"/>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
            <tr><td style="padding:2px 0;font-size:12px;"><a href="mailto:support@humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">support@humancareconnect.co</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="tel:+13023039993" style="color:#4b5db8;text-decoration:none;font-weight:500;">+1 302-303-9993</a></td></tr>
            <tr><td style="padding:2px 0;font-size:12px;"><a href="https://humancareconnect.co" style="color:#4b5db8;text-decoration:none;font-weight:500;">humancareconnect.co</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:4px 0 0;font-size:11px;color:#b0b7c9;">© ${new Date().getFullYear()} Humancare Connect. All rights reserved.</p>
    </div>
  </div>

</div>
</body>
</html>`;
};

const sendGopEmail = async (to, { providerName, gopNumber, patientName, caseType, amountDisplay, pdfBuffer }) => {
  await sendMail({
    from: `"Humancare Connect" <${MAIL_FROM}>`,
    to,
    subject: `Humancare Connect — Guarantee of Payment (${gopNumber})`,
    html: buildGopEmailHTML({ providerName, gopNumber, patientName, caseType, amountDisplay }),
    attachments: [
      {
        filename: `${gopNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

module.exports = { sendOTPEmail, sendEmail, sendInvoiceEmail, sendManualInvoiceEmail, sendGopEmail };