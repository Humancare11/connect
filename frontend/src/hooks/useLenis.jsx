import { useEffect, useRef } from "react";

export default function useLenis() {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (window.matchMedia?.("(pointer: coarse)").matches) return undefined;

    let active = true;
    let frameId = 0;

    import("lenis").then(({ default: Lenis }) => {
      if (!active) return;

      const lenis = new Lenis({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });

      const raf = (time) => {
        lenis.raf(time);
        frameId = requestAnimationFrame(raf);
      };

      lenisRef.current = lenis;
      frameId = requestAnimationFrame(raf);
    });

    return () => {
      active = false;
      if (frameId) cancelAnimationFrame(frameId);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
