import { extClass, firstName, fmtFull, fmtSize, fmtTime, hashColor, initials, trackingInfo } from "./emailUtils";

const PATHS = {
  inbox: (<><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5.5 5h13L21 13v6H3v-6z" /></>),
  sent: (<><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4z" /></>),
  spam: (<><path d="M12 3 3 20h18z" /><path d="M12 10v4M12 17h.01" /></>),
  all: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></>),
  back: (<path d="M19 12H5M12 19l-7-7 7-7" />),
  reply: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></>),
  clip: (<path d="m21 11-8.6 8.6a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15.5 7" />),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  filter: (<path d="M3 5h18M6 12h12M10 19h4" />),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  compose: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  mailbox: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  expand: (<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
  refresh: (<><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>),
};

export function Icon({ name, size = 20 }) {
  return (
    <svg className="em-ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// An admin avatar is coloured per person; mail from outside is neutral grey.
export function Avatar({ name, colorKey, large = false, external = false }) {
  const label = external
    ? initials(String(name || "?").split(" ").slice(0, 2).join(" "))
    : initials(name);
  return (
    <span
      className={`em-av${large ? " lg" : ""}`}
      style={{ background: external ? "#6b7f80" : hashColor(colorKey || name) }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

// Which company ID a mail came to / went from.
export function MailboxChip({ mailbox, full = false }) {
  if (!mailbox) return null;
  return (
    <span className="em-mbox" title={mailbox.address} style={{ color: mailbox.color, background: `${mailbox.color}1f` }}>
      <Icon name="mailbox" size={14} />
      {mailbox.displayName}
      {full && <small>{mailbox.address}</small>}
    </span>
  );
}

// Who opened it first (list rows).
export function FirstViewed({ firstViewed }) {
  if (!firstViewed) return <span className="em-tag em-tag-unseen">Not viewed by anyone</span>;
  return (
    <span className="em-tag em-tag-view" title={`First viewed by ${firstViewed.by.name}, ${fmtFull(firstViewed.at)}`}>
      <Icon name="eye" size={15} />
      {firstName(firstViewed.by.name)}
    </span>
  );
}

// "Track opens" box of the compose and reply forms. Only rendered while open
// tracking is switched on; the server decides whether the mail really carries it.
export function TrackOpensToggle({ checked, onChange, disclosure }) {
  return (
    <label className="em-trkopt" title="Adds a tiny image so you can see whether the mail was opened. Not exact: some mail apps block images or load them automatically.">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Track opens
      {checked && disclosure ? <small className="em-sub"> · a short notice is added to the footer</small> : null}
    </label>
  );
}

// Open tracking on a Sent row: "Opened · 3:42 pm · ×2", "Not opened yet" or "Tracking unavailable".
export function TrackingBadge({ tracking }) {
  const info = trackingInfo(tracking);
  if (!info) return null;
  const extra =
    info.kind === "opened"
      ? ` · ${tracking.firstOpenedAt ? fmtTime(tracking.firstOpenedAt) : ""}${tracking.openCount > 1 ? ` · ×${tracking.openCount}` : ""}`
      : "";
  return (
    <span className={`em-tag em-trk em-trk-${info.kind}`} title={info.detail}>
      {info.text}
      {extra}
    </span>
  );
}

// Open tracking on the mail page: status, first/last open, count, and the caveat.
export function TrackingNote({ tracking }) {
  const info = trackingInfo(tracking);
  if (!info) return null;
  return (
    <div className="em-trkbox" aria-label="Open tracking">
      <span className="em-views-h">Open tracking</span>
      <span className={`em-tag em-trk em-trk-${info.kind}`}>{info.text}</span>
      {info.kind === "opened" && (
        <span className="em-trk-facts">
          First opened <b>{fmtFull(tracking.firstOpenedAt)}</b>
          {tracking.openCount > 1 && tracking.lastOpenedAt ? <> · last <b>{fmtFull(tracking.lastOpenedAt)}</b></> : null} · {tracking.openCount} open
          {tracking.openCount === 1 ? "" : "s"}
        </span>
      )}
      <small className="em-sub">
        {info.kind === "opened" && tracking.multiRecipient ? "We cannot tell which recipient opened it. " : ""}
        {info.kind === "opened" ? "Based on the mail app loading an image; not proof the mail was read." : info.detail}
      </small>
    </div>
  );
}

// Received/sent files (clickable → download) or files about to be sent (removable).
export function AttachmentList({ items, onOpen, onRemove }) {
  if (!items?.length) return null;
  return (
    <div className="em-atts">
      {items.map((f, i) => {
        const name = f.filename || f.name;
        return (
          <div className="em-att" key={f.id || `${name}-${i}`}>
            <span className={`em-ext ${extClass(name)}`}>{name.split(".").pop().toUpperCase().slice(0, 4)}</span>
            {onOpen ? (
              <button type="button" className="em-att-main" onClick={() => onOpen(f)} title={`Download ${name}`}>
                <span className="em-att-nm">{name}</span>
                <span className="em-att-sz">{fmtSize(f.size)}</span>
              </button>
            ) : (
              <span className="em-att-main">
                <span className="em-att-nm">{name}</span>
                <span className="em-att-sz">{fmtSize(f.size)}</span>
              </span>
            )}
            {onRemove && (
              <button type="button" className="em-att-rm" onClick={() => onRemove(i)} aria-label={`Remove ${name}`}>
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
