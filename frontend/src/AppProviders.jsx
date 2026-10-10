// The provider tree shared by the browser entry (main.jsx) and the prerender entry
// (entry-server.jsx), so the server renders exactly what the client hydrates.
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { DoctorAuthProvider } from "./context/DoctorAuthContext";
import { AdminProvider } from "./context/AdminContext";
import { PricingProvider } from "./context/PricingContext";
import { EmployeeAdminProvider } from "./context/EmployeeAdminContext";
import { PartnerProvider } from "./context/PartnerContext";
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

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <DoctorAuthProvider>
              <AdminProvider>
                <EmployeeAdminProvider>
                  <PartnerProvider>
                    <PricingProvider>{children}</PricingProvider>
                  </PartnerProvider>
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
              <PartnerProvider>
                <PricingProvider>{children}</PricingProvider>
              </PartnerProvider>
            </AdminProvider>
          </DoctorAuthProvider>
        </AuthProvider>
      )}
    </QueryClientProvider>
  );
}
