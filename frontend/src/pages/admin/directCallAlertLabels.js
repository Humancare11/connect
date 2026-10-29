// Admin-facing labels for DirectCallAlert.type (backend/models/DirectCallAlert.js enum).
export const ALERT_LABELS = {
  room_full: "Meeting full",
  repeated_retries: "Repeated reconnects",
  never_connected: "Never connected",
  pin_brute_force: "Repeated PIN verification failures",
};

// Unknown or missing types (e.g. a type added to the backend before this map)
// render a readable title-cased form of the raw value, never an empty label.
export function alertLabel(type) {
  if (typeof type === "string" && Object.prototype.hasOwnProperty.call(ALERT_LABELS, type)) {
    return ALERT_LABELS[type];
  }
  const readable = String(type ?? "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
  return readable || "Alert";
}
