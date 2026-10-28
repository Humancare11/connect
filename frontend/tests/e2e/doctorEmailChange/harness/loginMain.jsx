// Mounts the REAL doctor login page (DoctorLogin) under the REAL DoctorAuthProvider at the real URL /doctor-login (the test
// serves this page for that URL). After a sign-in the real page navigates to /doctor-dashboard, where a one-line stand-in shows
// that it arrived; the dashboard itself is not mounted. The Google provider gets a placeholder id and the test blocks its script.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

async function main() {
  const [{ DoctorAuthProvider }, { default: DoctorLogin }] = await Promise.all([
    import("../../../../src/context/DoctorAuthContext.jsx"),
    import("../../../../src/pages/doctors/DoctorLogin.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <GoogleOAuthProvider clientId="e2e-placeholder.apps.googleusercontent.com">
      <DoctorAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/doctor-dashboard" element={<h1 data-testid="dashboard-standin">Doctor dashboard stand-in</h1>} />
          </Routes>
        </BrowserRouter>
      </DoctorAuthProvider>
    </GoogleOAuthProvider>,
  );
}
main();
