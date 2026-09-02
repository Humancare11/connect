import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import partnerApi from "../../api/partnerApi";
import {
  STATUS_META,
  URGENCY_META,
  SERVICE_META,
  statusLabel,
  formatMoney,
} from "./caseConstants";
import "./partner.css";

const STATUS_OPTIONS = ["submitted", "assigned", "in-progress", "completed", "invoiced", "cancelled"];

export default function AllCases() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const casesQ = useQuery({
    queryKey: ["partner", "cases", { search, status }],
    queryFn: () =>
      partnerApi.listCases({
        ...(search ? { q: search } : {}),
        ...(status !== "all" ? { status } : {}),
      }),
    keepPreviousData: true,
  });

  const rows = casesQ.data || [];

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">All Cases</h1>
          <p className="pt-page-sub">Every care case your company has submitted</p>
        </div>
        <Link to="/partner-dashboard/submit-care" className="pt-btn">
          + Submit Care
        </Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          className="pt-field"
          style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
          placeholder="Search by case number or patient"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ minWidth: 150, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th>Case no.</th>
              <th>Patient</th>
              <th>Service</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {casesQ.isLoading && (
              <tr>
                <td colSpan={7} className="pt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!casesQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="pt-empty">
                  No cases match your filters.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const m = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };
              return (
                <tr
                  key={c._id}
                  className="pt-row-link"
                  onClick={() => navigate(`/partner-dashboard/cases/${c._id}`)}
                >
                  <td style={{ fontWeight: 600, color: "#0369a1" }}>{c.caseNumber}</td>
                  <td>{c.patient?.name}</td>
                  <td style={{ color: "#64748b" }}>
                    {SERVICE_META[c.serviceType]?.label || c.serviceType}
                  </td>
                  <td>
                    <span
                      className="pt-dot"
                      style={{ color: URGENCY_META[c.urgency]?.color || "#64748b" }}
                    >
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
    </div>
  );
}
