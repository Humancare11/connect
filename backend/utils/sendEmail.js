const nodemailer = require("nodemailer");

const createTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
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
    body{
      margin:0;
      padding:0;
      font-family:'Segoe UI',Arial,sans-serif;
      background:#eef4ff;
    }

    .wrap{
      max-width:520px;
      margin:40px auto;
      background:#ffffff;
      border-radius:18px;
      overflow:hidden;
      box-shadow:0 6px 24px rgba(11, 4, 67, 0.12);
    }

    .hdr{
      background:linear-gradient(135deg,#0b0443 0%,#1a0b73 100%);
      padding:34px 40px;
      text-align:center;
    }

    .hdr h1{
      color:#ffffff;
      margin:0;
      font-size:24px;
      font-weight:800;
      letter-spacing:-0.4px;
    }

    .hdr p{
      color:rgba(255,255,255,0.82);
      margin:8px 0 0;
      font-size:13px;
    }

    .body{
      padding:38px 40px;
    }

    .body p{
      color:#374151;
      font-size:15px;
      line-height:1.7;
      margin:0 0 14px;
    }

    .otp-box{
      background:#f4f3ff;
      border:2px dashed #312e81;
      border-radius:14px;
      text-align:center;
      padding:24px 16px;
      margin:24px 0;
    }

    .otp-code{
      font-size:40px;
      font-weight:800;
      letter-spacing:14px;
      color:#0b0443;
      font-family:monospace;
      padding-left:14px;
    }

    .otp-note{
      color:#6b7280;
      font-size:12px;
      margin-top:8px;
    }

    .footer{
      background:#f8f9ff;
      padding:18px 40px;
      text-align:center;
      color:#9ca3af;
      font-size:11px;
      border-top:1px solid #e5e7eb;
    }

    .footer a{
      color:#0b0443;
      text-decoration:none;
      font-weight:600;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1> Humancare Connect</h1>
      <p>${type === "register" ? "Email Verification" : "Password Reset"}</p>
    </div>

    <div class="body">
      <p>Hello,</p>

      <p>
        ${type === "register"
    ? "Thanks for registering with Humancare Connect! Use the OTP below to verify your email and complete your account setup."
    : "We received a request to reset your Humancare Connect account password. Use the OTP below to proceed."
  }
      </p>

      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-note">
          Valid for <strong>10 minutes</strong>
          &nbsp;·&nbsp;
          Do not share this with anyone
        </div>
      </div>

      <p>
        If you didn't request this, you can safely ignore this email — your account is secure.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} HumanCare Connect
      &nbsp;·&nbsp;
      <a href="https://humancareconnect.co">
        humancareconnect.co
      </a>
    </div>
  </div>
</body>
</html>`;

const sendOTPEmail = async (to, otp, type = "register") => {
  const subject =
    type === "register"
      ? "Humancare Connect — Email Verification OTP"
      : "Humancare Connect — Password Reset OTP";

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"HumanCare Connect" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: buildEmailHTML(otp, type),
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"HumanCare Connect" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = { sendOTPEmail, sendEmail };