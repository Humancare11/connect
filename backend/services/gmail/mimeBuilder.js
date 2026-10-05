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

// Visible sender name. Clients only ever see the company, never the admin.
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Human Care Connect";

// Body is plain text + the mailbox's company footer. The admin's name is
// deliberately never added — attribution lives only in our database.
function composeText(body, signature) {
  const text = String(body ?? "").replace(/\r\n/g, "\n").trimEnd();
  const footer = String(signature || "").trim();
  return footer ? `${text}\n\n-- \n${footer}\n` : `${text}\n`;
}

// Builds the RFC 822 message for Gmail's messages.send.
//   mailbox      active Mailbox doc (address + signature)
//   to / cc      already-normalised [{ name, address }] (see emailValidation)
//   inReplyTo    RFC Message-ID of the mail being answered (from OUR database)
//   references   RFC Message-IDs of the thread so far (from OUR database)
//   attachments  [{ filename, contentType, content: Buffer }]
// → { raw: Buffer, rfcMessageId, text }
async function buildRawMessage({ mailbox, to, cc = [], subject, body, inReplyTo = "", references = [], attachments = [] }) {
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
  const text = composeText(body, mailbox.signature);
  const cleanRef = (id) => stripLineBreaks(id);

  const composer = new MailComposer({
    from: { name: FROM_NAME, address: mailbox.address },
    to: to.map((a) => ({ name: a.name, address: a.address })),
    cc: cc.map((a) => ({ name: a.name, address: a.address })),
    subject: cleanedSubject,
    text,
    messageId: rfcMessageId,
    ...(inReplyTo ? { inReplyTo: cleanRef(inReplyTo) } : {}),
    ...(references.length ? { references: references.map(cleanRef).filter(Boolean) } : {}),
    attachments: attachments.map((file) => ({
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

module.exports = { buildRawMessage, composeText };
