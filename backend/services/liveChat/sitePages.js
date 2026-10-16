// The pages the live-chat AI may link to. The list is built from the app's own routes and taxonomy
// (backend/scripts/buildLiveChatSitePages.js -> backend/data/liveChatSitePages.json). The model never writes a URL
// that reaches the patient: it can only point at an entry of this list, and filterLinks() drops everything else
// (and takes the title from the list, never from the model).
const { titlesFor, serviceTitleFor, isServiceTopic } = require("./pageSynonyms");
const MAX_LINKS = 3;
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
function createSitePages(initialPages = require("../../data/liveChatSitePages.json"), { source = null } = {}) {
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

  // The links of a reply, in the order the patient sees the cards: the matched health-topic page first, the booking card
  // last. raw: whatever the model returned. A health-topic reply (medical) always carries a booking card, and when the
  // model named no page the server uses the best lay-word match. Without `allowContent` only service pages and booking
  // remain. Everything is checked against the list.
  function arrange(raw, { allowContent = true, medical = false, hintText = "" } = {}) {
    let links = filterLinks(raw);
    if (!allowContent) links = links.filter((l) => !isContent(l.url));
    // A sick-note or price question always gets its service page, even when the model named none.
    if (!links.some((l) => typeOf(l.url) === "service" && l.url !== BOOKING_URL)) {
      const service = serviceFor(hintText);
      if (service) links = [...links, service].slice(0, MAX_LINKS);
    }
    let content = links.find((l) => isContent(l.url)) || null;
    if (allowContent && (medical || content)) {
      // The curated phrase map is exact: when it names a page it wins over the model's pick (a model can wander, e.g.
      // hair fall -> Men's Health), and it fills in when the model named none.
      const hinted = hintFor(hintText, 1)[0];
      if (hinted && (!content || content.url !== hinted.url)) content = { title: hinted.title, url: hinted.url };
    }
    const isBookingPage = (url) => url === BOOKING_URL || url.startsWith(`${BOOKING_URL}/`);
    const services = links.filter((l) => !isContent(l.url) && !isBookingPage(l.url));
    // A reply about a health issue or a service (sick note, price, refills ...) always ends with Book, unless the matched
    // page already is a booking page. A reply that links nothing (who are you, off-topic) gets no Book either.
    const wantsBooking = medical || Boolean(content) || isServiceTopic(hintText) || services.length > 0 || links.some((l) => l.url === BOOKING_URL);
    const booking = wantsBooking && !(content && isBookingPage(content.url)) ? bookingFor(content ? content.url : BOOKING_URL) : null;
    if (booking && booking.url === content?.url) return [content, ...services.slice(0, MAX_LINKS - 1)];
    // Order: the matched health-topic page, then service pages (Pricing ...), then Book. At most MAX_LINKS.
    const room = MAX_LINKS - (content ? 1 : 0) - (booking ? 1 : 0);
    return [...(content ? [content] : []), ...services.slice(0, Math.max(0, room)), ...(booking ? [booking] : [])];
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
