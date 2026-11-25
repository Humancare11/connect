// Step 3: what each recipient will see (previous / next person, desktop or mobile width), a test mail to an
// address the admin types (it uses the first recipient's values), and the checks. The preview is shown in a
// sandboxed iframe with every permission off, so nothing in the design can run.
export default function PreviewStep({ pv, loading, error, pvIdx, setPvIdx, device, setDevice, from, testTo, setTestTo, onTest, testBusy, testMsg }) {
  const total = pv?.total || 0;
  const step = (d) => total && setPvIdx((i) => (i + d + total) % total);

  return (
    <div className="mk-pv">
      <div style={{ minWidth: 0 }}>
        <div className="mk-pvbar">
          <div className="mk-who-nav">
            <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => step(-1)} aria-label="Previous recipient" disabled={total < 2}>‹</button>
            <span>
              Preview for <b>{pv?.recipient?.name || "there"}</b> · {pv?.recipient?.email || ""}{" "}
              <span style={{ color: "var(--mk-faint)" }}>({total ? pvIdx + 1 : 0}/{total})</span>
            </span>
            <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => step(1)} aria-label="Next recipient" disabled={total < 2}>›</button>
          </div>
          <span className="mk-sp" />
          <div className="mk-tabs">
            <button type="button" className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>Desktop</button>
            <button type="button" className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>Mobile</button>
          </div>
        </div>
        {error && <div className="mk-callout bad" role="alert">{error}</div>}
        <div className={`mk-inbox ${device}`}>
          <div className="mk-inbox-h">
            <b>{pv?.subject || (loading ? "Loading…" : "")}</b>
            {from} · to {pv?.recipient?.email || ""}
          </div>
          <iframe title="Mail preview" sandbox="" srcDoc={pv?.html || ""} />
        </div>
      </div>

      <aside className="mk-side-box">
        <h3>Send yourself a test</h3>
        <small className="mk-hint">The test uses the first recipient’s name, so you can check that the placeholder works.</small>
        <input className="mk-inp" type="email" placeholder="you@humancareconnect.co" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Test email address" />
        <button type="button" className="mk-btn mk-btn-g" onClick={onTest} disabled={testBusy || !testTo.trim()}>{testBusy ? "Sending…" : "Send test mail"}</button>
        {testMsg && <small className="mk-hint" role="status">{testMsg}</small>}
        <h3 style={{ marginTop: 8 }}>Checks</h3>
        <div className="mk-checks">
          {(pv?.checks || []).map((c) => (
            <div key={c.key}><span className={c.ok ? "mk-ok-i" : "mk-warn-i"}>{c.ok ? "✓" : "!"}</span>{c.text}
              {c.link && <> · <a href={c.link.href} target="_blank" rel="noopener noreferrer">{c.link.text}</a></>}</div>
          ))}
        </div>
      </aside>
    </div>
  );
}
