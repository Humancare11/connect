// HTML twin of a plain-text mail. Built FROM the final plain text, so the two
// parts of a tracked mail always say exactly the same thing. Text is escaped,
// line breaks and runs of spaces are kept, bare http(s) links stay clickable
// (as they are in a plain-text mail) and are NOT rewritten — no click tracking.

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Runs on already-escaped text. Trailing punctuation is not part of the link.
function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (match) => {
    const trail = (match.match(/(?:[.,;:!?)\]]|&quot;|&#39;|&amp;)+$/) || [""])[0];
    const url = trail ? match.slice(0, -trail.length) : match;
    if (!/^https?:\/\/[^\s<"]+$/.test(url) || url.length < 9) return match;
    return `<a href="${url}">${url}</a>${trail}`;
  });
}

function textToHtml(text) {
  const body = linkify(escapeHtml(String(text).replace(/\r\n/g, "\n")))
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
    .replace(/ {2}/g, " &nbsp;")
    .replace(/\n/g, "<br>\n");
  return body;
}

// → full HTML document: the text, then the 1x1 tracking image (when imageUrl is given).
function buildHtml(text, { imageUrl = "" } = {}) {
  const img = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" width="1" height="1" alt="" border="0" style="border:0;width:1px;height:1px">`
    : "";
  return (
    `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f1f1f">${textToHtml(text)}</div>` +
    `${img}</body></html>`
  );
}

module.exports = { buildHtml, textToHtml, escapeHtml };
