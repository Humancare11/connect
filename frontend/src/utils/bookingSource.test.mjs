import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CLICK_KEY, TOUCH_KEY, CLICK_TTL_MS, TOUCH_TTL_MS, createStore, buildClickSource, buildPageSource, recordClick, captureTouch,
  getBookingSource, createClickHandler, cleanPath, cleanReferrer, _resetMemory,
} from "./bookingSource.js";

const T0 = Date.UTC(2026, 9, 26, 10, 0, 0);
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const fakeStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};
const brokenStorage = () => ({
  getItem() { throw new Error("SecurityError"); },
  setItem() { throw new Error("QuotaExceeded"); },
  removeItem() { throw new Error("SecurityError"); },
});

const newStore = () => {
  const storage = fakeStorage();
  return createStore(() => storage);
};

beforeEach(() => _resetMemory());

describe("what a click on a Book link means", () => {
  const onService = { pathname: "/fit-to-fly-certificate" };

  test("a header button keeps its label and the page it was clicked on", () => {
    assert.deepEqual(buildClickSource({ source: "header", text: " Book Appointment " }, onService), {
      sourceType: "header", sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly", pagePath: "/fit-to-fly-certificate",
    });
  });

  test("on the home page the header button says 'on Home page' (a home type with no name)", () => {
    const s = buildClickSource({ source: "header", text: "Book Appointment" }, { pathname: "/" });
    assert.deepEqual([s.clickedOnType, s.clickedOnName], ["home", ""]);
  });

  test("a footer button on a blog", () => {
    const s = buildClickSource({ source: "footer", text: "Book Appointment" }, { pathname: "/travelling-with-asthma", hints: { blogTitle: "Travelling with asthma" } });
    assert.deepEqual([s.sourceType, s.sourceName, s.clickedOnType, s.clickedOnName], ["footer", "Book Appointment", "blog", "Travelling with asthma"]);
  });

  test("a home-page section button is 'Home: <section>' with no clicked-on", () => {
    const s = buildClickSource({ source: "home", sourceName: "Hero", text: "Book now" }, { pathname: "/" });
    assert.deepEqual([s.sourceType, s.sourceName, s.clickedOnType, s.clickedOnName], ["home", "Hero", "", ""]);
  });

  test("data-source-name wins over the link text", () => {
    assert.equal(buildClickSource({ source: "header", sourceName: "Book", text: "Book Appointment" }, onService).sourceName, "Book");
  });

  test("an ordinary in-page button: the source is the page itself", () => {
    const s = buildClickSource({ text: "Book now" }, { pathname: "/women-health/obstetrics-and-gynaecology" });
    assert.equal(s.sourceType, "speciality");
    assert.equal(s.clickedOnType, "");
    const d = buildPageSource({ pathname: "/doctors/martin-perlin", hints: { doctorName: "Martin Perlin" } });
    assert.deepEqual([d.sourceType, d.sourceName], ["doctor_profile", "Martin Perlin"]);
  });

  test("link text that holds patient data is dropped, not stored", () => {
    for (const text of ["Book for jane@x.org", "Call +44 7700 900123", "Booking 64b0000000000000000000d1"]) {
      assert.equal(buildClickSource({ source: "header", text }, onService).sourceName, "", text);
    }
  });

  test("page path has no query string or fragment, and a hostile one is empty", () => {
    assert.equal(buildClickSource({}, { pathname: "/fit-to-fly-certificate?email=a@b.co#x" }).pagePath, "/fit-to-fly-certificate");
    assert.equal(cleanPath("https://evil.example"), "");
    assert.equal(cleanPath("//evil.example"), "");
    assert.equal(cleanPath(undefined), "");
  });

  test("an unknown data-source value is not a button", () => {
    assert.equal(buildClickSource({ source: "sidebar", text: "Book" }, onService).sourceType, "service");
  });
});

describe("click source: 30 minutes, localStorage", () => {
  test("a recorded click is sent with the booking, then expires", () => {
    const storage = fakeStorage();
    const st = createStore(() => storage);
    recordClick({ sourceType: "service", sourceName: "Fit to fly", pagePath: "/fit-to-fly-certificate" }, { now: T0, st });
    assert.ok(storage.data.has(CLICK_KEY), "stored in localStorage");
    const at29 = getBookingSource({ now: T0 + 29 * MIN, st });
    assert.deepEqual([at29.sourceType, at29.sourceName, at29.pagePath], ["service", "Fit to fly", "/fit-to-fly-certificate"]);
    const at31 = getBookingSource({ now: T0 + CLICK_TTL_MS + MIN, st });
    assert.deepEqual([at31.sourceType, at31.sourceName], ["direct", ""]);
    assert.equal(storage.data.has(CLICK_KEY), false, "expired value is removed");
  });

  test("another tab sees the same click (shared storage)", () => {
    const storage = fakeStorage();
    recordClick({ sourceType: "condition", sourceName: "Fever" }, { now: T0, st: createStore(() => storage) });
    assert.equal(getBookingSource({ now: T0 + MIN, st: createStore(() => storage) }).sourceName, "Fever");
  });

  test("with no click the booking is 'direct'", () => {
    const s = getBookingSource({ now: T0, st: newStore() });
    assert.deepEqual([s.sourceType, s.sourceName, s.referrer], ["direct", "", ""]);
  });

  test("the newest click replaces the older one", () => {
    const st = newStore();
    recordClick({ sourceType: "condition", sourceName: "Fever" }, { now: T0, st });
    recordClick({ sourceType: "service", sourceName: "Fit to fly" }, { now: T0 + MIN, st });
    assert.equal(getBookingSource({ now: T0 + 2 * MIN, st }).sourceName, "Fit to fly");
  });

  test("corrupt, wrong-shaped or future-dated stored values are ignored", () => {
    for (const raw of ["{not json", "null", "[]", '"x"', JSON.stringify({ sourceType: "service" }), JSON.stringify({ at: T0 + 10 * DAY, sourceType: "service" })]) {
      const storage = fakeStorage();
      storage.data.set(CLICK_KEY, raw);
      const s = getBookingSource({ now: T0, st: createStore(() => storage) });
      assert.equal(s.sourceType, "direct", raw);
    }
  });

  test("a stored value is cleaned again on the way out", () => {
    const storage = fakeStorage();
    storage.data.set(CLICK_KEY, JSON.stringify({ at: T0, sourceType: "service", sourceName: "Fit to fly jane@x.org", pagePath: "https://evil.example", clickedOnName: "x".repeat(500) }));
    const s = getBookingSource({ now: T0, st: createStore(() => storage) });
    assert.equal(s.sourceName, "");
    assert.equal(s.pagePath, "");
    assert.ok(s.clickedOnName.length <= 120);
  });
});

describe("blocked storage falls back to memory for this tab", () => {
  test("localStorage that throws on every call still keeps the click and the touch", () => {
    const st = createStore(() => brokenStorage());
    recordClick({ sourceType: "service", sourceName: "Fit to fly" }, { now: T0, st });
    captureTouch({ search: "?utm_source=google", now: T0, st });
    const s = getBookingSource({ now: T0 + MIN, st });
    assert.equal(s.sourceName, "Fit to fly");
    assert.equal(s.utm.source, "google");
  });

  test("no localStorage at all (it throws on access)", () => {
    const st = createStore(() => { throw new ReferenceError("localStorage is not defined"); });
    recordClick({ sourceType: "blog", sourceName: "Post" }, { now: T0, st });
    assert.equal(getBookingSource({ now: T0, st }).sourceType, "blog");
  });

  test("expiry still applies in memory", () => {
    const st = createStore(() => brokenStorage());
    recordClick({ sourceType: "blog", sourceName: "Post" }, { now: T0, st });
    assert.equal(getBookingSource({ now: T0 + CLICK_TTL_MS + MIN, st }).sourceType, "direct");
  });

  test("storage that fails only on write: the memory copy is used, and a later good write wins", () => {
    let fail = true;
    const storage = fakeStorage();
    const st = createStore(() => (fail ? { getItem: storage.getItem, removeItem: storage.removeItem, setItem() { throw new Error("full"); } } : storage));
    recordClick({ sourceType: "service", sourceName: "A" }, { now: T0, st });
    assert.equal(getBookingSource({ now: T0, st }).sourceName, "A");
    fail = false;
    recordClick({ sourceType: "service", sourceName: "B" }, { now: T0 + MIN, st });
    assert.equal(getBookingSource({ now: T0 + MIN, st }).sourceName, "B");
  });

  test("getBookingSource, recordClick and captureTouch never throw, whatever the store does", () => {
    const evil = { read() { throw new Error("x"); }, write() { throw new Error("x"); }, remove() { throw new Error("x"); } };
    assert.equal(getBookingSource({ now: T0, st: evil }).sourceType, "direct");
    assert.equal(recordClick({ sourceType: "blog" }, { now: T0, st: evil }), null);
    assert.equal(captureTouch({ search: "?utm_source=a", now: T0, st: evil }), null);
  });
});

describe("first touch: campaign and outside referrer, 30 days", () => {
  const fresh = () => newStore();

  test("utm and an outside referrer are kept, referrer as host and path only", () => {
    const st = fresh();
    captureTouch({ search: "?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc", referrer: "https://www.google.com/search?q=fever&token=abc#x", ownHost: "humancareconnect.co", now: T0, st });
    const s = getBookingSource({ now: T0 + DAY, st });
    assert.deepEqual(s.utm, { source: "google", medium: "cpc", campaign: "spring" });
    assert.equal(s.referrer, "www.google.com/search");
  });

  test("the first touch wins: a later landing does not overwrite it", () => {
    const st = fresh();
    captureTouch({ search: "?utm_source=google", now: T0, st });
    assert.equal(captureTouch({ search: "?utm_source=facebook", now: T0 + DAY, st }), null);
    assert.equal(getBookingSource({ now: T0 + 2 * DAY, st }).utm.source, "google");
  });

  test("it survives the 30-minute click expiry and ends after 30 days", () => {
    const st = fresh();
    captureTouch({ search: "?utm_campaign=spring", now: T0, st });
    assert.equal(getBookingSource({ now: T0 + 29 * DAY, st }).utm.campaign, "spring");
    assert.equal(getBookingSource({ now: T0 + TOUCH_TTL_MS + MIN, st }).utm.campaign, "");
    // and a new landing can be captured once it has expired
    assert.ok(captureTouch({ search: "?utm_campaign=autumn", now: T0 + TOUCH_TTL_MS + MIN, st }));
    assert.equal(getBookingSource({ now: T0 + TOUCH_TTL_MS + 2 * MIN, st }).utm.campaign, "autumn");
  });

  test("a direct landing, or a visit from our own site, stores nothing, so a later campaign landing still counts", () => {
    const st = fresh();
    assert.equal(captureTouch({ search: "", referrer: "", now: T0, st }), null);
    assert.equal(captureTouch({ search: "", referrer: "https://humancareconnect.co/about-us", ownHost: "humancareconnect.co", now: T0, st }), null);
    assert.ok(captureTouch({ search: "?utm_source=newsletter", now: T0 + MIN, st }));
  });

  test("campaign values are short plain tags; junk referrers are empty", () => {
    const st = fresh();
    captureTouch({ search: "?utm_source=%3Cimg%20onerror%3D1%3E&utm_campaign=" + "c".repeat(500), referrer: "javascript:alert(1)", now: T0, st });
    const s = getBookingSource({ now: T0, st });
    assert.equal(s.utm.source, "img onerror1");
    assert.equal(s.utm.campaign.length, 100);
    assert.equal(s.referrer, "");
    assert.equal(cleanReferrer("not a url"), "");
    assert.equal(cleanReferrer("https://t.co/abc?x=1"), "t.co/abc");
    // a hand-edited stored referrer that is not host/path is dropped
    const storage = fakeStorage();
    storage.data.set(TOUCH_KEY, JSON.stringify({ at: T0, referrer: "javascript:alert(1)", utm: {} }));
    assert.equal(getBookingSource({ now: T0, st: createStore(() => storage) }).referrer, "");
  });
});

describe("the click handler (installed on document in step 4)", () => {
  const anchor = (href, extra = {}) => ({ getAttribute: () => href, textContent: " Book Appointment ", dataset: {}, ...extra });
  const eventFor = (a) => ({ target: { closest: () => a } });
  const setup = (pathname = "/fit-to-fly-certificate", hints) => {
    const st = newStore();
    const onClick = createClickHandler({ getCurrent: () => ({ pathname, hints }), ownOrigin: "https://humancareconnect.co", now: () => T0, st });
    return { st, onClick, read: () => getBookingSource({ now: T0, st }) };
  };

  test("a header Book link records the button and the page it was on", () => {
    const { onClick, read } = setup();
    onClick(eventFor(anchor("/appointment-booking", { dataset: { source: "header" } })));
    const s = read();
    assert.deepEqual([s.sourceType, s.sourceName, s.clickedOnType, s.clickedOnName], ["header", "Book Appointment", "service", "Fit to fly"]);
  });

  test("every booking path counts, with a query string or an absolute same-site URL", () => {
    for (const href of ["/book-appointment", "/category-consultant?category=family", "/service-consultant?service=x", "https://humancareconnect.co/appointment-booking/mental-health"]) {
      const { onClick, read } = setup("/mental-health");
      onClick(eventFor(anchor(href)));
      assert.equal(read().sourceType, "category", href);
    }
  });

  test("other links, other sites and clicks that are not on a link are ignored", () => {
    for (const ev of [eventFor(anchor("/about-us")), eventFor(anchor("https://evil.example/appointment-booking")), eventFor(anchor("mailto:a@b.co")), { target: { closest: () => null } }, { target: {} }, {}, null, undefined]) {
      const { onClick, read } = setup();
      assert.doesNotThrow(() => onClick(ev));
      assert.equal(read().sourceType, "direct");
    }
  });

  test("it never throws, even if reading the page fails", () => {
    const onClick = createClickHandler({ getCurrent: () => { throw new Error("boom"); }, ownOrigin: "https://humancareconnect.co" });
    assert.doesNotThrow(() => onClick(eventFor(anchor("/appointment-booking"))));
  });
});
