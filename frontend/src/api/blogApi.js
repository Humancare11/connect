import axios from "axios";

// Public blog client (list + detail). Like searchApi, it uses its own axios
// instance: blogs are public, so no Authorization header and no cookies.
const apiBase = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");

const blogClient = axios.create({
  baseURL: apiBase,
  withCredentials: false,
  timeout: 10000,
  adapter: "fetch",
  fetchOptions: { credentials: "omit" },
});

export const BLOG_IMAGE_PATH = "/api/blogs/image/";

// Blog images are stored as relative "/api/blogs/image/<file>" URLs. The SPA and
// the API may live on different origins, so display URLs are prefixed with the
// API base; stored/saved HTML always keeps the relative form.
export function blogImageSrc(url) {
  if (typeof url === "string" && url.startsWith(BLOG_IMAGE_PATH)) return `${apiBase}${url}`;
  return url || "";
}

export function resolveBlogImages(html) {
  if (!apiBase) return html;
  return String(html || "").split(`src="${BLOG_IMAGE_PATH}`).join(`src="${apiBase}${BLOG_IMAGE_PATH}`);
}

export function relativizeBlogImages(html) {
  if (!apiBase) return html;
  return String(html || "").split(`src="${apiBase}${BLOG_IMAGE_PATH}`).join(`src="${BLOG_IMAGE_PATH}`);
}

export async function fetchBlogs({ page = 1, limit = 9, search = "", category = "" } = {}, signal) {
  const params = { page, limit };
  if (search) params.search = search;
  if (category) params.category = category;
  const res = await blogClient.get("/api/blogs", { params, signal });
  return res.data;
}

export async function fetchBlog(slug, signal) {
  const res = await blogClient.get(`/api/blogs/${encodeURIComponent(slug)}`, { signal });
  return res.data;
}
