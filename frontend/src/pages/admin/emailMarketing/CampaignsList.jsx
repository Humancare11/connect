import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import AccessPanel from "./AccessPanel";
import { MK_BASE, avatarColor, campaignStatusLabel, errorMessage, formatDateTime, initials, rate } from "./marketingUtils";

function StatusCell({ c }) {
  const counts = c.counts || {};
  const done = (counts.sent || 0) + (counts.failed || 0) + (counts.uncertain || 0) + (counts.skipped || 0);
  return (
    <>
      <span className={`mk-st ${c.status}`}>{campaignStatusLabel(c.status)}</span>
      {c.status === "sending" && counts.total > 0 && (
        <div className="mk-minibar" aria-hidden="true"><i style={{ width: `${Math.round((done / counts.total) * 100)}%` }} /></div>
      )}
    </>
  );
}

// Campaigns: name, From, sent by, recipients, delivered, opened, clicked, status, date.
export default function CampaignsList({ superAdmin }) {
  const navigate = useNavigate();
  const [showAccess, setShowAccess] = useState(false);
  const q = useQuery({ queryKey: ["marketing", "campaigns"], queryFn: marketingApi.list, refetchInterval: 15_000 });
  const campaigns = q.data?.campaigns || [];

  return (
    <section className="mk-card" aria-live="polite">
      <div className="mk-chead">
        <div>
          <h1>Campaigns</h1>
          <p>
            Send designed HTML emails to companies, patients, doctors or anyone, with each person’s name filled in. Everyone gets their own
            email, and opens and clicks are tracked for each one.
          </p>
        </div>
        <div className="mk-sp" />
        {superAdmin && (
          <button type="button" className="mk-btn mk-btn-g" onClick={() => setShowAccess((v) => !v)} aria-expanded={showAccess}>
            Who can use this page
          </button>
        )}
        <button type="button" className="mk-btn mk-btn-p" onClick={() => navigate(`${MK_BASE}/new`)}>
          <svg className="mk-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          New campaign
        </button>
      </div>

      {superAdmin && showAccess && <AccessPanel />}

      {q.isLoading && <div className="mk-empty">Loading…</div>}
      {q.isError && <div className="mk-err" role="alert">{errorMessage(q.error, "Could not load the campaigns.")}</div>}
      {q.isSuccess && !campaigns.length && <div className="mk-empty">No campaigns yet. Press “New campaign” to send the first one.</div>}

      {campaigns.length > 0 && (
        <div className="mk-tbl-wrap">
          <table className="mk-tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Sent by</th>
                <th className="num">Recipients</th>
                <th className="num">Delivered</th>
                <th className="num">Opened</th>
                <th className="num">Clicked</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const counts = c.counts || {};
                const live = c.status !== "draft";
                const by = c.sentBy || c.createdBy || "—";
                // Delivered comes from SES delivery events; until they arrive the sent count is the honest base.
                const base = counts.delivered || counts.sent;
                return (
                  <tr key={c.id} className="mk-click" onClick={() => navigate(`${MK_BASE}/campaign/${c.id}`)}>
                    <td className="mk-cname">
                      <b>{c.name}</b>
                      <small>{c.fromAddress}</small>
                    </td>
                    <td>
                      <span className="mk-byline">
                        <span className="mk-av" style={{ background: avatarColor(by) }}>{initials(by)}</span>
                        {by}
                      </span>
                    </td>
                    <td className="num">{counts.total ?? 0}</td>
                    <td className="num">{live ? counts.delivered : "–"}</td>
                    <td className="num">{live ? <>{counts.opened}<span className="mk-pct">{rate(counts.opened, base)}</span></> : "–"}</td>
                    <td className="num">{live ? <>{counts.clicked}<span className="mk-pct">{rate(counts.clicked, base)}</span></> : "–"}</td>
                    <td><StatusCell c={c} /></td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--mk-muted)", fontSize: "12.5px" }}>
                      {c.startedAt ? formatDateTime(c.startedAt) : `Draft · edited ${formatDateTime(c.updatedAt)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mk-how">
        <div><b>One email per person</b>Enter 50 addresses and 50 separate emails go out. Nobody sees anyone else’s address.</div>
        <div><b>Names filled in</b><span className="mk-phchip">{"{{name}}"}</span> is replaced with each person’s own name.</div>
        <div><b>Replies on the Email page</b>When someone replies, it arrives in that Mail ID’s Received folder on the Email page.</div>
      </div>
    </section>
  );
}
