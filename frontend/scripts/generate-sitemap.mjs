import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SEO_ROUTES, SITE_ORIGIN, isIndexable } from "../src/seo/routes.js";

const PRODUCTION_ORIGIN = SITE_ORIGIN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "dist");

// The sitemap is an allow-list: only routes declared in src/seo/routes.js that are indexable
// (not noindex, not under a non-public prefix) are listed. New routes never leak in by accident.
function indexableRoutes() {
  return Object.keys(SEO_ROUTES)
    .filter((routePath) => isIndexable(routePath))
    .sort((a, b) => {
      if (a === "/") return -1;
      if (b === "/") return 1;
      return a.localeCompare(b);
    });
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function routeToUrl(routePath) {
  // Same form as the page's <link rel="canonical"> (see src/seo/routes.js getRouteSeo).
  return `${PRODUCTION_ORIGIN}${SEO_ROUTES[routePath]?.canonical || routePath}`;
}

function priorityFor(routePath) {
  if (routePath === "/") return "1.0";
  if (
    [
      "/about-us",
      "/book-appointment",
      "/categories",
      "/conditions",
      "/contact-us",
      "/faq",
      "/medical-services",
      "/specialties",
    ].includes(routePath)
  ) {
    return "0.8";
  }

  return "0.6";
}

function changeFrequencyFor(routePath) {
  if (routePath === "/" || routePath === "/blogs") return "weekly";
  return "monthly";
}

// Blog posts and doctor profiles are not in the static map: scripts/prerender.mjs lists the ones it
// rendered in dist/.prerender-manifest.json (with the post's own published date).
function dynamicRoutes() {
  const file = path.join(outDir, ".prerender-manifest.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function buildSitemap(routePaths, extra) {
  const lastmods = new Map(extra.map((e) => [e.route, e.lastmod]));
  const entries = [...routePaths, ...extra.map((e) => e.route)]
    .map((routePath) => {
      const loc = escapeXml(routeToUrl(routePath));
      // Real content date from the metadata map / the post itself; never the build date.
      const lastmod = lastmods.has(routePath) ? lastmods.get(routePath) : SEO_ROUTES[routePath].lastmod;

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        `    <changefreq>${changeFrequencyFor(routePath)}</changefreq>`,
        `    <priority>${priorityFor(routePath)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
}

function buildRobotsTxt(isProduction) {
  if (!isProduction) {
    // Non-production deployments (UAT, staging, etc.) must never be indexed
    // or have their URLs surfaced as duplicates of the production site.
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /admin-dashboard/",
    "Disallow: /doctor-dashboard/",
    "Disallow: /employee-dashboard/",
    "Disallow: /payment-admin/",
    "Disallow: /superadmin-dashboard/",
    "Disallow: /user/",
    "Disallow: /pay/",
    "Disallow: /video-call/",
    "Disallow: /partner-dashboard",
    "Disallow: /partner-login",
    "Disallow: /services-prices",
    "Disallow: /ServiceDemo",
    "Disallow: /appointment-booking/form",
    "Disallow: /appointment-booking/category-confirm",
    "Disallow: /category-consultant",
    "Disallow: /service-consultant",
    "Disallow: /direct-video-call/",
    "",
    `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

function ensureBuildOutput() {
  if (!fs.existsSync(outDir)) {
    throw new Error("Build output directory does not exist. Run this script after vite build.");
  }
}

ensureBuildOutput();

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "production";
const isProduction = mode === "production";

const routes = indexableRoutes();

if (routes.length === 0) {
  throw new Error("No indexable routes in src/seo/routes.js for sitemap generation.");
}

fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(routes, dynamicRoutes()));
fs.writeFileSync(path.join(outDir, "robots.txt"), buildRobotsTxt(isProduction));

