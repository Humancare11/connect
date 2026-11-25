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
// The look is a normal personal email (white page, left aligned, max 600px), not a newsletter.
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
      return lines.join("<br>");
    });
  // The last paragraph has no bottom margin, so a signature can sit 6px below it.
  const last = paragraphs.length - 1;
  const body = paragraphs.map((html, i) => `<p style="margin:0 0 ${i === last ? 0 : 14}px 0;">${html}</p>`).join("");
  return (
    '<body style="margin:0;padding:0;background:#ffffff;">' +
    `<div style="max-width:600px;padding:16px 16px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:#16213e;text-align:left;">${body}</div></body>`
  );
}

module.exports = { textToHtml, MAX_SOURCE_CHARS };
