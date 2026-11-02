// Mounts the REAL doctor dashboard profile page (DoctorProfile) under the REAL DoctorAuthProvider, at the real route path
// /doctor-dashboard/profile, so the page signs in through the real /api/doctor/me with the cookie the test logged in with.
// (The dashboard layout around it is not mounted.) Nothing in src/ is changed.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

// DoctorAuthProvider only checks the session on /doctor-dashboard paths; the URL is moved there without a reload.
window.history.replaceState(null, "", "/doctor-dashboard/profile");

async function main() {
  const [{ DoctorAuthProvider }, { default: DoctorProfile }] = await Promise.all([
    import("../../../../src/context/DoctorAuthContext.jsx"),
    import("../../../../src/pages/doctors/DoctorProfile.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <DoctorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/doctor-dashboard/profile" element={<DoctorProfile />} />
        </Routes>
      </BrowserRouter>
    </DoctorAuthProvider>,
  );
}
main();
