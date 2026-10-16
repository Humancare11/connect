// Follow-up email: when no admin has replied to a chat in the Queue within the follow-up time (the patient was told
// "Our team will connect with you by email"), ONE email goes to the contact's own address from the company support
// mailbox, through the existing Email module (so it shows in the Sent folder like any other mail).
//
// The email contains NO health details: no topic, no message text, no file names, no reason. Only the first name
// and the chat reference.
const { followUpMailboxAddress } = require("../../utils/liveChat/config");
const { decryptLiveChatText } = require("../../utils/liveChat/crypto");

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

module.exports = { createFollowUpMailer, buildFollowUpEmail, sendViaEmailModule, loadEmailModule };
