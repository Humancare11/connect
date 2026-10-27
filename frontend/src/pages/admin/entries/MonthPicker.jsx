import { useEffect, useId, useRef, useState } from "react";
import { MONTHS_SHORT, arrowTarget, formatMonth, monthOf, thisMonth } from "./entriesFormat";

// The month control of the entries toolbar: [‹] [ October 2026 ▾ ] [›]. ‹ and › step one month; the label opens a popover with a year
// row and a 4x3 grid of months (selected = filled teal, this month = teal outline, months with no entries greyed but clickable,
// future months disabled), and "This month" / "All time" buttons. Closes on a pick, a click outside, or Escape.
// `month` is "" for All time, else "YYYY-MM". `withEntries` is the list of months that have entries.
export default function MonthPicker({ month, withEntries = [], onChange }) {
  const now = thisMonth();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((month || now).slice(0, 4)));
  const [focus, setFocus] = useState(month || now);
  const root = useRef(null);
  const label = useRef(null);
  const popId = useId();
  const nowYear = Number(now.slice(0, 4));
  const has = new Set(withEntries);

  const toggle = () => {
    if (!open) {
      const start = month || now;
      setYear(Number(start.slice(0, 4)));
      setFocus(start);
    }
    setOpen(!open);
  };
  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) label.current?.focus();
  };
  const pick = (value) => {
    onChange(value);
    close();
  };

  // Click outside closes (without stealing focus from what was clicked).
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (root.current && !root.current.contains(event.target)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The focused month button takes real focus so the arrow keys and Enter work on it.
  useEffect(() => {
    if (open) root.current?.querySelector(`[data-month="${focus}"]`)?.focus();
  }, [open, focus, year]);

  const move = (delta) => {
    // Months are in a row of 3; a move that would leave the year goes to the neighbouring year. Future months are skipped over.
    const [y, m] = focus.split("-").map(Number);
    const index = y * 12 + (m - 1) + delta;
    const target = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    if (target > now) return;
    setFocus(target);
    setYear(Number(target.slice(0, 4)));
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
    if (delta) {
      event.preventDefault();
      move(delta);
    }
  };

  const back = arrowTarget(month, -1, { months: withEntries, now });
  const forward = arrowTarget(month, 1, { months: withEntries, now });

  return (
    <div className="en-mp" ref={root} onKeyDown={onKeyDown}>
      <div className="en-mp-ctl" role="group" aria-label="Month">
        <button type="button" className="en-mp-step" aria-label="Previous month" disabled={back === null} onClick={() => onChange(back)}>
          ‹
        </button>
        <button
          type="button"
          ref={label}
          className="en-mp-label"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          onClick={toggle}
        >
          {month ? formatMonth(month) : "All time"} <span aria-hidden="true">▾</span>
        </button>
        <button type="button" className="en-mp-step" aria-label="Next month" disabled={forward === null} onClick={() => onChange(forward)}>
          ›
        </button>
      </div>

      {open && (
        <div className="en-mp-pop" id={popId} role="dialog" aria-label="Pick a month">
          <div className="en-mp-year">
            <button type="button" aria-label="Previous year" onClick={() => setYear(year - 1)}>
              ‹
            </button>
            <b>{year}</b>
            <button type="button" aria-label="Next year" disabled={year >= nowYear} onClick={() => setYear(year + 1)}>
              ›
            </button>
          </div>
          <div className="en-mp-grid" role="group" aria-label={`Months of ${year}`}>
            {MONTHS_SHORT.map((name, i) => {
              const value = monthOf(year, i);
              const future = value > now;
              const cls = ["en-mp-m", value === month ? "is-selected" : "", value === now ? "is-now" : "", !has.has(value) ? "is-empty" : ""].filter(Boolean).join(" ");
              return (
                <button
                  key={value}
                  type="button"
                  className={cls}
                  data-month={value}
                  disabled={future}
                  aria-pressed={value === month}
                  aria-label={`${formatMonth(value)}${has.has(value) ? "" : " (no entries)"}`}
                  tabIndex={value === focus ? 0 : -1}
                  onClick={() => pick(value)}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <div className="en-mp-foot">
            <button type="button" className="en-btn" onClick={() => pick(now)}>
              This month
            </button>
            <button type="button" className="en-btn" onClick={() => pick("")}>
              All time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
