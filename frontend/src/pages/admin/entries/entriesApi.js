import api from "../../../api";

// One call per thing the Appointment entries page does. Errors carry the server's { msg, code } (see saveErrorText).

export const listEntries = (params) => api.get("/api/admin/entries", { params });

// Saves one field of one row. kind: "appointment" | "category" | "manual". Answers { item, noop }.
export const saveEntryField = (kind, id, { field, value, version }) => api.patch(`/api/admin/entries/${kind}/${id}`, { field, value, version });

export const createManualEntry = (body) => api.post("/api/admin/entries/manual", body);
export const editManualEntry = (id, body) => api.patch(`/api/admin/entries/manual/${id}/details`, body);
// Who changed what and when, newest first, grouped per save.
export const getManualHistory = (id) => api.get(`/api/admin/entries/manual/${id}/history`);
export const deleteManualEntry = (id) => api.delete(`/api/admin/entries/manual/${id}`);

// The CSV of everything the filters match (no paging), as a file.
export const exportEntriesCsv = (params) => api.get("/api/admin/entries/export.csv", { params, responseType: "blob" });
