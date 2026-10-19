// The pages the live-chat AI may link to. The list is built from the app's own routes and taxonomy
// (backend/scripts/buildLiveChatSitePages.js -> backend/data/liveChatSitePages.json). The model never writes a URL
// that reaches the patient: it can only point at an entry of this list, and filterLinks() drops everything else
// (and takes the title from the list, never from the model).
const { titlesFor, serviceTitleFor, isServiceTopic } = require("./pageSynonyms");
const MAX_LINKS = 1; // one button per AI reply
const MAX_SUGGESTED = 3; // what filterLinks keeps by default (arrange asks for more and then shows one)
const MAX_CANDIDATES = 14;
const BOOKING_URL = "/appointment-booking";
const CONTENT_TYPES = new Set(["condition", "specialty", "category"]); // pages about a health topic (setting: aiMayLinkConditionPages)
const slugify = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// pages: the list to start with (the static allowlist). options.source: async () => pages | null, the live list from the
// site's database (see siteCatalog.js); `refresh()` swaps it in (it is cached there), and a null answer keeps the current one.
function createSitePages(initialPages = require("../../data/liveChatSitePages.json"), { source = null, log = console.log } = {}) {
  let pages = initialPages;
  let byUrl;
  let prepared;
  let lastSource = null;
  const fold = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

  function index(list) {
    pages = list;
    byUrl = new Map(list.map((p) => [p.url, p]));
    prepared = list.map((p) => ({
      page: p,
      title: fold(p.title),
      titleWords: new Set(fold(p.title).split(" ").filter((w) => w.length > 2)),
      keywords: (p.keywords || []).map(fold).filter(Boolean),
    }));
  }
  index(initialPages);

  async function refresh() {
    if (!source) return;
    try {
      const next = await source();
      if (Array.isArray(next) && next.length && next !== lastSource) {
        lastSource = next;
        index(next);
      }
    } catch {
      /* keep the list we have */
    }
  }

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
  function filterLinks(raw, max = MAX_SUGGESTED) {
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

  const typeOf = (url) => byUrl.get(String(url || "").trim())?.type || "";
  const isContent = (url) => CONTENT_TYPES.has(typeOf(url));

  // What the model is shown: every page of the list (titles and paths only). Health-topic pages are left out when the
  // setting says the AI may not link them.
  const pagesForPrompt = ({ allowContent = true } = {}) =>
    pages.filter((p) => allowContent || !CONTENT_TYPES.has(p.type)).map((p) => ({ title: p.title, url: p.url }));

  // The one page (at most) that the patient's words clearly point at through the phrase map (English, Hindi/Hinglish,
  // Spanish). Pass the latest patient message only. No clear match: an empty list, and the chat shows just Book.
  function hintFor(text, limit = 1) {
    const out = [];
    for (const wanted of titlesFor(text, limit + 3)) {
      const key = fold(wanted);
      const page =
        pages.find((p) => CONTENT_TYPES.has(p.type) && fold(p.title) === key) ||
        pages.find((p) => CONTENT_TYPES.has(p.type) && fold(p.title).startsWith(`${key} `));
      if (page && !out.includes(page)) out.push(page);
    }
    return out.slice(0, limit);
  }

  // The service page a message asks for by name ("sick note" -> Doctor's note, "price?" -> Pricing), or null.
  function serviceFor(text) {
    const wanted = fold(serviceTitleFor(text));
    if (!wanted) return null;
    const page = pages.find((p) => p.type === "service" && p.url !== BOOKING_URL && fold(p.title) === wanted);
    return page ? { title: page.title, url: page.url } : null;
  }

  // "Book an appointment", opened on the matched page's category / specialty when we know them (the booking page has
  // /appointment-booking/:category/:specialty); the plain booking page otherwise. Built here, never by the model.
  function bookingFor(url) {
    const booking = byUrl.get(BOOKING_URL);
    if (!booking) return null;
    const page = byUrl.get(String(url || "").trim());
    const target = page?.category ? `${BOOKING_URL}/${slugify(page.category)}${page.specialty ? `/${slugify(page.specialty)}` : ""}` : "";
    return { title: booking.title, url: target || BOOKING_URL };
  }

  // The link of a reply: ONE button at most. The patient's latest message decides, the model's suggestions only fill in:
  //   1. a health-topic page the words clearly match (the phrase map wins over the model's pick) -> only that page;
  //   2. a service page the words name (sick note, refills, second opinion, lab ...), else the model's one service pick;
  //   3. price words and no specific service -> only Pricing (a price in the AI's own text never adds it);
  //   4. a health or service topic with no match -> only the plain Book card;
  //   5. nothing else (greeting, small talk, refusal, emergency) -> no button.
  // raw: whatever the model returned. Without `allowContent` health-topic pages are never used. Everything is checked
  // against the list. Old stored messages with several links are not touched: this only decides new replies.
  function arrange(raw, { allowContent = true, medical = false, hintText = "" } = {}) {
    let suggested = filterLinks(raw, 6);
    if (!allowContent) suggested = suggested.filter((l) => !isContent(l.url));
    const isBookingPage = (url) => url === BOOKING_URL || url.startsWith(`${BOOKING_URL}/`);
    const pricing = pages.find((p) => p.type === "service" && p.url !== BOOKING_URL && fold(p.title) === "pricing");
    const isPricing = (url) => Boolean(pricing) && url === pricing.url;

    const pick = () => {
      const modelContent = suggested.find((l) => isContent(l.url)) || null;
      if (allowContent && (medical || modelContent)) {
        const hinted = hintFor(hintText, 1)[0];
        const content = hinted ? { title: hinted.title, url: hinted.url } : modelContent;
        if (content) return content;
      }
      const wanted = serviceFor(hintText); // a service named by the patient's words (Pricing only when nothing more specific)
      if (wanted) return wanted;
      const modelService = suggested.find((l) => !isContent(l.url) && !isBookingPage(l.url) && !isPricing(l.url));
      if (modelService) return modelService;
      const wantsBooking = medical || isServiceTopic(hintText) || suggested.length > 0;
      return wantsBooking ? bookingFor(BOOKING_URL) : null;
    };

    const chosen = pick();
    const shown = chosen ? [chosen] : [];
    // Debug line for the server log: urls only, never patient text.
    if (suggested.length && (suggested.length > 1 || suggested[0].url !== shown[0]?.url)) {
      log(`[livechat] links: model=[${suggested.map((l) => l.url).join(",")}] -> shown=[${shown.map((l) => l.url).join(",")}]`);
    }
    return shown;
  }

  return {
    get pages() {
      return pages;
    },
    refresh,
    typeOf,
    isContent,
    has: (url) => byUrl.has(String(url || "").trim()),
    candidatesFor,
    pagesForPrompt,
    hintFor,
    serviceFor,
    bookingFor,
    arrange,
    filterLinks,
    linkFor,
  };
}

module.exports = { createSitePages, MAX_LINKS, BOOKING_URL, CONTENT_TYPES };
