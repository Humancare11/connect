const sanitizeHtml = require("sanitize-html");

// Server-side clean-up of the HTML an admin pastes or uploads. Whatever the browser sent is never trusted.
//   removed: scripts, inline event handlers (onclick=...), iframes/forms/objects/base/meta/svg and javascript: URLs
//   kept:    tables, images, links, inline styles and <style> blocks (their CSS is cleaned as well)
// The result is a complete, standalone HTML document.

const ALLOWED_TAGS = [
  "a", "abbr", "address", "article", "aside", "b", "big", "blockquote", "body", "br", "caption", "center", "cite",
  "code", "col", "colgroup", "dd", "div", "dl", "dt", "em", "figcaption", "figure", "font", "footer", "h1", "h2",
  "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "li", "main", "mark", "nav", "ol", "p", "pre", "q", "s",
  "section", "small", "span", "strike", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
  "time", "tr", "tt", "u", "ul",
];

const GLOBAL_ATTRS = [
  "style", "class", "id", "align", "valign", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing",
  "colspan", "rowspan", "dir", "lang", "title", "role",
];

// CSS (a <style> block or a style="" attribute) without anything that can run code or reach out oddly.
function cleanCss(css) {
  return String(css ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\/g, "") // CSS escapes could hide "javascript" from the checks below
    .replace(/@import[^;]*;?/gi, "")
    .replace(/@charset[^;]*;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "none")
    .replace(/-moz-binding\s*:[^;}]*/gi, "")
    .replace(/behavior\s*:[^;}]*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/url\(\s*(['"]?)\s*(?!https?:)[^)]*\)/gi, "none")
    .replace(/</g, "");
}

const countOf = (text, re) => (String(text).match(re) || []).length;

function sanitizeEmailHtml(input) {
  let source = String(input ?? "");
  const removed = {
    scripts: countOf(source, /<script\b/gi),
    eventHandlers: countOf(source, /<[a-z][^>]*\son[a-z]+\s*=/gi),
    otherUnsafe:
      countOf(source, /<(iframe|object|embed|form|input|button|textarea|select|base|meta|link|applet|svg|math|frame|frameset|video|audio)\b/gi) +
      countOf(source, /javascript\s*:/gi),
  };

  // <style> blocks: pulled out first, cleaned, and put back in the <head>.
  const styles = [];
  source = source.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_m, css) => {
    const cleaned = cleanCss(css).trim();
    if (cleaned) styles.push(cleaned);
    return "";
  });
  source = source.replace(/<head\b[\s\S]*?<\/head\s*>/gi, "");

  const body = sanitizeHtml(source, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": GLOBAL_ATTRS,
      a: ["href", "target", "rel", "name"],
      img: ["src", "alt", "width", "height", "border", "style"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      "*": (tagName, attribs) => {
        const next = { ...attribs };
        if (typeof next.style === "string") {
          const cleaned = cleanCss(next.style).trim();
          if (cleaned) next.style = cleaned;
          else delete next.style;
        }
        if (tagName === "a") next.rel = "noopener noreferrer";
        return { tagName, attribs: next };
      },
    },
  });

  const hasBody = /<body\b/i.test(body);
  const css = styles.length ? `<style>${styles.join("\n")}</style>` : "";
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `${css}</head>${hasBody ? body : `<body>${body}</body>`}</html>`;

  return { html, removed, bytes: Buffer.byteLength(html, "utf8") };
}

module.exports = { sanitizeEmailHtml, cleanCss };
