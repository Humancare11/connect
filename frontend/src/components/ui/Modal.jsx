import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import useModalA11y from "../../hooks/useModalA11y";
import "./Modal.css";

let lockCount = 0;
let prevOverflow = "";

// Locks page scroll while a modal is open. Lenis (smooth scroll) ignores wheel events on elements that
// carry data-lenis-prevent, which the backdrop does.
function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}

// Accessible dialog. role "alertdialog" is for confirmations.
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  role = "dialog",
  dismissible = true,
  initialFocus,
  className = "",
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useScrollLock(open);
  useModalA11y(panelRef, open, dismissible ? onClose : null, { initialFocus });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="hc-modal-backdrop"
      data-lenis-prevent
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={`hc-modal ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
      >
        {title && (
          <h2 id={titleId} className="hc-modal__title">
            {title}
          </h2>
        )}
        {description && (
          <p id={descId} className="hc-modal__desc">
            {description}
          </p>
        )}
        {children}
        {actions && <div className="hc-modal__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
