// Email to the admins when a patient or doctor raises a support ticket.
// Fire-and-forget safe: never throws, because the ticket is already saved and the in-app
// notification already exists. One message per admin so recipients never see each other.
const mailer = require("./sendEmail");
const bookingNotifications = require("./bookingNotifications");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const { ADMIN_TIMEZONE, formatInZone, ticketRef } = require("./ticketThread");

const frontendBase = () =>
  String(process.env.FRONTEND_URL || "https://humancareconnect.co").split(",")[0].trim().replace(/\/+$/, "");

const oneLine = (value, max = 150) => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

async function notifyAdminsByEmailTicketRaised({ ticket, source }) {
  try {
    const kind = source === "doctor" ? "doctor" : "patient";
    const raiser = await (kind === "doctor" ? Doctor : User)
      .findById(ticket.createdBy)
      .select("name email")
      .lean();
    const recipients = await bookingNotifications._internals.adminRecipients();
    if (!recipients.length) {
      console.warn("[ticket-notify] No active admin with an email found; skipping ticket email.");
      return;
    }

    const ref = ticketRef(ticket._id);
    const raisedAt = ticket.createdAt || new Date();
    const userTime = ticket.userTimezone ? formatInZone(raisedAt, ticket.userTimezone) : "";
    const label = kind === "doctor" ? "Doctor" : "Patient";
    const payload = {
      subject: `New support ticket ${ref}: ${oneLine(ticket.title, 90)}`,
      badge: "New Support Ticket",
      greeting: "Hello Admin,",
      intro: `${kind === "doctor" ? "A doctor" : "A patient"} has raised a new support ticket.`,
      rows: [
        ["Ticket ID", ref],
        ["Raised by", label],
        ["Title", oneLine(ticket.title)],
        ["Category", ticket.category || "other"],
        ["Name", oneLine(raiser?.name)],
        ["Email", oneLine(raiser?.email)],
        [`Raised (${label.toLowerCase()} time)`, userTime || "Not provided"],
        ["Raised (admin time)", formatInZone(raisedAt, ADMIN_TIMEZONE)],
      ],
      quote: String(ticket.description || ""),
      ctaUrl: `${frontendBase()}/admin-dashboard/tickets?tab=${kind}`,
      ctaLabel: "Open Support Tickets",
    };
    for (const to of recipients) {
      try {
        await mailer.sendBookingNotificationEmail(to, payload);
      } catch (err) {
        console.error(`[ticket-notify] email to ${to} failed (non-fatal):`, err.message);
      }
    }
  } catch (err) {
    console.error("[ticket-notify] could not send the ticket email (non-fatal):", err.message);
  }
}

module.exports = { notifyAdminsByEmailTicketRaised };
