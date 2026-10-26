import { Fragment } from "react";
import { Navigate, Route, useParams } from "react-router-dom";

// Old admin URLs that carried a booking id open that booking's page, or its assign page.
export function RedirectToBooking({ assign = false, callReport = false }) {
  const { id } = useParams();
  return <Navigate to={`/admin-dashboard/appointments/${id}${assign ? "/assign" : ""}${callReport ? "/call-report" : ""}`} replace />;
}

// The retired Category Consultations list, detail and assign-doctor pages. Bookmarks and old links land on the unified
// Appointments page: the list opens on its All tab (category consultations used to show every status), a booking id
// opens that booking's page, the old category assign page opens the assign page (which now serves both kinds, at
// /admin-dashboard/appointments/:id/assign) and an old category call-report link opens the call report there. Put `{legacyAdminRedirects}` inside <Routes>.
export const legacyAdminRedirects = (
  <Fragment>
    <Route path="/admin-dashboard/category-consultations" element={<Navigate to="/admin-dashboard/appointments?tab=all" replace />} />
    <Route path="/admin-dashboard/category-consultations/assign-doctor/:id" element={<RedirectToBooking assign />} />
    <Route path="/admin-dashboard/category-consultations/:id" element={<RedirectToBooking />} />
    <Route path="/admin-dashboard/category-consultations/:id/call-report" element={<RedirectToBooking callReport />} />
  </Fragment>
);
