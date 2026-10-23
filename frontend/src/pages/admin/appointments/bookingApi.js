import api from "../../../api";

// One call per row action. Each answers { msg, booking, paid } on success; on failure the
// error carries the server's { msg, code } (see explainActionError).
const post = (id, action, body = {}) => api.post(`/api/admin/bookings/${id}/${action}`, body);

export const assignDoctor = (id, { doctorId, appointmentTime }) =>
  post(id, "assign-doctor", { doctorId, ...(appointmentTime ? { appointmentTime } : {}) });
export const alternateDoctor = (id, { doctorId }) => post(id, "alternate-doctor", { doctorId });
export const revertDoctor = (id) => post(id, "revert-doctor");
export const confirmBooking = (id) => post(id, "confirm");
export const autoCompleteBooking = (id) => post(id, "auto-complete");
export const cancelBooking = (id, { reason }) => post(id, "cancel", { reason });

// The approved doctors, as the old assign pages used them: `id` is the doctor's Enrollment
// id, which is what the action endpoints take as doctorId.
export const fetchApprovedDoctors = () => api.get("/api/doctor/approved").then((res) => (Array.isArray(res.data) ? res.data : []));
