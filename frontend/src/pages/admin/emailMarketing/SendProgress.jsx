import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import { MK_BASE, errorMessage, estimateText, holdText } from "./marketingUtils";

// Live progress of a running campaign (sent, failed, remaining). Sending runs on the server, so closing this
// page changes nothing; it simply shows the same numbers again when reopened.
export default function SendProgress({ campaign, onChanged }) {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = useQuery({
    queryKey: ["marketing", "progress", campaign.id],
    queryFn: () => marketingApi.progress(campaign.id),
    refetchInterval: 2000,
  });
  const p = q.data?.progress;
  const total = p?.total || 0;
  const done = p ? p.sent + p.failed + p.skipped : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const finished = p && p.status !== "sending";

  // When the server says it is over, reload the campaign: this view then turns into the report.
  useEffect(() => {
    if (finished) onChanged();
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  async function stop() {
    setBusy(true);
    setError("");
    try {
      await marketingApi.stop(campaign.id);
      setAsking(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const hold = holdText(p?.holdReason);
  return (
    <section className="mk-card" aria-live="polite">
      <div className="mk-chead">
        <div>
          <h2>{campaign.name}</h2>
          <p>{campaign.fromAddress}</p>
        </div>
      </div>
      <div className="mk-body">
        <div className="mk-prog">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 16 }}>Sending emails…</b>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pct}%</span>
          </div>
          <div className="mk-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
          <div className="mk-pnums">
            <span>Sent: <b>{p?.sent ?? 0}</b></span>
            <span>Failed: <b>{p?.failed ?? 0}</b></span>
            {p?.skipped > 0 && <span>Skipped: <b>{p.skipped}</b></span>}
            <span>Remaining: <b>{p?.remaining ?? 0}</b></span>
          </div>
          {hold && <div className="mk-callout warn" role="status"><div>{hold}</div></div>}
          {q.data?.estimate?.days > 1 && <small className="mk-hint">{estimateText(q.data.estimate)}</small>}
          <div className="mk-callout info">
            <svg className="mk-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h0M11 12h1v5h1" /></svg>
            <div>You can close this page. Sending continues on the server.</div>
          </div>
          {q.isError && <div className="mk-callout bad" role="alert"><div>{errorMessage(q.error, "Could not load the progress.")}</div></div>}
          {error && <div className="mk-callout bad" role="alert"><div>{error}</div></div>}
        </div>

        {asking && (
          <div className="mk-callout warn" role="alertdialog" aria-label="Stop sending?">
            <div>
              <b>Stop sending?</b> People who have not been sent to yet will be skipped. Emails already handed to Amazon SES cannot be recalled.
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="mk-btn mk-btn-d mk-btn-s" onClick={stop} disabled={busy}>{busy ? "Stopping…" : "Yes, stop sending"}</button>
                <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => setAsking(false)} disabled={busy}>Keep sending</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mk-foot">
        <button type="button" className="mk-btn mk-btn-g" onClick={() => navigate(MK_BASE)}>Back to campaigns</button>
        {!asking && <button type="button" className="mk-btn mk-btn-d" onClick={() => setAsking(true)}>Stop sending</button>}
      </div>
    </section>
  );
}
