// Mounts only the admin Appointments page (no layout, no login) with the app's toast and confirm providers.
// The first URL comes from ?start=, e.g. ?start=/admin-dashboard/appointments?tab=all
// With ?mode=routes it mounts the old-URL redirects instead, with a stand-in for the page they land on that
// shows the URL it received (used to check the redirects).
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "./base.css";
import { ToastProvider } from "../../../../src/components/ui/Toast.jsx";
import { ConfirmProvider } from "../../../../src/components/ui/ConfirmDialog.jsx";
import AdminAppointments from "../../../../src/pages/admin/AdminAppointments.jsx";
import { legacyAdminRedirects } from "../../../../src/pages/admin/legacyRedirects.jsx";

const params = new URLSearchParams(window.location.search);
const start = params.get("start") || "/admin-dashboard/appointments";

function Landed() {
  const { pathname, search } = useLocation();
  return <div id="landed">{pathname + search}</div>;
}

const app =
  params.get("mode") === "routes" ? (
    <Routes>
      {legacyAdminRedirects}
      <Route path="/admin-dashboard/appointments" element={<Landed />} />
      <Route path="/admin-dashboard/appointments/:id" element={<Landed />} />
    </Routes>
  ) : (
    <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>
      <AdminAppointments />
    </div>
  );

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <ConfirmProvider>
      <MemoryRouter initialEntries={[start]}>{app}</MemoryRouter>
    </ConfirmProvider>
  </ToastProvider>,
);
