import React, { useEffect, useRef, useState, useCallback } from "react";
import "./StepProgress.css";
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
  FiCheckCircle,
} from "react-icons/fi";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DURATION = 3000; // 3 seconds per step

const DEFAULT_STEPS = [
  { label: "Open App", icon: <FiSmartphone /> },
  { label: "Match Doctor", icon: <FiUserCheck /> },
  { label: "Wait Room", icon: <FiClock /> },
  { label: "Video Call", icon: <FiVideo /> },
  { label: "Rx Sent", icon: <FiFileText /> },
  { label: "Complete", icon: <FiCheckCircle /> },
];

export default function StepProgress({
  steps = DEFAULT_STEPS,
  duration = DURATION,
  onProgress,
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const circleRefs = useRef([]);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const progressRef = useRef(0);

  const setCircleRef = (el, i) => {
    circleRefs.current[i] = el;
  };

  const updateCircles = useCallback(() => {
    const len = steps.length;
    for (let i = 0; i < len; i++) {
      const el = circleRefs.current[i];
      if (!el) continue;

      let progress;
      if (i < current)
        progress = 1; // completed
      else if (i > current)
        progress = 0; // upcoming
      else progress = progressRef.current; // active

      const offset = CIRCUMFERENCE * (1 - progress);
      el.style.strokeDasharray = String(CIRCUMFERENCE);
      el.style.strokeDashoffset = String(offset);
      el.style.transition = "stroke-dashoffset 120ms linear"; // small smoothing
    }
  }, [current, steps.length]);

  const tick = useCallback(
    (timestamp) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!startRef.current) startRef.current = timestamp;

      const elapsed = timestamp - startRef.current;
      const pct = Math.min(elapsed / duration, 1);

      progressRef.current = pct;

      // ✅ Update circle UI
      updateCircles();

      // ✅ Sync progress line (TOTAL progress across all steps)
      if (onProgress) {
        const totalProgress = (current + pct) / steps.length;
        onProgress(totalProgress);
      }

      if (pct >= 1) {
        startRef.current = timestamp;

        setCurrent((prev) => {
          const next = (prev + 1) % steps.length;

          // ✅ Reset progress line when loop restarts
          if (next === 0 && onProgress) {
            onProgress(0);
          }

          return next;
        });

        progressRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [duration, paused, steps.length, updateCircles, current, onProgress],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  // update visuals when current changes (immediate)
  useEffect(() => {
    progressRef.current = 0;
    startRef.current = null;
    updateCircles();
  }, [current, updateCircles]);

  const jumpTo = (i) => {
    setCurrent(i);
    progressRef.current = 0;
    startRef.current = null;
  };

  return (
    <div
      className="step-progress"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {steps.map((s, i) => {
        const isActive = i === current;
        const isCompleted = i < current;

        return (
          <button
            key={s.label}
            className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
            onClick={() => jumpTo(i)}
            aria-current={isActive}
          >
            <div className="ring">
              <svg
                className="progress-ring"
                width="44"
                height="44"
                viewBox="0 0 44 44"
              >
                <circle
                  className="ring-bg"
                  cx="22"
                  cy="22"
                  r={18}
                  fill="none"
                />
                <circle
                  className="ring-fill"
                  cx="22"
                  cy="22"
                  r={18}
                  fill="none"
                  ref={(el) => setCircleRef(el, i)}
                />
              </svg>

              <div className="ring-icon">{s.icon}</div>
            </div>
            <div className="step-label">{s.label}</div>
          </button>
        );
      })}
    </div>
  );
}
