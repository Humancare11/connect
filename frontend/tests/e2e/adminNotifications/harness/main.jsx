// Mounts the real admin layout (so the real role check around the notification bell runs) with a stand-in page that
// shows the address the bell's links lead to. Sign-in state is stubbed by the test (stubContexts); the API is the
// backend's own routers over a throwaway database (apiServer.mjs).
//   ?role=admin|superadmin|paymentadmin   who is signed in
//   &token=...                            the access token of a real admin login (sent as the bell's Bearer token)
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

const params = new URLSearchParams(window.location.search);
window.__HARNESS_ROLE = params.get("role") || "admin";

function Landed() {
  const { pathname, search } = useLocation();
  return <div id="landed">{pathname + search}</div>;
}

async function main() {
  const { setAuthTokenForRole } = await import("../../../../src/api.js");
  if (params.get("token")) setAuthTokenForRole("admin", params.get("token"));
  const { default: Layout } = await import("../../../../src/pages/admin/AdminLayout.jsx");
  createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/admin-dashboard"]}>
      <Routes>
        <Route path="*" element={<Layout><Landed /></Layout>} />
      </Routes>
    </MemoryRouter>,
  );
}
main();
