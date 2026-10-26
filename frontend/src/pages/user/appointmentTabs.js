// Which tab of the patient's Appointments page a booking belongs to. Plain
// functions (no React) so they can be tested with `node --test`
// (see appointmentTabs.test.mjs).
//
// Only a booking the doctor has confirmed is "confirmed" (that tab has the Join
// button, and the server only lets people into a confirmed booking's call).
// Everything before that, including Assigned, is "pending".
export const PENDING_STATUSES = ["requested", "upcoming", "pending", "assigned"];
export const COMPLETED_STATUSES = ["complete", "completed"];

export function appointmentTab(status) {
  if (PENDING_STATUSES.includes(status)) return "pending";
  if (status === "confirmed") return "confirmed";
  if (COMPLETED_STATUSES.includes(status)) return "completed";
  return "";
}

export function groupAppointments(appointments) {
  const groups = { pending: [], confirmed: [], completed: [] };
  for (const appointment of appointments) {
    const tab = appointmentTab(appointment?.status || "");
    if (tab) groups[tab].push(appointment);
  }
  return groups;
}

// Waiting line on a pending card: no doctor yet, or waiting for the doctor to confirm.
export function pendingNote(status) {
  return ["requested", "upcoming"].includes(status)
    ? "Awaiting admin review and doctor assignment"
    : "Awaiting doctor confirmation";
}
