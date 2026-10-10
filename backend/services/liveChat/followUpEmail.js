// Offline follow-up email: when a patient asks for an agent while the team is offline (outside support hours or no
// agent online), the request is saved and ONE email goes to the contact's own address from the company support
// mailbox, through the existing Email module (so it shows in the Sent folder like any other mail).
//
// The email contains NO health details: no topic, no message text, no file names. Only the first name, the chat
// reference and the support hours, which are read from the Live Chat settings (never hard-coded).
const { followUpMailboxAddress } = require("../../utils/liveChat/config");
const { decryptLiveChatText } = require("../../utils/liveChat/crypto");

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABEL = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(hhmm);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function zoneLabel(timeZone, date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || timeZone;
  } catch {
    return timeZone || "";
  }
}

// "8:00 AM – 10:00 PM EDT, every day" or "Mon–Fri 9:00 AM – 5:00 PM EDT; Sat 10:00 AM – 2:00 PM EDT", built from
// settings.supportHours. Empty string when no day is enabled.
function describeSupportHours(supportHours, date = new Date()) {
  if (supportHours?.alwaysOn === true) return "24/7";
  const days = (supportHours?.days || []).filter((d) => d.enabled && DAY_ORDER.includes(d.day));
  if (!days.length) return "";
  const zone = zoneLabel(supportHours.timezone, date);
  const byDay = new Map(days.map((d) => [d.day, `${formatTime(d.open)} – ${formatTime(d.close)} ${zone}`.trim()]));
  const sameEverywhere = new Set(byDay.values()).size === 1;
  if (byDay.size === 7 && sameEverywhere) return `${[...byDay.values()][0]}, every day`;

  // group consecutive days that share the same hours
  const groups = [];
  for (const day of DAY_ORDER) {
    if (!byDay.has(day)) continue;
    const last = groups[groups.length - 1];
    const hours = byDay.get(day);
    if (last && last.hours === hours && DAY_ORDER.indexOf(day) === DAY_ORDER.indexOf(last.to) + 1) last.to = day;
    else groups.push({ from: day, to: day, hours });
  }
  return groups.map((g) => `${g.from === g.to ? DAY_LABEL[g.from] : `${DAY_LABEL[g.from]}–${DAY_LABEL[g.to]}`} ${g.hours}`).join("; ");
}

function buildFollowUpEmail({ firstName, conversationId, settings, date = new Date() }) {
  const lines = [
    `Hi ${firstName || "there"},`,
    "",
    `Thanks for contacting Humancare Connect. We received your message (reference ${conversationId}) and will get back to you soon.`,
    "",
    "Please don't include medical details when you reply by email.",
    "",
    "Humancare Connect Support",
  ];
  return { subject: "We received your message – Humancare Connect", body: lines.join("\n") };
}

// The Email module (Gmail client and friends) takes seconds to load the first time. It is loaded when live chat
// starts, so that never happens in the middle of a patient's request (which would stall the whole server).
function loadEmailModule() {
  return {
    ...require("../email/emailSender"),
    Mailbox: require("../../models/Mailbox"),
    ...require("../gmail/gmailAuth"),
    ...require("../gmail/gmailClient"),
    ...require("../../utils/emailAttachments"),
    ...require("../email/emailSettings"),
    ...require("../../utils/emailValidation"),
  };
}

// Sends through the Email module.
async function sendViaEmailModule({ to, subject, body, conversationId }, env = process.env) {
  const {
    sendNewMail,
    Mailbox,
    getGmailApi,
    createGmailClient,
    createS3AttachmentStore,
    getTrackingState,
    normalizeAddressList,
  } = loadEmailModule();

  const mailbox = await Mailbox.findOne({ address: followUpMailboxAddress(env), isActive: true });
  if (!mailbox) throw new Error("follow-up mailbox is not set up");
  await sendNewMail({
    mailbox,
    actor: { id: null, name: "Live chat" }, // a system send, not a person
    to: normalizeAddressList(to, { label: "To", required: true }),
    cc: [],
    subject,
    body,
    files: [],
    clientRequestId: `livechat-${conversationId}`, // one email per chat, even if this runs twice
    gmail: createGmailClient(getGmailApi(mailbox)),
    store: createS3AttachmentStore(),
    trackOpens: false, // no open-tracking pixel on a patient email
    trackingState: await getTrackingState(),
  });
}

// models: LcConversation. sendMail({ to, subject, body, conversationId }) is replaceable in tests.
function createFollowUpMailer({ models, loadSettings, sendMail = sendViaEmailModule, env = process.env, now = () => Date.now() }) {
  const { LcConversation } = models;

  // Never throws and never blocks the chat. Resolves to { sent, reason }.
  async function send(conv) {
    const email = decryptLiveChatText(conv.contact?.email);
    if (!email) {
      await LcConversation.updateOne({ _id: conv._id, "followUp.status": "" }, { $set: { "followUp.status": "skipped", "followUp.at": new Date(now()) } });
      return { sent: false, reason: "no_email" };
    }
    // claim: only the first caller sends
    const claim = await LcConversation.updateOne({ _id: conv._id, "followUp.status": "" }, { $set: { "followUp.status": "sending" } });
    if (claim.modifiedCount === 0) return { sent: false, reason: "already" };

    try {
      const settings = await loadSettings();
      const first = String(decryptLiveChatText(conv.contact?.name) || "").trim().split(/\s+/)[0];
      const { subject, body } = buildFollowUpEmail({ firstName: first, conversationId: conv.conversationId, settings, date: new Date(now()) });
      await sendMail({ to: email, subject, body, conversationId: conv.conversationId }, env);
      await LcConversation.updateOne({ _id: conv._id }, { $set: { "followUp.status": "sent", "followUp.at": new Date(now()) } });
      return { sent: true };
    } catch (err) {
      // Name of the problem only: Gmail errors can echo addresses.
      console.error(`[livechat] follow-up email failed: ${err?.code || err?.name || "Error"}`);
      await LcConversation.updateOne({ _id: conv._id }, { $set: { "followUp.status": "failed", "followUp.at": new Date(now()) } });
      return { sent: false, reason: "failed" };
    }
  }

  return { send };
}

module.exports = { createFollowUpMailer, buildFollowUpEmail, describeSupportHours, sendViaEmailModule, loadEmailModule };
