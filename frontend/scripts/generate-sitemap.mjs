import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_ORIGIN = "https://humancareconnect.co";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const appFile = path.join(projectRoot, "src", "App.jsx");
const outDir = path.join(projectRoot, "dist");

const excludedPrefixes = [
  "/admin-dashboard",
  "/doctor-dashboard",
  "/employee-dashboard",
  "/payment-admin",
  "/superadmin-dashboard",
  "/user",
];

const excludedExactPaths = new Set([
  "*",
  "/admin-auth",
  "/adminauth",
  "/cookies",
  "/doctor-login",
  "/employee-login",
  "/images",
  "/login",
  "/payment-admin-login",
  "/profile",
  "/test",
]);

function readAppRoutes() {
  const source = fs.readFileSync(appFile, "utf8");
  const withoutJsxComments = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const pathAttributePattern = /\bpath\s*=\s*["']([^"']+)["']/g;
  const routes = [];
  let match;

  while ((match = pathAttributePattern.exec(withoutJsxComments)) !== null) {
    routes.push(match[1]);
  }

  return routes;
}

function isIndexableRoute(routePath) {
  if (!routePath || excludedExactPaths.has(routePath)) return false;
  if (!routePath.startsWith("/")) return false;
  if (routePath.includes(":") || routePath.includes("*")) return false;
  if (excludedPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`))) {
    return false;
  }

  return true;
}

function normalizeRoutes(routePaths) {
  return [...new Set(routePaths.filter(isIndexableRoute))]
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
  if (routePath === "/") return PRODUCTION_ORIGIN;
  return `${PRODUCTION_ORIGIN}${routePath}`;
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

function buildSitemap(routePaths) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const entries = routePaths
    .map((routePath) => {
      const loc = escapeXml(routeToUrl(routePath));

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
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

function buildRobotsTxt() {
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

const routes = normalizeRoutes(readAppRoutes());

if (routes.length === 0) {
  throw new Error("No indexable React routes were found for sitemap generation.");
}

fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(routes));
fs.writeFileSync(path.join(outDir, "robots.txt"), buildRobotsTxt());

console.log(`Generated sitemap.xml and robots.txt for ${routes.length} routes.`);
