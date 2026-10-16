// Small helpers for the chat pages (list, conversation, details panel).
export const timeOf = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

export const stamp = (iso) => (Date.now() - new Date(iso).getTime() < 60000 ? "Now" : timeOf(iso));

export const dayWord = (iso) => {
  try {
    return new Date(iso).toDateString() === new Date().toDateString()
      ? "Today"
      : new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export const sizeOf = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;

export const CLOSED_LABEL = { patient_left: "Left", patient_ended: "Ended by patient", blocked: "Blocked", inactive: "Inactive" };
