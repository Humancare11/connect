// Navigation for admin notifications. Everything returned here is a same-app path
// under /admin-dashboard, rendered with react-router's <Link>; anything else is dropped.

const SAFE_ADMIN_PATH = /^\/admin-dashboard(\/[A-Za-z0-9._~-]+)*\/?$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

export const TICKET_TABS = ["patient", "doctor"];

export function isSafeAdminPath(value) {
  return (
    typeof value === "string" &&
    value.length <= 300 &&
    !value.includes("..") &&
    !value.includes("//") &&
    SAFE_ADMIN_PATH.test(value)
  );
}

// ?tab= on /admin-dashboard/tickets. Anything but a known tab is ignored.
export function ticketTabFromQuery(value) {
  return TICKET_TABS.includes(value) ? value : null;
}

// Routes verified in App.jsx for each notification type, used only when the stored link
// is missing or unsafe. A doctor_registered refId is the Doctor id, but the profile page
// loads an Enrollment id, so that type has no fallback and relies on the stored link.
function fallbackPath(type, refType, refId) {
  const id = String(refId || "");
  switch (type) {
    case "appointment_created":
    case "appointment_confirmed_by_doctor":
    case "appointment_completed_by_doctor":
      return OBJECT_ID.test(id) ? `/admin-dashboard/appointments/${id}` : null;
    case "doctor_enrollment_submitted":
      return refType === "enrollment" && OBJECT_ID.test(id) ? `/admin-dashboard/doctor-profile/${id}` : null;
    case "doctor_profile_updated":
    case "doctor_account_deletion_requested":
    case "doctor_approved":
    case "doctor_rejected":
      return refType === "enrollment" && OBJECT_ID.test(id) ? `/admin-dashboard/doctor-profile/${id}` : null;
    case "partner_case_created":
    case "partner_case_cancelled":
    case "partner_case_message":
      return OBJECT_ID.test(id) ? `/admin-dashboard/partner-cases/${id}` : null;
    case "payment_needs_reconciliation":
      return "/admin-dashboard/appointments";
    case "security_repeated_failed_logins":
    case "security_critical_event":
      return "/admin-dashboard/manage-users";
    case "support_ticket_created":
      return "/admin-dashboard/tickets";
    case "account_deletion_requested":
      return "/admin-dashboard/deletion-requests";
    default:
      return null;
  }
}

// Support tickets have no per-ticket page: the list page is opened on the right tab
// (patient tickets vs doctor tickets), nothing more.
export function notificationLink({ type, refType, refId, link } = {}) {
  const base = isSafeAdminPath(link) ? link.replace(/\/+$/, "") : fallbackPath(type, refType, refId);
  if (!base) return null;
  if (base === "/admin-dashboard/tickets") {
    if (refType === "ticket") return `${base}?tab=doctor`;
    if (refType === "user_ticket") return `${base}?tab=patient`;
  }
  return base;
}
