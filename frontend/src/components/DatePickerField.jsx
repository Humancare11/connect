import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let row = [];
  for (let i = 0; i < first; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) {
      grid.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    grid.push(row);
  }
  return grid;
}

export default function DatePickerField({
  id,
  name,
  value,
  onChange,
  min = "1880-01-01",
  max,
  placeholder = "Select date of birth",
}) {
  const today = new Date();
  const maxDate = max || today.toISOString().slice(0, 10);

  const parseVal = () => {
    if (value && value.length === 10) {
      const [y, m] = value.split("-").map(Number);
      if (y > 0) return { year: y, month: m - 1 };
    }
    return { year: today.getFullYear() - 30, month: today.getMonth() };
  };

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseVal().year);
  const [viewMonth, setViewMonth] = useState(() => parseVal().month);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const wrapRef = useRef(null);
  const dropRef = useRef(null);

  const minYear = parseInt(min.slice(0, 4));
  const maxYear = parseInt(maxDate.slice(0, 4));

  // Year list for dropdown
  const yearOptions = [];
  for (let y = maxYear; y >= minYear; y--) yearOptions.push(y);

  const selDate =
    value && value.length === 10 ? new Date(value + "T00:00:00") : null;
  const calendar = useMemo(
    () => buildCalendar(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const fmt = (y, m, d) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const isDisabled = (d) => {
    if (!d) return true;
    const s = fmt(viewYear, viewMonth, d);
    if (min && s < min) return true;
    if (maxDate && s > maxDate) return true;
    return false;
  };

  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({
        top: r.bottom + window.scrollY + 4,
        left: r.left + window.scrollX,
      });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (d) => {
    if (!d || isDisabled(d)) return;
    onChange(fmt(viewYear, viewMonth, d));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const canPrev =
    fmt(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1,
      1,
    ) >= min;
  const canNext =
    fmt(
      viewMonth === 11 ? viewYear + 1 : viewYear,
      viewMonth === 11 ? 0 : viewMonth + 1,
      1,
    ) <= maxDate;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        wrapRef.current?.contains(e.target) ||
        dropRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Sync view when value changes externally
  useEffect(() => {
    const p = parseVal();
    setViewYear(p.year);
    setViewMonth(p.month);
  }, [value]);

  const displayVal = selDate
    ? selDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  return (
    <>
      <style>{`
        @keyframes dpDrop {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .dp-cell {
          width:40px; height:40px; border:1.5px solid #e2e8f0;
          background:#fff; cursor:pointer; font-size:13px;
          font-family: inherit; color:#334155; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.12s; font-weight:500;
        }
        .dp-cell:hover:not(.dp-dis) {
          background:#eff6ff; border-color:#93c5fd; color:#1d4ed8;
        }
        .dp-cell.dp-today {
          border-color:#3b82f6; color:#1d4ed8; font-weight:700; background:#eff6ff;
        }
        .dp-cell.dp-sel {
          background:#2563eb; border-color:#2563eb; color:#fff;
          font-weight:700; box-shadow:0 2px 8px rgba(37,99,235,0.3);
        }
        .dp-cell.dp-dis {
          opacity:0.25; cursor:default; border-color:#f1f5f9;
        }
        .dp-hdr-sel {
          height:34px; border:1.5px solid #e2e8f0; border-radius:8px;
          padding:0 28px 0 10px; font-size:13px; font-weight:600;
          font-family: inherit; color:#0f172a; background:#f8fafc;
          cursor:pointer; outline:none; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 8px center;
          transition:border-color 0.15s;
        }
        .dp-hdr-sel:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
        .dp-nav-btn {
          width:30px; height:30px; border:1.5px solid #e2e8f0; border-radius:8px;
          background:#f8fafc; cursor:pointer; display:flex; align-items:center;
          justify-content:center; transition:all 0.12s; flex-shrink:0;
        }
        .dp-nav-btn:hover:not(:disabled) { background:#eff6ff; border-color:#93c5fd; }
        .dp-nav-btn:disabled { opacity:0.3; cursor:default; }
      `}</style>

      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        {/* Trigger */}
        <div
          id={id}
          onClick={handleToggle}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: 46,
            padding: "0 14px",
            gap: 10,
            border: open ? "1.5px solid #2563eb" : "1.5px solid #cbd5e1",
            borderRadius: 10,
            background: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            color: selDate ? "#0f172a" : "#9ca3af",
            boxShadow: open
              ? "0 0 0 3px rgba(37,99,235,0.1)"
              : "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.2s",
            userSelect: "none",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ flex: 1 }}>{displayVal || placeholder}</span>
          {selDate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#94a3b8",
                display: "flex",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            style={{
              flexShrink: 0,
              color: "#64748b",
              transition: "transform 0.18s",
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            <path
              d="M1 1l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {open &&
          createPortal(
            <div
              ref={dropRef}
              style={{
                position: "absolute",
                top: dropPos.top,
                left: dropPos.left,
                width: 320,
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 14,
                boxShadow:
                  "0 16px 48px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.07)",
                zIndex: 999999,
                overflow: "hidden",
                animation: "dpDrop 0.2s cubic-bezier(0.34,1.3,0.64,1)",
                fontFamily: "inherit",
              }}
            >
              {/* ── Header: prev | Month▼ Year▼ | next ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 14px 10px",
                }}
              >
                <button
                  type="button"
                  className="dp-nav-btn"
                  onClick={prevMonth}
                  disabled={!canPrev}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                {/* Month dropdown */}
                {id && (
                  <label htmlFor={`${id}-month`} style={VISUALLY_HIDDEN}>
                    Month
                  </label>
                )}
                <select
                  id={id ? `${id}-month` : undefined}
                  name={name ? `${name}Month` : undefined}
                  className="dp-hdr-sel"
                  style={{ flex: "1.4" }}
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Year dropdown */}
                {id && (
                  <label htmlFor={`${id}-year`} style={VISUALLY_HIDDEN}>
                    Year
                  </label>
                )}
                <select
                  id={id ? `${id}-year` : undefined}
                  name={name ? `${name}Year` : undefined}
                  className="dp-hdr-sel"
                  style={{ flex: "1" }}
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="dp-nav-btn"
                  onClick={nextMonth}
                  disabled={!canNext}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* ── Day headers ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  padding: "0 10px 4px",
                  textAlign: "center",
                }}
              >
                {DAY_HEADERS.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94a3b8",
                      padding: "2px 0",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* ── Calendar grid ── */}
              <div style={{ padding: "0 10px 10px" }}>
                {calendar.map((row, ri) => (
                  <div
                    key={ri}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7,1fr)",
                      gap: 2,
                      justifyItems: "center",
                      marginBottom: 2,
                    }}
                  >
                    {row.map((d, ci) => {
                      if (d === null)
                        return (
                          <div key={ci} style={{ width: 40, height: 40 }} />
                        );
                      const disabled = isDisabled(d);
                      const isSel =
                        selDate &&
                        selDate.getDate() === d &&
                        selDate.getMonth() === viewMonth &&
                        selDate.getFullYear() === viewYear;
                      const isToday =
                        d === todayD &&
                        viewMonth === todayM &&
                        viewYear === todayY;
                      return (
                        <button
                          key={ci}
                          type="button"
                          className={`dp-cell${isToday && !isSel ? " dp-today" : ""}${isSel ? " dp-sel" : ""}${disabled ? " dp-dis" : ""}`}
                          onClick={() => handleSelect(d)}
                          disabled={disabled}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* ── Footer ── */}
              <div
                style={{
                  borderTop: "1px solid #f1f5f9",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: selDate ? "#1d4ed8" : "#94a3b8",
                    fontWeight: selDate ? 600 : 400,
                  }}
                >
                  {selDate
                    ? selDate.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "No date selected"}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "4px 8px",
                    fontFamily: "inherit",
                  }}
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}
