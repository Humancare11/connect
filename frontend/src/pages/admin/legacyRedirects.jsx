import { Fragment } from "react";
import { Navigate, Route, useParams } from "react-router-dom";

// Old admin URLs that carried a booking id (category detail, the assign pages) open that booking's page.
export function RedirectToBooking() {
  const { id } = useParams();
  return <Navigate to={`/admin-dashboard/appointments/${id}`} replace />;
}

// The retired Category Consultations list and assign-doctor pages. Bookmarks and old links land on the unified
// Appointments page: the list opens on its All tab (category consultations used to show every status), and a
// booking id opens that booking's page. Put `{legacyAdminRedirects}` inside <Routes>.
export const legacyAdminRedirects = (
  <Fragment>
    <Route path="/admin-dashboard/category-consultations" element={<Navigate to="/admin-dashboard/appointments?tab=all" replace />} />
    <Route path="/admin-dashboard/category-consultations/assign-doctor/:id" element={<RedirectToBooking />} />
    <Route path="/admin-dashboard/category-consultations/:id" element={<RedirectToBooking />} />
    <Route path="/admin-dashboard/appointments/:id/assign" element={<RedirectToBooking />} />
  </Fragment>
);
