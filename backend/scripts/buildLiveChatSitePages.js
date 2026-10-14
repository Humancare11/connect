#!/usr/bin/env node
// Builds backend/data/liveChatSitePages.json: the allowlist of real public pages the live-chat AI may link to.
//
// Source of truth is the app itself: frontend/src/data/searchIndex.js (categories, specialties, conditions, built
// from the real routes) plus a short list of service pages. Every entry is checked against the routes that are
// really active in frontend/src/App.jsx; an entry whose route is not routed is left out (and reported).
// The result is committed so the backend does not need the frontend folder at runtime; a test fails when the file
// is out of date:  node backend/scripts/buildLiveChatSitePages.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const APP = path.join(ROOT, "frontend", "src", "App.jsx");
const INDEX = path.join(ROOT, "frontend", "src", "data", "searchIndex.js");
const OUT = path.join(__dirname, "..", "data", "liveChatSitePages.json");

// Service pages and the booking page. Each one must be an active route (checked below).
const SERVICE_PAGES = [
  { url: "/appointment-booking", title: "Book an appointment", keywords: ["book", "booking", "appointment", "schedule", "visit", "see a doctor", "how to book"] },
  { url: "/medical-services", title: "All medical services", keywords: ["services", "what do you treat", "what can you treat"] },
  { url: "/online-doctor-consultation", title: "Online doctor consultation", keywords: ["consultation", "online doctor", "talk to a doctor", "video visit", "telehealth"] },
  { url: "/how-does-a-telemedicine-appointment-work", title: "How a telemedicine visit works", keywords: ["how does it work", "telemedicine", "video call"] },
  { url: "/online-prescription-refills", title: "Online prescription refills", keywords: ["prescription", "refill", "renew", "medication refill"] },
  { url: "/online-second-medical-opinion", title: "Online second medical opinion", keywords: ["second opinion", "another opinion", "review my diagnosis"] },
  { url: "/doctors-note", title: "Doctor's note (sick note)", keywords: ["sick note", "doctor's note", "doctors note", "work note", "school note", "medical certificate"] },
  { url: "/return-to-work-clearance", title: "Return-to-work clearance", keywords: ["return to work", "work clearance"] },
  { url: "/fit-to-fly-certificate", title: "Fit-to-fly certificate", keywords: ["fit to fly", "flight certificate", "travel certificate"] },
  { url: "/lab-requisitions", title: "Lab requisitions", keywords: ["lab requisition", "lab test", "blood test", "lab order"] },
  { url: "/lab-results-review", title: "Lab results review", keywords: ["lab results", "test results", "review my results"] },
];

const activeRoutes = (appSource) => {
  const src = appSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, ""); // commented-out routes do not count
  return new Set([...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
};

// searchIndex.js is a plain ES module with no imports: read its three arrays without a bundler.
function readSearchIndex(source) {
  const body = source.replace(/export\s+default\s+[A-Za-z_$][\w$]*\s*;?/g, "").replace(/export\s+const/g, "const");
  return new Function(`${body}\nreturn { categories, specialties, conditions };`)();
}

function build({ appSource, indexSource }) {
  const active = activeRoutes(appSource);
  const { categories, specialties, conditions } = readSearchIndex(indexSource);
  const pages = [];
  const seen = new Set();
  const skipped = [];
  const add = (page) => {
    if (!page.url.startsWith("/") || page.url.includes(":") || page.url.includes("?") || page.url.includes("#")) return;
    if (!active.has(page.url)) return skipped.push(page.url);
    if (seen.has(page.url)) return;
    seen.add(page.url);
    pages.push(page);
  };
  for (const s of SERVICE_PAGES) add({ type: "service", ...s });
  for (const c of categories) add({ type: "category", title: c.title, url: c.route, keywords: c.keywords || [] });
  for (const s of specialties) add({ type: "specialty", title: s.title, url: s.route, keywords: s.keywords || [] });
  for (const c of conditions) add({ type: "condition", title: c.title, url: c.route, keywords: c.keywords || [] });
  return { pages, skipped };
}

function run() {
  const { pages, skipped } = build({ appSource: fs.readFileSync(APP, "utf8"), indexSource: fs.readFileSync(INDEX, "utf8") });
  fs.writeFileSync(OUT, `${JSON.stringify(pages, null, 1)}\n`);
  console.log(`[sitepages] wrote ${pages.length} pages to ${path.relative(ROOT, OUT)}`);
  if (skipped.length) console.log(`[sitepages] left out (not an active route in App.jsx): ${skipped.length}`);
}

if (require.main === module) run();
module.exports = { build, activeRoutes, readSearchIndex, SERVICE_PAGES, OUT };
