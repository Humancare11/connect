import api from "../api";

// Email Marketing (a separate page from the Gmail-based Email module). The acting admin is always the logged-in
// session on the server; nothing here says who is sending. Recipient lists are personal data: they only ever come
// from the server to an authorised admin and are never kept in browser storage.
const BASE = "/api/admin/email-marketing";
const ACCESS_BASE = "/api/superadmin/email-marketing";

// Mail content is arbitrary text: it must not go through the shared client's upload-URL rewriting (see api.js).
const RAW = { skipUrlNormalize: true };

export const marketingApi = {
  // → { enabled, allowed, superAdmin }  (always answers, so the sidebar knows whether to show the item)
  access: () => api.get(`${BASE}/access`, RAW).then((r) => r.data),
  settings: () => api.get(`${BASE}/settings`, RAW).then((r) => r.data),
  // The signature of the admin looking at the page: { hasImage, autoAdd, previewUrl, displayWidth, displayHeight }
  signature: () => api.get(`${BASE}/signature`, RAW).then((r) => r.data),
  // "Write text" -> HTML (saves nothing)
  textToHtml: (text) => api.post(`${BASE}/text-to-html`, { text }, RAW).then((r) => r.data),
  mailboxes: () => api.get(`${BASE}/mailboxes`, RAW).then((r) => r.data),
  list: () => api.get(`${BASE}/campaigns`, RAW).then((r) => r.data),
  create: (payload) => api.post(`${BASE}/campaigns`, payload, RAW).then((r) => r.data),
  get: (id) => api.get(`${BASE}/campaigns/${id}`, RAW).then((r) => r.data),
  save: (id, patch) => api.put(`${BASE}/campaigns/${id}`, patch, RAW).then((r) => r.data),
  remove: (id) => api.delete(`${BASE}/campaigns/${id}`, RAW).then((r) => r.data),
  previewRecipients: (payload) => api.post(`${BASE}/recipients/preview`, payload, RAW).then((r) => r.data),
  previewMail: (id, index) => api.post(`${BASE}/campaigns/${id}/preview`, { index }, RAW).then((r) => r.data),
  sendTest: (id, to) => api.post(`${BASE}/campaigns/${id}/test`, { to }, RAW).then((r) => r.data),
  send: (id) => api.post(`${BASE}/campaigns/${id}/send`, { confirm: true }, RAW).then((r) => r.data),
  progress: (id) => api.get(`${BASE}/campaigns/${id}/progress`, RAW).then((r) => r.data),
  stop: (id) => api.post(`${BASE}/campaigns/${id}/stop`, null, RAW).then((r) => r.data),
  retryUncertain: (id) => api.post(`${BASE}/campaigns/${id}/retry-uncertain`, null, RAW).then((r) => r.data),
  report: (id) => api.get(`${BASE}/campaigns/${id}/report`, RAW).then((r) => r.data),
};

// Super Admin only (the server refuses everyone else): who may use Email Marketing.
export const marketingAccessApi = {
  admins: () => api.get(`${ACCESS_BASE}/admins`, RAW).then((r) => r.data),
  setAccess: (id, allowed) => api.patch(`${ACCESS_BASE}/admins/${id}`, { allowed }, RAW).then((r) => r.data),
};
