import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { DoctorAuthProvider } from "./context/DoctorAuthContext";
import { AdminProvider } from "./context/AdminContext";
import { PricingProvider } from "./context/PricingContext";
import { EmployeeAdminProvider } from "./context/EmployeeAdminContext";
import "./index.css";
import App from "./App.jsx";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
      staleTime: 1000 * 60 * 5, // 5 minutes default staleTime
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <DoctorAuthProvider>
              <AdminProvider>
                <EmployeeAdminProvider>
                  <PricingProvider>
                    <App />
                  </PricingProvider>
                </EmployeeAdminProvider>
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
              <PricingProvider>
                <App />
              </PricingProvider>
            </AdminProvider>
          </DoctorAuthProvider>
        </AuthProvider>
      )}
    </QueryClientProvider>
  </StrictMode>,
);
