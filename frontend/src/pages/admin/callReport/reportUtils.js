// Small helpers shared by the admin call-report screens (direct call and
// appointment call). Moved verbatim out of AdminDirectVideoCallDetail.jsx.

export const CONNECTION_STATE_COLORS = {
  connected: "#16a34a",
  connecting: "#d97706",
  new: "#6b7280",
  disconnected: "#dc2626",
  failed: "#dc2626",
  closed: "#6b7280",
};

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function roleLabel(role) {
  if (role === "doctor") return "Doctor";
  if (role === "patient") return "Patient";
  if (role === "initiator") return "Host";
  if (role === "guest") return "Guest";
  return "Participant";
}
