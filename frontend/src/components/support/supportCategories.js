// Ticket categories offered when raising a ticket. These must match the backend models
// (UserTicket.category for patients, Ticket.category for doctors).
export const PATIENT_CATEGORIES = [
  { value: "appointment", label: "Appointment" },
  { value: "billing",     label: "Billing" },
  { value: "technical",   label: "Technical" },
  { value: "medical",     label: "Medical" },
  { value: "other",       label: "Other" },
];

export const DOCTOR_CATEGORIES = [
  { value: "technical",   label: "Technical" },
  { value: "appointment", label: "Appointment" },
  { value: "payments",    label: "Payments" },
  { value: "profile",     label: "Profile" },
  { value: "account",     label: "Account" },
  { value: "other",       label: "Other" },
];
