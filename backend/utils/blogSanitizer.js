const sanitizeHtml = require("sanitize-html");

// Public URL prefix of the blog image proxy (routes/blogs.js).
const BLOG_IMAGE_URL_PREFIX = "/api/blogs/image/";

const ALLOWED_TAGS = ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "img", "hr"];

function isBlogImageUrl(src) {
  if (typeof src !== "string") return false;
  const raw = src.trim();
  // Accept the relative proxy path or an absolute URL whose path is the proxy.
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return false;
    }
  }
  return pathname.startsWith(BLOG_IMAGE_URL_PREFIX) && !pathname.includes("..");
}

function sanitizeBlogHtml(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const out = { href: attribs.href };
        if (attribs.target === "_blank") out.target = "_blank";
        out.rel = "noopener noreferrer";
        return { tagName, attribs: out };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !isBlogImageUrl(frame.attribs.src),
  });
}

function slugifyHeading(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/&[a-z0-9#]+;/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]*>/g, "");
}

function decodeBasicEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Adds a stable id to every <h2> (sanitized output has no attributes on h2, so
// the simple pattern is safe) and returns the TOC. Ids are deterministic from
// the heading text, with -2, -3 ... suffixes for duplicates.
function addHeadingIds(sanitizedHtml) {
  const used = new Map();
  const toc = [];
  const content = sanitizedHtml.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner) => {
    const label = decodeBasicEntities(stripTags(inner)).replace(/\s+/g, " ").trim();
    if (!label) return `<h2>${inner}</h2>`;
    const base = slugifyHeading(label);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    toc.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { content, toc };
}

function processBlogContent(rawHtml) {
  return addHeadingIds(sanitizeBlogHtml(rawHtml));
}

// ~200 wpm, same rate the existing article pages use.
function estimateReadTime(html) {
  const words = decodeBasicEntities(stripTags(html)).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

module.exports = {
  BLOG_IMAGE_URL_PREFIX,
  sanitizeBlogHtml,
  addHeadingIds,
  processBlogContent,
  estimateReadTime,
  isBlogImageUrl,
};
