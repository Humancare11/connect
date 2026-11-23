const { escapeHtml } = require("./render");

// "Write text" tab: plain text the admin typed -> simple, email-safe HTML. Pure (no database, no network).
//   blank line      -> new paragraph
//   single break    -> <br>
//   http(s) URLs    -> links (so click tracking treats them like any other link)
//   everything else -> HTML-escaped, so typed "<script>" is just visible text
//   {{name}} / {{company}} are left exactly as typed; the normal fill step replaces them per recipient.
// The result is still run through the sanitizer by the caller, like pasted HTML.

const MAX_SOURCE_CHARS = 50_000;
const FONT = "Arial,Helvetica,sans-serif";
// Matches on already-escaped text, so an escaped quote or angle bracket ends the URL.
const URL_RE = /https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<>])+/gi;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

function linkify(escaped) {
  return escaped.replace(URL_RE, (match) => {
    const trail = (match.match(TRAILING_PUNCT) || [""])[0];
    const url = trail ? match.slice(0, match.length - trail.length) : match;
    if (!/^https?:\/\/[^/?#\s]+/i.test(url)) return match;
    return `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${url}</a>${trail}`;
  });
}

function textToHtml(source) {
  const text = String(source ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const paragraphs = text
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lines = p.split("\n").map((l) => linkify(escapeHtml(l.trim())));
      return `<p style="margin:0 0 16px 0;">${lines.join("<br>")}</p>`;
    });
  return (
    '<body style="margin:0;padding:0;background:#f4f6f8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;"><tr>' +
    '<td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;"><tr>' +
    `<td style="padding:28px 32px;font-family:${FONT};font-size:16px;line-height:1.6;color:#1f2937;text-align:left;">` +
    `${paragraphs.join("")}</td></tr></table></td></tr></table></body>`
  );
}

module.exports = { textToHtml, MAX_SOURCE_CHARS };
