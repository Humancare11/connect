import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolvePage, safeName, prettifySlug, HAND_PAGES, SOURCE_TYPES, MAX_NAME_LENGTH } from "./pageIdentity.js";
import { categories, specialties, conditions } from "../data/searchIndex.js";
import { buildReport } from "../../scripts/booking-source-coverage.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const backend = require("../../../backend/utils/bookingSource.js");

describe("the type list", () => {
  test("is the backend's fixed list, in the same order", () => {
    assert.deepEqual(SOURCE_TYPES, backend.SOURCE_TYPES);
    assert.equal(MAX_NAME_LENGTH, backend.MAX_NAME_LENGTH);
  });
});

describe("safeName: display text, never patient data", () => {
  test("ordinary titles and names are kept", () => {
    for (const ok of ["Fit to fly", "Doctor's Note", "Are Online Doctors Real Doctors?", "Martin Perlin", "Men's Health", "Children & Family Care", "Eye, Ear & Bone", "Travelling with asthma"]) {
      assert.equal(safeName(ok), ok, ok);
    }
  });

  test("emails, phone numbers, ids, tokens and URLs are dropped entirely", () => {
    const bad = [
      "john.smith@example.com",
      "Booking for jane@x.org",
      "+44 7700 900123",
      "(415) 555-0132",
      "5551234567",
      "64b0000000000000000000d1",
      "123e4567-e89b-12d3-a456-426614174000",
      "tok_1Nabc2DEFghi3JKLmno4PQR",
      "https://example.com/pay?token=abc",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    ];
    for (const text of bad) assert.equal(safeName(text), "", text);
  });

  test("a query string is cut off; a title ending in a question mark is not", () => {
    assert.equal(safeName("Fit to fly?utm_source=x&id=7"), "Fit to fly");
    assert.equal(safeName("Page ?a=1"), "Page");
    assert.equal(safeName("Is Telemedicine Safe?"), "Is Telemedicine Safe?");
  });

  test("control and invisible characters go, spaces squeeze, length is capped", () => {
    assert.equal(safeName("  a\u0000b\u202Ec\u200Bd \n e "), "a b c d e");
    assert.equal(safeName("x".repeat(500)).length, MAX_NAME_LENGTH);
  });

  test("anything that is not a string is empty", () => {
    for (const v of [undefined, null, 5, {}, [], true]) assert.equal(safeName(v), "");
  });
});

describe("prettifySlug", () => {
  test("words, small words and acronyms", () => {
    assert.equal(prettifySlug("obstetrics-and-gynaecology"), "Obstetrics and Gynaecology");
    assert.equal(prettifySlug("adhd-evaluation"), "ADHD Evaluation");
    assert.equal(prettifySlug("mens-health"), "Men's Health");
    assert.equal(prettifySlug(""), "");
    assert.equal(prettifySlug(undefined), "");
  });
});

describe("resolvePage", () => {
  test("every searchIndex entry resolves to its own type and title (by data)", () => {
    const typeOf = { category: "category", specialty: "speciality", condition: "condition" };
    let checked = 0;
    for (const e of [...categories, ...specialties, ...conditions]) {
      if (HAND_PAGES[e.route.toLowerCase()]) continue;
      const r = resolvePage(e.route);
      if (r.via === "none") continue; // a stale entry that is now a private path
      if (r.via === "hand") continue; // a category root named by the table
      assert.equal(r.type, typeOf[e.type], e.route);
      assert.equal(r.name, safeName(e.title), e.route);
      checked += 1;
    }
    assert.ok(checked > 150, `checked ${checked}`);
  });

  test("the hand table: home, services, dashboard, symptoms", () => {
    assert.deepEqual(resolvePage("/"), { type: "home", name: "", via: "hand" });
    assert.deepEqual(resolvePage("/fit-to-fly-certificate"), { type: "service", name: "Fit to fly", via: "hand" });
    assert.deepEqual(resolvePage("/online-prescription-refills"), { type: "service", name: "Online Prescription Refills", via: "hand" });
    assert.deepEqual(resolvePage("/user/dashboard"), { type: "patient_dashboard", name: "Patient dashboard", via: "hand" });
    assert.deepEqual(resolvePage("/user/appointments"), { type: "my_appointments", name: "My appointments", via: "hand" });
    assert.deepEqual(resolvePage("/conditions"), { type: "symptom", name: "Symptoms", via: "hand" });
    assert.deepEqual(resolvePage("/doctors-note"), { type: "condition", name: "Doctor's Note", via: "hand" });
  });

  test("case, trailing slash and query string do not matter", () => {
    assert.equal(resolvePage("/Fit-To-Fly-Certificate/").name, "Fit to fly");
    assert.equal(resolvePage("/fit-to-fly-certificate?email=a@b.co&id=64b0000000000000000000d1#top").name, "Fit to fly");
  });

  test("category, speciality and condition pages follow /{category}/{speciality}/{condition}", () => {
    const category = resolvePage("/mental-health");
    assert.deepEqual([category.type, category.name], ["category", "Mental Health"]);
    assert.equal(resolvePage("/mens-health").name, "Men's Health");
    const spec = resolvePage("/child-and-family-care/adolescent-medicine");
    assert.deepEqual([spec.type, spec.name], ["speciality", "Adolescent Medicine"]);
    const cond = resolvePage("/women-health/obstetrics-and-gynaecology/pcos");
    assert.equal(cond.type, "condition");
    assert.match(cond.name, /pcos/i);
  });

  test("a page missing from the data is still typed by its place in the URL, named from the slug", () => {
    const r = resolvePage("/mental-health/psychiatry/some-new-condition");
    assert.deepEqual(r, { type: "condition", name: "Some New Condition", via: "path" });
  });

  test("the booking tree: category, speciality and condition from the slugs", () => {
    assert.equal(resolvePage("/appointment-booking/mental-health").type, "category");
    assert.equal(resolvePage("/appointment-booking/mental-health").name, "Mental Health");
    assert.equal(resolvePage("/appointment-booking/mental-health/psychiatry").type, "speciality");
    assert.equal(resolvePage("/appointment-booking/mental-health/psychiatry/anxiety").type, "condition");
    assert.equal(resolvePage("/appointment-booking/category-confirm").via, "none");
    assert.equal(resolvePage("/appointment-booking/not-a-real-category").type, "category");
  });

  test("doctor profile: the name from the page, else the name slug; an id is never shown", () => {
    assert.deepEqual(resolvePage("/doctors/x-123", { doctorName: "Martin Perlin" }), { type: "doctor_profile", name: "Martin Perlin", via: "hand" });
    assert.equal(resolvePage("/doctors/martin-perlin").name, "Martin Perlin");
    assert.deepEqual(resolvePage("/doctor/64b0000000000000000000d1"), { type: "doctor_profile", name: "", via: "path" });
    assert.equal(resolvePage("/doctor/64b0000000000000000000d1", { doctorName: "Dr Who" }).name, "Dr Who");
  });

  test("a doctor name that is really an email is not used", () => {
    const r = resolvePage("/doctors/martin-perlin", { doctorName: "martin@clinic.example" });
    assert.equal(r.name, "Martin Perlin");
  });

  test("private pages are never named", () => {
    for (const p of ["/login", "/admin-dashboard/appointments/64b0000000000000000000d1", "/pay/abc123def456ghi789jkl012", "/video-call/64b0000000000000000000d1", "/user/payment-history", "/doctor-dashboard", "/partner-dashboard/cases/5"]) {
      assert.deepEqual(resolvePage(p), { type: "unknown", name: "", via: "none" }, p);
    }
  });

  test("articles are blogs, named from the SEO title", () => {
    const r = resolvePage("/are-online-doctors-real-doctors");
    assert.equal(r.type, "blog");
    assert.equal(r.via, "seo");
    assert.equal(r.name, "Are Online Doctors Real Doctors?");
  });

  test("a blog post made in Super Admin says so itself; any other unknown page is not called a blog", () => {
    assert.deepEqual(resolvePage("/travelling-with-asthma", { blogTitle: "Travelling with asthma | Humancare Connect" }), { type: "blog", name: "Travelling with asthma", via: "seo" });
    assert.equal(resolvePage("/travelling-with-asthma").type, "page");
    assert.equal(resolvePage("/travelling-with-asthma", { blogTitle: "jane@x.org" }).type, "page");
  });

  test("a generic page (About us, Contact, legal, Corporates, the Blogs index) is a 'page', named from its SEO title", () => {
    for (const p of ["/about-us", "/contact-us", "/privacy-policy", "/corporates", "/blogs", "/terms-of-service"]) {
      const r = resolvePage(p);
      assert.equal(r.type, "page", p);
      assert.equal(r.via, "seo", p);
      assert.ok(r.name.length > 0, p);
    }
    assert.equal(resolvePage("/about-us").name, "About Humancare Connect");
    // no SEO entry: still a page, named from the URL
    assert.deepEqual(resolvePage("/patient-privacy-notice"), { type: "page", name: "Patient Privacy Notice", via: "path" });
  });

  test("never throws, always returns a listed type and a safe name", () => {
    const junk = [undefined, null, 5, {}, "", "   ", "no-slash", "/" + "a".repeat(5000), "//evil.example/x", "/%00%ff", "/a/b/c/d/e/f/g", "javascript:alert(1)"];
    for (const p of junk) {
      for (const hints of [undefined, null, 5, "x", { doctorName: {}, blogTitle: [] }]) {
        const r = resolvePage(p, hints);
        assert.ok(SOURCE_TYPES.includes(r.type), String(p));
        assert.equal(r.name, safeName(r.name));
        assert.ok(["hand", "data", "seo", "path", "none"].includes(r.via));
      }
    }
  });
});

describe("coverage over every public route in App.jsx", () => {
  const report = buildReport();
  const rows = [...report.matchAll(/^\| `([^`]+)` \| ([a-z_]+) \| (.*) \|$/gm)].map((m) => ({ route: m[1], type: m[2], name: m[3] }));

  test("the report lists the routes and every name in it is safe display text", () => {
    assert.ok(rows.length > 300, `${rows.length} rows`);
    for (const r of rows) {
      assert.ok(SOURCE_TYPES.includes(r.type), r.route);
      const name = r.name === "—" ? "" : r.name.replace(/\\\|/g, "|");
      assert.equal(safeName(name), name, r.route);
    }
  });

  test("docs/booking-source-coverage.md is up to date (run `npm run report:booking-source`)", () => {
    const file = path.join(here, "../../../docs/booking-source-coverage.md");
    assert.equal(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), report);
  });

  test("every public condition, speciality and category page resolves to its own type", () => {
    const roots = ["child-and-family-care", "chronic-care", "eye-ear-bone", "general-and-everyday-care", "mens-health", "mental-health", "sexual-health", "skin-and-hair-care", "travel-and-global-care", "weight-and-nutrition", "women-health"];
    const wrong = rows.filter((r) => {
      const parts = r.route.split("/").filter(Boolean);
      if (!roots.includes(parts[0])) return false;
      return r.type !== ["category", "speciality", "condition"][parts.length - 1];
    });
    assert.deepEqual(wrong, []);
  });
});
