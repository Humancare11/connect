// The pages the live-chat AI may link to, built from the site's own database: the categories, specialties and
// conditions of the appointment tree (what /appointment-booking shows). The hand-built list
// (backend/data/liveChatSitePages.json) stays as the fallback, and supplies the service pages (pricing, refills, ...),
// which are not in the database.
//
// Read-only: three fixed finds with explicit fields (the same collections the public appointment tree reads), cached
// in memory. A database error serves the last good list; with no list at all `load()` returns null and the caller
// keeps the static one. The static condition pages stay alongside the database ones (the database may hold few).
// No blog or article pages, no patient data.
const TTL_MS = 10 * 60 * 1000;
const SAFE_PATH = /^\/[A-Za-z0-9\-/&]*$/;

const slugify = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const foldTitle = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function defaultModels() {
  return {
    HealthcareCategory: require("../../models/HealthcareCategory"),
    HealthcareSpecialty: require("../../models/HealthcareSpecialty"),
    HealthcareCondition: require("../../models/HealthcareCondition"),
  };
}

// Pure: raw rows -> pages. `fallback` is the static list (service pages, and the real url of a category or specialty page
// that has one).
function buildPages({ categories, specialties, conditions }, fallback) {
  const services = fallback.filter((p) => p.type === "service");
  const staticByTitle = new Map();
  for (const p of fallback) if (p.type !== "service") staticByTitle.set(`${p.type}|${foldTitle(p.title)}`, p);

  const pages = [...services];
  const seen = new Set(pages.map((p) => p.url));
  const add = (page) => {
    if (!page.title || !SAFE_PATH.test(page.url) || page.url.includes("//") || seen.has(page.url)) return;
    seen.add(page.url);
    pages.push(page);
  };
  const aliasesOf = (row) => (Array.isArray(row.aliases) ? row.aliases.filter((a) => typeof a === "string" && a.trim()).slice(0, 30) : []);

  const activeCategory = new Map(categories.filter((c) => c.isActive && c.name).map((c) => [String(c._id), c]));
  const activeSpecialty = new Map(
    specialties.filter((s) => s.isActive && s.name && activeCategory.has(String(s.categoryId))).map((s) => [String(s._id), s])
  );

  for (const c of activeCategory.values()) {
    const known = staticByTitle.get(`category|${foldTitle(c.name)}`);
    add({ type: "category", title: c.name, url: known?.url || `/appointment-booking/${slugify(c.name)}`, keywords: known?.keywords || [], category: c.name });
  }
  for (const s of activeSpecialty.values()) {
    const category = activeCategory.get(String(s.categoryId));
    const known = staticByTitle.get(`specialty|${foldTitle(s.name)}`);
    add({
      type: "specialty",
      title: s.name,
      url: known?.url || `/appointment-booking/${slugify(category.name)}/${slugify(s.name)}`,
      keywords: [...aliasesOf(s), ...(known?.keywords || [])],
      category: category.name,
      specialty: s.name,
    });
  }
  for (const c of conditions) {
    const specialty = activeSpecialty.get(String(c.specialtyId));
    if (!c.isActive || !c.name || !specialty) continue;
    const category = activeCategory.get(String(specialty.categoryId));
    const known = staticByTitle.get(`condition|${foldTitle(c.name)}`);
    const route = typeof c.route === "string" ? c.route.trim() : "";
    const url = SAFE_PATH.test(route) ? route : known?.url || "";
    if (!url) continue;
    add({ type: "condition", title: c.name, url, keywords: [...aliasesOf(c), ...(known?.keywords || [])], category: category.name, specialty: specialty.name });
  }
  // The database may hold few or no conditions (the UAT data has 3, none with a route): the hand-built condition pages are
  // real, routed pages, so they stay available. Each gets the category / specialty names of the database specialty
  // that has the same title as its static parent (the url prefix), so Book can still open on that specialty.
  const dbSpecialtyByTitle = new Map([...activeSpecialty.values()].map((sp) => [foldTitle(sp.name), sp]));
  const staticSpecialties = fallback.filter((p) => p.type === "specialty");
  for (const c of fallback.filter((p) => p.type === "condition")) {
    const parent = staticSpecialties.find((sp) => c.url.startsWith(`${sp.url}/`));
    const dbSpecialty = parent ? dbSpecialtyByTitle.get(foldTitle(parent.title)) : null;
    const category = dbSpecialty ? activeCategory.get(String(dbSpecialty.categoryId)) : null;
    add({ ...c, ...(category ? { category: category.name, specialty: dbSpecialty.name } : {}) });
  }
  return pages;
}

function createSiteCatalog({ models = null, fallbackPages = require("../../data/liveChatSitePages.json"), ttlMs = TTL_MS, now = () => Date.now(), log = () => {} } = {}) {
  let cached = null; // { pages, expiresAt }
  let inflight = null;

  async function read() {
    const m = models || defaultModels();
    const [categories, specialties, conditions] = await Promise.all([
      m.HealthcareCategory.find({ isActive: true }).select("_id name isActive").lean(),
      m.HealthcareSpecialty.find({ isActive: true }).select("_id categoryId name aliases isActive").lean(),
      m.HealthcareCondition.find({ isActive: true }).select("_id specialtyId name aliases kind route isActive").lean(),
    ]);
    const pages = buildPages({ categories, specialties, conditions }, fallbackPages);
    return categories.length || conditions.length ? pages : null; // an empty database: keep the static list
  }

  // Resolves to the pages (cached for ttlMs), or null when the database gave nothing usable.
  async function load() {
    if (cached && now() < cached.expiresAt) return cached.pages;
    if (!inflight) {
      inflight = read()
        .then((pages) => {
          cached = { pages, expiresAt: now() + ttlMs };
          return pages;
        })
        .catch((err) => {
          log({ event: "site_catalog_failed", name: err?.name });
          if (cached) {
            cached = { ...cached, expiresAt: now() + 60_000 }; // keep the last good list, try again in a minute
            return cached.pages;
          }
          return null;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  }

  return { load, invalidate: () => (cached = null) };
}

module.exports = { createSiteCatalog, buildPages, slugify };
