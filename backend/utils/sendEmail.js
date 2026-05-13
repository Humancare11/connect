const nodemailer = require("nodemailer");

// Create a fresh transporter on each call so env vars are always current
const createTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,           // SSL — required on AWS EC2 (port 587/STARTTLS is typically blocked)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const buildEmailHTML = (otp, type) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f7f6}
    .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(6,78,59,.10)}
    .hdr{background:linear-gradient(135deg,#059669 0%,#064e3b 100%);padding:32px 40px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px}
    .hdr p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
    .body{padding:36px 40px}
    .body p{color:#374151;font-size:15px;line-height:1.65;margin:0 0 14px}
    .otp-box{background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;text-align:center;padding:22px 16px;margin:22px 0}
    .otp-code{font-size:38px;font-weight:800;letter-spacing:14px;color:#059669;font-family:monospace;padding-left:14px}
    .otp-note{color:#9ca3af;font-size:12px;margin-top:6px}
    .footer{background:#f9fafb;padding:18px 40px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb}
    .footer a{color:#059669;text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>🩺 HumaniCare</h1>
      <p>${type === "register" ? "Email Verification" : "Password Reset"}</p>
    </div>
    <div class="body">
      <p>Hello,</p>
      <p>${type === "register"
        ? "Thanks for registering with HumaniCare! Use the OTP below to verify your email and complete your account setup."
        : "We received a request to reset your HumaniCare account password. Use the OTP below to proceed."
      }</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-note">Valid for <strong>10 minutes</strong> &nbsp;·&nbsp; Do not share this with anyone</div>
      </div>
      <p>If you didn't request this, you can safely ignore this email — your account is safe.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} HumaniCare &nbsp;·&nbsp;
      <a href="https://humancareconnect.co">humancareconnect.co</a>
    </div>
  </div>
</body>
</html>`;

const sendOTPEmail = async (to, otp, type = "register") => {
  const subject =
    type === "register"
      ? "HumaniCare — Email Verification OTP"
      : "HumaniCare — Password Reset OTP";

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"HumaniCare" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: buildEmailHTML(otp, type),
  });
};

module.exports = { sendOTPEmail };
