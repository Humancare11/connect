// Build-time SEO guard. Fails the build (exit 1) when the metadata map, routes, redirects or
// sitemap drift apart. Run automatically before every build (see package.json) and again with
// --dist after the sitemap is generated.
//
//   node scripts/check-seo.mjs          checks sources
//   node scripts/check-seo.mjs --dist   additionally checks dist/sitemap.xml
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_ROUTES, SITE_ORIGIN, isNoindexPath, isIndexable } from "../src/seo/routes.js";
import { REDIRECTS, CASE_REDIRECTS } from "../src/seo/redirects.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkDist = process.argv.includes("--dist");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const MAX_DESC = 160;
const MIN_DESC_WARN = 120;

// ---- 1. entry shape -------------------------------------------------------------------------
const indexable = [];
for (const [key, e] of Object.entries(SEO_ROUTES)) {
  if (!key.startsWith("/")) err(`[routes] "${key}" must start with "/"`);
  if (key !== key.toLowerCase()) err(`[routes] "${key}" must be lowercase`);
  if (key.length > 1 && key.endsWith("/")) err(`[routes] "${key}" must not end with "/"`);
  if (/\s/.test(key)) err(`[routes] "${key}" contains whitespace`);
  if (/[&_]/.test(key)) warn(`[routes] "${key}" contains "&" or "_" (prefer kebab-case)`);

  const noindex = isNoindexPath(key);
  if (e.canonical !== undefined && e.canonical !== key) {
    err(`[canonical] "${key}" declares canonical "${e.canonical}"; it must equal the route (self-referencing)`);
  }
  if (noindex) {
    if (e.canonical) err(`[canonical] non-public route "${key}" must not declare a canonical`);
    continue;
  }
  indexable.push(key);
  if (!e.title || !String(e.title).trim()) err(`[meta] "${key}" has no title`);
  if (!e.description || !String(e.description).trim()) err(`[meta] "${key}" has no description`);
  if (e.description && e.description.length > MAX_DESC) {
    err(`[meta] "${key}" description is ${e.description.length} chars (max ${MAX_DESC})`);
  }
  if (e.description && e.description.length < MIN_DESC_WARN) {
    warn(`[meta] "${key}" description is only ${e.description.length} chars`);
  }
  if (e.lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)) err(`[meta] "${key}" lastmod "${e.lastmod}" is not YYYY-MM-DD`);
  if (!e.lastmod) warn(`[meta] "${key}" has no lastmod`);
}

// ---- 2. duplicate titles / descriptions -----------------------------------------------------
function dupes(field) {
  const seen = new Map();
  for (const key of indexable) {
    const v = SEO_ROUTES[key][field];
    if (!v) continue;
    const norm = String(v).trim().toLowerCase().replace(/\s+/g, " ");
    seen.set(norm, [...(seen.get(norm) || []), key]);
  }
  for (const keys of seen.values()) {
    if (keys.length > 1) err(`[duplicate ${field}] shared by: ${keys.join(", ")}`);
  }
}
dupes("title");
dupes("description");

// ---- 3. App.jsx routes vs the map -----------------------------------------------------------
const appSource = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const appRoutes = new Set();
{
  const noComments = appSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of noComments.matchAll(/<Route\b[^>]*?\bpath\s*=\s*["']([^"']+)["']/g)) appRoutes.add(m[1]);
}
const redirectFroms = new Set(REDIRECTS.map((r) => r.from));
for (const p of appRoutes) {
  if (!p.startsWith("/") || p.includes(":") || p.includes("*")) continue; // nested/dynamic/catch-all
  if (p !== p.toLowerCase()) err(`[routes] App.jsx route "${p}" must be lowercase (add a CASE_REDIRECTS entry for the old URL)`);
  const lower = p.toLowerCase();
  if (!SEO_ROUTES[lower] && !isNoindexPath(lower) && !redirectFroms.has(lower)) {
    err(`[routes] App.jsx route "${p}" has no entry in src/seo/routes.js (add metadata, or mark it non-public)`);
  }
}
for (const key of indexable) {
  if (!appRoutes.has(key)) err(`[routes] map entry "${key}" is indexable but App.jsx has no such <Route> (it would be a dead sitemap URL)`);
}

// ---- 4. redirects ---------------------------------------------------------------------------
const toSet = new Set();
for (const { from, to } of [...REDIRECTS, ...CASE_REDIRECTS]) {
  if (from === to) err(`[redirect] "${from}" redirects to itself`);
  if (SEO_ROUTES[from]) err(`[redirect] source "${from}" still has a metadata entry (it must not be indexable)`);
  if (appRoutes.has(from) && !redirectFroms.has(from)) err(`[redirect] source "${from}" is still a live <Route> in App.jsx`);
  if (!isIndexable(to)) err(`[redirect] target "${to}" (from "${from}") is not an indexable route in the map`);
  toSet.add(to);
}
for (const { from } of [...REDIRECTS, ...CASE_REDIRECTS]) {
  if (toSet.has(from)) err(`[redirect] chain: "${from}" is both a source and a target`);
}
for (const { from, to } of CASE_REDIRECTS) {
  if (from.toLowerCase() !== to) err(`[redirect] case redirect "${from}" must target its lowercase form "${from.toLowerCase()}"`);
}

const renderYaml = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
{
  const yamlRoutes = [];
  const re = /-\s*type:\s*(\w+)\s*\n\s*source:\s*(\S+)\s*\n\s*destination:\s*(\S+)/g;
  let m;
  while ((m = re.exec(renderYaml))) yamlRoutes.push({ type: m[1], source: m[2], destination: m[3], at: m.index });
  const yamlRedirects = yamlRoutes.filter((r) => r.type === "redirect");
  const want = [...REDIRECTS, ...CASE_REDIRECTS];
  for (const { from, to } of want) {
    const hit = yamlRedirects.find((r) => r.source === from);
    if (!hit) err(`[render.yaml] missing 301 redirect ${from} -> ${to}`);
    else if (hit.destination !== to) err(`[render.yaml] redirect ${from} points to ${hit.destination}, expected ${to}`);
  }
  for (const r of yamlRedirects) {
    if (!want.some((w) => w.from === r.source)) err(`[render.yaml] redirect ${r.source} is not in src/seo/redirects.js`);
  }
  const rewrite = yamlRoutes.find((r) => r.type === "rewrite" && r.source === "/*");
  if (!rewrite) err(`[render.yaml] catch-all rewrite "/*" not found`);
  else if (yamlRedirects.some((r) => r.at > rewrite.at)) err(`[render.yaml] redirects must come before the "/*" rewrite`);
}

// ---- 5. index.html must not carry page-level tags again -------------------------------------
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const banned = [
    [/<link[^>]+rel=["']canonical["']/i, "canonical link"],
    [/<meta[^>]+name=["']description["']/i, "meta description"],
    [/<meta[^>]+name=["']robots["']/i, "meta robots"],
    [/<meta[^>]+property=["']og:/i, "og:* tag"],
    [/<meta[^>]+name=["']twitter:/i, "twitter:* tag"],
  ];
  for (const [re, label] of banned) {
    if (re.test(html)) err(`[index.html] static ${label} found; page tags must come from src/seo/routes.js`);
  }
}

// ---- 6. built sitemap ------------------------------------------------------------------------
if (checkDist) {
  const sitemapFile = path.join(root, "dist", "sitemap.xml");
  if (!fs.existsSync(sitemapFile)) err(`[sitemap] dist/sitemap.xml not found`);
  else {
    const xml = fs.readFileSync(sitemapFile, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    const seen = new Set();
    for (const loc of locs) {
      if (seen.has(loc)) err(`[sitemap] duplicate <loc> ${loc}`);
      seen.add(loc);
      if (!loc.startsWith(SITE_ORIGIN)) {
        err(`[sitemap] ${loc} is not on ${SITE_ORIGIN}`);
        continue;
      }
      const p = loc.slice(SITE_ORIGIN.length) || "/";
      if (!isIndexable(p)) err(`[sitemap] ${loc} is not an indexable route`);
    }
    if (locs.length !== indexable.length) {
      err(`[sitemap] ${locs.length} URLs but ${indexable.length} indexable routes in the map`);
    }
    for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) err(`[sitemap] bad lastmod "${m[1]}"`);
    }
  }
}

// ---- report ----------------------------------------------------------------------------------
if (warnings.length) {
  console.warn(`SEO check: ${warnings.length} warning(s)`);
  for (const w of warnings.slice(0, 15)) console.warn("  warn  " + w);
  if (warnings.length > 15) console.warn(`  ... and ${warnings.length - 15} more`);
}
if (errors.length) {
  console.error(`\nSEO check FAILED: ${errors.length} error(s)`);
  for (const e of errors) console.error("  error " + e);
  process.exit(1);
}
console.log(
  `SEO check passed: ${indexable.length} indexable routes, ${Object.keys(SEO_ROUTES).length - indexable.length} non-public entries, ` +
    `${REDIRECTS.length + CASE_REDIRECTS.length} redirects${checkDist ? ", sitemap verified" : ""}.`
);
