import { useEffect, useState } from "react";
import "./RouteFallback.css";

// Suspense fallback for lazy routes. Keeps the old fallback's height (so the footer does not jump)
// and shows a spinner only if loading takes longer than the delay, so fast loads never flash.
export default function RouteFallback({ delay = 300 }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="hc-route-loading">
      {show && (
        <div className="hc-route-spinner" role="status">
          <span className="hc-route-spinner__ring" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </div>
      )}
    </div>
  );
}
