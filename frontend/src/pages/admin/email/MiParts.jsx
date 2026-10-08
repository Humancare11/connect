import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./email.css";

// Dialog on <body> so it sits above the admin sidebar (same reason as the composer).
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="em-root">
      <div className="mi-scrim" onClick={onClose} />
      <div className="mi-modal" role="dialog" aria-modal="true" aria-labelledby="mi-title">
        <div className="mi-head">
          <h2 id="mi-title">{title}</h2>
          <button type="button" className="mi-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
