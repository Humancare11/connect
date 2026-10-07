// Build-time prerender (SEO_CODE_REVIEW.md, Phase 2, Option A).
//
//   npm run build   = vite build (client) + vite build --ssr (server bundle) + this script
//
// For every indexable route in src/seo/routes.js, every published blog post and every approved
// doctor, renders the real app with StaticRouter and writes dist/<route>/index.html (plus
// dist/<route>.html) with the page's own <head> (title, description, canonical, robots, og,
// JSON-LD) and body content already in the HTML. The browser then hydrates it.
//
// Also writes:
//   dist/404.html               prerendered not-found page (Render serves it with a real 404)
//   dist/.prerender-manifest.json   dynamic routes for the sitemap
//
// dist/200.html (copied from the untouched client index.html before this runs) stays the empty
// SPA shell used for dashboards, login, booking, payment, user and video-call routes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnv } from "vite";
import { SEO_ROUTES, isIndexable } from "../src/seo/routes.js";
import { fetchBlogPages, fetchBlogIndexPage, fetchDoctorPages } from "./prerender-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrEntry = path.join(root, "dist-ssr", "entry-server.js");

const modeArg = process.argv.find((a) => a.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "production";
const env = loadEnv(mode, root, "");
const skipApi = process.env.PRERENDER_SKIP_API === "1";

const started = Date.now();

for (const f of [path.join(dist, "200.html"), ssrEntry]) {
  if (!fs.existsSync(f)) {
    console.error(`prerender: missing ${path.relative(root, f)} (run the client and SSR builds first)`);
    process.exit(1);
  }
}

const template = fs.readFileSync(path.join(dist, "200.html"), "utf8");
if (!template.includes('<div id="root"></div>')) {
  console.error('prerender: dist/200.html does not contain <div id="root"></div>');
  process.exit(1);
}

const { render } = await import(pathToFileURL(ssrEntry).href);

// ---- helpers ----------------------------------------------------------------------------------
// React 19 hoists <title>, <meta>, <link> to the front of the rendered markup. Move them into
// <head>; the browser's hydration adopts the identical tags that are already there.
const HOISTED = /^(?:<link\b[^>]*\/?>|<meta\b[^>]*\/?>|<base\b[^>]*\/?>|<title\b[^>]*>[\s\S]*?<\/title>)/;

function splitHead(html) {
  const head = [];
  let rest = html;
  for (let m = HOISTED.exec(rest); m; m = HOISTED.exec(rest)) {
    head.push(m[0]);
    rest = rest.slice(m[0].length);
  }
  return { head, body: rest };
}

// Server head tags are marked so the browser can remove them once React has rendered its own copy
// (src/seo/PrerenderCleanup.jsx); React 19 does not adopt head tags it did not create.
const mark = (tags) => tags.map((t) => t.replace(/^<(link|meta|title|base)\b/, "<$1 data-prerendered-head"));

function assemble({ head, body, data }) {
  let page = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/, "");
  page = page.replace("</head>", `    ${mark(head).join("\n    ")}\n  </head>`);
  const dataScript = data
    ? `<script id="__PRERENDER_DATA__" type="application/json">${JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")}</script>`
    : "";
  return page.replace('<div id="root"></div>', `<div id="root" data-prerendered>${body}</div>${dataScript}`);
}

function outputFiles(route) {
  if (route === "/") return [path.join(dist, "index.html")];
  const rel = route.replace(/^\//, "");
  return [path.join(dist, rel, "index.html"), path.join(dist, `${rel}.html`)];
}

function write(route, html) {
  for (const file of outputFiles(route)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
}

// ---- collect pages ----------------------------------------------------------------------------
const staticRoutes = Object.keys(SEO_ROUTES).filter((r) => isIndexable(r));
const pages = staticRoutes.map((route) => ({ route, data: null, kind: "static" }));
const reserved = new Set(Object.keys(SEO_ROUTES));
const dynamic = [];
let blogIndex = null;

if (skipApi) {
  console.warn("prerender: PRERENDER_SKIP_API=1, blog posts and doctor profiles are NOT prerendered");
} else {
  try {
    const blogs = await fetchBlogPages(env, { reservedRoutes: reserved });
    const doctors = await fetchDoctorPages(env);
    blogIndex = await fetchBlogIndexPage(env);
    for (const p of blogs) dynamic.push({ ...p, kind: "blog" });
    for (const p of doctors) dynamic.push({ ...p, kind: "doctor" });
  } catch (error) {
    console.error(`prerender: could not fetch blogs/doctors from the API: ${error.message}`);
    console.error("prerender: fix VITE_API_URL / API availability, or set PRERENDER_SKIP_API=1 to build static pages only");
    process.exit(1);
  }
}
// The /blogs index embeds its first page of posts so the post links are in the HTML.
if (blogIndex) {
  const index = pages.find((p) => p.route === "/blogs");
  if (index) index.data = { "blogs:list": blogIndex };
}
for (const p of dynamic) pages.push({ route: p.route, data: { [p.key]: p.record }, kind: p.kind, lastmod: p.lastmod });

// ---- render -----------------------------------------------------------------------------------
const failures = [];
let rendered = 0;

for (const page of pages) {
  try {
    const { html, errors } = await render(page.route, page.data);
    if (errors.length) {
      failures.push(`${page.route}: ${errors.map((e) => e?.message || String(e)).join(" | ").slice(0, 300)}`);
      continue;
    }
    const { head, body } = splitHead(html);
    if (!head.some((t) => t.startsWith("<title"))) {
      failures.push(`${page.route}: rendered without a <title>`);
      continue;
    }
    if (!head.some((t) => /rel="canonical"/.test(t))) {
      failures.push(`${page.route}: rendered without a canonical link`);
      continue;
    }
    if (/\$RC\(|<template id="B:/.test(body)) {
      failures.push(`${page.route}: unresolved Suspense boundary in the output`);
      continue;
    }
    write(page.route, assemble({ head, body, data: page.data }));
    rendered += 1;
  } catch (error) {
    failures.push(`${page.route}: ${error.message}`);
  }
}

// ---- 404 page ---------------------------------------------------------------------------------
{
  // Several unmatched segments fall through to the catch-all <NotFound/> route, not the /:slug blog route.
  const { html, errors } = await render("/404/not/found", null);
  if (errors.length) failures.push(`404.html: ${errors.map((e) => e?.message || String(e)).join(" | ").slice(0, 300)}`);
  const { head, body } = splitHead(html);
  // No data-prerendered: the browser renders from scratch, so a post published after this build
  // can still resolve client-side while crawlers get a real 404 status for unknown URLs.
  const page = template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/, "")
    .replace("</head>", `    ${mark(head).join("\n    ")}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  fs.writeFileSync(path.join(dist, "404.html"), page);
}

if (failures.length) {
  console.error(`\nprerender FAILED for ${failures.length} page(s):`);
  for (const f of failures.slice(0, 30)) console.error("  " + f);
  process.exit(1);
}

fs.writeFileSync(
  path.join(dist, ".prerender-manifest.json"),
  JSON.stringify(
    dynamic.map((p) => ({ route: p.route, kind: p.kind, lastmod: p.lastmod })),
    null,
    1
  )
);

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `prerender: ${rendered} pages (${staticRoutes.length} static, ${dynamic.filter((p) => p.kind === "blog").length} blog posts, ` +
    `${dynamic.filter((p) => p.kind === "doctor").length} doctor profiles) + 404.html in ${seconds}s`
);
