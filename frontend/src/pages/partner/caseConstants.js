export const STATUS_META = {
  submitted: { label: "Submitted", bg: "#FEF3C7", text: "#92400E" },
  assigned: { label: "Assigned", bg: "#DBEAFE", text: "#1E40AF" },
  "in-progress": { label: "In progress", bg: "#EDE9FE", text: "#5B21B6" },
  completed: { label: "Completed", bg: "#D1FAE5", text: "#065F46" },
  invoiced: { label: "Invoiced", bg: "#F3F4F6", text: "#374151" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", text: "#991B1B" },
};

export const STATUS_PIPELINE = ["submitted", "assigned", "in-progress", "completed", "invoiced"];

export const URGENCY_META = {
  routine: { label: "Routine", color: "#10B981" },
  urgent: { label: "Urgent", color: "#F59E0B" },
  emergency: { label: "Emergency", color: "#EF4444" },
};

export const SERVICE_META = {
  teleconsultation: {
    label: "Teleconsultation",
    desc: "Remote video consultation with prescription",
  },
  "house-call": { label: "House call", desc: "Physician visits the patient at their location" },
  "in-clinic": { label: "In-clinic", desc: "Patient visits a local clinic or medical centre" },
};

export function statusLabel(s) {
  return STATUS_META[s]?.label || s;
}

export function formatMoney(amountCents, currency = "usd") {
  if (typeof amountCents !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
  }
}
