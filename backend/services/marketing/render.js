// Builds ONE recipient's email from the campaign's sanitised HTML. Pure: no database, no network.
//   1. {{name}} / {{company}} are filled in (with the campaign's fallbacks). Values are HTML-escaped, and
//      URL-encoded inside href="..." so a name can never break out of a link.
//   2. The plain-text twin is made from that.
//   3. Links are rewritten through the tracking redirect (when `trackLink` is given), then the unsubscribe
//      footer and the 1x1 tracking image are added. Tracking is never announced in the mail.

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;
const KNOWN_PLACEHOLDERS = ["name", "company"];
const MAX_TRACKED_LINKS = 50;

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const unescapeHtml = (s) =>
  String(s ?? "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const valuesFor = (recipient, campaign) => ({
  name: (recipient?.name || "").trim() || (campaign?.fallbackName || "there"),
  company: (recipient?.company || "").trim() || (campaign?.fallbackCompany || ""),
});

function fillText(text, values) {
  return String(text ?? "").replace(PLACEHOLDER_RE, (match, key) => {
    const k = key.toLowerCase();
    return KNOWN_PLACEHOLDERS.includes(k) ? values[k] : match;
  });
}

function fillHtml(html, values) {
  // Inside href="..." first (URL-encoded), then everywhere else (HTML-escaped).
  const encoded = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, encodeURIComponent(v)]));
  const withLinks = String(html ?? "").replace(/(\shref=")([^"]*)(")/gi, (_m, a, value, c) => a + fillText(value, encoded) + c);
  const escaped = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeHtml(v)]));
  return fillText(withLinks, escaped);
}

// The subject is plain text: no line breaks (header injection), trimmed, capped.
const cleanSubject = (subject, values) =>
  fillText(subject, values).replace(/[\r\n\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

// Names of {{...}} placeholders that are not supported (typos such as {{nmae}}).
function unknownPlaceholders(...texts) {
  const found = new Set();
  for (const text of texts) {
    for (const m of String(text ?? "").matchAll(PLACEHOLDER_RE)) {
      if (!KNOWN_PLACEHOLDERS.includes(m[1].toLowerCase())) found.add(m[1]);
    }
  }
  return [...found];
}

const usesPlaceholder = (...texts) =>
  texts.some((t) => [...String(t ?? "").matchAll(PLACEHOLDER_RE)].some((m) => KNOWN_PLACEHOLDERS.includes(m[1].toLowerCase())));

function htmlToText(html) {
  return unescapeHtml(
    String(html ?? "")
      .replace(/<(head|style|script)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<a\b[^>]*\shref="(https?:[^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, href, label) => {
        const text = label.replace(/<[^>]+>/g, "").trim();
        const url = unescapeHtml(href);
        return text && text !== url ? `${text} (${url})` : url;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h[1-6]|li|table|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Rewrites http(s) links through the tracking redirect. `trackLink(originalUrl)` returns the tracking URL or null
// (leave the link alone). The same address twice in one mail is the same tracked link.
function rewriteLinks(html, trackLink) {
  if (!trackLink) return html;
  return html.replace(/<a\b([^>]*?)\shref="(https?:[^"]*)"/gi, (match, before, href) => {
    const original = unescapeHtml(href);
    if (original.length > 2048) return match;
    const tracked = trackLink(original);
    return tracked ? `<a${before} href="${escapeHtml(tracked)}"` : match;
  });
}

function appendBeforeBodyEnd(html, fragment) {
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i === -1 ? html + fragment : html.slice(0, i) + fragment + html.slice(i);
}

function footerHtml({ address, unsubscribeUrl }) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a93a6;text-align:center;padding:14px 12px 22px;">' +
    `${escapeHtml(address)}<br>You received this email from Humancare Connect. ` +
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a93a6;text-decoration:underline;">Unsubscribe</a></div>`
  );
}

const footerText = ({ address, unsubscribeUrl }) =>
  `\n\n--\n${address}\nYou received this email from Humancare Connect. Unsubscribe: ${unsubscribeUrl}`;

const pixelHtml = (url) =>
  `<img src="${escapeHtml(url)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;overflow:hidden">`;

// The image signature, like on the Email page: shown at most 420px wide (width/height attributes set), 6px below the
// content. It has no link, and it is added AFTER links are rewritten, so click tracking can never touch it.
// `signature`: { url, width, height } with width/height already the display size. `centered`: inside a 600px column
// (used when the design came from the "Write text" tab, whose layout is centered).
function signatureBlockHtml({ url, width, height }, { centered = false } = {}) {
  const img =
    `<img src="${escapeHtml(url)}" alt="Signature" width="${width}" height="${height}" border="0" ` +
    `style="width:${width}px;max-width:100%;height:auto;display:block;border:0">`;
  if (!centered) return `<div style="margin-top:6px">${img}</div>`;
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 12px;">' +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="padding:0 32px;"><div style="margin-top:6px">${img}</div></td></tr></table>` +
    "</td></tr></table>"
  );
}

// → { subject, html, text, bytes }
function renderMail({ campaign, recipient, footerAddress, unsubscribeUrl, trackLink = null, pixelUrl = "", signature = null }) {
  const values = valuesFor(recipient, campaign);
  const filled = fillHtml(campaign.html, values);
  // "Write text" designs: the plain-text part is what was typed (placeholders filled), not a re-reading of the HTML.
  const body = campaign.contentMode === "text" && campaign.sourceText ? fillText(campaign.sourceText, values).trim() : htmlToText(filled);
  const text = body + footerText({ address: footerAddress, unsubscribeUrl });

  let html = rewriteLinks(filled, trackLink);
  if (signature) html = appendBeforeBodyEnd(html, signatureBlockHtml(signature, { centered: campaign.contentMode === "text" }));
  html = appendBeforeBodyEnd(html, footerHtml({ address: footerAddress, unsubscribeUrl }));
  if (pixelUrl) html = appendBeforeBodyEnd(html, pixelHtml(pixelUrl));

  return { subject: cleanSubject(campaign.subject, values), html, text, bytes: Buffer.byteLength(html, "utf8") };
}

module.exports = {
  KNOWN_PLACEHOLDERS,
  MAX_TRACKED_LINKS,
  escapeHtml,
  unescapeHtml,
  valuesFor,
  fillText,
  fillHtml,
  cleanSubject,
  unknownPlaceholders,
  usesPlaceholder,
  htmlToText,
  rewriteLinks,
  appendBeforeBodyEnd,
  signatureBlockHtml,
  renderMail,
};
