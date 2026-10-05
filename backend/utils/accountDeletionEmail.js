// utils/accountDeletionEmail.js
//
// The three emails around a patient's self-service account-deletion request:
//   requested  — right after the patient submits it
//   approved   — when an admin approves it (sent BEFORE the account is removed,
//                while the address is still on file)
//   rejected   — when an admin declines it
//
// Same sender and SMTP setup as the OTP emails (utils/sendEmail.js). Sending is
// best-effort: sendAccountDeletionEmail never throws, so a mail outage can't
// block the patient's request or an admin's decision. Callers get back
// { sent: boolean } to record in the activity log.
//
// TODO(legal review): the "records we keep" wording below must match the final
// retention policy and the public /account-deletion-policy page. Keep the three
// in sync, and do not add a specific retention period until legal has signed it
// off.
const mailer = require("./sendEmail");

const SUPPORT_EMAIL = "support@humancareconnect.co";
const POLICY_URL = "https://humancareconnect.co/account-deletion-policy";
const PROFILE_URL = "https://humancareconnect.co/user/profile-settings";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

const RETENTION_NOTE =
  "Some records — for example appointments, payments and invoices, and medical and billing " +
  "records — are kept where we are required to retain them by law.";

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};

// kind → { subject, badge, paragraphs(name, requestedAt) , cta? }
const TEMPLATES = {
  requested: {
    subject: "Humancare Connect — We received your account deletion request",
    badge: "Request Received",
    paragraphs: ({ requestedAt }) => [
      `We received your request${requestedAt ? ` on ${formatDate(requestedAt)}` : ""} to delete your Humancare Connect account.`,
      "Our team will review it. Until then your account stays active and you can keep using it. " +
        "If you change your mind you can cancel the request from Profile Settings.",
      RETENTION_NOTE,
      `If you did not make this request, please cancel it from Profile Settings or contact ${SUPPORT_EMAIL} right away.`,
    ],
    cta: { label: "Open Profile Settings", url: PROFILE_URL },
  },
  approved: {
    subject: "Humancare Connect — Your account deletion request was approved",
    badge: "Request Approved",
    paragraphs: () => [
      "Your account deletion request has been approved, and your Humancare Connect account is now being deleted. " +
        "Your profile, contact details and sign-in will be removed, and you will no longer be able to log in.",
      RETENTION_NOTE,
      "You are welcome to create a new account at any time.",
      `Questions about your data? Contact ${SUPPORT_EMAIL}.`,
    ],
    cta: { label: "How we handle your data", url: POLICY_URL },
  },
  rejected: {
    subject: "Humancare Connect — Your account deletion request",
    badge: "Request Declined",
    paragraphs: () => [
      "We were unable to complete your account deletion request, so your account has not been deleted and remains active.",
      `If you would still like to delete your account, you can submit a new request from Profile Settings, or contact ${SUPPORT_EMAIL} and we will help.`,
    ],
    cta: { label: "Open Profile Settings", url: PROFILE_URL },
  },
};

function buildHtml(kind, { name, requestedAt } = {}) {
  const t = TEMPLATES[kind];
  const greeting = name ? `Hello ${escapeHtml(name)},` : "Hello,";
  const body = t
    .paragraphs({ requestedAt })
    .map((p) => `<p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 14px;">${escapeHtml(p)}</p>`)
    .join("\n    ");
  const cta = t.cta
    ? `<p style="margin:22px 0 4px;"><a href="${escapeHtml(t.cta.url)}" style="display:inline-block;background:#083ab0;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px;">${escapeHtml(t.cta.label)}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(t.badge)} — Humancare Connect</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff;padding:10px;">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #0a1f44">
  <div style="background:#dcebff;padding:20px 32px;text-align:center;">
    <img src="https://humancareconnect.co/logo-email.png" alt="Humancare Connect" style="display:block;margin:0 auto 12px;object-fit:contain;width:220px;height:72px;"/>
    <span style="display:inline-block;color:#0a1f44;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:5px 14px;border-radius:20px;border:1px solid #0a1f44">${escapeHtml(t.badge)}</span>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:15px;font-weight:600;color:#0a1f44;margin:0 0 14px;">${greeting}</p>
    ${body}
    ${cta}
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#64748b;">
    Humancare Connect · ${SUPPORT_EMAIL}
  </div>
</div>
</body>
</html>`;
}

function buildText(kind, { name, requestedAt } = {}) {
  const t = TEMPLATES[kind];
  return [name ? `Hello ${name},` : "Hello,", "", ...t.paragraphs({ requestedAt }).flatMap((p) => [p, ""]),
    ...(t.cta ? [`${t.cta.label}: ${t.cta.url}`] : [])].join("\n");
}

// kind: "requested" | "approved" | "rejected". Never throws.
async function sendAccountDeletionEmail(kind, to, { name, requestedAt } = {}) {
  if (!TEMPLATES[kind]) throw new Error(`Unknown account-deletion email kind: ${kind}`);
  if (!to) return { sent: false };
  try {
    await mailer.sendEmail({
      to,
      subject: TEMPLATES[kind].subject,
      text: buildText(kind, { name, requestedAt }),
      html: buildHtml(kind, { name, requestedAt }),
    });
    return { sent: true };
  } catch (err) {
    console.error(`sendAccountDeletionEmail(${kind}) failed:`, err.message);
    return { sent: false };
  }
}

module.exports = { sendAccountDeletionEmail, buildHtml, buildText, TEMPLATES };
