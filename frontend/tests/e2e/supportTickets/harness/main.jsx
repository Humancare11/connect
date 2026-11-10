// Mounts one of the three REAL support-ticket pages against the backend's real routers (apiServer.mjs).
//   ?view=admin|patient|doctor   which page
//   &token=...                   the access token of a real login for that role
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

const params = new URLSearchParams(window.location.search);
const view = params.get("view") || "admin";

async function main() {
  const { setAuthTokenForRole } = await import("../../../../src/api.js");
  const role = view === "patient" ? "user" : view;
  if (params.get("token")) setAuthTokenForRole(role, params.get("token"));
  const page = {
    admin: () => import("../../../../src/pages/admin/SupportTickets.jsx"),
    patient: () => import("../../../../src/pages/user/RaiseTicket.jsx"),
    doctor: () => import("../../../../src/pages/doctors/RaiseTicket.jsx"),
  }[view];
  const { default: Page } = await page();
  createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/"]}>
      <Page />
    </MemoryRouter>,
  );
}
main();
