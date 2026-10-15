import api from "../api";

const BASE = "/api/admin/email";

// Mail content is arbitrary text and downloads are binary: neither may go through
// the shared client's upload-URL rewriting (see api.js).
const RAW = { skipUrlNormalize: true };

// The acting admin is always the logged-in session on the server; nothing here
// ever sends "who" is sending.
export const emailApi = {
  mailboxes: () => api.get(`${BASE}/mailboxes`, RAW).then((r) => r.data),
  admins: () => api.get(`${BASE}/admins`, RAW).then((r) => r.data),
  list: (params = {}) => api.get(`${BASE}/messages`, { params, ...RAW }).then((r) => r.data),
  get: (id) => api.get(`${BASE}/messages/${id}`, RAW).then((r) => r.data),
  // Called once when a mail page opens; the server records admin + time.
  recordView: (id) => api.post(`${BASE}/messages/${id}/view`, null, RAW).then((r) => r.data),
  send: (formData) => api.post(`${BASE}/send`, formData, RAW).then((r) => r.data),
  reply: (id, formData) => api.post(`${BASE}/messages/${id}/reply`, formData, RAW).then((r) => r.data),
  // The image signature a sent mail went out with (blob; see useAuthImage).
  signatureImageBlob: (id) => api.get(`${BASE}/messages/${id}/signature-image`, { responseType: "blob", ...RAW }).then((r) => r.data),
  markSpam: (id) => api.post(`${BASE}/messages/${id}/spam`, null, RAW).then((r) => r.data),
  notSpam: (id) => api.post(`${BASE}/messages/${id}/not-spam`, null, RAW).then((r) => r.data),

  // Authenticated download (the session cookie/token travels with the request),
  // then handed to the browser as a normal file save.
  async downloadAttachment(attachment) {
    const res = await api.get(`${BASE}/attachments/${attachment.id}`, { responseType: "blob", ...RAW });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

// My signatures (every admin and Super Admin, each only their own: the server decides
// who owns what from the session, nothing here says whose they are).
const SIGNATURE_BASE = "/api/admin/email/signatures";

export const signaturesApi = {
  get: () => api.get(SIGNATURE_BASE, RAW).then((r) => r.data),
  create: (payload) => api.post(SIGNATURE_BASE, payload, RAW).then((r) => r.data),
  update: (id, patch) => api.patch(`${SIGNATURE_BASE}/${id}`, patch, RAW).then((r) => r.data),
  remove: (id) => api.delete(`${SIGNATURE_BASE}/${id}`, RAW).then((r) => r.data),
  // The image of a signature (png/jpg). The file is decoded and re-encoded on the server.
  uploadImage: (id, file) => {
    const fd = new FormData();
    fd.append("image", file);
    return api.put(`${SIGNATURE_BASE}/${id}/image`, fd, RAW).then((r) => r.data);
  },
  removeImage: (id) => api.delete(`${SIGNATURE_BASE}/${id}/image`, RAW).then((r) => r.data),
  // Needs the session header, so it is fetched as a blob (see useAuthImage).
  imageBlob: (id) => api.get(`${SIGNATURE_BASE}/${id}/image`, { responseType: "blob", ...RAW }).then((r) => r.data),
  setMailboxDefault: (mailbox, signatureId) => api.put(`${SIGNATURE_BASE}/mailbox-defaults`, { mailbox, signatureId }, RAW).then((r) => r.data),
};

// Super Admin only (the server refuses everyone else): manage the company mail IDs.
const MAILBOX_BASE = "/api/superadmin/email/mailboxes";

export const mailIdsApi = {
  list: () => api.get(MAILBOX_BASE, RAW).then((r) => r.data),
  // Dry run: read-only Gmail check, saves nothing. → { ok, message?, code? }
  check: (address) => api.post(`${MAILBOX_BASE}/check`, { address }, RAW).then((r) => r.data),
  add: (payload) => api.post(MAILBOX_BASE, payload, RAW).then((r) => r.data),
  update: (id, patch) => api.patch(`${MAILBOX_BASE}/${id}`, patch, RAW).then((r) => r.data),
};

// Super Admin only: open-tracking switches, disclosure line and the opt-out list.
const SETTINGS_BASE = "/api/superadmin/email/settings";

export const trackingSettingsApi = {
  get: () => api.get(SETTINGS_BASE, RAW).then((r) => r.data),
  update: (patch) => api.patch(SETTINGS_BASE, patch, RAW).then((r) => r.data),
  addOptOut: (address, note) => api.post(`${SETTINGS_BASE}/opt-outs`, { address, note }, RAW).then((r) => r.data),
  removeOptOut: (id) => api.delete(`${SETTINGS_BASE}/opt-outs/${id}`, RAW).then((r) => r.data),
};

// Server errors are { msg }; a blob download error arrives as a Blob.
export function apiMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.msg || fallback;
}

export default emailApi;
