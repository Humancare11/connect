const addressParser = require("nodemailer/lib/addressparser");
const sanitizeHtml = require("sanitize-html");

// Turns a Gmail `format=full` message into the flat shape our sync stores.

// ── RFC 2047 encoded words ("=?UTF-8?B?...?=") in headers ──
function decodeCharset(buffer, charset) {
  try {
    return new TextDecoder(charset || "utf-8").decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

function decodeMimeWords(value) {
  return String(value || "")
    .replace(/(\?=)\s+(=\?)/g, "$1$2") // whitespace between adjacent encoded words is dropped
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, charset, enc, text) => {
      const bytes =
        enc.toUpperCase() === "B"
          ? Buffer.from(text, "base64")
          : Buffer.from(
              text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))),
              "latin1"
            );
      return decodeCharset(bytes, charset);
    });
}

const clean = (v) => decodeMimeWords(v).replace(/[\r\n]+/g, " ").trim();

function parseAddresses(headerValue) {
  if (!headerValue) return [];
  return addressParser(String(headerValue), { flatten: true })
    .filter((a) => a.address)
    .map((a) => ({ name: clean(a.name).slice(0, 200), address: a.address.trim().toLowerCase() }));
}

// ── HTML: mail is hostile input. No scripts/styles/forms/event handlers. ──
const HTML_OPTIONS = {
  allowedTags: [
    "a", "b", "strong", "i", "em", "u", "s", "br", "p", "div", "span", "blockquote", "pre", "code",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "img",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "sub", "sup", "small",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan", "align"],
    th: ["colspan", "rowspan", "align"],
    table: ["width", "align"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // cid: = inline attachment, data: = embedded image. Remote http(s) images are
  // blocked at render time by the iframe's CSP so opening a mail can't fire
  // tracking pixels (which would also reveal which admin opened it).
  allowedSchemesByTag: { img: ["http", "https", "cid", "data"] },
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

const sanitizeEmailHtml = (html) => sanitizeHtml(String(html || ""), HTML_OPTIONS);

const htmlToText = (html) =>
  sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const makeSnippet = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);

// ── MIME tree ──
function headerMap(headers = []) {
  const map = {};
  for (const h of headers) map[String(h.name).toLowerCase()] = h.value;
  return map;
}

function walk(part, out) {
  if (!part) return;
  const mimeType = String(part.mimeType || "").toLowerCase();
  const headers = headerMap(part.headers);
  const filename = clean(part.filename || "");
  const body = part.body || {};

  if (part.parts?.length) {
    for (const child of part.parts) walk(child, out);
    return;
  }

  if (filename || (body.attachmentId && !mimeType.startsWith("text/"))) {
    const disposition = String(headers["content-disposition"] || "").toLowerCase();
    const contentId = String(headers["content-id"] || "").replace(/[<>]/g, "").trim();
    out.attachments.push({
      filename: filename || "attachment",
      mimeType: mimeType || "application/octet-stream",
      size: Number(body.size) || 0,
      gmailAttachmentId: body.attachmentId || "",
      partId: part.partId || "",
      contentId,
      isInline: disposition.startsWith("inline") && Boolean(contentId),
      // Small parts can arrive inline in the message instead of by attachmentId.
      ...(body.data && !body.attachmentId ? { data: Buffer.from(body.data, "base64url") } : {}),
    });
    return;
  }

  if (body.data && (mimeType === "text/plain" || mimeType === "text/html")) {
    const charset = /charset="?([^";\s]+)/i.exec(headers["content-type"] || "")?.[1];
    const decoded = decodeCharset(Buffer.from(body.data, "base64url"), charset);
    (mimeType === "text/plain" ? out.texts : out.htmls).push(decoded);
  }
}

// → the normalised message, or null when there is nothing to store (no id).
function parseGmailMessage(msg) {
  if (!msg?.id) return null;
  const payload = msg.payload || {};
  const h = headerMap(payload.headers);
  const labelIds = msg.labelIds || [];

  const out = { texts: [], htmls: [], attachments: [] };
  walk(payload, out);

  const html = out.htmls.length ? sanitizeEmailHtml(out.htmls.join("\n")) : "";
  const text = (out.texts.join("\n").trim() || htmlToText(html)).trim();
  const visible = out.attachments.filter((a) => !a.isInline);

  const references = String(h.references || "").split(/\s+/).filter(Boolean);

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId || null,
    labelIds,
    isSpam: labelIds.includes("SPAM"),
    isSent: labelIds.includes("SENT"),
    isDraft: labelIds.includes("DRAFT"),
    isTrash: labelIds.includes("TRASH"),
    isUnread: labelIds.includes("UNREAD"),
    messageDate: new Date(Number(msg.internalDate) || Date.now()),
    rfcMessageId: String(h["message-id"] || "").trim(),
    inReplyTo: String(h["in-reply-to"] || "").trim(),
    references,
    from: parseAddresses(h.from)[0] || { name: "", address: "unknown@unknown.invalid" },
    to: parseAddresses(h.to),
    cc: parseAddresses(h.cc),
    subject: clean(h.subject || "").slice(0, 998),
    text,
    html,
    snippet: makeSnippet(text),
    attachments: out.attachments,
    hasAttachments: visible.length > 0,
    attachmentCount: visible.length,
  };
}

module.exports = { parseGmailMessage, decodeMimeWords, sanitizeEmailHtml, makeSnippet };
