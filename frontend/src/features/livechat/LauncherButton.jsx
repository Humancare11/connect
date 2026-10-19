import { useEffect, useRef, useState } from "react";

// The closed-chat launcher: the speech-bubble "H" logo that flips to a "typing" back face every 3 seconds.
// It is only mounted while the chat window is closed, so the flip is paused whenever the window is open. It also
// pauses while the button is hovered or keyboard-focused and while the tab is hidden, and never runs for visitors
// who asked for reduced motion. Hover, focus, a click and a hidden tab all put the logo side back.
export const FLIP_EVERY_MS = 3000;
export const LOGO_SRC = "/livechat/launcher-logo.png";

const REDUCED = "(prefers-reduced-motion: reduce)";
const reducedNow = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCED).matches);

// The logo's own outline (rounded square, tail bottom-left) for the back face.
const BUBBLE_PATH =
  "M50 8H186Q228 8 228 50V176Q228 218 186 218H128L90 249Q82 255 82 245V218H50Q8 218 8 176V50Q8 8 50 8Z";

export default function LauncherButton({ unread = 0, onOpen }) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const [reduced, setReduced] = useState(reducedNow);
  const [logoOk, setLogoOk] = useState(true);
  const timer = useRef(null);

  const paused = hovered || focused || tabHidden || reduced;

  useEffect(() => {
    const onVisibility = () => {
      setTabHidden(document.hidden);
      setFlipped(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const media = window.matchMedia?.(REDUCED);
    const onMotion = (event) => {
      setReduced(event.matches);
      setFlipped(false);
    };
    media?.addEventListener?.("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      media?.removeEventListener?.("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    timer.current = setInterval(() => setFlipped((value) => !value), FLIP_EVERY_MS);
    return () => clearInterval(timer.current);
  }, [paused]);

  const showBack = flipped && !paused && logoOk;
  const stopHover = () => {
    setHovered(false);
    setFlipped(false);
  };
  const onFocus = (event) => {
    let visible = true;
    try {
      visible = event.currentTarget.matches(":focus-visible");
    } catch {
      /* old browser: treat any focus as keyboard focus */
    }
    if (visible) {
      setFocused(true);
      setFlipped(false);
    }
  };

  return (
    <button
      type="button"
      className={`lcw-launcher ${logoOk ? "lcw-launcher--logo" : "lcw-launcher--hc"}${showBack ? " lcw-launcher--flipped" : ""}`}
      onClick={() => {
        setFlipped(false);
        onOpen();
      }}
      onMouseEnter={() => {
        setHovered(true);
        setFlipped(false);
      }}
      onMouseLeave={stopHover}
      onFocus={onFocus}
      onBlur={() => {
        setFocused(false);
        setFlipped(false);
      }}
      aria-label="Open chat"
      aria-expanded="false"
    >
      {logoOk ? (
        <span className="lcw-launcher-flip" aria-hidden="true">
          <span className="lcw-launcher-face lcw-launcher-front">
            <img src={LOGO_SRC} alt="" width="236" height="256" onError={() => setLogoOk(false)} />
          </span>
          <span className="lcw-launcher-face lcw-launcher-back">
            <svg viewBox="0 0 236 256" focusable="false">
              <defs>
                <linearGradient id="lcw-launcher-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5b9bff" />
                  <stop offset="1" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <path d={BUBBLE_PATH} fill="url(#lcw-launcher-grad)" stroke="#12318f" strokeWidth="9" strokeLinejoin="round" />
            </svg>
            <span className="lcw-launcher-dots">
              <i />
              <i />
              <i />
            </span>
          </span>
        </span>
      ) : (
        <span className="lcw-launcher-hc" aria-hidden="true">
          HC
        </span>
      )}
      {unread > 0 && <span className="lcw-badge">{unread}</span>}
    </button>
  );
}
