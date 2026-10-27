import { TAB_LABELS, TAB_ORDER } from "./bookingFormat";

// The status tabs with their live counts (from the server), and the Hide testing toggle.
export default function BookingTabs({ tab, counts, hideTesting, onTab, onToggleHideTesting }) {
  return (
    <div className="adp-bk-tabs">
      <div className="adp-tabs" role="tablist" aria-label="Appointment status">
        {TAB_ORDER.map((key) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === key}
            key={key}
            className={`adp-tab ${tab === key ? "active" : ""}`}
            onClick={() => onTab(key)}
          >
            {TAB_LABELS[key]}
            <span className="adp-tab-count">{counts?.[key] ?? "–"}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`adp-tab adp-bk-hide ${hideTesting ? "active" : ""}`}
        aria-pressed={hideTesting}
        onClick={onToggleHideTesting}
      >
        {hideTesting ? "Showing without testing" : "Hide testing"}
      </button>
    </div>
  );
}
