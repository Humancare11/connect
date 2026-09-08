import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import adminPartnerApi from "../../api/adminPartnerApi";
import {
  STATUS_META,
  URGENCY_META,
  SERVICE_META,
  statusLabel,
  formatMoney,
} from "../partner/caseConstants";
import "../partner/partner.css";

const STATUS_OPTIONS = ["submitted", "assigned", "in-progress", "completed", "invoiced", "cancelled"];
const URGENCY_OPTIONS = ["routine", "urgent", "emergency"];

export default function AdminPartnerCases() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [page, setPage] = useState(1);

  const statsQ = useQuery({ queryKey: ["admin", "partner-cases", "stats"], queryFn: adminPartnerApi.stats });
  const listQ = useQuery({
    queryKey: ["admin", "partner-cases", { q, status, urgency, page }],
    queryFn: () =>
      adminPartnerApi.listCases({
        ...(q ? { q } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(urgency !== "all" ? { urgency } : {}),
        page,
        limit: 25,
      }),
    keepPreviousData: true,
  });

  const data = listQ.data || { items: [], total: 0, pages: 1, page: 1 };
  const stats = statsQ.data || {};

  return (
    <div className="pt-page" style={{ maxWidth: "100%" }}>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">Partners Cases</h1>
          <p className="pt-page-sub">Care cases submitted by Partner Companies</p>
        </div>
      </div>

      <div className="pt-stat-grid">
        {STATUS_OPTIONS.map((s) => (
          <div className="pt-stat" key={s}>
            <p className="pt-stat-label">{statusLabel(s)}</p>
            <p className="pt-stat-value">{stats[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
          placeholder="Search by case number or patient"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          style={{ padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={urgency}
          onChange={(e) => {
            setPage(1);
            setUrgency(e.target.value);
          }}
          style={{ padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
        >
          <option value="all">All urgencies</option>
          {URGENCY_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {URGENCY_META[u].label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th>Case no.</th>
              <th>Partner</th>
              <th>Patient</th>
              <th>Service</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading && (
              <tr>
                <td colSpan={8} className="pt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!listQ.isLoading && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="pt-empty">
                  No partner cases found.
                </td>
              </tr>
            )}
            {data.items.map((c) => {
              const m = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };
              return (
                <tr
                  key={c._id}
                  className="pt-row-link"
                  onClick={() => navigate(`/admin-dashboard/partner-cases/${c._id}`)}
                >
                  <td style={{ fontWeight: 600, color: "#0369a1" }}>{c.caseNumber}</td>
                  <td>{c.partner?.companyName || "—"}</td>
                  <td>{c.patient?.name}</td>
                  <td style={{ color: "#64748b" }}>
                    {SERVICE_META[c.serviceType]?.label || c.serviceType}
                  </td>
                  <td>
                    <span className="pt-dot" style={{ color: URGENCY_META[c.urgency]?.color }}>
                      {URGENCY_META[c.urgency]?.label || c.urgency}
                    </span>
                  </td>
                  <td>
                    <span className="pt-badge" style={{ background: m.bg, color: m.text }}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td style={{ color: "#64748b" }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td>{formatMoney(c.amountCents, c.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <button
            className="pt-btn pt-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Page {data.page} of {data.pages}
          </span>
          <button
            className="pt-btn pt-btn-ghost"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
