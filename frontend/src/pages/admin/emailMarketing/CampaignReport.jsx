import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import { MK_BASE, errorMessage, filterPeople, formatDateTime, formatWhen, rate, reportFilters, statusLabel } from "./marketingUtils";

// The campaign report: totals, then every recipient with a status and last activity, with filters.
export default function CampaignReport({ campaign }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["marketing", "report", campaign.id], queryFn: () => marketingApi.report(campaign.id), refetchInterval: 30_000 });
  const retry = useMutation({
    mutationFn: () => marketingApi.retryUncertain(campaign.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing"] });
    },
  });

  const c = q.data?.counts;
  const people = q.data?.people || [];
  const chips = reportFilters(people);
  const rows = filterPeople(people, filter);
  // Delivered comes from SES delivery events; until they arrive the sent count is the honest base for the rates.
  const base = c ? c.delivered || c.sent : 0;
  const by = campaign.sentBy || campaign.createdBy || "—";
  const when = campaign.startedAt ? formatDateTime(campaign.startedAt) : "";

  return (
    <section className="mk-card">
      <div className="mk-chead">
        <div>
          <h2>{campaign.name}</h2>
          <p>{campaign.fromAddress} · sent by {by}{when ? ` · ${when}` : ""}{campaign.status === "stopped" ? " · stopped" : ""}</p>
        </div>
        <div className="mk-sp" />
        <button type="button" className="mk-btn mk-btn-g" onClick={() => navigate(MK_BASE)}>All campaigns</button>
      </div>

      {q.isLoading && <div className="mk-empty">Loading…</div>}
      {q.isError && <div className="mk-err" role="alert">{errorMessage(q.error, "Could not load the report.")}</div>}

      {c && (
        <>
          <div className="mk-tiles">
            <div className="mk-tile"><span>Recipients</span><b>{c.total}</b></div>
            <div className="mk-tile"><span>Delivered</span><b>{c.delivered}</b></div>
            <div className="mk-tile"><span>Opened</span><b>{c.opened}</b><em>{rate(c.opened, base)}</em></div>
            <div className="mk-tile"><span>Clicked</span><b>{c.clicked}</b><em>{rate(c.clicked, base)}</em></div>
            <div className="mk-tile"><span>Replied</span><b>{c.replied}</b></div>
            <div className="mk-tile"><span>Bounced / Unsub</span><b>{c.bounced} / {c.unsubscribed}</b></div>
          </div>

          {c.uncertain > 0 && (
            <div className="mk-callout warn" style={{ margin: "12px 20px 0" }} role="status">
              <div>
                <b>{c.uncertain} {c.uncertain === 1 ? "email was" : "emails were"} interrupted</b> while being handed to Amazon SES, so they may or may not have been delivered. They are never sent again automatically.
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => retry.mutate()} disabled={retry.isPending}>{retry.isPending ? "Retrying…" : "Retry uncertain"}</button>
                  {retry.isError && <span style={{ marginLeft: 8 }}>{errorMessage(retry.error)}</span>}
                </div>
              </div>
            </div>
          )}
          {c.appleOnly > 0 && (
            <div className="mk-hint" style={{ padding: "10px 20px 0" }}>
              {c.appleOnly} {c.appleOnly === 1 ? "person" : "people"} on Apple Mail loaded the email automatically (Mail Privacy Protection). That is not counted as an open.
            </div>
          )}

          <div className="mk-fchips" role="group" aria-label="Filter recipients">
            {chips.map((f) => (
              <button key={f.key} type="button" className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>{f.label} {f.count}</button>
            ))}
          </div>
          <div className="mk-tbl-wrap">
            <table className="mk-tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Last activity</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name || "—"}{p.company ? <span className="mk-pct">{p.company}</span> : null}</td>
                    <td style={{ color: "var(--mk-muted)" }}>{p.email || <i>removed after the retention period</i>}</td>
                    <td><span className={`mk-st ${p.status}`}>{statusLabel(p.status)}</span></td>
                    <td style={{ color: "var(--mk-muted)", fontSize: "12.5px", whiteSpace: "nowrap" }}>{formatWhen(p.when)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} style={{ color: "var(--mk-muted)", padding: "24px 16px" }}>No one matches this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mk-how">
            <div><b>Replied</b>The reply arrived in Gmail and also shows in Received on the Email page.</div>
            <div><b>Bounced</b>The address is wrong or closed. It is skipped in future campaigns.</div>
            <div><b>Unsubscribed</b>This person opted out and will never get marketing email again.</div>
          </div>
        </>
      )}
    </section>
  );
}
