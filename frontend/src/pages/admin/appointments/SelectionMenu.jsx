import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuOptions } from "./selectionLogic";

// Just below the element, kept on screen.
const placeBelow = (element) => {
  const box = element.getBoundingClientRect();
  return { top: box.bottom + 4, left: Math.max(8, Math.min(box.left, window.innerWidth - 200)) };
};

const CHOOSE = { selectPage: "selectPage", oneByOne: "enter", clear: "clear", exit: "exit" };

// The selection menu. As the header checkbox (table layout) it does not select anything by itself:
// clicking it opens a small menu of the choices that make sense right now. As a plain "Select"
// button (card layout, where the table header is hidden) it opens the same menu.
export default function SelectionMenu({ selection, pageCount, variant = "checkbox" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchor = useRef(null);
  const menu = useRef(null);
  const options = menuOptions({ selecting: selection.selecting, selectedCount: selection.count, pageCount });

  useEffect(() => {
    if (anchor.current && variant === "checkbox") {
      anchor.current.indeterminate = selection.selecting && selection.count > 0 && !selection.allSelected;
    }
  }, [variant, selection.selecting, selection.count, selection.allSelected]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    // The menu is fixed to the screen, so it follows its checkbox when the page scrolls or resizes.
    const follow = () => {
      if (!anchor.current || !anchor.current.isConnected) return close();
      setPosition(placeBelow(anchor.current));
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        close();
        anchor.current?.focus();
      }
    };
    const onDown = (event) => {
      if (!menu.current?.contains(event.target) && !anchor.current?.contains(event.target)) close();
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    menu.current?.querySelector("button")?.focus();
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const toggle = (event) => {
    event.preventDefault();
    if (open) return setOpen(false);
    setPosition(placeBelow(anchor.current));
    setOpen(true);
  };

  const choose = (id) => {
    setOpen(false);
    selection[CHOOSE[id]]();
  };

  const popup = open
    ? createPortal(
        <div ref={menu} className="adp-bk-menu" role="menu" style={{ top: position.top, left: position.left }}>
          {options.map((option) => (
            <button key={option.id} type="button" role="menuitem" data-choice={option.id} onClick={() => choose(option.id)}>
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {variant === "checkbox" ? (
        <input
          ref={anchor}
          type="checkbox"
          className="adp-bk-headcheck"
          aria-label="Selection options"
          aria-haspopup="menu"
          aria-expanded={open}
          checked={selection.selecting && selection.allSelected}
          onClick={toggle}
          onChange={() => {}}
        />
      ) : (
        <button ref={anchor} type="button" className="adp-bk-btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
          {selection.selecting ? `Selection (${selection.count})` : "Select"}
        </button>
      )}
      {popup}
    </>
  );
}
