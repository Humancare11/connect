// JSON-LD factory. Every builder returns a plain object or null; callers drop nulls and
// never render a <script> when nothing is left (no empty JSON-LD tags).
//
// Compliance: only mark up what is true and visible/derivable. We do not invent ratings,
// review authors, phone numbers or sameAs profiles here.

import { SITE_ORIGIN, SITE_NAME, SEO_ROUTES, isNoindexPath } from "./routes.js";

const LOGO_URL = `${SITE_ORIGIN}/single-logo.png`;
const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;

const SEGMENT_LABELS = {
  "child-and-family-care": "Child & Family Care",
  "chronic-care": "Chronic Care",
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

const SMALL_WORDS = new Set(["and", "of", "in", "for", "to", "the", "a", "with", "or", "vs"]);

function labelFor(segment) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment
    .split("-")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function organization() {
  return {
    "@type": "MedicalOrganization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN + "/",
    logo: LOGO_URL,
    description: SEO_ROUTES["/"]?.description || undefined,
  };
}

function website() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN + "/",
    inLanguage: "en-US",
    publisher: { "@id": ORG_ID },
  };
}

function webPage(type, ctx) {
  if (!ctx.canonical || !ctx.title) return null;
  return {
    "@type": type,
    "@id": `${ctx.canonical}#webpage`,
    url: ctx.canonical,
    name: ctx.title,
    description: ctx.description || undefined,
    inLanguage: "en-US",
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    primaryImageOfPage: ctx.image ? { "@type": "ImageObject", url: ctx.image } : undefined,
  };
}

// Home > ...real parent pages... > this page, for a path. Used by the BreadcrumbList JSON-LD below and by
// the visible <Breadcrumb/> component, so both always agree.
export function breadcrumbItems(path) {
  const segments = String(path || "/").split("/").filter(Boolean);
  const items = [{ name: "Home", path: "/" }];
  segments.forEach((seg, i) => {
    const prefix = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    // Skip intermediate segments that are not real, public pages.
    if (!isLast && (!SEO_ROUTES[prefix] || isNoindexPath(prefix))) return;
    items.push({ name: labelFor(seg), path: prefix });
  });
  return items;
}

function breadcrumb(ctx) {
  if (!ctx.canonical || ctx.path === "/") return null;
  const items = breadcrumbItems(ctx.path).map((it) => ({ name: it.name, url: SITE_ORIGIN + it.path }));
  if (items.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// The page's name without the site suffix: "Fit to Fly Certificate Online | Humancare Connect" -> "Fit to Fly Certificate Online".
function offerName(title) {
  return String(title || "").split(/\s+\|\s+/)[0].trim();
}

// A Service with one Offer: the USD price shown (hidden behind the loading skeleton) in the static HTML of a service or category page,
// stated explicitly for crawlers. Always USD: the visitor's own currency is decided in the browser after the page loads. Only built
// when the page really has a USD price (ctx.offer = { price }); an invented or zero price is never marked up.
function serviceOffer(ctx) {
  const price = Number(ctx.offer?.price);
  const name = ctx.offer?.name || offerName(ctx.title);
  if (!ctx.canonical || !name || !Number.isFinite(price) || price <= 0) return null;
  return {
    "@type": "Service",
    "@id": `${ctx.canonical}#service`,
    name,
    url: ctx.canonical,
    provider: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": `${ctx.canonical}#webpage` },
    offers: {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      url: ctx.canonical,
      availability: "https://schema.org/InStock",
      seller: { "@id": ORG_ID },
    },
  };
}

const BUILDERS = {
  Organization: organization,
  MedicalOrganization: organization,
  WebSite: website,
  MedicalWebPage: (ctx) => webPage("MedicalWebPage", ctx),
  WebPage: (ctx) => webPage("WebPage", ctx),
  BreadcrumbList: breadcrumb,
  Service: serviceOffer,
};

export const DEFAULT_SCHEMA_TYPES = ["MedicalWebPage", "BreadcrumbList"];

// ctx: { path, canonical, title, description, image, types?, offer? }   offer: { price (USD), name? } adds the Service + Offer node
export function buildSchema(ctx) {
  if (!ctx || !ctx.canonical) return [];
  const types = [...(ctx.types || DEFAULT_SCHEMA_TYPES)];
  if (ctx.offer && !types.includes("Service")) types.push("Service");
  const seen = new Set();
  const nodes = [];
  for (const t of types) {
    const build = BUILDERS[t];
    if (!build || seen.has(build)) continue;
    seen.add(build);
    const node = build(ctx);
    if (node) nodes.push(JSON.parse(JSON.stringify(node))); // drops undefined fields
  }
  return nodes;
}

export function schemaScriptContent(nodes) {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(
    (n) => n && typeof n === "object" && Object.keys(n).length > 0
  );
  if (list.length === 0) return null;
  return JSON.stringify({ "@context": "https://schema.org", "@graph": list }).replace(/</g, "\\u003c");
}
