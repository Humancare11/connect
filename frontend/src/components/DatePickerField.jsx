import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let row = [];
  for (let i = 0; i < first; i++) { row.push(null); }
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { grid.push(row); row = []; }
  }
  if (row.length) { while (row.length < 7) row.push(null); grid.push(row); }
  return grid;
}

export default function DatePickerField({ value, onChange, min, max, placeholder = "Date of Birth" }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value && !value.includes("0000")) return new Date(value + "T00:00:00").getFullYear();
    return new Date().getFullYear() - 30;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value && !value.includes("0000")) return new Date(value + "T00:00:00").getMonth();
    return new Date().getMonth();
  });
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const wrapRef = useRef(null);
  const dropRef = useRef(null);

  const selDate = value ? new Date(value + "T00:00:00") : null;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const calendar = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const formatDate = (y, m, d) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (d) => {
    if (!d) return;
    if (viewYear === 0 || viewYear < 1900) return;
    const dateStr = formatDate(viewYear, viewMonth, d);
    if (dateStr.includes("00")) return;
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    onChange(dateStr);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handleToday = () => {
    handleSelect(todayDate);
  };

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      if (wrapRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const selStr = selDate
    ? `${DAYS[selDate.getDay()]}, ${MONTHS[selDate.getMonth()]} ${selDate.getDate()}, ${selDate.getFullYear()}`
    : "";

  const canPrev = !min || formatDate(viewYear - (viewMonth === 0 ? 1 : 0), viewMonth === 0 ? 11 : viewMonth - 1, 1) >= min;
  const canNext = !max || formatDate(viewYear + (viewMonth === 11 ? 1 : 0), viewMonth === 11 ? 0 : viewMonth + 1, 1) <= max;

  const isDisabled = (d) => {
    if (!d) return true;
    const dateStr = formatDate(viewYear, viewMonth, d);
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  return (
    <>
      <style>{`
        @keyframes dp-drop {
          from { opacity:0; transform:translateY(-8px) scale(0.96); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
        .dp-cell {
          width:38px; height:38px; border:none; background:none; cursor:pointer;
          font-size:14px; font-family:inherit; color:#334155; border-radius:6px;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.15s; margin:2px; font-weight:500;
        }
        .dp-cell:hover:not(.disabled) { background:#dbeafe; color:#1e40af; transform:scale(1.05); }
        .dp-cell.today { border:2px solid #3b82f6; background:#eff6ff; color:#1e40af; font-weight:700; }
        .dp-cell.sel { background:#2563eb; color:#fff; font-weight:700; box-shadow:0 4px 12px rgba(37,99,235,0.35); }
        .dp-cell.sel:hover { background:#1d4ed8; transform:scale(1.05); }
        .dp-cell.disabled { opacity:0.3; cursor:default; }
      `}</style>

      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <div
          onClick={handleToggle}
          style={{
            display: "flex", alignItems: "center", width: "100%",
            height: 48, minHeight: 48,
            padding: "0 14px", gap: 10,
            border: "1.5px solid #cbd5e1",
            borderRadius: 10,
            background: "#f9fafb",
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            color: selDate ? "#1f2937" : "#9ca3af",
            boxSizing: "border-box",
            transition: "all 0.25s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
          onMouseEnter={(e) => { if (!open) { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; } }}
          onMouseLeave={(e) => { if (!open) { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; } }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selStr || placeholder}
          </span>
          {selDate && (
            <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8", display: "flex", flexShrink: 0 }}
              tabIndex={-1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, color: "#64748b", opacity: 0.7, transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {open && createPortal(
          <div ref={dropRef} style={{
            position: "absolute", top: dropPos.top, left: dropPos.left,
            width: 310, background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 999999, overflow: "hidden",
            animation: "dp-drop 0.22s cubic-bezier(0.34,1.56,0.64,1)",
            fontFamily: "inherit",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 6px" }}>
              <button type="button" onClick={prevMonth} disabled={!canPrev}
                style={{ background: "none", border: "none", cursor: canPrev ? "pointer" : "default", padding: "6px 8px", borderRadius: 8, color: canPrev ? "#475569" : "#cbd5e1", display: "flex", transition: "background 0.12s" }}
                onMouseEnter={e => { if (canPrev) e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={e => e.currentTarget.style.background = "none" }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", userSelect: "none" }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth} disabled={!canNext}
                style={{ background: "none", border: "none", cursor: canNext ? "pointer" : "default", padding: "6px 8px", borderRadius: 8, color: canNext ? "#475569" : "#cbd5e1", display: "flex", transition: "background 0.12s" }}
                onMouseEnter={e => { if (canNext) e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={e => e.currentTarget.style.background = "none" }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "4px 10px 0", textAlign: "center" }}>
              {DAYS.map((d) => (
                <div key={d} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", padding: "4px 0" }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ padding: "2px 10px 10px" }}>
              {calendar.map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", justifyItems: "center" }}>
                  {row.map((d, ci) => {
                    if (d === null) return <div key={ci} style={{ width: 36, height: 36, margin: 1 }} />;
                    const disabled = isDisabled(d);
                    const isSel = selDate && selDate.getDate() === d && selDate.getMonth() === viewMonth && selDate.getFullYear() === viewYear;
                    const isToday = d === todayDate && viewMonth === todayMonth && viewYear === todayYear;
                    return (
                      <button key={ci} type="button"
                        className={`dp-cell${isToday ? " today" : ""}${isSel ? " sel" : ""}${disabled ? " disabled" : ""}`}
                        onClick={() => handleSelect(d)}
                        disabled={disabled}
                        tabIndex={-1}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: "1px solid #f3f4f6" }}>
              <button type="button" onClick={handleToday}
                style={{ background: "none", border: "1.5px solid #d1d5db", borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#374151"; }}>
                Today
              </button>
              <button type="button" onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#9ca3af", cursor: "pointer", padding: "6px 10px", fontFamily: "inherit" }}>
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
