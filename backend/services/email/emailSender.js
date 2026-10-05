const EmailMessage = require("../../models/EmailMessage");
const EmailAttachment = require("../../models/EmailAttachment");
const { buildRawMessage } = require("../gmail/mimeBuilder");
const { makeSnippet } = require("../gmail/mimeParser");
const { attachmentKey } = require("../../utils/emailAttachments");

// An error the API shows to the admin as-is (status + message + optional extra JSON).
class EmailHttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = "EmailHttpError";
    this.status = status;
    this.extra = extra;
  }
}

// A repeat of a request we already processed (double-click / network retry).
const DUPLICATE_WINDOW_MS = 30_000;

const cleanRequestId = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : null);

function friendlySendError(err) {
  const status = Number(err?.code) || Number(err?.status) || Number(err?.response?.status) || 0;
  if (status === 429 || /rate ?limit|quota/i.test(String(err?.message))) {
    return "Gmail's sending limit was reached for this mailbox. Please try again later.";
  }
  if (status === 400) return `Gmail rejected the message: ${String(err.message).slice(0, 200)}`;
  return "Gmail could not send the message. Please try again.";
}

// Creates the outbound row, stores attachments, hands the mail to Gmail, and
// records the result. The row exists BEFORE the send (status "sending") so:
//  - the sync can adopt it by Message-ID instead of importing a second copy,
//  - a double-click is caught by the unique (sentByAdmin, clientRequestId) index,
//  - a failure is visible in Sent as "Failed" with the reason.
// → { message, duplicate }
async function dispatch({ mailbox, actor, to, cc = [], subject, body, files = [], clientRequestId, thread = null, gmail, store }) {
  const requestId = cleanRequestId(clientRequestId);

  if (requestId) {
    const existing = await EmailMessage.findOne({ sentByAdmin: actor.id, clientRequestId: requestId });
    if (existing) return { message: existing, duplicate: true };
  }

  // Validates addresses/subject/body/size and builds the MIME mail. Throws
  // EmailValidationError before anything is stored or sent.
  const built = await buildRawMessage({
    mailbox,
    to,
    cc,
    subject,
    body,
    inReplyTo: thread?.inReplyTo || "",
    references: thread?.references || [],
    attachments: files,
  });

  const doc = new EmailMessage({
    mailbox: mailbox._id,
    direction: "out",
    gmailMessageId: null,
    gmailThreadId: thread?.gmailThreadId || null,
    rfcMessageId: built.rfcMessageId,
    inReplyTo: thread?.inReplyTo || "",
    references: thread?.references || [],
    from: { name: "Human Care Connect", address: mailbox.address },
    to,
    cc,
    subject: String(subject).replace(/[\r\n]+/g, " ").trim(),
    messageDate: new Date(),
    hasAttachments: files.length > 0,
    attachmentCount: files.length,
    sentByAdmin: actor.id,
    sentByName: actor.name,
    sentOutsideDashboard: false,
    status: "sending",
    clientRequestId: requestId,
  });
  doc.setContent({ text: built.text, html: "", snippet: makeSnippet(body) });

  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000 && requestId) {
      const existing = await EmailMessage.findOne({ sentByAdmin: actor.id, clientRequestId: requestId });
      if (existing) return { message: existing, duplicate: true };
    }
    throw err;
  }

  const fail = async (reason) => {
    await EmailMessage.updateOne({ _id: doc._id }, { $set: { status: "failed", failureReason: reason } });
  };

  // Attachments go to storage first: if that fails nothing has been sent.
  const stored = [];
  try {
    for (const file of files) {
      const key = attachmentKey(mailbox._id, doc._id, file.filename);
      await store.put(key, file.content, file.contentType);
      stored.push({ file, key });
    }
    if (stored.length) {
      await EmailAttachment.insertMany(
        stored.map(({ file, key }) => ({
          message: doc._id,
          mailbox: mailbox._id,
          filename: file.filename,
          mimeType: file.contentType,
          size: file.content.length,
          s3Key: key,
          cachedAt: new Date(),
        }))
      );
    }
  } catch (err) {
    console.error("[email-send] attachment storage failed:", err?.message || err);
    await Promise.all(stored.map(({ key }) => store.remove(key).catch(() => {})));
    await fail("Attachments could not be stored.");
    throw new EmailHttpError(502, "Your attachments could not be stored, so the mail was not sent. Please try again.", { messageId: String(doc._id) });
  }

  let sent;
  try {
    sent = await gmail.sendRaw(built.raw, thread?.gmailThreadId || undefined);
  } catch (err) {
    console.error("[email-send] Gmail send failed:", err?.message || err);
    const reason = friendlySendError(err);
    await fail(reason);
    throw new EmailHttpError(502, reason, { messageId: String(doc._id) });
  }

  // The sync may already have adopted this row (same Message-ID); both updates
  // are conditional so neither can clobber the other.
  await EmailMessage.updateOne(
    { _id: doc._id, gmailMessageId: null },
    { $set: { gmailMessageId: sent.id, gmailThreadId: sent.threadId || doc.gmailThreadId } }
  );
  await EmailMessage.updateOne({ _id: doc._id, status: "sending" }, { $set: { status: "sent" } });

  return { message: await EmailMessage.findById(doc._id), duplicate: false };
}

function sendNewMail({ mailbox, actor, to, cc, subject, body, files, clientRequestId, gmail, store }) {
  return dispatch({ mailbox, actor, to, cc, subject, body, files, clientRequestId, gmail, store });
}

// Decides what a reply to `opened` answers, from stored data only (never the request):
//   anchor      the mail whose Message-ID/thread the reply attaches to
//   claimTarget the received mail that gets marked "replied by <admin>" (null when
//               following up on our own sent mail that the client hasn't answered)
//   replyTo     who it goes to: the client, never our own address
// `thread` = the non-spam messages of the conversation, oldest first.
function pickReplyTarget(opened, thread) {
  if (opened.direction === "in") {
    return { anchor: opened, claimTarget: opened, replyTo: { name: opened.from.name || "", address: opened.from.address } };
  }
  const lastInbound = [...thread].reverse().find((m) => m.direction === "in");
  if (lastInbound) {
    return { anchor: lastInbound, claimTarget: lastInbound, replyTo: { name: lastInbound.from.name || "", address: lastInbound.from.address } };
  }
  const first = opened.to[0] || { name: "", address: "" };
  return { anchor: opened, claimTarget: null, replyTo: { name: first.name || "", address: first.address } };
}

// Claim-then-send: the received mail is atomically marked "replied by <admin>"
// first, so two admins answering at once can't both go through; a failed send
// restores whatever was there before.
async function sendReply({ mailbox, actor, anchor, claimTarget, replyTo, subject, body, files, clientRequestId, confirm = false, gmail, store }) {
  // A repeat of a request we already handled must not claim or send again.
  const requestId = cleanRequestId(clientRequestId);
  if (requestId) {
    const existing = await EmailMessage.findOne({ sentByAdmin: actor.id, clientRequestId: requestId });
    if (existing) return { message: existing, duplicate: true };
  }

  const claimedAt = new Date();
  const claim = { $set: { repliedAt: claimedAt, repliedBy: actor.id, repliedByName: actor.name } };
  let previous = { repliedAt: null, repliedBy: null, repliedByName: "" };

  if (claimTarget) {
    if (confirm) {
      const before = await EmailMessage.findOneAndUpdate({ _id: claimTarget._id }, claim, { returnDocument: "before" });
      if (before) previous = { repliedAt: before.repliedAt, repliedBy: before.repliedBy, repliedByName: before.repliedByName };
    } else {
      const claimed = await EmailMessage.findOneAndUpdate({ _id: claimTarget._id, repliedAt: null }, claim, { returnDocument: "after" });
      if (!claimed) {
        const current = await EmailMessage.findById(claimTarget._id).select("repliedAt repliedBy repliedByName").lean();
        const mine = current?.repliedBy && String(current.repliedBy) === String(actor.id);
        if (mine && current.repliedAt && Date.now() - new Date(current.repliedAt).getTime() < DUPLICATE_WINDOW_MS) {
          return { message: null, duplicate: true }; // our own request is still in flight
        }
        throw new EmailHttpError(409, `${current?.repliedByName || "Someone"} has already replied to this mail.`, {
          code: "ALREADY_REPLIED",
          repliedByName: current?.repliedByName || "",
          repliedAt: current?.repliedAt || null,
        });
      }
    }
  }

  try {
    return await dispatch({
      mailbox,
      actor,
      to: [replyTo],
      subject,
      body,
      files,
      clientRequestId,
      thread: {
        gmailThreadId: anchor.gmailThreadId,
        inReplyTo: anchor.rfcMessageId,
        references: [...(anchor.references || []), anchor.rfcMessageId].filter(Boolean),
      },
      gmail,
      store,
    });
  } catch (err) {
    // Nothing went out (or it failed): give the claim back, unless someone else
    // has since claimed it.
    if (claimTarget) {
      await EmailMessage.updateOne(
        { _id: claimTarget._id, repliedBy: actor.id, repliedAt: claimedAt },
        { $set: previous }
      );
    }
    throw err;
  }
}

// Mirrors Mark as spam / Not spam into Gmail first; the database only changes
// once Gmail has accepted it.
async function setSpamState({ message, isSpam, gmail }) {
  if (message.direction !== "in") throw new EmailHttpError(400, "Only received mail can be marked as spam.");
  if (message.isSpam === isSpam) return message;
  try {
    await gmail.setSpam(message.gmailMessageId, isSpam);
  } catch (err) {
    console.error("[email-spam] Gmail update failed:", err?.message || err);
    throw new EmailHttpError(502, "Could not update Gmail. Please try again.");
  }
  message.isSpam = isSpam;
  await message.save();
  return message;
}

module.exports = { EmailHttpError, pickReplyTarget, sendNewMail, sendReply, setSpamState };
