/* eslint-disable react-refresh/only-export-components -- test stand-in */
// The REAL patient signup page (Login, register view) and the REAL profile edit page (ProfileSettings), with the real country /
// state dropdown (LocationSelects) and the real phone field, under the app's real providers. Only the API behind them is the test API.
import React, { useEffect, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AppProviders from "../../../../src/AppProviders.jsx";
import { useAuth } from "../../../../src/context/AuthContext.jsx";
import Login from "../../../../src/pages/Login.jsx";
import ProfileSettings from "../../../../src/pages/user/ProfileSettings.jsx";

function SignedInProfile() {
  const { login, user } = useAuth();
  useEffect(() => {
    login({ _id: "patient", name: "Test Patient", email: "patient@e2e.test", mobile: "+919876543210", country: "India", state: "Karnataka", city: "Bengaluru" });
  }, [login]);
  return user ? <ProfileSettings /> : <p>Signing in...</p>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
  <HelmetProvider>
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<SignedInProfile />} />
          <Route path="*" element={<div id="other-page">Other page</div>} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  </HelmetProvider>
  </StrictMode>,
);
