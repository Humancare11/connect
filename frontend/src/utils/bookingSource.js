// utils/bookingSource.js
//
// Remembers where a booking started, so the booking request can say so (backend: utils/bookingSource.js).
//
//   recordClick(...)        a patient clicked a Book link/button: keep { page type + name, clicked-on page } for 30 minutes
//   captureTouch(...)       first landing with a campaign (utm_*) or an outside referrer: keep it for 30 days
//   getBookingSource()      what to send as `source` in the booking request body
//
// Kept in localStorage (so a booking link opened in a new tab keeps its source), every read and write in try/catch. If
// storage is blocked or throws, the value lives in memory for the current tab instead. Names are display text and never
// patient data (pageIdentity.safeName); the server cleans everything again and decides the platform itself.
//
// Nothing here runs by itself: the click handler and landing capture are installed by the app (step 4).
import { resolvePage, safeName, MAX_NAME_LENGTH } from "./pageIdentity.js";

export const CLICK_KEY = "hc.bookingSource.click";
export const TOUCH_KEY = "hc.bookingSource.touch";
export const CLICK_TTL_MS = 30 * 60 * 1000;
export const TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Links that start a booking.
export const BOOKING_PATHS = ["/appointment-booking", "/book-appointment", "/category-consultant", "/service-consultant"];
// data-source="header" | "footer" | "home" on a link marks a site-wide button.
export const BUTTON_SOURCES = ["header", "footer", "home"];

// ── Storage: localStorage with an in-memory fallback ───────────────────────────

const memory = new Map();

export function createStore(getStorage = () => globalThis.localStorage) {
  const read = (key) => {
    try {
      const raw = getStorage().getItem(key);
      if (raw !== null && raw !== undefined) return raw;
    } catch {
      /* blocked or unavailable: fall through to memory */
    }
    return memory.has(key) ? memory.get(key) : null;
  };
  const write = (key, value) => {
    try {
      getStorage().setItem(key, value);
      memory.delete(key);
      return;
    } catch {
      /* blocked, full or private window: keep it in memory for this tab */
    }
    memory.set(key, value);
  };
  const remove = (key) => {
    try {
      getStorage().removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  };
  return { read, write, remove };
}

let defaultStore = null;
const store = () => (defaultStore ||= createStore());
// For tests: forget everything held in memory.
export const _resetMemory = () => memory.clear();

function load(st, key, ttl, now) {
  const raw = st.read(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || typeof value.at !== "number") throw new Error("bad shape");
    if (now - value.at > ttl || value.at > now + 60_000) throw new Error("expired");
    return value;
  } catch {
    st.remove(key);
    return null;
  }
}

// ── Cleaning (the server does it again) ────────────────────────────────────────

const text = (v) => safeName(typeof v === "string" ? v : "");

// A site path without query string or fragment.
export function cleanPath(value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v.startsWith("/") || v.startsWith("//")) return "";
  return v.split(/[?#]/)[0].slice(0, 200);
}

// Host + path of an outside page, never the query string.
export function cleanReferrer(value, ownHost = "") {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (ownHost && url.hostname.toLowerCase() === String(ownHost).toLowerCase()) return "";
    return (url.hostname.toLowerCase() + (url.pathname === "/" ? "" : url.pathname)).slice(0, 200);
  } catch {
    return "";
  }
}

// A stored referrer is already "host/path"; accept only that shape.
const storedReferrer = (v) => {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[a-z0-9.-]+(\/[^\s?#]*)?$/.test(t) ? t.slice(0, 200) : "";
};

const utmValue = (v) =>
  String(v || "")
    .replace(/[^\w .+()\-:/@|]/g, "")
    .trim()
    .slice(0, 100);

// ── Click source ───────────────────────────────────────────────────────────────

const TYPES_WITH_CLICKED_ON = ["header", "footer"];

// What a click on a booking link means. link: { pathname, text, source, sourceName } (source = data-source).
// current: { pathname, hints } the page the patient is on.
export function buildClickSource(link, current) {
  const here = resolvePage(current?.pathname || "/", current?.hints);
  const buttonType = BUTTON_SOURCES.includes(link?.source) ? link.source : "";
  const pagePath = cleanPath(current?.pathname);

  if (buttonType) {
    const sourceName = text(link.sourceName) || text(link.text);
    const clickedOn = TYPES_WITH_CLICKED_ON.includes(buttonType);
    return {
      sourceType: buttonType,
      sourceName,
      clickedOnType: clickedOn ? here.type : "",
      clickedOnName: clickedOn ? here.name : "",
      pagePath,
    };
  }
  return { sourceType: here.type, sourceName: here.name, clickedOnType: "", clickedOnName: "", pagePath };
}

// A booking started by a page's own button or navigate() call (no anchor to read): the source is the current page.
export const buildPageSource = (current) => buildClickSource({}, current);

export function recordClick(source, { now = Date.now(), st = store() } = {}) {
  try {
    const value = {
      sourceType: text(source?.sourceType),
      sourceName: text(source?.sourceName),
      clickedOnType: text(source?.clickedOnType),
      clickedOnName: text(source?.clickedOnName),
      pagePath: cleanPath(source?.pagePath),
      at: now,
    };
    st.write(CLICK_KEY, JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

// ── First touch: campaign and outside referrer, 30 days ────────────────────────

// Only a landing that carries a campaign or comes from another site is stored, and the first one wins until it expires.
export function captureTouch({ search = "", referrer = "", ownHost = "", now = Date.now(), st = store() } = {}) {
  try {
    if (load(st, TOUCH_KEY, TOUCH_TTL_MS, now)) return null;
    const params = new URLSearchParams(String(search || ""));
    const utm = {
      source: utmValue(params.get("utm_source")),
      medium: utmValue(params.get("utm_medium")),
      campaign: utmValue(params.get("utm_campaign")),
    };
    const from = cleanReferrer(referrer, ownHost);
    if (!from && !utm.source && !utm.medium && !utm.campaign) return null;
    const value = { referrer: from, utm, at: now };
    st.write(TOUCH_KEY, JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

// ── What the booking request sends ─────────────────────────────────────────────

// { sourceType, sourceName, clickedOnType, clickedOnName, pagePath, referrer, utm }. With no click in the last 30 minutes
// the booking is "direct" (a bookmark, a typed address or an old tab). Never throws.
export function getBookingSource({ now = Date.now(), st = store() } = {}) {
  const empty = { sourceType: "direct", sourceName: "", clickedOnType: "", clickedOnName: "", pagePath: "", referrer: "", utm: { source: "", medium: "", campaign: "" } };
  try {
    const click = load(st, CLICK_KEY, CLICK_TTL_MS, now);
    const touch = load(st, TOUCH_KEY, TOUCH_TTL_MS, now);
    const out = { ...empty, utm: { ...empty.utm } };
    if (click) {
      out.sourceType = text(click.sourceType) || "direct";
      out.sourceName = text(click.sourceName).slice(0, MAX_NAME_LENGTH);
      out.clickedOnType = text(click.clickedOnType);
      out.clickedOnName = text(click.clickedOnName).slice(0, MAX_NAME_LENGTH);
      out.pagePath = cleanPath(click.pagePath);
    }
    if (touch) {
      out.referrer = storedReferrer(touch.referrer);
      out.utm = {
        source: utmValue(touch.utm?.source),
        medium: utmValue(touch.utm?.medium),
        campaign: utmValue(touch.utm?.campaign),
      };
    }
    return out;
  } catch {
    return empty;
  }
}

// ── DOM glue (installed in step 4) ─────────────────────────────────────────────

// Returns the click handler for document-level "click" events. getCurrent() gives { pathname, hints } at click time.
export function createClickHandler({ getCurrent, ownOrigin = "", now = () => Date.now(), st } = {}) {
  return function onClick(event) {
    try {
      const anchor = event?.target?.closest?.("a[href]");
      if (!anchor) return;
      const url = new URL(anchor.getAttribute("href"), ownOrigin || "http://localhost");
      if (ownOrigin && url.origin !== new URL(ownOrigin).origin) return;
      const pathname = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
      if (!BOOKING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
      const link = {
        pathname,
        text: anchor.textContent,
        source: anchor.dataset?.source,
        sourceName: anchor.dataset?.sourceName,
      };
      recordClick(buildClickSource(link, getCurrent()), { now: now(), st });
    } catch {
      /* never get in the way of the click */
    }
  };
}
