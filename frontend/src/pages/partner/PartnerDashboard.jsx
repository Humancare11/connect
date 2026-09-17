import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import partnerApi from "../../api/partnerApi";
import {
  STATUS_META,
  URGENCY_META,
  SERVICE_META,
  statusLabel,
  formatMoney,
} from "./caseConstants";
import "./Partner-dasboard.css";

const STATUS_OPTIONS = [
  "submitted",
  "assigned",
  "in-progress",
  "completed",
  "invoiced",
  "cancelled",
];
const URGENCY_OPTIONS = ["routine", "urgent", "emergency"];
const PAGE_SIZE = 10;

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

  // ---- Filters + pagination state ----
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce the free-text search so we don't fire a request per keystroke.
  // A new search term always resets back to page 1.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return undefined;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const openCase = (id) => navigate(`/partner-dashboard/cases/${id}`);

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };
  const changeUrgency = (value) => {
    setUrgency(value);
    setPage(1);
  };

  const statsQ = useQuery({
    queryKey: ["partner", "dashboard"],
    queryFn: partnerApi.dashboard,
  });

  const casesParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search ? { q: search } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(urgency !== "all" ? { urgency } : {}),
    }),
    [page, search, status, urgency],
  );

  const casesQ = useQuery({
    queryKey: ["partner", "cases", casesParams],
    queryFn: () => partnerApi.listCasesPaged(casesParams),
    placeholderData: keepPreviousData,
  });

  const stats = statsQ.data || {
    total: 0,
    active: 0,
    completed: 0,
    billedCents: 0,
  };
  const data = casesQ.data || { items: [], total: 0, page: 1, pages: 1 };
  const rows = data.items;
  const totalPages = data.pages || 1;
  const hasFilters = Boolean(search) || status !== "all" || urgency !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setUrgency("all");
    setPage(1);
  };

  return (
    <div className="pt-page" style={{ maxWidth: "100%" }}>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">Dashboard</h1>
          <p className="pt-page-sub">Overview of your submitted care cases</p>
        </div>
        <Link to="/partner-dashboard/submit-case" className="pt-btn">
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
          Cases
        </h2>
        <Link
          to="/partner-dashboard/cases"
          style={{ fontSize: 13, color: "#0369a1" }}
        >
          View all
        </Link>
      </div>

      <div className="pt-filters">
        <input
          className="pt-filter-search"
          type="search"
          placeholder="Search by case number or patient"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search cases"
        />
        <select
          className="pt-filter-select"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          className="pt-filter-select"
          value={urgency}
          onChange={(e) => changeUrgency(e.target.value)}
          aria-label="Filter by urgency"
        >
          <option value="all">All urgencies</option>
          {URGENCY_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {URGENCY_META[u]?.label || u}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={clearFilters}
          >
            Clear
          </button>
        )}
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
              <th style={{ textAlign: "right" }}>View</th>
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
                  {hasFilters
                    ? "No cases match your filters."
                    : "No cases yet. Submit your first case to get started."}
                </td>
              </tr>
            )}
            {!casesQ.isLoading &&
              rows.map((c) => (
                <tr
                  key={c._id}
                  className="pt-row-link"
                  onClick={() => openCase(c._id)}
                >
                  <td style={{ fontWeight: 600, color: "#0369a1" }}>
                    {c.caseNumber}
                  </td>
                  <td>{c.patient?.name}</td>
                  <td style={{ color: "#64748b" }}>
                    {SERVICE_META[c.serviceType]?.label || c.serviceType}
                  </td>
                  <td>
                    <span
                      className="pt-dot"
                      style={{
                        color: URGENCY_META[c.urgency]?.color || "#64748b",
                      }}
                    >
                      {URGENCY_META[c.urgency]?.label || c.urgency}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{formatMoney(c.amountCents, c.currency)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/partner-dashboard/cases/${c._id}`}
                      className="pt-view-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pt-pagination">
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || casesQ.isFetching}
          >
            Prev
          </button>
          <span className="pt-pagination-info">
            Page {data.page || page} of {totalPages}
          </span>
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || casesQ.isFetching}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
