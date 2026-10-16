import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// true when the visitor asked the OS/browser for reduced motion. Starts false so the server render
// and the first client render match; updates right after mount and when the setting changes.
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return undefined;
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}
