// HTML twin of a plain-text mail. Built FROM the final plain text, so the two
// parts of a tracked mail always say exactly the same thing. Text is escaped,
// line breaks and runs of spaces are kept, bare http(s) and www. links become clickable
// (as they usually are in a plain-text mail). When a `linkTracker` is given the href of each
// http(s) link goes through it (click tracking); the visible text stays the original
// address, so the two parts of the mail still say the same thing.

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const unescapeHtml = (s) =>
  String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const MAX_LINK_LENGTH = 2048;

// What counts as a link in the body, in the HTML part only:
//   http:// and https:// addresses, and bare "www.example.com" (made https://).
// Email addresses are never linked, and neither is anything else ("example.com",
// "ftp://", "mailto:", "javascript:"): a www. address must start a word, so
// "name@www.example.com" and "xwww.example.com" are left as plain text.
// A www. address needs a real host with a top-level domain: www.example.com,
// www.example.co.uk/path?a=1, www.example.com:8080.
const LINK_RE = new RegExp(
  "https?:\\/\\/[^\\s<]+" +
    "|(?<![\\w@./:-])www\\.(?:[a-z0-9-]+\\.)+[a-z]{2,}(?::\\d+)?(?:[/?#][^\\s<]*)?",
  "gi"
);

// Runs on already-escaped text. Trailing punctuation is not part of the link.
// linkTracker(originalUrl) → the address to put in href, or null to leave the link alone.
// The visible text is always what was typed.
function linkify(escaped, linkTracker = null) {
  return escaped.replace(LINK_RE, (match) => {
    const trail = (match.match(/(?:[.,;:!?)\]]|&quot;|&#39;|&amp;)+$/) || [""])[0];
    const typed = trail ? match.slice(0, -trail.length) : match;
    const isWww = /^www\./i.test(typed);
    // The address that is really visited: www. gets https://.
    const url = isWww ? `https://${typed}` : typed;
    if (!/^https?:\/\/[^\s<"]+$/i.test(url) || typed.length < 9) return match;
    let href = url;
    if (linkTracker) {
      const original = unescapeHtml(url);
      // Only plain http(s) addresses of reasonable length are ever tracked.
      const tracked = original.length <= MAX_LINK_LENGTH && /^https?:\/\//i.test(original) ? linkTracker(original) : null;
      if (tracked) href = escapeHtml(tracked);
    }
    return `<a href="${href}">${typed}</a>${trail}`;
  });
}

function textToHtml(text, { linkTracker = null } = {}) {
  const body = linkify(escapeHtml(String(text).replace(/\r\n/g, "\n")), linkTracker)
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
    .replace(/ {2}/g, " &nbsp;")
    .replace(/\n/g, "<br>\n");
  return body;
}

// → full HTML document: the text, then the 1x1 tracking image (when imageUrl is given).
function buildHtml(text, { imageUrl = "", linkTracker = null } = {}) {
  const img = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" width="1" height="1" alt="" border="0" style="border:0;width:1px;height:1px">`
    : "";
  return (
    `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f1f1f">${textToHtml(text, { linkTracker })}</div>` +
    `${img}</body></html>`
  );
}

// HTML twin of a mail that carries the sender's IMAGE signature:
//
//   message (+ attachment lines)
//   [the signature image]
//   [notice]
//   [the 1x1 tracking image, always last]
//
// parts: { message, notice }
// image: { cid, alt, width, height }
function buildSignatureImageHtml(parts, { image, imageUrl = "", linkTracker = null } = {}) {
  const font = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f1f1f";
  const block = (text, top = 0) => (text ? `<div style="${font}${top ? `;margin-top:${top}px` : ""}">${textToHtml(text, { linkTracker })}</div>` : "");

  const picture =
    `<img src="cid:${escapeHtml(image.cid)}" alt="${escapeHtml(image.alt || "")}" width="${Number(image.width) || 0}"` +
    ` height="${Number(image.height) || 0}" border="0" style="display:block;border:0;max-width:100%;height:auto">`;

  const pixel = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" width="1" height="1" alt="" border="0" style="border:0;width:1px;height:1px">`
    : "";

  return (
    `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>` +
    block(parts.message) +
    `<div style="margin-top:16px">${picture}</div>` +
    block(parts.notice, 16) +
    `${pixel}</body></html>`
  );
}

// How many links of this text would be offered to a link tracker (http/https/www., within the
// length limit). Used to word the footer notice: "links" is only mentioned when there are some.
function countTrackableLinks(text) {
  let n = 0;
  linkify(escapeHtml(String(text || "").replace(/\r\n/g, "\n")), () => {
    n += 1;
    return null;
  });
  return n;
}

module.exports = { buildHtml, buildSignatureImageHtml, textToHtml, escapeHtml, countTrackableLinks };
