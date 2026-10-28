// Mounts the real Payment Links page with the app's real global CSS. The test intercepts the page's API calls
// (see paymentLinks.e2e.test.mjs), so no backend is needed.
import React from "react";
import { createRoot } from "react-dom/client";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

// ?page=manual mounts the Manual Invoices page instead; ?role=superadmin|paymentadmin picks who is signed in
// (the test API reads it from the x-test-role header; the real role guard still runs).
const params = new URLSearchParams(window.location.search);

async function main() {
  const { default: api } = await import("../../../../src/api.js");
  if (params.get("role")) api.defaults.headers.common["x-test-role"] = params.get("role");
  const [{ default: Page }, { ToastProvider }] = await Promise.all([
    params.get("page") === "manual" ? import("../../../../src/pages/admin/ManualInvoices.jsx") : import("../../../../src/pages/admin/PaymentLinks.jsx"),
    import("../../../../src/components/ui/Toast.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );
}
main();
