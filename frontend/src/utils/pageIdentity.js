// utils/pageIdentity.js
//
// "Which page is this?" for the booking source: a pathname goes in, { type, name, via } comes out, e.g.
//   /women-health/obstetrics-and-gynaecology/pcos  ->  { type: "condition", name: "PCOS", via: "data" }
// It is how the admin Appointments list can say "Condition: Fever" or "Header: Book Appointment / on Service: Fit to fly"
// without editing the ~250 page templates.
//
// `type` is one of the backend's fixed list (backend/utils/bookingSource.js SOURCE_TYPES); `name` is display text, at most
// 120 characters, and NEVER patient data (see safeName). `via` says how it was worked out, for the coverage report:
//   "hand"  a hand-written table entry (services, home, dashboard, fixed pages)
//   "data"  matched against src/data/searchIndex.js (categories, specialities, conditions)
//   "seo"   the page title in src/seo/routes.js
//   "path"  worked out from the URL itself (prettified slug); the least reliable
//   "none"  a private page (login, dashboards, payment): never named
//
// Pure functions, no React, no DOM: importable from node tests and the coverage script.
import { SEO_ROUTES, normalizePath, isNoindexPath } from "../seo/routes.js";
import { categories, specialties, conditions } from "../data/searchIndex.js";
import { slugify } from "./slug.js";

export const MAX_NAME_LENGTH = 120;

// The backend's fixed list (backend/utils/bookingSource.js). A test keeps the two equal.
export const SOURCE_TYPES = [
  "condition", "service", "speciality", "category", "doctor_profile", "blog", "home", "symptom",
  "find_doctor", "patient_dashboard", "my_appointments", "header", "footer", "direct", "unknown",
];

// ── Names are display text and must never carry patient data ───────────────────

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
const UNSAFE = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email address
  /\bhttps?:\/\//i, // a URL (can carry tokens)
  /(\+?\d[\d\s().-]{5,}\d)/, // phone number or other long digit run
  /\b[0-9a-f]{24}\b/i, // booking / user id (Mongo ObjectId)
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // uuid
  /\b(?=[A-Za-z_-]*\d)(?=[A-Za-z\d_-]*[A-Za-z])[A-Za-z\d_-]{20,}\b/, // token-like: a long word mixing letters and digits
];

// Returns the cleaned name, or "" when it looks like it holds patient data or an identifier. Query strings are cut off.
export function safeName(value, max = MAX_NAME_LENGTH) {
  if (typeof value !== "string") return "";
  let text = value.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  // "?x=1&y=2" is a query string; a title ending in "?" is not.
  text = text.replace(/\?\S*=\S*/g, "").replace(/#\S*/g, (m) => (/^#\w/.test(m) ? "" : m)).trim();
  if (!text) return "";
  if (UNSAFE.some((rx) => rx.test(text))) return "";
  return text.slice(0, max).trim();
}

// ── Tables ─────────────────────────────────────────────────────────────────────

const CATEGORY_ROOTS = {
  "child-and-family-care": "Children & Family Care",
  "chronic-care": "Chronic Care & Expert Opinion",
  "eye-ear-bone": "Eye, Ear & Bone",
  "general-and-everyday-care": "General & Everyday Care",
  "mens-health": "Men's Health",
  "mental-health": "Mental Health",
  "sexual-health": "Sexual Health",
  "skin-and-hair-care": "Skin & Hair Care",
  "travel-and-global-care": "Travel & Global Care",
  "weight-and-nutrition": "Weight & Nutrition",
  "women-health": "Women's Health",
};

// Pages worked out by hand: type + name. Keys are normalized paths.
export const HAND_PAGES = {
  "/": { type: "home", name: "" },
  "/user/dashboard": { type: "patient_dashboard", name: "Patient dashboard" },
  "/user/appointments": { type: "my_appointments", name: "My appointments" },
  // The Symptoms page is routed at /conditions.
  "/conditions": { type: "symptom", name: "Symptoms" },
  "/categories": { type: "category", name: "All categories" },
  "/specialties": { type: "speciality", name: "All specialties" },
  // Services (pages/NewServices/*).
  "/general-consultation": { type: "service", name: "General Consultation" },
  "/online-prescription-refills": { type: "service", name: "Online Prescription Refills" },
  "/service-sexual-health": { type: "service", name: "Sexual Health" },
  "/weight-loss-programs": { type: "service", name: "Weight Loss Programs" },
  "/online-second-medical-opinion": { type: "service", name: "Online Second Medical Opinion" },
  "/fit-to-fly-certificate": { type: "service", name: "Fit to fly" },
  "/lab-requisitions": { type: "service", name: "Lab Requisitions" },
  "/chronic-care-management": { type: "service", name: "Chronic Care Management" },
  "/primary-care-provider": { type: "service", name: "Primary Care Provider" },
  "/doctors-note": { type: "condition", name: "Doctor's Note" },
  // The booking pages themselves: the patient is already inside the flow, so there is no page to name.
  "/appointment-booking": { type: "unknown", name: "Book Appointment" },
  "/book-appointment": { type: "unknown", name: "Book Appointment" },
};

// The 14 article pages (pages/Blogs/*); their names come from the SEO title.
const BLOG_PATHS = new Set([
  "/what-is-telemedicine", "/telemedicine-services", "/how-does-a-telemedicine-appointment-work", "/online-doctor-consultation",
  "/conditions-treated-through-telemedicine", "/top-telemedicine-platforms-providers", "/is-telemedicine-safe",
  "/telemedicine-vs-in-person-doctor-visits", "/telemedicine-cost-usa", "/are-online-doctors-real-doctors",
  "/future-of-telemedicine", "/uti-symptoms-causes-treatment-&-when-to-see-a-doctor",
  "/migraine-vs-headache-symptoms-causes-differences-and-treatment-options", "/telehealth-for-hypertension",
]);

// ── Data lookups (src/data/searchIndex.js) ─────────────────────────────────────

const norm = (p) => normalizePath(p);
const DATA_BY_ROUTE = new Map();
const SPECIALTY_BY_KEY = new Map();
const CONDITION_BY_KEY = new Map();
const CATEGORY_BY_KEY = new Map();
const addKeys = (map, entry) => {
  for (const key of [entry.id, slugify(entry.title)]) if (key && !map.has(key)) map.set(key, entry);
};
for (const list of [categories, specialties, conditions]) for (const e of list) DATA_BY_ROUTE.set(norm(e.route), e);
for (const e of categories) addKeys(CATEGORY_BY_KEY, e);
for (const e of specialties) addKeys(SPECIALTY_BY_KEY, e);
for (const e of conditions) addKeys(CONDITION_BY_KEY, e);

const TYPE_OF_ENTRY = { category: "category", specialty: "speciality", condition: "condition" };

// ── Slug -> readable ───────────────────────────────────────────────────────────

const ACRONYMS = new Set([
  "pcos", "adhd", "ptsd", "ocd", "hrt", "uti", "sti", "std", "hiv", "bv", "ent", "copd", "ibs", "gerd", "ecg", "pmdd", "ob", "gyn", "usa", "uk", "ai",
]);
const SMALL_WORDS = new Set(["and", "of", "for", "to", "the", "in", "on", "with", "a", "an", "or", "vs"]);
const IRREGULAR = { mens: "Men's", womens: "Women's", childrens: "Children's", doctors: "Doctor's", ear: "Ear" };

export function prettifySlug(slug) {
  const words = String(slug || "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (IRREGULAR[lower]) return IRREGULAR[lower];
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

const seoNameOf = (path) => {
  const title = SEO_ROUTES[path]?.title;
  if (!title) return "";
  return safeName(title.replace(/\s*\|\s*Humancare Connect\s*$/i, "").split(" | ")[0]);
};

const result = (type, name, via) => ({ type, name: safeName(name), via });

// ── The resolver ───────────────────────────────────────────────────────────────

// hints (all optional, all display text from the page itself):
//   doctorName     the doctor being viewed, on a doctor profile page
//   blogTitle      the title of a blog post created in Super Admin (the /:slug route); only that page passes it
export function resolvePage(pathname, hints = {}) {
  try {
    return resolve(pathname, hints || {});
  } catch {
    return { type: "unknown", name: "", via: "none" };
  }
}

function resolve(pathname, hints) {
  const path = norm(pathname);
  const parts = path.split("/").filter(Boolean);

  const hand = HAND_PAGES[path];
  if (hand) return result(hand.type, hand.name, "hand");

  // Booking tree: /appointment-booking/:category[/:specialty[/:condition]]
  if (parts[0] === "appointment-booking" && parts.length >= 2 && parts.length <= 4 && parts[1] !== "category-confirm") {
    const [, cat, spec, cond] = parts;
    if (cond) return named("condition", CONDITION_BY_KEY.get(cond), cond);
    if (spec) return named("speciality", SPECIALTY_BY_KEY.get(spec), spec);
    return named("category", CATEGORY_BY_KEY.get(cat), cat, CATEGORY_ROOTS[cat]);
  }

  // Doctor profile
  if ((parts[0] === "doctors" || parts[0] === "doctor") && parts.length === 2) {
    const fromHint = safeName(hints.doctorName);
    if (fromHint) return { type: "doctor_profile", name: fromHint, via: "hand" };
    // /doctors/:slug is a name slug; /doctor/:id is an id and must never be shown.
    return { type: "doctor_profile", name: parts[0] === "doctors" ? safeName(prettifySlug(parts[1])) : "", via: "path" };
  }

  // Private pages (login, dashboards, payment, video calls...): never named.
  if (isNoindexPath(path)) return { type: "unknown", name: "", via: "none" };

  const entry = DATA_BY_ROUTE.get(path);
  if (entry) return result(TYPE_OF_ENTRY[entry.type] || "unknown", entry.title, "data");

  // /{category}/{speciality}/{condition}
  if (CATEGORY_ROOTS[parts[0]]) {
    if (parts.length === 1) return result("category", CATEGORY_ROOTS[parts[0]], "hand");
    if (parts.length === 2) return named("speciality", SPECIALTY_BY_KEY.get(parts[1]), parts[1]);
    if (parts.length === 3) return named("condition", CONDITION_BY_KEY.get(parts[2]), parts[2]);
  }
  if (parts[0] === "online-second-medical-opinion" && parts.length === 2) return named("condition", CONDITION_BY_KEY.get(parts[1]), parts[1]);

  const seo = seoNameOf(path);
  if (BLOG_PATHS.has(path)) return seo ? result("blog", seo, "seo") : result("blog", prettifySlug(parts[0]), "path");
  if (seo) return result("unknown", seo, "seo");

  // A blog post created in Super Admin (the /:slug route) says so itself; any other unknown page is just "unknown".
  if (parts.length === 1) {
    const title = safeName(String(hints.blogTitle || "").replace(/\s*\|\s*Humancare Connect\s*$/i, "").split(" | ")[0]);
    if (title) return result("blog", title, "seo");
  }
  return result("unknown", prettifySlug(parts[parts.length - 1]), "path");
}

// A page of a known type: the data title if there is one, else the table name, else the prettified slug.
function named(type, entry, slug, tableName) {
  if (entry) return result(type, entry.title, "data");
  if (tableName) return result(type, tableName, "hand");
  return result(type, prettifySlug(slug), "path");
}
