import { isoDay, longDay, monthCells, monthTitle, shiftMonth } from "./rescheduleLogic";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const Chevron = ({ dir }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

// Inline month calendar. Only past days are disabled (no per-day availability requests). Pure view: the dialog owns the month, the date and the data.
export default function RescheduleCalendar({ month, onMonth, today, value, disabled, onPick, onClear, onToday }) {
  const atStart = month <= today.slice(0, 7);
  return (
    <div className="adp-rs-cal">
      <div className="adp-rs-cal__head">
        <button type="button" className="adp-rs-cal__nav" aria-label="Previous month" disabled={atStart || disabled} onClick={() => onMonth(shiftMonth(month, -1))}>
          <Chevron dir="prev" />
        </button>
        <b aria-live="polite">{monthTitle(month)}</b>
        <button type="button" className="adp-rs-cal__nav" aria-label="Next month" disabled={disabled} onClick={() => onMonth(shiftMonth(month, 1))}>
          <Chevron dir="next" />
        </button>
      </div>
      <div className="adp-rs-cal__grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="adp-rs-cal__wd">
            {w}
          </span>
        ))}
        {monthCells(month).map((iso, i) => {
          if (!iso) return <span key={`b${i}`} className="adp-rs-cal__day adp-rs-cal__day--out" aria-hidden="true" />;
          const past = iso < today;
          return (
            <button
              key={iso}
              type="button"
              className={`adp-rs-cal__day${iso === today ? " adp-rs-cal__day--today" : ""}`}
              aria-pressed={value === iso}
              aria-label={longDay(iso)}
              disabled={past || disabled}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="adp-rs-cal__foot">
        <button type="button" className="adp-rs-cal__link" onClick={onClear} disabled={disabled}>
          Clear
        </button>
        <button type="button" className="adp-rs-cal__link" onClick={() => onToday(isoDay(new Date()))} disabled={disabled}>
          Today
        </button>
      </div>
    </div>
  );
}
