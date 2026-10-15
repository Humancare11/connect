const crypto = require("crypto");
const MailComposer = require("nodemailer/lib/mail-composer");
const {
  EmailValidationError,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_BODY_LENGTH,
  MAX_TOTAL_ATTACHMENT_BYTES,
  assertRecipientCount,
  cleanSubject,
  stripLineBreaks,
} = require("../../utils/emailValidation");
const { EMAIL_DOMAIN } = require("../../models/Mailbox");
const { buildHtml } = require("../email/emailHtml");

// Visible sender name. Clients only ever see the company, never the admin.
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Human Care Connect";

// Body is plain text + the mailbox's company footer (+ the tracking disclosure line
// on tracked mail). The admin's name is deliberately never added — attribution
// lives only in our database. Without a disclosure the result is exactly what
// it always was.
function composeText(body, signature, disclosure = "", attachmentBlock = "", { adminSignature = false, companyFooter = true } = {}) {
  const text = String(body ?? "").replace(/\r\n/g, "\n").trimEnd();
  const block = String(attachmentBlock || "").trim();
  const company = String(signature || "").trim();
  const notice = String(disclosure || "").trim();

  if (adminSignature) {
    // The admin's signature is already at the end of `text` (the composer put it there, below
    // a "-- " line, and the admin could edit it). Order: message, attachments, signature,
    // company footer, notice. The attachment lines go ABOVE the signature, not after it.
    const cut = block ? lastDividerIndex(text) : -1;
    const main = !block
      ? text
      : cut >= 0
        ? `${text.slice(0, cut).trimEnd()}\n\n${block}\n\n${text.slice(cut)}`
        : `${text}\n\n${block}`;
    // One divider only: the company footer follows the signature without a second "-- ".
    return `${[main, companyFooter ? company : "", notice].filter(Boolean).join("\n\n")}\n`;
  }

  const withBlock = [text, block].filter(Boolean).join("\n\n");
  const footer = [company, notice].filter(Boolean).join("\n\n");
  return footer ? `${withBlock}\n\n-- \n${footer}\n` : `${withBlock}\n`;
}

// Index of the start of the LAST signature divider line ("-- " or "--"), or -1.
function lastDividerIndex(text) {
  let at = -1;
  const re = /^-- ?$/gm;
  let m;
  while ((m = re.exec(text)) !== null) at = m.index;
  return at;
}

// Builds the RFC 822 message for Gmail's messages.send.
//   mailbox      active Mailbox doc (address + signature)
//   to / cc      already-normalised [{ name, address }] (see emailValidation)
//   inReplyTo    RFC Message-ID of the mail being answered (from OUR database)
//   references   RFC Message-IDs of the thread so far (from OUR database)
//   attachments  [{ filename, contentType, content: Buffer }]
//   tracking     { imageUrl, disclosure, linkTracker? } → the mail becomes multipart/alternative
//                (the same plain text + an HTML twin ending in a 1x1 image; with a
//                linkTracker the HTML links go through it, the text part is unchanged);
//                null/absent → plain text only, exactly as before
//   secureLinks  { items: [{ filename, size, url }], expiresAt } → the files are NOT attached;
//                the text lists one link per file and says when they stop being available
//                (no wording about tracking)
//                (the files are still validated like attachments)
//   disclosure   the footer notice for mail that has no `tracking` (secure links, read receipt
//                only); mail with `tracking` carries tracking.disclosure
//   adminSignature  true → the admin's signature is already at the end of `body`; the company
//                footer then follows it without a second divider (and is left out when
//                companyFooter is false); attachment lines go above the signature
//   requestReceipt  true → adds Disposition-Notification-To: <the mailbox address>, so
//                the recipient's mail app may confirm the mail was displayed
// → { raw: Buffer, rfcMessageId, text }
async function buildRawMessage({ mailbox, to, cc = [], subject, body, inReplyTo = "", references = [], attachments = [], tracking = null, requestReceipt = false, secureLinks = null, disclosure = "", adminSignature = false, companyFooter = true }) {
  if (!to?.length) throw new EmailValidationError("At least one recipient is required.");
  assertRecipientCount(to, cc);

  const cleanedSubject = cleanSubject(subject);
  if (!cleanedSubject) throw new EmailValidationError("Subject is required.");
  if (!String(body ?? "").trim()) throw new EmailValidationError("Message is required.");
  if (String(body).length > MAX_BODY_LENGTH) throw new EmailValidationError("Message is too long.");

  if (attachments.length > MAX_ATTACHMENTS) {
    throw new EmailValidationError(`Too many attachments (max ${MAX_ATTACHMENTS}).`);
  }
  let total = 0;
  for (const file of attachments) {
    const size = file.content?.length || 0;
    if (size > MAX_ATTACHMENT_BYTES) {
      throw new EmailValidationError(`"${stripLineBreaks(file.filename)}" is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
    }
    total += size;
  }
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new EmailValidationError(`Attachments exceed ${MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024} MB in total.`);
  }

  // We choose the Message-ID so it is stored before Gmail ever sees the mail.
  const rfcMessageId = `<${crypto.randomUUID()}@${EMAIL_DOMAIN}>`;
  const text = composeText(body, mailbox.signature, tracking ? tracking.disclosure : disclosure, secureLinks ? secureLinksBlock(secureLinks) : "", {
    adminSignature,
    companyFooter,
  });
  const cleanRef = (id) => stripLineBreaks(id);

  const composer = new MailComposer({
    from: { name: FROM_NAME, address: mailbox.address },
    to: to.map((a) => ({ name: a.name, address: a.address })),
    cc: cc.map((a) => ({ name: a.name, address: a.address })),
    subject: cleanedSubject,
    text,
    ...(tracking?.imageUrl ? { html: buildHtml(text, { imageUrl: tracking.imageUrl, linkTracker: tracking.linkTracker || null }) } : {}),
    messageId: rfcMessageId,
    // The address comes from our own mailbox record, never from the request.
    ...(requestReceipt ? { headers: { "Disposition-Notification-To": mailbox.address } } : {}),
    ...(inReplyTo ? { inReplyTo: cleanRef(inReplyTo) } : {}),
    ...(references.length ? { references: references.map(cleanRef).filter(Boolean) } : {}),
    attachments: (secureLinks ? [] : attachments).map((file) => ({
      filename: stripLineBreaks(file.filename).slice(0, 255) || "attachment",
      contentType: file.contentType || "application/octet-stream",
      content: file.content,
    })),
  });

  const raw = await new Promise((resolve, reject) => {
    composer.compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });
  return { raw, rfcMessageId, text };
}

const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// The lines that stand where the attachments would be. Plain text, so they read the same
// in the text part and the HTML part, and a mail app can make the addresses clickable.
function secureLinksBlock({ items, expiresAt }) {
  const until = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const lines = items.map((i) => `- ${stripLineBreaks(i.filename)} (${fmtSize(i.size || 0)})\n  ${i.url}`);
  // Only what the recipient needs: the files, their sizes and when they stop being available.
  return [`Attachments (available until ${until}, UTC):`, ...lines].join("\n");
}

module.exports = { buildRawMessage, composeText, secureLinksBlock };
