import { useState } from "react";
import { Icon } from "./EmailParts";
import { TRACKING_FILTER_OPTIONS } from "./emailUtils";

// The filter bar for Received and Sent. Every value lives in the URL query, so
// going back from a mail keeps the filters, and a filtered view can be shared.
// Inline: Sent by (Sent), Mail ID (only while "All" is selected) and Date.
// Everything else sits behind "More filters".
function Select({ name, label, value, options, onChange }) {
  return (
    <span className="em-fsel">
      <select aria-label={label} value={value} className={value ? "set" : ""} onChange={(e) => onChange(name, e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </span>
  );
}

export default function EmailFilters({ folder, allMailIds, filters, mailboxes, admins, onChange, onClear }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const adminOpts = admins.map((a) => [a.id, a.name]);
  const isSent = folder === "sent";

  const defs = {
    by: { label: "Sent by", options: [["", "Sent by: anyone"], ...adminOpts] },
    box: { label: "Mail ID", options: [["", "Mail ID: all"], ...mailboxes.map((m) => [m.id, m.displayName])] },
    date: { label: "Date", options: [["", "Date: any time"], ["today", "Today"], ["7d", "Last 7 days"], ["month", "This month"]] },
    st: {
      label: "Status",
      options: isSent
        ? [["", "All"], ["noreply", "Sent (no reply yet)"], ["replied", "Client replied"], ["failed", "Failed"]]
        : [["", "All"], ["noreply", "Not replied yet"], ["replied", "Replied"]],
    },
    open: { label: "Open status", options: [["", "All"], ...TRACKING_FILTER_OPTIONS] },
    view: { label: "First viewed by", options: [["", "Anyone"], ["none", "Nobody yet"], ...adminOpts] },
    att: { label: "Attachment", options: [["", "Any"], ["1", "Has attachment"]] },
  };

  const inline = ["by", "box", "date"].filter((k) => !(k === "by" && !isSent) && !(k === "box" && !allMailIds));
  const extra = ["st", ...(isSent ? ["open"] : []), "view", "att"];
  const active = Object.keys(defs).filter((k) => filters[k] && (inline.includes(k) || extra.includes(k)));
  const extraSet = extra.filter((k) => filters[k]).length;
  const chipText = (k) => {
    const opt = defs[k].options.find(([v]) => String(v) === String(filters[k]));
    return `${defs[k].label}: ${opt ? opt[1] : filters[k]}`;
  };

  return (
    <>
      <div className="em-fbar">
        <span className="em-ficon" title="Filters">
          <Icon name="filter" size={18} />
        </span>
        {inline.map((k) => (
          <Select key={k} name={k} label={defs[k].label} value={filters[k]} options={defs[k].options} onChange={onChange} />
        ))}
        <button type="button" className={`em-morebtn${moreOpen ? " on" : ""}`} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          More filters
          {extraSet > 0 && <span className="em-morebtn-n">{extraSet}</span>}
        </button>
      </div>

      {moreOpen && (
        <div className="em-more">
          {extra.map((k) => (
            <label key={k}>
              {defs[k].label}
              <Select name={k} label={defs[k].label} value={filters[k]} options={defs[k].options} onChange={onChange} />
            </label>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div className="em-chips">
          {active.map((k) => (
            <span key={k} className="em-chip">
              {chipText(k)}
              <button type="button" aria-label={`Remove filter ${defs[k].label}`} onClick={() => onChange(k, "")}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="em-fclear" onClick={onClear}>
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
