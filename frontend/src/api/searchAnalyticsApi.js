import api from "../api";

export const SEARCH_ANALYTICS_BASE = "/api/admin/search-analytics";

// Analytics rows carry what visitors typed. A term such as "uploads/x.pdf" or
// "/uploads/a" must be shown exactly as recorded, so these requests opt out of
// the shared client's upload-URL rewriting (see api.js).
const RAW = { skipUrlNormalize: true };

export function getSearchAnalytics(path, params, signal) {
  return api.get(`${SEARCH_ANALYTICS_BASE}${path}`, { params, signal, ...RAW });
}
