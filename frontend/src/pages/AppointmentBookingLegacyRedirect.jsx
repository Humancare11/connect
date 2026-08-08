import { Navigate, useSearchParams } from "react-router-dom";

// Legacy support for the old query-param booking-form URL:
//   /appointment-booking/form?category=X&specialty=Y&condition=Z
// redirects (client-side) to the new SEO-friendly path-based URL:
//   /appointment-booking/X/Y/Z
// Production hosting also serves a real 301 for this via public/_redirects;
// this component is the fallback for local dev and any non-Netlify host.
export default function AppointmentBookingLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const specialty = searchParams.get("specialty");
  const condition = searchParams.get("condition");

  if (category && specialty && condition) {
    return (
      <Navigate
        to={`/appointment-booking/${category}/${specialty}/${condition}`}
        replace
      />
    );
  }

  return <Navigate to="/appointment-booking" replace />;
}
