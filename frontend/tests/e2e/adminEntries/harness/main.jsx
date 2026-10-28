// Mounts the real admin layout (sidebar and top bar, the app's real global CSS) with the real Appointment entries page inside it,
// so the widths the page really gets (window minus the sidebar) are what the layout tests measure. Sign-in state is stubbed by the
// test (stubContexts); the API is the backend's own entries router over a throwaway database (apiServer.mjs).
//   ?role=admin|superadmin|paymentadmin   who is signed in (the menu follows the role)
//   &start=/admin-dashboard/appointment-entries?tab=paid   the first URL
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

const params = new URLSearchParams(window.location.search);
window.__HARNESS_ROLE = params.get("role") || "admin";
// The test API takes the signed-in role from this header (the real token check is replaced there).
const roleHeader = window.__HARNESS_ROLE === "superadmin" ? "superadmin" : "admin";
const start = params.get("start") || "/admin-dashboard/appointment-entries";

// Records the page address (a memory router has no browser address), so a test can check what the page keeps in it.
function TrackLocation() {
  window.__loc = useLocation().search;
  return null;
}

async function main() {
  const { default: api } = await import("../../../../src/api.js");
  api.defaults.headers.common["x-test-role"] = roleHeader;
  const [{ default: Layout }, { default: Page }, { ToastProvider }, { ConfirmProvider }] = await Promise.all([
    import("../../../../src/pages/admin/AdminLayout.jsx"),
    import("../../../../src/pages/admin/AdminEntries.jsx"),
    import("../../../../src/components/ui/Toast.jsx"),
    import("../../../../src/components/ui/ConfirmDialog.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <ToastProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={[start]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <TrackLocation />
                  <Layout>
                    <Page />
                  </Layout>
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </ToastProvider>,
  );
}
main();
