import { useEffect, useState } from "react";

// Viewport at or below which the video-call control bar collapses into
// primary controls + a "More" menu (see components/CallMoreMenu.jsx and the
// matching @media block at the end of pages/videocall.css).
export const MOBILE_CONTROLS_QUERY = "(max-width: 480px)";

const readMatch = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_CONTROLS_QUERY).matches
    : false;

export default function useMobileCallControls() {
  const [matches, setMatches] = useState(readMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(MOBILE_CONTROLS_QUERY);
    const onChange = (e) => setMatches(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return matches;
}
