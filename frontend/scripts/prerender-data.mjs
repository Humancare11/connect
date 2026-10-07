// Build-time data for the prerender step: published blog posts and approved doctors, fetched
// from the public API. Nothing here needs credentials.
//
//   API base:   VITE_API_URL (same variable the app itself uses)
//   offline:    PRERENDER_SKIP_API=1 skips both fetches (static pages only, with a warning)
//
// In every other case an API failure fails the build: shipping a site that silently dropped its
// blog posts would turn them into 404s.

const BLOG_PAGE_SIZE = 24; // the API caps limit at 24
const BLOG_LIST_CARDS = 9; // first page of /blogs, same size as CARDS_PER_PAGE in pages/Blogs/Blogs.jsx
const TIMEOUT_MS = 15000;

function apiBase(env) {
  return String(env.VITE_API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
}

async function getJsonOnce(base, pathAndQuery) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base + pathAndQuery, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 404) return { status: 404, data: null };
    if (!res.ok) {
      const error = new Error(`${pathAndQuery} -> HTTP ${res.status}`);
      error.retryable = res.status === 429 || res.status >= 500;
      throw error;
    }
    return { status: res.status, data: await res.json() };
  } catch (error) {
    // Network errors and timeouts are worth another try; 4xx (other than 429) are not.
    if (error.retryable === undefined) error.retryable = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Up to 4 attempts with 1s / 2s / 4s backoff, so a rate limit or a cold API does not fail the build.
async function getJson(base, pathAndQuery) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await getJsonOnce(base, pathAndQuery);
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

export function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function doctorSlug(doctor) {
  const id = String(doctor.doctorId || "");
  const name = slugifyName(doctor.name);
  return name ? `${id}-${name}` : id;
}

// Returns [{ route, key, record, lastmod }]
export async function fetchBlogPages(env, { reservedRoutes }) {
  const base = apiBase(env);
  if (!base) throw new Error("VITE_API_URL is not set, cannot fetch blog posts");
  const pages = [];
  const seen = new Set();
  let page = 1;
  let totalPages = 1;
  do {
    const { data } = await getJson(base, `/api/blogs?page=${page}&limit=${BLOG_PAGE_SIZE}`);
    totalPages = data?.totalPages || 1;
    for (const item of data?.blogs || []) {
      if (item.isLegacy || !item.slug || seen.has(item.slug)) continue;
      seen.add(item.slug);
      const route = `/${String(item.slug).toLowerCase()}`;
      if (reservedRoutes.has(route)) {
        console.warn(`  prerender: blog slug "${item.slug}" collides with a static route, skipped`);
        continue;
      }
      const { status, data: blog } = await getJson(base, `/api/blogs/${encodeURIComponent(item.slug)}`);
      if (status === 404 || !blog || blog.isLegacy) continue;
      pages.push({
        route,
        key: `blog:${item.slug}`,
        record: blog,
        lastmod: String(blog.updatedAt || blog.publishedAt || "").slice(0, 10) || null,
      });
    }
    page += 1;
  } while (page <= totalPages);
  return pages;
}

export async function fetchDoctorPages(env) {
  const base = apiBase(env);
  if (!base) throw new Error("VITE_API_URL is not set, cannot fetch doctors");
  const { data: list } = await getJson(base, "/api/doctor/approved");
  const pages = [];
  for (const d of Array.isArray(list) ? list : []) {
    if (!d.doctorId) continue; // the page is addressed by the 5-digit doctorId
    const { status, data: doctor } = await getJson(base, `/api/doctor/profile/${encodeURIComponent(d.doctorId)}`);
    if (status === 404 || !doctor) continue;
    const slug = doctorSlug({ doctorId: d.doctorId, name: doctor.name || d.name });
    pages.push({ route: `/doctors/${slug}`, key: `doctor:${slug}`, record: doctor, lastmod: null });
  }
  return pages;
}

// First page of the /blogs index, embedded so the listing (and its post links) is in the HTML.
export async function fetchBlogIndexPage(env) {
  const base = apiBase(env);
  if (!base) throw new Error("VITE_API_URL is not set, cannot fetch the blog index");
  const { data } = await getJson(base, `/api/blogs?page=1&limit=${BLOG_LIST_CARDS}`);
  return data;
}
