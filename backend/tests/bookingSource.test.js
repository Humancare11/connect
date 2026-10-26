const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const S = require("../utils/bookingSource");

const NOW = new Date("2026-10-26T10:00:00Z");
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const req = (headers = {}) => ({ headers });
const web = () => req({ "user-agent": BROWSER });
const build = (headers, raw) => S.buildBookingSource(req(headers), raw, NOW);

describe("platform comes from the server's own view of the request", () => {
  test("browser user-agent is web, with no app version even if one is sent", () => {
    const s = build({ "user-agent": BROWSER, "x-app-version": "9.9.9+9" }, {});
    assert.equal(s.platform, "web");
    assert.equal(s.appVersion, "");
  });

  test("the app headers win and carry the version", () => {
    for (const p of ["android", "ios"]) {
      const s = build({ "x-client-platform": p, "x-app-version": "1.0.0+16", "user-agent": "Dart/3.5 (dart:io)" }, {});
      assert.equal(s.platform, p);
      assert.equal(s.appVersion, "1.0.0+16");
    }
  });

  test("a native user-agent without the header is an app; an unknown OS is plain 'app'", () => {
    assert.equal(build({ "user-agent": "okhttp/4.12.0" }, {}).platform, "android");
    assert.equal(build({ "user-agent": "App/1 CFNetwork/1494 Darwin/23.4.0" }, {}).platform, "ios");
    assert.equal(build({ "user-agent": "Dart/3.5 (dart:io)" }, {}).platform, "app");
  });

  test("curl, scripts and a missing user-agent are empty", () => {
    assert.equal(build({ "user-agent": "curl/8.4.0" }, {}).platform, "");
    assert.equal(build({}, {}).platform, "");
  });

  test("the body can never set the platform or the version", () => {
    const s = build({ "user-agent": BROWSER }, { platform: "android", appVersion: "6.6.6", source: { platform: "ios" } });
    assert.equal(s.platform, "web");
    assert.equal(s.appVersion, "");
  });
});

describe("page type and name are display text, cleaned", () => {
  test("a known type is kept (any case); an unknown one is stored as 'unknown', never refused", () => {
    assert.equal(build({}, { sourceType: "condition" }).sourceType, "condition");
    assert.equal(build({}, { sourceType: " Doctor_Profile " }).sourceType, "doctor_profile");
    assert.equal(build({}, { sourceType: "partner_link" }).sourceType, "unknown");
    assert.equal(build({}, { sourceType: "<script>" }).sourceType, "unknown");
    assert.equal(build({}, { sourceType: 7 }).sourceType, "");
    assert.equal(build({}, {}).sourceType, "");
  });

  test("every listed type is accepted as sent", () => {
    for (const t of S.SOURCE_TYPES) assert.equal(build({}, { sourceType: t }).sourceType, t);
  });

  test("names are trimmed, lose control and invisible characters, squeeze spaces and are capped at 120", () => {
    assert.equal(build({}, { sourceType: "service", sourceName: "  Fit \t to\nfly\u0000 " }).sourceName, "Fit to fly");
    assert.equal(build({}, { sourceName: "a\u202Eb\u200Bc\u2028d" }).sourceName, "a b c d");
    assert.equal(build({}, { sourceName: "x".repeat(500) }).sourceName.length, S.MAX_NAME_LENGTH);
    assert.equal(build({}, { sourceName: { toString: () => "boom" } }).sourceName, "");
    assert.equal(build({}, { sourceName: ["a"] }).sourceName, "");
  });

  test("the name is kept as text, not interpreted (markup is not removed, the admin UI escapes it)", () => {
    assert.equal(build({}, { sourceName: "<b>Doctor's Note</b>" }).sourceName, "<b>Doctor's Note</b>");
  });

  test("clicked-on is kept for header, footer and home only", () => {
    for (const t of ["header", "footer", "home"]) {
      const s = build({}, { sourceType: t, sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly" });
      assert.deepEqual([s.clickedOnType, s.clickedOnName], ["service", "Fit to fly"], t);
    }
    const s = build({}, { sourceType: "condition", sourceName: "Fever", clickedOnType: "service", clickedOnName: "Fit to fly" });
    assert.deepEqual([s.clickedOnType, s.clickedOnName], ["", ""]);
  });

  test("clicked-on type must be a page type: a button position or junk is 'unknown'", () => {
    const s = (t) => build({}, { sourceType: "header", sourceName: "Book", clickedOnType: t, clickedOnName: "x" }).clickedOnType;
    assert.equal(s("header"), "unknown");
    assert.equal(s("footer"), "unknown");
    assert.equal(s("nonsense"), "unknown");
    assert.equal(s("home"), "home");
  });

  test("anything that is not a plain object is ignored, the build still works", () => {
    for (const raw of [undefined, null, "condition", 5, [], [{ sourceType: "condition" }], true]) {
      const s = build({ "user-agent": BROWSER }, raw);
      assert.equal(s.platform, "web");
      assert.equal(s.sourceType, "");
      assert.equal(s.sourceName, "");
      assert.deepEqual(s.capturedAt, NOW);
    }
  });

  test("unexpected fields in the body are dropped", () => {
    const s = build({}, { sourceType: "blog", evil: "x", $set: { a: 1 }, __proto__: { polluted: 1 } });
    assert.deepEqual(Object.keys(s).sort(), [
      "appVersion", "capturedAt", "clickedOnName", "clickedOnType", "pagePath", "platform", "referrer", "sourceName", "sourceType", "utm",
    ]);
  });
});

describe("path, referrer and campaign", () => {
  test("page path is a site path without query string or fragment", () => {
    assert.equal(S.cleanPath("/conditions/fever?token=abc#x"), "/conditions/fever");
    assert.equal(S.cleanPath("https://evil.example/x"), "");
    assert.equal(S.cleanPath("//evil.example/x"), "");
    assert.equal(S.cleanPath("javascript:alert(1)"), "");
    assert.equal(S.cleanPath("/" + "a".repeat(400)).length, 200);
    assert.equal(S.cleanPath(undefined), "");
  });

  test("referrer is host and path only: no scheme, credentials, query or fragment", () => {
    assert.equal(S.cleanReferrer("https://www.google.com/search?q=fever&token=abc#top"), "www.google.com/search");
    assert.equal(S.cleanReferrer("https://user:pw@Example.COM/"), "example.com");
    assert.equal(S.cleanReferrer("http://t.co/abc"), "t.co/abc");
    assert.equal(S.cleanReferrer("javascript:alert(1)"), "");
    assert.equal(S.cleanReferrer("not a url"), "");
    // the website already sends host/path
    assert.equal(S.cleanReferrer("www.google.com/search"), "www.google.com/search");
    assert.equal(S.cleanReferrer("t.co"), "t.co");
    assert.equal(S.cleanReferrer("t.co/abc?x=1"), "t.co/abc");
    assert.equal(S.cleanReferrer(""), "");
    assert.ok(S.cleanReferrer("https://a.com/" + "p".repeat(500)).length <= 200);
  });

  test("campaign values are short plain tags", () => {
    assert.equal(S.cleanUtmValue("google"), "google");
    assert.equal(S.cleanUtmValue("spring sale-2026"), "spring sale-2026");
    assert.equal(S.cleanUtmValue("<img src=x onerror=1>"), "img srcx onerror1");
    assert.equal(S.cleanUtmValue("x".repeat(300)).length, 100);
    assert.equal(S.cleanUtmValue({}), "");
  });

  test("referrer and campaign are kept for web bookings only", () => {
    const raw = { referrer: "https://www.google.com/?q=1", utm: { source: "g", medium: "cpc", campaign: "spring" } };
    const w = build({ "user-agent": BROWSER }, raw);
    assert.equal(w.referrer, "www.google.com");
    assert.deepEqual(w.utm, { source: "g", medium: "cpc", campaign: "spring" });
    const a = build({ "x-client-platform": "android", "x-app-version": "1.0.0+16" }, raw);
    assert.equal(a.referrer, "");
    assert.deepEqual(a.utm, { source: "", medium: "", campaign: "" });
  });

  test("utm that is not an object is ignored", () => {
    for (const utm of ["x", 5, [], null]) assert.deepEqual(build({ "user-agent": BROWSER }, { utm }).utm, { source: "", medium: "", campaign: "" });
  });
});

describe("never throws", () => {
  test("a hostile request object still gives an empty source", () => {
    const hostile = { get headers() { throw new Error("boom"); } };
    const s = S.buildBookingSource(hostile, { sourceType: "blog" }, NOW);
    assert.equal(s.platform, "");
    assert.equal(s.sourceType, "blog");
  });

  test("a hostile body still gives a usable value", () => {
    const body = { get sourceType() { throw new Error("boom"); } };
    const s = S.buildBookingSource(web(), body, NOW);
    assert.equal(s.platform, "");
    assert.equal(s.sourceType, "");
    assert.deepEqual(s.capturedAt, NOW);
  });
});

describe("labels for the admin list", () => {
  test("Android and iOS are both 'App'; the exact platform and version are the tooltip", () => {
    assert.equal(S.platformGroup({ platform: "web" }), "Web");
    assert.equal(S.platformGroup({ platform: "android" }), "App");
    assert.equal(S.platformGroup({ platform: "ios" }), "App");
    assert.equal(S.platformGroup({ platform: "app" }), "App");
    assert.equal(S.platformDetail({ platform: "android", appVersion: "2.4.1+30" }), "Android · v2.4.1+30");
    assert.equal(S.platformDetail({ platform: "ios", appVersion: "" }), "iOS");
    assert.equal(S.platformDetail({ platform: "web" }), "Website");
  });

  test("old bookings (no source, or an empty one) are Unknown and Not recorded", () => {
    for (const old of [undefined, null, {}, { platform: "" }, { platform: "", sourceType: "" }]) {
      assert.equal(S.platformGroup(old), "Unknown");
      assert.equal(S.platformDetail(old), "Booked before source tracking started");
      assert.equal(S.sourcePageLabel(old), null);
      assert.equal(S.sourceSearchText(old), "");
    }
  });

  test("an app booking before the app sends a page is App with Source page 'Not recorded'", () => {
    const s = build({ "x-client-platform": "ios", "x-app-version": "1.0.0+16" }, undefined);
    assert.equal(S.platformGroup(s), "App");
    assert.equal(S.sourcePageLabel(s), null);
  });

  test("a stored 'unknown' type also reads as Not recorded", () => {
    assert.equal(S.sourcePageLabel({ platform: "web", sourceType: "unknown", sourceName: "x" }), null);
  });

  test("source page is TYPE and NAME", () => {
    assert.deepEqual(S.sourcePageLabel({ sourceType: "condition", sourceName: "Fever" }), { type: "Condition", name: "Fever", clickedOn: "" });
    assert.deepEqual(S.sourcePageLabel({ sourceType: "doctor_profile", sourceName: "Martin Perlin" }), { type: "Doctor profile", name: "Martin Perlin", clickedOn: "" });
    assert.deepEqual(S.sourcePageLabel({ sourceType: "speciality", sourceName: "Adolescent Medicine" }), { type: "Speciality", name: "Adolescent Medicine", clickedOn: "" });
  });

  test("header and footer buttons show the page the patient was on", () => {
    assert.deepEqual(
      S.sourcePageLabel({ sourceType: "header", sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly" }),
      { type: "Header", name: "Book Appointment", clickedOn: "Service: Fit to fly" }
    );
    assert.equal(S.sourcePageLabel({ sourceType: "header", sourceName: "Book Appointment", clickedOnType: "home", clickedOnName: "" }).clickedOn, "Home page");
    assert.equal(
      S.sourcePageLabel({ sourceType: "footer", sourceName: "Book Appointment", clickedOnType: "blog", clickedOnName: "Travelling with asthma" }).clickedOn,
      "Blog: Travelling with asthma"
    );
  });

  test("a generic site page is 'Page: About Us', and can be the page a button was clicked on", () => {
    assert.deepEqual(S.sourcePageLabel({ sourceType: "page", sourceName: "About Us" }), { type: "Page", name: "About Us", clickedOn: "" });
    assert.equal(
      S.sourcePageLabel({ sourceType: "header", sourceName: "Book Appointment", clickedOnType: "page", clickedOnName: "About Us" }).clickedOn,
      "Page: About Us"
    );
    assert.equal(build({}, { sourceType: "header", sourceName: "Book", clickedOnType: "page", clickedOnName: "Contact" }).clickedOnType, "page");
  });

  test("a page with no type of its own shows just its name after 'on'", () => {
    const label = S.sourcePageLabel({ sourceType: "header", sourceName: "Book Appointment", clickedOnType: "unknown", clickedOnName: "About Us" });
    assert.equal(label.clickedOn, "About Us");
    assert.equal(S.sourcePageLabel({ sourceType: "header", sourceName: "Book Appointment", clickedOnType: "unknown", clickedOnName: "" }).clickedOn, "");
  });

  test("search text has type, name and the clicked-on page", () => {
    const text = S.sourceSearchText({ sourceType: "footer", sourceName: "Book Appointment", clickedOnType: "blog", clickedOnName: "Travelling with asthma" });
    for (const word of ["Footer", "Book Appointment", "Blog", "Travelling with asthma"]) assert.ok(text.includes(word), word);
  });
});

describe("on both booking models", () => {
  const base = { patientId: "64b000000000000000000001", date: "2026-11-01", time: "10:00" };
  const models = [["Appointment", Appointment], ["CategoryConsultation", CategoryConsultation]];

  for (const [name, Model] of models) {
    test(`${name}: a booking with no source is untouched and reads as empty`, () => {
      const doc = new Model(base);
      assert.equal(doc.source.platform, "");
      assert.equal(doc.source.sourceType, "");
      assert.equal(doc.source.capturedAt, null);
      assert.equal(S.platformGroup(doc.source), "Unknown");
      assert.equal(S.sourcePageLabel(doc.source), null);
      const err = doc.validateSync();
      assert.ok(!err || !Object.keys(err.errors).some((k) => k.startsWith("source")), "no source error");
    });

    test(`${name}: a built source validates and is kept`, () => {
      const source = build({ "user-agent": BROWSER }, { sourceType: "header", sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly", pagePath: "/fit-to-fly" });
      const doc = new Model({ ...base, source });
      const err = doc.validateSync();
      assert.ok(!err || !Object.keys(err.errors).some((k) => k.startsWith("source")), "no source error");
      assert.equal(doc.source.sourceType, "header");
      assert.equal(doc.source.clickedOnName, "Fit to fly");
      assert.equal(doc.source.platform, "web");
    });

    test(`${name}: a type outside the list is refused by the schema (the builder never produces one)`, () => {
      const err = new Model({ ...base, source: { sourceType: "partner_link" } }).validateSync();
      assert.ok(err?.errors["source.sourceType"]);
    });
  }
});
