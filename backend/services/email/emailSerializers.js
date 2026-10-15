// Explicit response shapes for the mail screens. Fields are picked one by one
// (never spread from the document) so nothing internal — ciphertext, Gmail ids,
// idempotency keys — can reach the browser.

const { computeReadStatus } = require("./readStatus");

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
    trackOpensDefault: mb.trackOpensDefault !== false,
  };
}

// Tracking as the screens show it. Only for outbound mail that actually went out.
// Never includes the token or its hash.
//   status / reason / *OpenedAt / openCount   the open-pixel state ("opened" | "pending" | "unavailable")
//   readStatus / readStatusAt                 the one combined status (see readStatus.js)
//   signals                                   every signal behind it, null where there is none
// A row without a tracking block (older mail, or mail sent from Gmail directly)
// is "unavailable".
const signal = (count, first, last) => (count > 0 ? { count, first: first || null, last: last || null } : null);

function trackingView(doc) {
  const combined = computeReadStatus(doc);
  if (!combined) return null;
  const t = doc.tracking;
  const multiRecipient = (doc.to?.length || 0) + (doc.cc?.length || 0) > 1;
  const signals = {
    replied: doc.status === "replied" ? { at: doc.repliedAt || null } : null,
    downloaded: signal(t?.downloadCount || 0, t?.firstDownloadedAt, t?.lastDownloadedAt),
    clicked: signal(t?.clickCount || 0, t?.firstClickedAt, t?.lastClickedAt),
    receipt: t?.receiptAt ? { at: t.receiptAt, by: t.receiptBy || "" } : null,
    opened: signal(t?.status === "opened" ? t.openCount || 0 : 0, t?.firstOpenedAt, t?.lastOpenedAt),
    openedApple: signal(t?.appleOpenCount || 0, t?.firstAppleOpenedAt, t?.lastAppleOpenedAt),
  };
  // includesInternal: an open may be one of our own colleagues. Both are facts fixed at send time.
  const summary = {
    readStatus: combined.status,
    readStatusAt: combined.at,
    signals,
    multiRecipient,
    includesInternal: Boolean(t?.includesInternal),
    receiptRequested: Boolean(t?.receiptRequested),
    secureLinks: Boolean(t?.secureLinks),
    secureLinksExpireAt: t?.secureLinksExpireAt || null,
    receiptBy: t?.receiptBy || "",
    allRecipientsApple: Boolean(t?.allRecipientsApple),
  };
  if (!t) {
    return {
      status: "unavailable",
      reason: doc.sentOutsideDashboard ? "outside_dashboard" : "tracking_off",
      firstOpenedAt: null,
      lastOpenedAt: null,
      openCount: 0,
      ...summary,
    };
  }
  return {
    status: t.status || "unavailable",
    reason: t.status === "unavailable" ? t.unavailableReason || "" : "",
    firstOpenedAt: t.firstOpenedAt || null,
    lastOpenedAt: t.lastOpenedAt || null,
    openCount: t.openCount || 0,
    ...summary,
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
    tracking: trackingView(doc),
    // Read in Gmail (by someone on the team, not by name). Separate from firstViewed (dashboard views).
    readInGmail: doc.direction === "in" && Boolean(doc.gmailRead),
    // Shared-inbox meaning: unread = no admin has opened it in the dashboard AND it is not read in Gmail.
    unread: doc.direction === "in" && !doc.firstViewedAt && !doc.gmailRead,
  };
}

function serializeListItem(doc, mailboxMap) {
  return { ...baseFields(doc, mailboxMap), snippet: safeContent(doc).snippet };
}

// attachmentsByMessage: Map(messageId → EmailAttachment[]); adminsById: Map(id → { name, role });
// linksByMessage: Map(messageId → [{ index, url, count, first, last }]) (see clickSummary.js).
function serializeThreadMessage(doc, mailboxMap, attachmentsByMessage, adminsById, linksByMessage = new Map(), filesByMessage = new Map()) {
  const content = safeContent(doc);
  const base = baseFields(doc, mailboxMap);
  const sender = doc.sentByAdmin ? adminsById.get(idOf(doc.sentByAdmin)) : null;
  return {
    ...base,
    sentBy: base.sentBy ? { ...base.sentBy, role: sender?.role || "" } : null,
    // The image signature this mail went out with (never the storage key).
    signatureImage: doc.signatureImage
      ? {
          mime: doc.signatureImage.mime,
          width: doc.signatureImage.width,
          height: doc.signatureImage.height,
          alt: doc.signatureImage.alt || "",
          link: doc.signatureImage.link || "",
          layout: doc.signatureImage.layout,
          signatureText: doc.signatureImage.signatureText || "",
        }
      : null,
    // Which tracked link was clicked: only on the mail page, never in lists.
    tracking: base.tracking
      ? { ...base.tracking, links: linksByMessage.get(idOf(doc._id)) || [], files: filesByMessage.get(idOf(doc._id)) || [] }
      : null,
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

module.exports = { serializeMailbox, serializeListItem, serializeThreadMessage, trackingView, idOf };
