import { mailboxLabel } from "./marketingUtils";

const MODES = [
  ["emails", "Email addresses"],
  ["lines", "Name + email"],
  ["csv", "CSV upload"],
];
const MAX_FILE_BYTES = 2_000_000;

const InfoIcon = () => (
  <svg className="mk-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h0M11 12h1v5h1" /></svg>
);

// Step 1: From, campaign name, and the recipients in three ways. The counts come from the server (the same rules
// that are applied when the list is saved), so what is shown here is what will happen.
export default function RecipientsStep({
  mailboxes, mailboxId, setMailboxId, name, setName, mode, setMode, raw, setRaw, csvName, setCsvName,
  parse, parseError, fallbackName, onFileError,
}) {
  const onCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return onFileError("That file is too large (limit 2 MB).");
    const reader = new FileReader();
    reader.onload = () => {
      setRaw((r) => ({ ...r, csv: String(reader.result || "") }));
      setCsvName(file.name);
    };
    reader.readAsText(file);
  };

  const list = parse?.list || [];
  return (
    <>
      <div className="mk-grid2">
        <div className="mk-field">
          <label htmlFor="mk-from">From</label>
          <select className="mk-sel" id="mk-from" value={mailboxId} onChange={(e) => setMailboxId(e.target.value)}>
            {!mailboxes.length && <option value="">No Mail ID is allowed for marketing</option>}
            {mailboxes.map((m) => <option key={m.id} value={m.id}>{mailboxLabel(m)}</option>)}
          </select>
          <small>Only Mail IDs approved for marketing. support@ is left out to protect its reputation.</small>
        </div>
        <div className="mk-field">
          <label htmlFor="mk-name">Campaign name</label>
          <input className="mk-inp" id="mk-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="For example: Corporate wellness offer" />
          <small>For your team only. Recipients never see it.</small>
        </div>
      </div>

      {!mailboxes.length && (
        <div className="mk-callout warn">
          <InfoIcon />
          <div>No Mail ID is switched on for marketing yet. A Super Admin can turn on “Allowed for marketing” for a Mail ID in Email → Mail IDs.</div>
        </div>
      )}

      <div className="mk-field">
        <span className="mk-flabel">Recipients</span>
        <div className="mk-tabs" role="tablist">
          {MODES.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? "on" : ""} onClick={() => setMode(key)}>{label}</button>
          ))}
        </div>

        {mode === "emails" && (
          <>
            <textarea className="mk-ta" spellCheck="false" aria-label="Email addresses" placeholder="a@example.com, b@example.com, c@example.com" value={raw.emails} onChange={(e) => setRaw((r) => ({ ...r, emails: e.target.value }))} />
            <small>Separate with commas, semicolons or new lines. There are no names here, so <span className="mk-phchip">{"{{name}}"}</span> becomes "{fallbackName || "there"}".</small>
          </>
        )}
        {mode === "lines" && (
          <>
            <textarea className="mk-ta" spellCheck="false" aria-label="Name and email, one person per line" placeholder={"Anil Sharma, anil@example.com\nPriya Mehta, Acme Travels, priya@example.com"} value={raw.lines} onChange={(e) => setRaw((r) => ({ ...r, lines: e.target.value }))} />
            <small>One person per line: <b>Name, email</b> or <b>Name, Company, email</b></small>
          </>
        )}
        {mode === "csv" && (
          <div className="mk-drop">
            <input type="file" accept=".csv,text/csv" aria-label="Upload CSV" onChange={onCsv} />
            <svg className="mk-ico" viewBox="0 0 24 24" style={{ width: 26, height: 26 }} aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            <div><b>{csvName || "Drop a CSV file here or click to choose"}</b></div>
            <small>Columns: <b>name</b>, <b>company</b> (optional), <b>email</b>. In Excel, use "Save as CSV" and upload the file.</small>
          </div>
        )}
      </div>

      {parseError && <div className="mk-callout bad" role="alert"><InfoIcon /><div>{parseError}</div></div>}

      <div className="mk-parse">
        <div className="mk-pstats">
          <div className="good"><b>{parse?.willReceive ?? 0}</b><span>Will receive</span></div>
          <div className={parse?.invalidCount ? "bad" : ""}><b>{parse?.invalidCount ?? 0}</b><span>Invalid</span></div>
          <div className={parse?.duplicates ? "warnc" : ""}><b>{parse?.duplicates ?? 0}</b><span>Duplicates removed</span></div>
          <div className={parse?.suppressedCount ? "warnc" : ""}><b>{parse?.suppressedCount ?? 0}</b><span>Unsubscribed, skipped</span></div>
        </div>
        {list.length ? (
          <div className="mk-plist">
            <table>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.email}>
                    <td style={{ color: "var(--mk-faint)", width: 36 }}>{i + 1}</td>
                    <td>{r.name ? r.name : <span className="mk-miss">No name → "{fallbackName || "there"}"</span>}</td>
                    <td style={{ color: "var(--mk-muted)" }}>{r.company}</td>
                    <td style={{ color: "var(--mk-muted)" }}>{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 16, color: "var(--mk-muted)" }}>Add recipients above. They will be listed here.</div>
        )}
        {parse?.willReceive > list.length && <div style={{ padding: "8px 14px", color: "var(--mk-muted)", fontSize: 12.5 }}>Showing the first {list.length} of {parse.willReceive}.</div>}
        {parse?.invalidCount > 0 && (
          <div className="mk-badlist">
            These addresses are invalid and will not be sent: {parse.invalid.map((b, i) => <code key={`${b}-${i}`}>{b}</code>).reduce((a, c) => [a, " ", c])}
            {parse.invalidCount > parse.invalid.length && ` and ${parse.invalidCount - parse.invalid.length} more`}
          </div>
        )}
        {parse?.suppressedCount > 0 && (
          <div className="mk-badlist warn">
            These people unsubscribed earlier (or their address bounced) and will not be sent: {parse.suppressed.map((b) => <code key={b}>{b}</code>).reduce((a, c) => [a, " ", c])}
            {parse.suppressedCount > parse.suppressed.length && ` and ${parse.suppressedCount - parse.suppressed.length} more`}
          </div>
        )}
      </div>

      <div className="mk-callout info">
        <InfoIcon />
        <div><b>{parse?.willReceive ?? 0} separate emails will be sent.</b> Each person sees only their own email, never anyone else’s address.</div>
      </div>
    </>
  );
}
