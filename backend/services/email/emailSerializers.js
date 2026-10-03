// Explicit response shapes for the mail screens. Fields are picked one by one
// (never spread from the document) so nothing internal — ciphertext, Gmail ids,
// idempotency keys — can reach the browser.

const idOf = (v) => (v ? String(v._id || v) : null);

// Decrypts content; a key mismatch must not take the whole list down.
function safeContent(doc) {
  try {
    return doc.getContent();
  } catch {
    return { text: "", html: "", snippet: "" };
  }
}

function serializeMailbox(mb) {
  return {
    id: idOf(mb._id),
    address: mb.address,
    displayName: mb.displayName,
    color: mb.color,
  };
}

function baseFields(doc, mailboxMap) {
  const mb = mailboxMap.get(idOf(doc.mailbox));
  return {
    id: idOf(doc._id),
    mailbox: mb ? serializeMailbox(mb) : null,
    direction: doc.direction,
    from: { name: doc.from?.name || "", address: doc.from?.address || "" },
    to: (doc.to || []).map((a) => ({ name: a.name || "", address: a.address })),
    cc: (doc.cc || []).map((a) => ({ name: a.name || "", address: a.address })),
    subject: doc.subject,
    messageDate: doc.messageDate,
    isSpam: doc.isSpam,
    status: doc.status,
    failureReason: doc.status === "failed" ? doc.failureReason : "",
    hasAttachments: doc.hasAttachments,
    attachmentCount: doc.attachmentCount,
    sentBy: doc.direction === "out" && doc.sentByName ? { id: idOf(doc.sentByAdmin), name: doc.sentByName } : null,
    sentOutsideDashboard: doc.sentOutsideDashboard,
    repliedAt: doc.repliedAt,
    repliedByName: doc.direction === "in" ? doc.repliedByName : "",
    firstViewed: doc.firstViewedAt
      ? { by: { id: idOf(doc.firstViewedBy), name: doc.firstViewedByName }, at: doc.firstViewedAt }
      : null,
    // Shared-inbox meaning: unread = no admin has opened it yet.
    unread: doc.direction === "in" && !doc.firstViewedAt,
  };
}

function serializeListItem(doc, mailboxMap) {
  return { ...baseFields(doc, mailboxMap), snippet: safeContent(doc).snippet };
}

// attachmentsByMessage: Map(messageId → EmailAttachment[]); adminsById: Map(id → { name, role }).
function serializeThreadMessage(doc, mailboxMap, attachmentsByMessage, adminsById) {
  const content = safeContent(doc);
  const base = baseFields(doc, mailboxMap);
  const sender = doc.sentByAdmin ? adminsById.get(idOf(doc.sentByAdmin)) : null;
  return {
    ...base,
    sentBy: base.sentBy ? { ...base.sentBy, role: sender?.role || "" } : null,
    text: content.text,
    html: content.html,
    attachments: (attachmentsByMessage.get(idOf(doc._id)) || []).map((a) => ({
      id: idOf(a._id),
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      isInline: a.isInline,
    })),
  };
}

module.exports = { serializeMailbox, serializeListItem, serializeThreadMessage, idOf };
