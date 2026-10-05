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

export function prepareFaqAnswer(html) {
  return DOMPurify.sanitize(html || "", FAQ_PURIFY_CONFIG);
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
  const clean = DOMPurify.sanitize(resolveBlogImages(rawHtml || ""), PURIFY_CONFIG);
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, "text/html");
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

export function formatBlogDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
