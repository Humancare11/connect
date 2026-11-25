// Email to every admin and superadmin when a NEW patient registers.
// Fire-and-forget safe: never throws, because the account already exists and the signup response must not depend
// on email. One message per admin so recipients never see each other. Uses the normal SMTP mailer (sendEmail.js),
// never SES / Email Marketing.
//
// Switch: ADMIN_REGISTRATION_EMAIL. ON unless set to false / 0 / off / no (read on every call).
const mailer = require("./sendEmail");
const bookingNotifications = require("./bookingNotifications");
const { ADMIN_TIMEZONE, formatInZone } = require("./ticketThread");

const frontendBase = () =>
  String(process.env.FRONTEND_URL || "https://humancareconnect.co").split(",")[0].trim().replace(/\/+$/, "");

// Single line, no control characters, capped: safe for the subject and the table.
const oneLine = (value, max = 80) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const enabled = () => !["false", "0", "off", "no"].includes(String(process.env.ADMIN_REGISTRATION_EMAIL ?? "").trim().toLowerCase());

async function notifyAdminsByEmailUserRegistered({ user } = {}) {
  try {
    if (!enabled() || !user?._id) return;

    const recipients = await bookingNotifications._internals.adminRecipients();
    if (!recipients.length) {
      console.warn("[user-registered-notify] No active admin with an email found; skipping.");
      return;
    }

    const name = oneLine(user.name);
    const registeredAt = user.createdAt || new Date();
    const payload = {
      subject: name ? `New patient registered: ${name}` : "New patient registered",
      badge: "New Patient Registered",
      greeting: "Hello Admin,",
      intro: "A new patient has just registered on Humancare Connect.",
      rows: [
        ["Name", name],
        ["Email", oneLine(user.email, 120)],
        ["Signup method", user.signupMethod === "google" ? "Google" : "Email"],
        ["Registered (IST)", formatInZone(registeredAt, ADMIN_TIMEZONE)],
      ],
      ctaUrl: `${frontendBase()}/admin-dashboard/manage-users/${encodeURIComponent(String(user._id))}`,
      ctaLabel: "Open patient profile",
    };

    for (const to of recipients) {
      try {
        await mailer.sendBookingNotificationEmail(to, payload);
      } catch (err) {
        console.error(`[user-registered-notify] email to ${to} failed (non-fatal):`, err.message);
      }
    }
  } catch (err) {
    console.error("[user-registered-notify] could not send the registration email (non-fatal):", err.message);
  }
}

module.exports = { notifyAdminsByEmailUserRegistered };
