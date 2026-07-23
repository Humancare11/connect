import React from "react";
import "./StepProgress.css";
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
} from "react-icons/fi";

const RADIUS = 18; // must match the <circle r={...}> below and STEP_CIRCUMFERENCE in home.jsx
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const DEFAULT_STEPS = [
  { label: "Create Account", icon: <FiSmartphone /> },
  { label: "Choose Service", icon: <FiUserCheck /> },
  { label: "Book Appointment", icon: <FiClock /> },
  { label: "Consult", icon: <FiVideo /> },
  { label: "Complete Care", icon: <FiFileText /> },
];

/**
 * Presentational / fully controlled component.
 *
 * home.jsx owns the single source-of-truth timer + `current` step index.
 * This component only:
 *   - renders the dots/rings for the given `current` step
 *   - exposes `registerRing(el, i)` so the parent can drive each ring's
 *     stroke-dashoffset directly on every animation frame (no re-renders needed)
 *   - calls `onStepClick(i)` so the parent can jump both the ring AND the
 *     scene card together, then resume autoplay from there
 *   - calls `onHoverChange(bool)` so the parent can pause/resume its timer
 */
export default function StepProgress({
  steps = DEFAULT_STEPS,
  current = 0,
  onStepClick,
  onHoverChange,
  registerRing,
}) {
  const setCircleRef = (el, i) => {
    if (el) {
      el.style.transition = "stroke-dashoffset 120ms linear";
    }
    registerRing?.(el, i);
  };

  return (
    <div
      className="step-progress"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {steps.map((s, i) => {
        const isActive = i === current;
        const isCompleted = i < current;

        return (
          <button
            key={s.label}
            type="button"
            className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
            onClick={() => onStepClick?.(i)}
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
                  r={RADIUS}
                  fill="none"
                />
                <circle
                  className="ring-fill"
                  cx="22"
                  cy="22"
                  r={RADIUS}
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE}
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
