import DOMPurify from "dompurify";
import { resolveBlogImages } from "../api/blogApi.js";

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

// Build-time prerender (Node, no DOM): DOMPurify and DOMParser do not exist there. The backend already
// sanitizes FAQ answers on save (sanitizeFaqAnswer in backend/utils/blogSanitizer.js), so this path only
// rebuilds the markup from the same allow-list as a second guard. The output is made only of allowed tags and
// escaped text, so nothing else can pass through, and it matches what the browser serializes for normal
// FAQ HTML (no hydration mismatch).
const FAQ_SERVER_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"]);
// Other tags are dropped and their text kept; these are dropped together with their content.
const FAQ_SERVER_DROP_RE = /<(script|style|iframe|frame|frameset|object|embed|noscript|template|svg|math|textarea|title|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const FAQ_SERVER_TOKEN_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const FAQ_SERVER_ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const HIDDEN_CHARS_RE = /[\p{Cc}\p{Cf}\s]/gu;

function safeCodePoint(code, fallback) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : fallback;
}

function decodeHtmlText(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCodePoint(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => safeCodePoint(parseInt(d, 10), m))
    .replace(/&nbsp;/gi, "\xa0")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

// Same escaping as the browser's innerHTML serializer.
const escapeText = (t) => t.replace(/&/g, "&amp;").replace(/\xa0/g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (t) => t.replace(/&/g, "&amp;").replace(/\xa0/g, "&nbsp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same schemes the backend allows (http, https, mailto, tel), plus relative and #anchor links; never "//host".
function isSafeFaqHref(value) {
  const href = value.replace(HIDDEN_CHARS_RE, "");
  if (!href || href.startsWith("//")) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href);
  return scheme ? ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase()) : !href.includes(":") || /^[/?#.]/.test(href);
}

function faqAnchorAttrs(rawAttrs) {
  let out = "";
  for (const m of rawAttrs.matchAll(FAQ_SERVER_ATTR_RE)) {
    const name = m[1].toLowerCase();
    const value = decodeHtmlText(m[2] ?? m[3] ?? m[4] ?? "");
    if (name === "href" && isSafeFaqHref(value)) out += ` href="${escapeAttr(value)}"`;
    else if (name === "target" && value === "_blank") out += ' target="_blank"';
    else if (name === "rel" && /^[\w\s-]+$/.test(value)) out += ` rel="${escapeAttr(value)}"`;
  }
  return out;
}

function prepareFaqAnswerWithoutDom(html) {
  const source = String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(FAQ_SERVER_DROP_RE, "");
  const open = [];
  let out = "";
  let last = 0;
  for (const m of source.matchAll(FAQ_SERVER_TOKEN_RE)) {
    out += escapeText(decodeHtmlText(source.slice(last, m.index)));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!FAQ_SERVER_TAGS.has(tag)) continue;
    if (tag === "br") {
      if (!closing) out += "<br>";
    } else if (closing) {
      const at = open.lastIndexOf(tag);
      if (at === -1) continue;
      while (open.length > at) out += `</${open.pop()}>`;
    } else {
      open.push(tag);
      out += `<${tag}${tag === "a" ? faqAnchorAttrs(m[3]) : ""}>`;
    }
  }
  out += escapeText(decodeHtmlText(source.slice(last)));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

export function prepareFaqAnswer(html) {
  if (typeof DOMParser === "undefined") return prepareFaqAnswerWithoutDom(html);
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
  if (typeof DOMParser === "undefined") {
    const spaced = prepareFaqAnswer(html).replace(/<(\/(p|li)|br\s*\/?)>/gi, " $&");
    return decodeHtmlText(spaced.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
  }
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

  wrapTables(doc);
  return { html: doc.body.innerHTML, toc };
}

// Tables from the editor can be wider than a phone; give each one a horizontal scroller.
// (The prerender path below does the same with a regex so server and client HTML match.)
function wrapTables(doc) {
  doc.body.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("hc-table-scroll")) return;
    const wrap = doc.createElement("div");
    wrap.className = "hc-table-scroll";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
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
  out = out.replace(/<table[\s\S]*?<\/table>/gi, (table) => `<div class="hc-table-scroll">${table}</div>`);
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
