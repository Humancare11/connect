import { Icon } from "./EmailParts";

// The filter bar for Received and Sent. Every value lives in the URL query, so
// going back from a mail keeps the filters, and a filtered view can be shared.
function Select({ name, label, value, options, onChange }) {
  return (
    <label className="em-fsel">
      <select aria-label={label} value={value} className={value ? "set" : ""} onChange={(e) => onChange(name, e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function EmailFilters({ folder, inMailboxView, filters, mailboxes, admins, onChange, onClear }) {
  const adminOpts = admins.map((a) => [a.id, a.name]);
  const isSent = folder === "sent";

  return (
    <div className="em-fbar">
      <span className="em-ficon" title="Filters">
        <Icon name="filter" />
      </span>

      {isSent && <Select name="by" label="Sent by" value={filters.by} onChange={onChange} options={[["", "Sent by: all admins"], ...adminOpts]} />}

      {!inMailboxView && (
        <Select
          name="box"
          label="Mail ID"
          value={filters.box}
          onChange={onChange}
          options={[["", "Mail ID: all"], ...mailboxes.map((m) => [m.id, `${m.displayName} — ${m.address}`])]}
        />
      )}

      <Select
        name="st"
        label={isSent ? "Status" : "Reply status"}
        value={filters.st}
        onChange={onChange}
        options={
          isSent
            ? [["", "Status: all"], ["noreply", "Sent (no reply yet)"], ["replied", "Replied"], ["failed", "Failed"]]
            : [["", "Reply: all"], ["noreply", "Reply pending"], ["replied", "Already replied"]]
        }
      />

      <Select
        name="view"
        label="First viewed by"
        value={filters.view}
        onChange={onChange}
        options={[["", "First viewed by: anyone"], ["none", "Not viewed by anyone"], ...adminOpts.map(([id, name]) => [id, `First viewed: ${name}`])]}
      />

      <Select
        name="date"
        label="Date"
        value={filters.date}
        onChange={onChange}
        options={[["", "Date: any time"], ["today", "Today"], ["7d", "Last 7 days"], ["month", "This month"]]}
      />

      <Select name="att" label="Attachment" value={filters.att} onChange={onChange} options={[["", "Attachment: any"], ["1", "With attachment only"]]} />

      {Object.values(filters).some(Boolean) && (
        <button type="button" className="em-fclear" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
