import api from "../api";

const cfg = { authRole: "partner" };

export const partnerApi = {
  dashboard: () => api.get("/api/partner/dashboard", cfg).then((r) => r.data),

  listCases: (params = {}) =>
    api.get("/api/partner/cases", { ...cfg, params }).then((r) => r.data),

  getCase: (id) => api.get(`/api/partner/cases/${id}`, cfg).then((r) => r.data),

  submitCase: (payload) =>
    api.post("/api/partner/cases", payload, cfg).then((r) => r.data),

  cancelCase: (id) =>
    api.patch(`/api/partner/cases/${id}/cancel`, null, cfg).then((r) => r.data),

  addMessage: (id, body) =>
    api.post(`/api/partner/cases/${id}/messages`, { body }, cfg).then((r) => r.data),

  attachmentUrl: (id, key) =>
    api
      .get(`/api/partner/cases/${id}/attachments/access-url`, { ...cfg, params: { key } })
      .then((r) => r.data),

  listInvoices: () => api.get("/api/partner/invoices", cfg).then((r) => r.data),

  invoiceDownloadUrl: (id) =>
    api.get(`/api/partner/invoices/${id}/download`, cfg).then((r) => r.data),
};

export default partnerApi;
