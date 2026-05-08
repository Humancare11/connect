import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function useLenis() {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const lenis = new Lenis({
      duration: 1.2, // ✅ use duration, easier to tune
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo ease
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 1, // increase if scroll feels too slow
      touchMultiplier: 2,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const animId = requestAnimationFrame(raf);
    lenisRef.current = lenis;

    return () => {
      cancelAnimationFrame(animId); // ✅ properly cancel on unmount
      lenis.destroy();
    };
  }, []);

  return lenisRef; // ✅ return ref in case you need lenis instance
}
