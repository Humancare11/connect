const EmailAttachment = require("../../models/EmailAttachment");
const EmailMessage = require("../../models/EmailMessage");
const { parseGmailMessage } = require("../gmail/mimeParser");
const { attachmentKey } = require("../../utils/emailAttachments");

// Gmail's own per-message cap; anything larger than this is not cached.
const MAX_CACHE_BYTES = 25 * 1024 * 1024;

// Bytes of a stored attachment. Outbound files and already-cached inbound files
// come from S3; an inbound file is fetched from Gmail on first download (the
// Gmail attachment id is re-resolved through the MIME partId, because Gmail may
// issue a different id each time) and then cached for next time.
// → Buffer, or null when the file cannot be found anywhere.
async function getAttachmentBytes({ attachment, gmail, store }) {
  if (attachment.s3Key) {
    try {
      return await store.get(attachment.s3Key);
    } catch (err) {
      if (!attachment.gmailAttachmentId && !attachment.partId) throw err;
      // Cache object missing: fall through and re-fetch from Gmail.
    }
  }

  const message = await EmailMessage.findById(attachment.message).select("gmailMessageId mailbox").lean();
  if (!message?.gmailMessageId) return null;

  const raw = await gmail.getMessage(message.gmailMessageId);
  const parsed = raw ? parseGmailMessage(raw) : null;
  const match = parsed?.attachments.find((a) => (attachment.partId && a.partId === attachment.partId) || (attachment.gmailAttachmentId && a.gmailAttachmentId === attachment.gmailAttachmentId));
  if (!match) return null;

  const bytes = match.data || (match.gmailAttachmentId ? await gmail.getAttachment(message.gmailMessageId, match.gmailAttachmentId) : null);
  if (!bytes) return null;

  if (bytes.length <= MAX_CACHE_BYTES) {
    try {
      const key = attachmentKey(message.mailbox, attachment.message, attachment.filename);
      await store.put(key, bytes, attachment.mimeType);
      await EmailAttachment.updateOne({ _id: attachment._id }, { $set: { s3Key: key, cachedAt: new Date(), size: bytes.length } });
    } catch (err) {
      console.error("[email-attachment] could not cache:", err?.message || err); // download still works
    }
  }
  return bytes;
}

module.exports = { getAttachmentBytes };
