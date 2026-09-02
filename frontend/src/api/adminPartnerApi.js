import api from "../api";

const BASE = "/api/admin/partner-cases";

export const adminPartnerApi = {
  listCases: (params = {}) => api.get(BASE, { params }).then((r) => r.data),
  stats: () => api.get(`${BASE}/stats`).then((r) => r.data),
  getCase: (id) => api.get(`${BASE}/${id}`).then((r) => r.data),
  setStatus: (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data),
  assign: (id, doctorId, videoLink) =>
    api.patch(`${BASE}/${id}/assign`, { doctorId, videoLink }).then((r) => r.data),
  setBilling: (id, amountCents, currency) =>
    api.patch(`${BASE}/${id}/billing`, { amountCents, currency }).then((r) => r.data),
  setNotes: (id, adminNotes) => api.patch(`${BASE}/${id}/notes`, { adminNotes }).then((r) => r.data),
  addMessage: (id, body) => api.post(`${BASE}/${id}/messages`, { body }).then((r) => r.data),
  listDoctors: () => api.get("/api/admin/approved-doctors").then((r) => r.data),
};

export default adminPartnerApi;
