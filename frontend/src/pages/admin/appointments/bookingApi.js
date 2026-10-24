import api from "../../../api";

// One call per row action. Each answers { msg, booking, paid } on success; on failure the
// error carries the server's { msg, code } (see explainActionError).
const post = (id, action, body = {}) => api.post(`/api/admin/bookings/${id}/${action}`, body);

export const assignDoctor = (id, { doctorId, appointmentTime }) =>
  post(id, "assign-doctor", { doctorId, ...(appointmentTime ? { appointmentTime } : {}) });
export const alternateDoctor = (id, { doctorId }) => post(id, "alternate-doctor", { doctorId });
export const revertDoctor = (id) => post(id, "revert-doctor");
export const reactivateBooking = (id) => post(id, "reactivate");
export const autoCompleteBooking = (id) => post(id, "auto-complete");
export const cancelBooking = (id, { reason }) => post(id, "cancel", { reason });

// Up to 100 bookings at a time. action: "auto-complete" | "cancel" | "mark-testing" | "unmark-testing" (there is no
// bulk confirm). Answers { summary, results: [{ id, status: ok | not_found | conflict | error, message? }] }.
export const bulk = ({ action, ids, reason }) => api.post("/api/admin/bookings/bulk", { action, ids, ...(reason ? { reason } : {}) });

