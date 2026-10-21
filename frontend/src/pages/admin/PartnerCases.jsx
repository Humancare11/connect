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
import "./PartnerCases.css";

const STATUS_OPTIONS = ["submitted", "assigned", "in-progress", "completed", "invoiced", "cancelled"];
const URGENCY_OPTIONS = ["routine", "urgent", "emergency"];

export default function AdminPartnerCases() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [page, setPage] = useState(1);

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

  return (
    <div className="pcs-page">
      <div className="pcs-inner">
        <div className="pcs-head">
          <h1 className="pcs-title">Partners Cases</h1>
          <p className="pcs-sub">Care cases submitted by Partner Companies</p>
        </div>

        <div className="pcs-toolbar">
          <input
            className="pcs-field pcs-field--search"
            type="search"
            placeholder="Search by case number or patient"
            aria-label="Search cases"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <select
            className="pcs-field pcs-field--select"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <select
            className="pcs-field pcs-field--select"
            aria-label="Filter by urgency"
            value={urgency}
            onChange={(e) => {
              setPage(1);
              setUrgency(e.target.value);
            }}
          >
            <option value="all">All urgencies</option>
            {URGENCY_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {URGENCY_META[u].label}
              </option>
            ))}
          </select>
        </div>

        <div className="pcs-panel">
          <table className="pcs-table">
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
                <tr className="pcs-state-row">
                  <td colSpan={8} className="pcs-state">
                    Loading…
                  </td>
                </tr>
              )}
              {listQ.isError && !listQ.isLoading && (
                <tr className="pcs-state-row">
                  <td colSpan={8} className="pcs-state pcs-state--error" role="alert">
                    Failed to load partner cases.
                  </td>
                </tr>
              )}
              {!listQ.isLoading && !listQ.isError && data.items.length === 0 && (
                <tr className="pcs-state-row">
                  <td colSpan={8} className="pcs-state">
                    No partner cases found.
                  </td>
                </tr>
              )}
              {data.items.map((c) => {
                const m = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };
                return (
                  <tr
                    key={c._id}
                    className="pcs-row"
                    tabIndex={0}
                    aria-label="Open case details"
                    onClick={() => navigate(`/admin-dashboard/partner-cases/${c._id}`)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/admin-dashboard/partner-cases/${c._id}`);
                      }
                    }}
                  >
                    <td className="pcs-num pcs-td--num">{c.caseNumber}</td>
                    <td className="pcs-td--partner">{c.partner?.companyName || "—"}</td>
                    <td className="pcs-td--patient">{c.patient?.name}</td>
                    <td className="pcs-muted pcs-td--service">
                      {SERVICE_META[c.serviceType]?.label || c.serviceType}
                    </td>
                    <td className="pcs-td--urgency">
                      <span className="pcs-dot" style={{ color: URGENCY_META[c.urgency]?.color }}>
                        {URGENCY_META[c.urgency]?.label || c.urgency}
                      </span>
                    </td>
                    <td className="pcs-td--status">
                      <span className="pcs-badge" style={{ background: m.bg, color: m.text }}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="pcs-muted pcs-td--date">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="pcs-amount pcs-td--amount">{formatMoney(c.amountCents, c.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.pages > 1 && (
          <div className="pcs-pager">
            <button
              className="pcs-btn"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span className="pcs-pager__info">
              Page {data.page} of {data.pages}
            </span>
            <button
              className="pcs-btn"
              type="button"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
