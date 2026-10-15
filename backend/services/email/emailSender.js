const EmailMessage = require("../../models/EmailMessage");
const EmailAttachment = require("../../models/EmailAttachment");
const { buildRawMessage } = require("../gmail/mimeBuilder");
const { makeSnippet } = require("../gmail/mimeParser");
const { attachmentKey } = require("../../utils/emailAttachments");
const EmailLink = require("../../models/EmailLink");
const EmailDownloadLink = require("../../models/EmailDownloadLink");
const { planTracking, planReceipt, planSecureLinks } = require("./emailTracking");
const { getTrackingState } = require("./emailSettings");
const { composeDisclosure } = require("./disclosure");
const EmailSignature = require("../../models/EmailSignature");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { countTrackableLinks } = require("./emailHtml");
const { newToken, linkUrl, downloadUrl } = require("./trackingToken");

// Max tracked links per mail; links beyond this stay as they were written.
const MAX_TRACKED_LINKS = 50;

// Alt text of the signature image in every mail (fixed on purpose: there is no field for it).
const SIGNATURE_ALT = "Signature";

// An error the API shows to the admin as-is (status + message + optional extra JSON).
class EmailHttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = "EmailHttpError";
    this.status = status;
    this.extra = extra;
  }
}

// The admin's signature for this mail. `requested` is the compose form's "Add my signature" box.
// → null (not requested) or the admin's OWN signature document (lean): the owner is always the
// verified session. Asking for a signature that has no image is refused, never silently skipped.
async function resolveSignatureUse(actor, requested) {
  if (!requested) return null;
  const mine = await EmailSignature.findOne({ owner: actor.id }).lean();
  if (!mine?.image) {
    throw new EmailHttpError(400, 'You have no signature image. Untick "Add my signature", or upload one in My signature.', { code: "SIGNATURE_NOT_FOUND" });
  }
  return mine;
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
async function dispatch({ mailbox, actor, to, cc = [], subject, body, files = [], clientRequestId, thread = null, gmail, store, trackOpens, requestReceipt = false, secureLinks = false, useSignature = false, trackingState }) {
  const requestId = cleanRequestId(clientRequestId);

  if (requestId) {
    const existing = await EmailMessage.findOne({ sentByAdmin: actor.id, clientRequestId: requestId });
    if (existing) return { message: existing, duplicate: true };
  }

  // An image signature: the bytes come from OUR storage by the admin's own record, never from
  // the request. If they cannot be loaded the mail is refused (it is not sent without the image
  // the admin chose); a claimed reply is given back by the caller.
  const signature = await resolveSignatureUse(actor, useSignature);
  let signatureImage = null;
  if (signature) {
    let content;
    try {
      content = await store.get(signature.image.key);
    } catch (err) {
      console.error("[email-send] signature image could not be loaded:", err?.message || err);
      throw new EmailHttpError(
        503,
        "Your signature image could not be loaded, so the mail was not sent. Try again, or untick \"Add my signature\".",
        { code: "SIGNATURE_IMAGE_UNAVAILABLE" }
      );
    }
    signatureImage = { content, mime: signature.image.mime, width: signature.image.width, height: signature.image.height, alt: SIGNATURE_ALT };
  }
  // The image takes the place of the Mail ID's text footer.
  const companyFooter = !signatureImage;

  // Open tracking is decided per mail (global switches, the "Track opens" box,
  // recipients). The token is made now so the stored row can already be found by
  // a very fast open.
  const state = trackingState || (await getTrackingState());
  const plan = await planTracking({ mailbox, to, cc, requested: trackOpens, state });
  // A read receipt is its own box and works without the image.
  const receipt = await planReceipt({ to, cc, requested: requestReceipt, state });

  // Secure attachment links: its own box, default off. Every file gets its own token and
  // the files are not attached. If the box was ticked but the feature is off now, refuse
  // rather than quietly attach the files: the admin asked for them NOT to travel in the mail.
  const secure = await planSecureLinks({ requested: secureLinks, fileCount: files.length, state });
  if (secure.reason === "off") {
    throw new EmailHttpError(409, "Secure attachment links are switched off, so the mail was not sent. Untick the box, or ask a Super Admin to switch them on.", { code: "SECURE_LINKS_OFF" });
  }
  const secureFiles = secure.enabled
    ? files.map((file, index) => ({ file, index, ...newToken() }))
    : [];
  const secureExpiresAt = secure.enabled ? new Date(Date.now() + secure.days * 24 * 3600 * 1000) : null;

  // Click tracking: every http(s) link of the HTML part gets its own token. The same
  // address twice in one mail is one link, so "which link" stays meaningful.
  const trackedLinks = [];
  const linkTracker = plan.enabled && plan.links
    ? (url) => {
        // Secure download links are already tracked by the download itself.
        if (secure.enabled && url.startsWith(`${secure.baseUrl}/api/d/`)) return null;
        let entry = trackedLinks.find((l) => l.url === url);
        if (!entry) {
          if (trackedLinks.length >= MAX_TRACKED_LINKS) return null;
          const { token, hash } = newToken();
          entry = { url, token, hash, index: trackedLinks.length };
          trackedLinks.push(entry);
        }
        return linkUrl(plan.baseUrl, entry.token);
      }
    : null;

  // The footer notice names exactly what this mail does: opens, links (only if it has some),
  // downloads, read receipt. Mail that is not tracked in any way carries none.
  const disclosure = composeDisclosure(
    {
      opens: plan.enabled,
      // Whatever will really be in the mail: the body and the company footer (none with an image signature).
      links: Boolean(linkTracker) && countTrackableLinks(`${body}\n${companyFooter ? mailbox.signature || "" : ""}`) > 0,
      downloads: secure.enabled,
      receipt: receipt.enabled,
    },
    state
  );

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
    tracking: plan.enabled ? { imageUrl: plan.imageUrl, disclosure, linkTracker } : null,
    disclosure,
    requestReceipt: receipt.enabled,
    companyFooter,
    signatureImage,
    secureLinks: secure.enabled
      ? {
          items: secureFiles.map((s) => ({ filename: s.file.filename, size: s.file.content.length, url: downloadUrl(secure.baseUrl, s.token) })),
          expiresAt: secureExpiresAt,
        }
      : null,
  });

  // This mail keeps its own copy of the signature image (key known before the row is saved).
  const messageId = new mongoose.Types.ObjectId();
  const sentImage = signatureImage
    ? {
        key: `email-sent-signatures/${mailbox._id}/${messageId}/${crypto.randomBytes(8).toString("hex")}.${signatureImage.mime === "image/jpeg" ? "jpg" : "png"}`,
        mime: signatureImage.mime,
        width: signatureImage.width,
        height: signatureImage.height,
        alt: signatureImage.alt,
      }
    : undefined;

  const doc = new EmailMessage({
    _id: messageId,
    ...(sentImage ? { signatureImage: sentImage } : {}),
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
    tracking: plan.enabled
      ? { enabled: true, tokenHash: plan.hash, status: "pending", includesInternal: plan.includesInternal, allRecipientsApple: plan.allRecipientsApple, receiptRequested: receipt.enabled, secureLinks: secure.enabled, secureLinksExpireAt: secureExpiresAt }
      : { enabled: false, status: "unavailable", unavailableReason: plan.reason, receiptRequested: receipt.enabled, secureLinks: secure.enabled, secureLinksExpireAt: secureExpiresAt },
  });
  // Only the plain text is stored: the dashboard never renders the tracking image,
  // so our own admins opening a mail here can never count as the recipient.
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

  // The image copy is written before the mail leaves: the mail page needs it, and a mail that
  // cannot keep its record is not sent.
  if (sentImage) {
    try {
      await store.put(sentImage.key, signatureImage.content, signatureImage.mime);
    } catch (err) {
      console.error("[email-send] signature image copy failed:", err?.message || err);
      await EmailMessage.updateOne({ _id: doc._id }, { $set: { status: "failed", failureReason: "The signature image could not be stored." } });
      throw new EmailHttpError(502, "The mail could not be prepared, so it was not sent. Please try again.", { messageId: String(doc._id) });
    }
  }

  // The links must exist before the mail leaves, or a very fast click would find nothing.
  if (trackedLinks.length) {
    try {
      await EmailLink.insertMany(trackedLinks.map((l) => ({ message: doc._id, index: l.index, url: l.url, tokenHash: l.hash })));
    } catch (err) {
      console.error("[email-send] could not store tracked links:", err?.message || err);
      await EmailMessage.updateOne({ _id: doc._id }, { $set: { status: "failed", failureReason: "Tracked links could not be stored." } });
      throw new EmailHttpError(502, "The mail could not be prepared, so it was not sent. Please try again.", { messageId: String(doc._id) });
    }
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
      const rows = await EmailAttachment.insertMany(
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
      // The permission to fetch each file exists before the mail leaves, so a very fast
      // click finds it. It is written last: a failure above leaves no usable link behind.
      if (secureFiles.length) {
        await EmailDownloadLink.insertMany(
          secureFiles.map((s) => ({ message: doc._id, attachment: rows[s.index]._id, index: s.index, tokenHash: s.hash, expiresAt: secureExpiresAt }))
        );
      }
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

function sendNewMail({ mailbox, actor, to, cc, subject, body, files, clientRequestId, gmail, store, trackOpens, requestReceipt, secureLinks, useSignature, trackingState }) {
  return dispatch({ mailbox, actor, to, cc, subject, body, files, clientRequestId, gmail, store, trackOpens, requestReceipt, secureLinks, useSignature, trackingState });
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
async function sendReply({ mailbox, actor, anchor, claimTarget, replyTo, subject, body, files, clientRequestId, confirm = false, gmail, store, trackOpens, requestReceipt = false, secureLinks = false, useSignature = false, trackingState }) {
  // Refuse a signature the admin does not have BEFORE anything is claimed or looked up.
  await resolveSignatureUse(actor, useSignature);

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
      trackOpens,
      requestReceipt,
      secureLinks,
      useSignature,
      trackingState,
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
