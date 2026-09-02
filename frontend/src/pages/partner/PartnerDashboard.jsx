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

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { bg: "#e2e8f0", text: "#334155" };
  return (
    <span className="pt-badge" style={{ background: m.bg, color: m.text }}>
      {statusLabel(status)}
    </span>
  );
}

export default function PartnerDashboard() {
  const navigate = useNavigate();

  const statsQ = useQuery({ queryKey: ["partner", "dashboard"], queryFn: partnerApi.dashboard });
  const casesQ = useQuery({
    queryKey: ["partner", "cases", { recent: true }],
    queryFn: () => partnerApi.listCases(),
  });

  const stats = statsQ.data || { total: 0, active: 0, completed: 0, billedCents: 0 };
  const recent = (casesQ.data || []).slice(0, 5);

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">Dashboard</h1>
          <p className="pt-page-sub">Overview of your submitted care cases</p>
        </div>
        <Link to="/partner-dashboard/submit-care" className="pt-btn">
          + Submit Care
        </Link>
      </div>

      <div className="pt-stat-grid">
        <div className="pt-stat">
          <p className="pt-stat-label">Total cases</p>
          <p className="pt-stat-value">{stats.total}</p>
        </div>
        <div className="pt-stat">
          <p className="pt-stat-label">Active cases</p>
          <p className="pt-stat-value">{stats.active}</p>
        </div>
        <div className="pt-stat">
          <p className="pt-stat-label">Completed</p>
          <p className="pt-stat-value">{stats.completed}</p>
        </div>
        <div className="pt-stat">
          <p className="pt-stat-label">Total billed</p>
          <p className="pt-stat-value">{formatMoney(stats.billedCents)}</p>
        </div>
      </div>

      <div className="pt-page-head" style={{ marginBottom: 12 }}>
        <h2 className="pt-page-title" style={{ fontSize: 15 }}>
          Recent cases
        </h2>
        <Link to="/partner-dashboard/cases" style={{ fontSize: 13, color: "#0369a1" }}>
          View all
        </Link>
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
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {casesQ.isLoading && (
              <tr>
                <td colSpan={6} className="pt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!casesQ.isLoading && recent.length === 0 && (
              <tr>
                <td colSpan={6} className="pt-empty">
                  No cases yet. Submit your first case to get started.
                </td>
              </tr>
            )}
            {recent.map((c) => (
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
                  <StatusBadge status={c.status} />
                </td>
                <td>{formatMoney(c.amountCents, c.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
