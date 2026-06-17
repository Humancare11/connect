const nodemailer = require("nodemailer");

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
    ? "Thanks for registering with Humancare Connect! Use the one-time code below to verify your email address and complete your account setup."
    : "We received a request to reset your Humancare Connect account password. Use the one-time code below to proceed.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${badgeText} — HumanCare Connect</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f0f4ff;
    }
    .email-wrap {
      max-width: 750px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #dde4f0;
    }
    .hdr {
      background: #132e88;
      padding: 20px 48px 20px;
      text-align: center;
    }
    .hdr img.header-logo {
      width: 292px;
      height: 95px;
      object-fit: contain;
      display: block;
      margin: 0 auto 18px;
    }
    .hdr h1 {
      color: #ffffff;
      margin: 0 0 10px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.18);
      color: rgba(255,255,255,0.92);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 5px 16px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .body {
      padding: 20px 35px;
    }
    .body p {
      color: #374151;
      font-size: 15px;
      line-height: 1.75;
      margin: 0 0 16px;
    }
    .otp-wrap {
      background: #f5f4ff;
      border: 1.5px dashed #312e81;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-size: 11px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .otp-code {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: 16px;
      color: #0b0443;
      font-family: monospace;
      padding-left: 16px;
      line-height: 1;
    }
    .otp-meta {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
    }
    .otp-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #ffffff;
      border: 1px solid #dde2f0;
      border-radius: 20px;
      padding: 5px 13px;
      font-size: 12px;
      color: #4b5563;
    }
    .notice {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      border-radius: 0 10px 10px 0;
      padding: 13px 18px;
      font-size: 13px;
      color: #78350f;
      margin: 0 0 20px;
    }
    .divider {
      height: 1px;
      background: #e9ecf5;
      margin: 24px 0;
    }
    .footer {
      background: #f8f9ff;
      padding: 15px 52px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .footer img.footer-logo {
      width: 155px;
      height: 62px;
      object-fit: contain;
      display: block;
      margin: 0 auto 14px;
    }
    .footer-links {
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .footer-links a {
      color: #4b5db8;
      text-decoration: none;
      font-weight: 500;
    }
    .footer-sep {
      margin: 0 6px;
      color: #d1d5db;
    }
    .copyright {
      font-size: 11px;
      color: #b0b7c9;
    }
  </style>
</head>
<body>
  <div class="email-wrap">
    <div class="hdr">
      <img class="header-logo" src="https://humancareconnect.co/assets/Logo-CFoJDHpJ.png" alt="HumanCare Connect" />
      <h1>HumanCare Connect</h1>
      <span class="badge">${badgeText}</span>
    </div>

    <div class="body">
      <p>${greeting}</p>
      <p>${bodyText}</p>

      <div class="otp-wrap">
        <div class="otp-label">Your one-time code</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-meta">
        <div style="text-align:center; margin-top:16px; width:100%;">
            <div style="display:inline-block; background:#ffffff; border:1px solid #dde2f0; border-radius:20px; padding:5px 13px; font-size:12px; color:#4b5563; margin:0 4px;">
            ⏱ Valid for <strong>10 minutes</strong>
            </div>
            <div style="display:inline-block; background:#ffffff; border:1px solid #dde2f0; border-radius:20px; padding:5px 13px; font-size:12px; color:#4b5563; margin:0 4px;">
            🔒 Do not share this code
            </div>
        </div>
        </div>
      </div>

      <div class="notice">
        ⚠️ If you didn't request this, please ignore this email — your account remains secure.
      </div>

      <div class="divider"></div>
      <p style="margin:0; font-size:13px; color:#9ca3af;">This is an automated message. Please do not reply to this email.</p>
    </div>

    <div class="footer">
      <img class="footer-logo" src="https://humancareconnect.co/assets/Logo-CFoJDHpJ.png" alt="HumanCare Connect" />
      <div class="footer-links">
        <a href="https://humancareconnect.co">Website</a>
        <span class="footer-sep">·</span>
        <a href="https://humancareconnect.co/privacy">Privacy Policy</a>
        <span class="footer-sep">·</span>
        <a href="https://humancareconnect.co/support">Support</a>
      </div>
      <div class="copyright">© ${new Date().getFullYear()} HumanCare Connect. All rights reserved.</div>
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
    from: `"HumanCare Connect" <${MAIL_FROM}>`,
    to,
    subject,
    html: buildEmailHTML(otp, type, name),
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  await sendMail({
    from: `"HumanCare Connect" <${MAIL_FROM}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = { sendOTPEmail, sendEmail };