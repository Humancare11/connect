import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMoreHorizontal, FiX } from "react-icons/fi";

// Shared by VideoCall.jsx and DirectVideoCall.jsx. On narrow phones the
// secondary call controls are rendered inside this bottom drawer instead of
// the main control bar; the buttons (and their handlers) are the very same
// elements the desktop layout renders, just placed in a different parent.
const ITEM_SELECTOR = "button:not(:disabled)";

export default function CallMoreMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [wrapEl, setWrapEl] = useState(null);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerId = useId();
  const titleId = useId();

  // Render the drawer inside the call page element (not document.body) so it
  // stays visible in fullscreen, and outside the control bar, whose
  // backdrop-filter would otherwise become the containing block for
  // position: fixed.
  const portalTarget = wrapEl ? wrapEl.closest(".hc-vc__page") || document.body : null;

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    (drawer?.querySelector(ITEM_SELECTOR) || drawer)?.focus();
  }, [open]);

  // Escape closes; Tab is kept inside the drawer while it is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab") return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const items = Array.from(drawer.querySelectorAll(ITEM_SELECTOR));
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !drawer.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !drawer.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // The moved buttons run their own onClick first (it fires before this
  // bubbling handler); we only close the drawer afterwards.
  const onListClick = (e) => {
    if (e.target.closest("button")) close(true);
  };

  return (
    <div className="hc-vc__more" ref={setWrapEl}>
      <button
        type="button"
        ref={triggerRef}
        className={`hc-vc__btn hc-vc__btn--more ${open ? "hc-vc__btn--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? drawerId : undefined}
        aria-label="More options"
        title="More"
      >
        <span className="hc-vc__btn-icon">
          {open ? <FiX /> : <FiMoreHorizontal />}
        </span>
        <span className="hc-vc__btn-label">More</span>
      </button>

      {open &&
        portalTarget &&
        createPortal(
          <>
            <div
              className="hc-vc__drawer-backdrop"
              onClick={() => close(true)}
              aria-hidden="true"
            />
            <div
              id={drawerId}
              ref={drawerRef}
              className="hc-vc__drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
            >
              <div className="hc-vc__drawer-handle" aria-hidden="true" />
              <h2 className="hc-vc__drawer-title" id={titleId}>
                More Options
              </h2>
              <div className="hc-vc__drawer-list" onClick={onListClick}>
                {children}
              </div>
            </div>
          </>,
          portalTarget,
        )}
    </div>
  );
}
