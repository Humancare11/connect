// Mounted once in AppLayout. Installs the booking-source click handler and landing capture (once, whatever the route does)
// and reports each route change so a page's own navigate() button is also recorded as a booking source.
// Renders nothing, so the page looks exactly the same.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { installBookingSource, onRouteChange } from "../utils/bookingSource";

export default function BookingSourceTracker() {
  const { pathname } = useLocation();
  const previous = useRef(null);

  useEffect(() => {
    installBookingSource();
  }, []);

  useEffect(() => {
    onRouteChange(previous.current, pathname);
    previous.current = pathname;
  }, [pathname]);

  return null;
}
