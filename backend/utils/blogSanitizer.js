const sanitizeHtml = require("sanitize-html");

// Public URL prefix of the blog image proxy (routes/blogs.js).
const BLOG_IMAGE_URL_PREFIX = "/api/blogs/image/";

const ALLOWED_TAGS = ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "img", "hr"];

// Heading anchors copied from the legacy pages (<a class="heading-link">#</a>)
// are not content: a link whose text is only "#" / "¶" / "§" / 🔗 is dropped
// (its text goes with it), so it never reaches the TOC label or the heading.
const HEADING_ANCHOR_TEXT_RE = /^[#¶§\u{1F517}]+$/u;
const isHeadingAnchor = (frame) => frame.tag === "a" && HEADING_ANCHOR_TEXT_RE.test(String(frame.text || "").trim());

// A bullet typed or pasted into the text of a list item ("• Living far...")
// would show next to the list's own marker. Strip it from the start of the
// item (also when it sits inside a <p> or inline-format tag).
const LEADING_BULLET_RE = /(<li>(?:\s*<(?:p|strong|b|em|i|u|s)>)*)\s*(?:[•●▪◦‣∙·]|&bull;|&#8226;|&#x2022;)+\s*/gi;
function stripLeadingListBullets(html) {
  return String(html || "").replace(LEADING_BULLET_RE, "$1");
}

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
  return stripLeadingListBullets(sanitizeHtml(String(html || ""), {
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
    exclusiveFilter: (frame) => (frame.tag === "img" && !isBlogImageUrl(frame.attribs.src)) || isHeadingAnchor(frame),
  }));
}

const FAQ_ANSWER_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"];
const MAX_FAQS = 30;
const MAX_FAQ_QUESTION = 300;
const MAX_FAQ_ANSWER = 3000;

function sanitizeFaqAnswer(html) {
  return stripLeadingListBullets(sanitizeHtml(String(html || ""), {
    allowedTags: FAQ_ANSWER_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const out = { href: attribs.href };
        if (attribs.target === "_blank") out.target = "_blank";
        out.rel = "noopener noreferrer";
        return { tagName, attribs: out };
      },
    },
    exclusiveFilter: isHeadingAnchor,
  })
    // A link whose href was rejected (e.g. javascript:) is kept as plain text.
    .replace(/<a(?![^>]*\shref=)[^>]*>([\s\S]*?)<\/a>/g, "$1"))
    .trim();
}

// Cleans the FAQ list from the admin form: plain-text questions, simple-HTML
// answers, empty entries dropped, count and lengths capped.
function sanitizeFaqs(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const question = decodeBasicEntities(
      sanitizeHtml(String(item.question || ""), { allowedTags: [], allowedAttributes: {} })
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_FAQ_QUESTION);
    const answer = sanitizeFaqAnswer(String(item.answer || "").slice(0, MAX_FAQ_ANSWER * 2));
    if (!question || !stripTags(answer).trim()) continue;
    out.push({ question, answer: answer.slice(0, MAX_FAQ_ANSWER) });
    if (out.length >= MAX_FAQS) break;
  }
  return out;
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
  sanitizeFaqs,
  estimateReadTime,
  isBlogImageUrl,
};
