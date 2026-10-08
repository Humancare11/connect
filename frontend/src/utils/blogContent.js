import DOMPurify from "dompurify";
import { resolveBlogImages } from "../api/blogApi";

// Mirrors the backend allow-list (backend/utils/blogSanitizer.js). Content is
// already sanitized on save; this second pass also covers admin previews of
// unsaved editor content.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "img", "hr"],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "id"],
  ALLOW_DATA_ATTR: false,
};

// FAQ answers: simple formatting only, same allow-list as the backend.
const FAQ_PURIFY_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
  ALLOWED_ATTR: ["href", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

// Posts saved before the backend cleaned these up may still contain heading
// anchors (<a>#</a>, copied from the legacy pages) and bullets typed into list
// items. Remove them at render time so they never reach the TOC or the page.
const HEADING_ANCHOR_TEXT_RE = /^[#¶§\u{1F517}]+$/u;
const LEADING_BULLET_TEXT_RE = /^\s*[•●▪◦‣∙·]+\s*/;

function cleanPastedArtifacts(root) {
  root.querySelectorAll("a").forEach((a) => {
    if (HEADING_ANCHOR_TEXT_RE.test(a.textContent.trim())) a.remove();
  });
  root.querySelectorAll("li").forEach((li) => {
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue.trim()) node = walker.nextNode();
    if (node) node.nodeValue = node.nodeValue.replace(LEADING_BULLET_TEXT_RE, "");
  });
}

export function prepareFaqAnswer(html) {
  const clean = DOMPurify.sanitize(html || "", FAQ_PURIFY_CONFIG);
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, "text/html");
  cleanPastedArtifacts(doc.body);
  return doc.body.innerHTML;
}

// FAQs that are complete enough to render (the backend drops the rest on save;
// this also covers unsaved preview content).
export function usableFaqs(faqs) {
  return (Array.isArray(faqs) ? faqs : []).filter(
    (f) => f && String(f.question || "").trim() && prepareFaqAnswer(f.answer).replace(/<[^>]*>/g, "").trim(),
  );
}

// Plain-text answer for the FAQPage structured data.
export function faqAnswerText(html) {
  const doc = new DOMParser().parseFromString(`<body>${prepareFaqAnswer(html).replace(/<(\/(p|li)|br\s*\/?)>/gi, " $&")}</body>`, "text/html");
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

function slugifyHeading(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

// Sanitizes the HTML and returns { html, toc }. The backend already assigns
// stable ids to every <h2> on save; headings that still lack one (unsaved
// preview content) get ids generated with the same rule.
export function prepareBlogHtml(rawHtml) {
  // Build-time prerender (Node, no DOM): see prepareBlogHtmlWithoutDom.
  if (typeof DOMParser === "undefined") return prepareBlogHtmlWithoutDom(rawHtml);
  const clean = DOMPurify.sanitize(resolveBlogImages(rawHtml || ""), PURIFY_CONFIG);
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, "text/html");
  cleanPastedArtifacts(doc.body);
  const used = new Set(Array.from(doc.body.querySelectorAll("h2[id]")).map((h) => h.id));
  const toc = [];

  doc.body.querySelectorAll("h2").forEach((h2) => {
    const label = h2.textContent.replace(/\s+/g, " ").trim();
    if (!label) return;
    if (!h2.id) {
      const base = slugifyHeading(label);
      let id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      h2.id = id;
    }
    toc.push({ id: h2.id, label });
  });

  return { html: doc.body.innerHTML, toc };
}

// Prerender-only path. The backend sanitizes blog HTML against the same allow-list when a post is
// saved and assigns an id to every <h2>, so the server needs only the table of contents (and ids
// for any heading that still lacks one). The browser still runs the full DOMPurify pass above.
function prepareBlogHtmlWithoutDom(rawHtml) {
  const used = new Set();
  const html = resolveBlogImages(rawHtml || "");
  const headings = [];
  const withIds = html.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs, inner) => {
    const label = decodeEntities(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    const existing = /\sid="([^"]*)"/i.exec(" " + attrs);
    headings.push({ existing: existing ? existing[1] : "", label, match, attrs, inner });
    if (existing) used.add(existing[1]);
    return match;
  });
  const toc = [];
  let out = withIds;
  for (const h of headings) {
    if (!h.label) continue;
    let id = h.existing;
    if (!id) {
      const base = slugifyHeading(h.label);
      id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      out = out.replace(h.match, `<h2${h.attrs} id="${id}">${h.inner}</h2>`);
    }
    toc.push({ id, label: h.label });
  }
  return { html: out, toc };
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function formatBlogDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
