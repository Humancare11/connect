import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (root) =>
  Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

// Keyboard support for a modal/drawer that already exists: Escape closes, Tab stays inside, focus moves in
// when it opens and returns to the element that opened it. It changes no markup or styles.
//   ref           the dialog element (or its backdrop)
//   isOpen        whether it is currently shown
//   onClose       called on Escape (omit/null to disable)
//   options       { initialFocus: CSS selector or element to focus first }
// Open dialogs, innermost last. Only the top one reacts to keys, so a confirm dialog opened from inside
// another modal gets the Tab trap and Escape instead of fighting it.
const stack = [];

export default function useModalA11y(ref, isOpen, onClose, options = {}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const initial = options.initialFocus;

  useEffect(() => {
    if (!isOpen) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const opener = document.activeElement;
    const token = {};
    stack.push(token);

    const target =
      (typeof initial === "string" ? root.querySelector(initial) : initial) || focusables(root)[0] || root;
    if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
    // Wait a frame so the dialog is laid out (and any autoFocus inside has run).
    const raf = requestAnimationFrame(() => {
      if (!root.contains(document.activeElement)) target.focus?.({ preventScroll: true });
    });

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(root);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      const at = stack.indexOf(token);
      if (at !== -1) stack.splice(at, 1);
      document.removeEventListener("keydown", onKeyDown, true);
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ref]);
}
