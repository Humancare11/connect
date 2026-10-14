// The pages the live-chat AI may link to. The list is built from the app's own routes and taxonomy
// (backend/scripts/buildLiveChatSitePages.js -> backend/data/liveChatSitePages.json). The model never writes a URL
// that reaches the patient: it can only point at an entry of this list, and filterLinks() drops everything else
// (and takes the title from the list, never from the model).
const MAX_LINKS = 3;
const MAX_CANDIDATES = 14;
const BOOKING_URL = "/appointment-booking";

function createSitePages(pages = require("../../data/liveChatSitePages.json")) {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const fold = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  const prepared = pages.map((p) => ({
    page: p,
    title: fold(p.title),
    titleWords: new Set(fold(p.title).split(" ").filter((w) => w.length > 2)),
    keywords: (p.keywords || []).map(fold).filter(Boolean),
  }));

  // Pages that fit the patient's words (a few, best first). Only these are shown to the model.
  function candidatesFor(text, limit = MAX_CANDIDATES) {
    const hay = ` ${fold(text)} `;
    const words = new Set(hay.split(" ").filter((w) => w.length > 2));
    const scored = [];
    for (const p of prepared) {
      let score = 0;
      if (p.title && hay.includes(` ${p.title} `)) score += 6;
      for (const k of p.keywords) if (hay.includes(` ${k} `)) score += k.includes(" ") ? 4 : 3;
      for (const w of p.titleWords) if (words.has(w)) score += 1;
      if (score > 0) scored.push({ page: p.page, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const out = scored.slice(0, limit).map((s) => s.page);
    const booking = byUrl.get(BOOKING_URL);
    if (booking && !out.includes(booking)) out.push(booking); // the booking page is always an option
    return out;
  }

  // raw: whatever the model returned (any shape). Keeps only allowlisted urls, once each, with the list's own title.
  function filterLinks(raw, max = MAX_LINKS) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      const candidate = typeof item === "string" ? item : item && typeof item.url === "string" ? item.url : "";
      const url = candidate.trim();
      const page = byUrl.get(url);
      if (page && !out.some((l) => l.url === url)) out.push({ title: page.title, url: page.url });
      if (out.length >= max) break;
    }
    return out;
  }

  const linkFor = (url) => {
    const page = byUrl.get(String(url || "").trim());
    return page ? { title: page.title, url: page.url } : null;
  };

  return { pages, has: (url) => byUrl.has(String(url || "").trim()), candidatesFor, filterLinks, linkFor };
}

module.exports = { createSitePages, MAX_LINKS, BOOKING_URL };
