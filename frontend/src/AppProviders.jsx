// The provider tree shared by the browser entry (main.jsx) and the prerender entry
// (entry-server.jsx), so the server renders exactly what the client hydrates.
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID, googleEnabled } from "./utils/googleAuth";
import { AuthProvider } from "./context/AuthContext";
import { DoctorAuthProvider } from "./context/DoctorAuthContext";
import { AdminProvider } from "./context/AdminContext";
import { PricingProvider } from "./context/PricingContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { EmployeeAdminProvider } from "./context/EmployeeAdminContext";
import { PartnerProvider } from "./context/PartnerContext";
import { ToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
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

// Google sign-in needs its provider only when the build has a client id; without one the app renders without it (the login pages
// hide the Google button, see utils/googleAuth.js).
function GoogleScope({ children }) {
  return googleEnabled ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider> : children;
}

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <GoogleScope>
            <AuthProvider>
              <DoctorAuthProvider>
                <AdminProvider>
                  <EmployeeAdminProvider>
                    <PartnerProvider>
                      <CurrencyProvider>
                        <PricingProvider>{children}</PricingProvider>
                      </CurrencyProvider>
                    </PartnerProvider>
                  </EmployeeAdminProvider>
                </AdminProvider>
              </DoctorAuthProvider>
            </AuthProvider>
          </GoogleScope>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
