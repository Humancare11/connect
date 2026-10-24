// Mounts the admin Appointments list and the full-page Assign doctor screen (no layout, no login) with the app's toast
// and confirm providers, so a test can click from the list to the assign page and back.
// The first URL comes from ?start=, e.g. ?start=/admin-dashboard/appointments?tab=all
// With ?mode=routes it mounts the old-URL redirects instead, with a stand-in for the pages they land on that
// shows the URL it received (used to check the redirects).
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "./base.css";
import { ToastProvider } from "../../../../src/components/ui/Toast.jsx";
import { ConfirmProvider } from "../../../../src/components/ui/ConfirmDialog.jsx";
import AdminAppointments from "../../../../src/pages/admin/AdminAppointments.jsx";
import AdminAssignDoctor from "../../../../src/pages/admin/AdminAssignDoctor.jsx";
import { legacyAdminRedirects } from "../../../../src/pages/admin/legacyRedirects.jsx";
import { AdminContext } from "../../../../src/context/AdminContext.jsx";

const params = new URLSearchParams(window.location.search);
const start = params.get("start") || "/admin-dashboard/appointments";
// Which admin is signed in: ?role=admin hides Cancel (super admins only); the default is a super admin.
const admin = { name: "Test Admin", role: params.get("role") || "superadmin" };

function Landed() {
  const { pathname, search } = useLocation();
  return <div id="landed">{pathname + search}</div>;
}

const Frame = ({ children }) => <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>{children}</div>;

const app =
  params.get("mode") === "routes" ? (
    <Routes>
      {legacyAdminRedirects}
      <Route path="/admin-dashboard/appointments" element={<Landed />} />
      <Route path="/admin-dashboard/appointments/:id/assign" element={<Landed />} />
      <Route path="/admin-dashboard/appointments/:id" element={<Landed />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/admin-dashboard/appointments" element={<Frame><AdminAppointments /></Frame>} />
      <Route path="/admin-dashboard/appointments/:id/assign" element={<Frame><AdminAssignDoctor /></Frame>} />
    </Routes>
  );

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <ConfirmProvider>
      <AdminContext.Provider value={{ admin, loading: false }}>
        <MemoryRouter initialEntries={[start]}>{app}</MemoryRouter>
      </AdminContext.Provider>
    </ConfirmProvider>
  </ToastProvider>,
);
