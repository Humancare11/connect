// Mounts ONE real layout (with the app's real global CSS) for a screenshot. Sign-in state is stubbed by capture.mjs
// (see stubContexts), the API is answered by the browser-side route handler in capture.mjs, and the page content is a
// fixed placeholder except for the admin screens, which show the real Appointments page.
//   ?screen=admin|superadmin|paymentadmin|portal|employee|partner|doctor|patient
//   &adminCss=1   also loads the admin stylesheets first (the worst case for a leak into doctor/patient screens)
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../src/fonts.css";
import "../../../src/index.css";
import "../../../src/App.css";

const params = new URLSearchParams(window.location.search);
const screen = params.get("screen");
window.__HARNESS_ROLE = screen;

const Placeholder = ({ title }) => (
  <div style={{ padding: 24, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
    <h2 style={{ margin: 0 }}>{title}</h2>
    <p>Fixed placeholder content (the layout is what this screenshot is about).</p>
  </div>
);

const screens = {
  admin: { path: "/admin-dashboard/appointments", load: async () => {
    const [{ default: Layout }, { default: Page }] = await Promise.all([import("../../../src/pages/admin/AdminLayout.jsx"), import("../../../src/pages/admin/AdminAppointments.jsx")]);
    return () => <Layout><Page /></Layout>;
  } },
  portal: { path: "/superadmin-dashboard", load: async () => (await import("../../../src/pages/admin/SuperAdminDashboard.jsx")).default },
  employee: { path: "/employee-dashboard", load: async () => {
    const { default: Layout } = await import("../../../src/pages/employee/EmployeeLayout.jsx");
    return () => <Layout><Placeholder title="Employee page" /></Layout>;
  } },
  partner: { path: "/partner-dashboard", load: async () => {
    const { default: Layout } = await import("../../../src/pages/partner/PartnerLayout.jsx");
    return () => <Layout><Placeholder title="Partner page" /></Layout>;
  } },
  doctor: { path: "/doctor-dashboard", load: async () => {
    const { default: Layout } = await import("../../../src/pages/doctors/DoctorLayout.jsx");
    return () => <Layout><Placeholder title="Doctor page" /></Layout>;
  } },
  patient: { path: "/user/dashboard", load: async () => {
    const { default: Layout } = await import("../../../src/pages/user/UserLayout.jsx");
    return () => <Layout><Placeholder title="Patient page" /></Layout>;
  } },
};
screens.superadmin = screens.admin;
screens.paymentadmin = { ...screens.admin, path: "/admin-dashboard/manual-invoices" };

async function main() {
  const spec = screens[screen];
  if (params.get("adminCss") === "1") {
    await import("../../../src/pages/admin/AdminDashboard.css");
    await import("../../../src/pages/admin/Dashboard.css");
  }
  const Screen = await spec.load();
  const { ToastProvider } = await import("../../../src/components/ui/Toast.jsx");
  const { ConfirmProvider } = await import("../../../src/components/ui/ConfirmDialog.jsx");
  createRoot(document.getElementById("root")).render(
    <ToastProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={[spec.path]}>
          <Routes>
            <Route path="*" element={<Screen />} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </ToastProvider>,
  );
  document.documentElement.setAttribute("data-ready", "1");
}
main();
