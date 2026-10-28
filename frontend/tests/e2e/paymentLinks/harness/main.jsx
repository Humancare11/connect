// Mounts the real Payment Links page with the app's real global CSS. The test intercepts the page's API calls
// (see paymentLinks.e2e.test.mjs), so no backend is needed.
import React from "react";
import { createRoot } from "react-dom/client";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

async function main() {
  const [{ default: Page }, { ToastProvider }] = await Promise.all([
    import("../../../../src/pages/admin/PaymentLinks.jsx"),
    import("../../../../src/components/ui/Toast.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );
}
main();
