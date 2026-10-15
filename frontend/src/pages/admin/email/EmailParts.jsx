import { READ_STATUS_HELP, extClass, firstName, fmtFull, fmtSize, hashColor, initials, trackingInfo } from "./emailUtils";

const PATHS = {
  inbox: (<><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5.5 5h13L21 13v6H3v-6z" /></>),
  sent: (<><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4z" /></>),
  spam: (<><path d="M12 3 3 20h18z" /><path d="M12 10v4M12 17h.01" /></>),
  all: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></>),
  back: (<path d="M19 12H5M12 19l-7-7 7-7" />),
  reply: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></>),
  clip: (<path d="m21 11-8.6 8.6a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15.5 7" />),
  open: (<><path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="m3 9 9 6 9-6" /></>),
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

// Mail that did not come from an admin in the dashboard: the Gmail "G".
export function GmailMark({ large = false, small = false, title = "Sent from the Gmail website" }) {
  return (
    <span className={`em-gm${large ? " lg" : ""}${small ? " sm" : ""}`} title={title} aria-hidden="true">
      G
    </span>
  );
}

// Status column, line 2: who opened the mail first in the dashboard. With nobody, "Read in
// Gmail" if someone on the team read it there (Gmail cannot say who), else "Not viewed".
export function FirstViewed({ firstViewed, readInGmail = false }) {
  if (!firstViewed && readInGmail) {
    return (
      <span className="em-m seen" title="Read in Gmail by someone on the team. Gmail does not say who.">
        <GmailMark small title="Read in Gmail" />
        Read in Gmail
      </span>
    );
  }
  if (!firstViewed) {
    return (
      <span className="em-m none">
        <Icon name="eye" size={14} />
        Not viewed
      </span>
    );
  }
  return (
    <span className="em-m seen" title={`First viewed by ${firstViewed.by.name}, ${fmtFull(firstViewed.at)}`}>
      <Icon name="eye" size={14} />
      {firstName(firstViewed.by.name)}
    </span>
  );
}

// Status column, line 1: the combined read status. Nothing at all when the mail was not tracked.
const STRONG = new Set(["replied", "downloaded", "clicked", "receipt", "opened"]);
export function TrackingBadge({ tracking }) {
  const info = trackingInfo(tracking);
  if (!info || info.kind === "na") return null;
  const short = {
    opened_apple: "Opened (Apple)",
    pending: "Not opened yet",
    automated: "Auto load only",
  };
  const n = info.kind === "opened" && tracking.openCount > 1 ? ` · ${tracking.openCount}×` : "";
  return (
    <span className={`em-m ${STRONG.has(info.kind) ? "open" : "none"}`} title={`${info.text}. ${info.detail}`}>
      <Icon name="open" size={14} />
      {(short[info.kind] || info.text) + n}
    </span>
  );
}

// "Send attachments as secure links" box. Own box, off by default, shown only when files are
// attached and the feature is on. The warning is always visible next to it, not in a tooltip.
export const SECURE_LINKS_WARNING =
  "Don't use for medical reports, prescriptions or ID documents \u2014 anyone with the link can download until it expires.";

export function SecureLinksToggle({ checked, onChange, days }) {
  return (
    <div className="em-securebox">
      <label className="em-trkopt">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Send attachments as secure links
        {days ? <small className="em-sub"> · expire after {days} day{days === 1 ? "" : "s"}</small> : null}
      </label>
      <small className="em-trkwarn em-securewarn">{SECURE_LINKS_WARNING}</small>
    </div>
  );
}

// "Request read receipt" box. Its own box, off by default, shown only while tracking is on.
export const RECEIPT_WARNING = "The recipient will see a prompt asking to send a receipt \u2014 they will know you asked.";

export function ReceiptToggle({ checked, onChange }) {
  return (
    <div className="em-receiptbox">
      <label className="em-trkopt" title="Most mail apps never send a receipt, and the recipient can always decline.">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Request read receipt
      </label>
      <small className="em-trkwarn">{RECEIPT_WARNING}</small>
    </div>
  );
}

// "Track opens" box of the compose and reply forms. Only rendered while open
// tracking is switched on; the server decides whether the mail really carries it.
export function TrackOpensToggle({ checked, onChange, disclosure, caveat = "" }) {
  return (
    <>
      <label className="em-trkopt" title="Adds a tiny image so you can see whether the mail was opened. Not exact: some mail apps block images or load them automatically.">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Track opens
        {checked && disclosure ? <small className="em-sub"> · a short notice is added to the footer</small> : null}
      </label>
      {checked && caveat ? <small className="em-trkwarn">{caveat}</small> : null}
    </>
  );
}

// Link as shown in the list of tracked links: host and path, no query string (it can hold personal data).
function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    const text = `${u.host}${path}${u.search ? "?…" : ""}`;
    return text.length > 70 ? `${text.slice(0, 69)}…` : text;
  } catch {
    return String(url).slice(0, 70);
  }
}

// Read status on a thread message: the combined status, then every signal behind it.
export function TrackingNote({ tracking }) {
  const info = trackingInfo(tracking);
  if (!info) return null;
  return (
    <div className="em-trkbox" aria-label="Read status">
      <span className="em-views-h">Read status</span>
      <span className={`em-tag em-trk em-trk-${info.kind}`}>{info.text}</span>
      <small className="em-sub">{info.detail}</small>
      {tracking.files?.length > 0 && (
        <ul className="em-trk-rows em-trk-links" aria-label="Secure download links">
          {tracking.files.map((f) => (
            <li key={f.index}>
              <b>{f.count > 0 ? `${f.count}× downloaded` : "Not downloaded"}</b>
              <span title={f.filename}>{f.filename}</span>
              <small className="em-sub">
                {f.expired ? " · link expired " : " · link valid until "}
                {fmtFull(f.expiresAt)}
                {f.last ? ` · last download ${fmtFull(f.last)}` : ""}
              </small>
            </li>
          ))}
        </ul>
      )}
      {tracking.links?.length > 0 && (
        <ul className="em-trk-rows em-trk-links" aria-label="Tracked links">
          {tracking.links.map((l) => (
            <li key={l.index}>
              <b title={l.url}>{l.count > 0 ? `${l.count}×` : "Not clicked"}</b>
              <span title={l.url}>{shortUrl(l.url)}</span>
              {l.last ? <small className="em-sub"> · last {fmtFull(l.last)}</small> : null}
            </li>
          ))}
        </ul>
      )}
      <details className="em-trkhelp">
        <summary>What do these statuses mean?</summary>
        <ul>
          {READ_STATUS_HELP.map((h) => (
            <li key={h.key}>
              <b>{h.label}</b> — {h.text}
            </li>
          ))}
        </ul>
        <p className="em-sub">The strongest signal wins. None of them proves a person read the mail.</p>
      </details>
      {info.rows.length > 0 && (
        <ul className="em-trk-rows">
          {info.rows.map((r) => (
            <li key={r.label}>
              <b>{r.label}</b> <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
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
