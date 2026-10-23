// Mounts only the admin Appointments page (no layout, no login) with the app's toast and confirm providers.
// The first URL comes from ?start=, e.g. ?start=/admin-dashboard/appointments?tab=all
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./base.css";
import { ToastProvider } from "../../../../src/components/ui/Toast.jsx";
import { ConfirmProvider } from "../../../../src/components/ui/ConfirmDialog.jsx";
import AdminAppointments from "../../../../src/pages/admin/AdminAppointments.jsx";

const start = new URLSearchParams(window.location.search).get("start") || "/admin-dashboard/appointments";

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <ConfirmProvider>
      <MemoryRouter initialEntries={[start]}>
        <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>
          <AdminAppointments />
        </div>
      </MemoryRouter>
    </ConfirmProvider>
  </ToastProvider>,
);
