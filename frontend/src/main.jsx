import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider }       from "./context/AuthContext";
import { DoctorAuthProvider } from "./context/DoctorAuthContext";
import { AdminProvider }      from "./context/AdminContext";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {import.meta.env.VITE_GOOGLE_CLIENT_ID
      ? (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <DoctorAuthProvider>
              <AdminProvider>
                <App />
              </AdminProvider>
            </DoctorAuthProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      ) : (
        // If no Google client ID is configured, render the app without the
        // GoogleOAuthProvider to avoid runtime errors from the provider.
        <AuthProvider>
          <DoctorAuthProvider>
            <AdminProvider>
              <App />
            </AdminProvider>
          </DoctorAuthProvider>
        </AuthProvider>
      )}
  </StrictMode>
);
