import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api";
import { approveUserDeletion, rejectUserDeletion } from "./userAdminActions";
import "./ManageUsers.css";
import "./AdminDeletionRequests.css";

// Account-deletion history: every request (and every direct "Delete User"),
// kept even after the account itself is gone.
//
// TODO(legal review): this lists personal data (name, email, patient ID,
// free-text reason) retained after the account was deleted. The retention
// period and wording need legal review.

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved (deleted)" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "deleted_by_admin", label: "Deleted by admin" },
];
const SOURCE_OPTIONS = [
  { key: "all", label: "All sources" },
  { key: "web", label: "Web" },
  { key: "app", label: "App" },
];
const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved · account deleted",
  rejected: "Rejected",
  cancelled: "Cancelled by user",
  deleted_by_admin: "Deleted by admin",
};
const VALID_STATUS = new Set(STATUS_TABS.map((t) => t.key));
const VALID_SOURCE = new Set(SOURCE_OPTIONS.map((s) => s.key));

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// "Web · Chrome on Windows", "App · Android · v1.0.0+16", or "Unknown".
function formatRequestedVia(row) {
  if (row.status === "deleted_by_admin") return "—";
  const { platform, subType, appVersion } = row.requestSource || {};
  if (platform === "web") return subType ? `Web · ${subType}` : "Web";
  if (platform === "app") {
    const os = { android: "Android", ios: "iOS" }[String(subType || "").toLowerCase()] || "";
    return ["App", os, appVersion ? `v${appVersion}` : ""].filter(Boolean).join(" · ");
  }
  return "Unknown";
}

function decidedByText(row) {
  if (row.status === "pending") return "";
  if (row.status === "cancelled") return "by the user";
  const who = row.decidedBy?.name || row.decidedBy?.email;
  const via = row.decidedVia === "direct_delete" && row.status === "approved" ? " (Delete User)" : "";
  return who ? `by ${who}${via}` : "by an admin (unknown)";
}

function ReasonCell({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="adr-muted">—</span>;
  const long = text.length > 90;
  return (
    <div className="adr-reason">
      <span>{open || !long ? text : `${text.slice(0, 90)}…`}</span>
      {long && (
        <button type="button" className="adr-link" onClick={() => setOpen((v) => !v)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export default function AdminDeletionRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get("status");
  const rawSource = searchParams.get("source");
  const status = VALID_STATUS.has(rawStatus) ? rawStatus : "all";
  const source = VALID_SOURCE.has(rawSource) ? rawSource : "all";
  const q = searchParams.get("q") || "";
  const page = Math.max(parseInt(searchParams.get("page"), 10) || 1, 1);

  const [searchText, setSearchText] = useState(q);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState("");
  const requestRef = useRef(0);

  const update = useCallback(
    (patch) => {
      const next = { status, source, q, page: 1, ...patch };
      const params = {};
      if (next.status !== "all") params.status = next.status;
      if (next.source !== "all") params.source = next.source;
      if (next.q) params.q = next.q;
      if (next.page > 1) params.page = String(next.page);
      setSearchParams(params, { replace: true });
    },
    [status, source, q, setSearchParams],
  );

  // Search box → URL, debounced.
  useEffect(() => {
    if (searchText === q) return undefined;
    const timer = setTimeout(() => update({ q: searchText.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchText, q, update]);

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/admin/deletion-requests", {
        params: { status, source, q, page, limit: 25 },
      });
      if (id !== requestRef.current) return; // a newer request superseded this one
      setData(res.data);
    } catch (err) {
      if (id !== requestRef.current) return;
      setError(err?.response?.data?.msg || "Failed to load deletion requests.");
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [status, source, q, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const decide = async (row, action) => {
    if (busyId) return;
    setBusyId(row._id);
    const result = await (action === "approve" ? approveUserDeletion : rejectUserDeletion)(row.userId, row.name);
    setBusyId("");
    if (!result.done) return;
    setToast({ ok: result.ok, msg: result.message });
    if (result.ok) load();
  };

  const counts = data.counts || {};
  const hasFilters = status !== "all" || source !== "all" || q;

  return (
    <div className="adr-page">
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Deletion Requests</h1>
        <p className="adp-sub">
          Every account-deletion request and what happened to it — kept even after the account is deleted.
        </p>
      </div>

      <div className="adp-card">
        <div className="adp-card-header adr-toolbar">
          <div className="adp-tabs" role="tablist" aria-label="Request status">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={status === tab.key}
                className={`adp-tab ${status === tab.key ? "active" : ""}`}
                onClick={() => update({ status: tab.key })}
              >
                {tab.label}
                <span className="adp-tab-count">{counts[tab.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="adr-filters">
            <select
              className="adr-select"
              aria-label="Requested via"
              value={source}
              onChange={(e) => update({ source: e.target.value })}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.key === "all" ? "Requested via: all" : `Requested via: ${o.label}`}</option>
              ))}
            </select>
            <div className="adp-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                aria-label="Search deletion requests"
                placeholder="Search by name, email or patient ID…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading && data.items.length === 0 ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading deletion requests…</p>
          </div>
        ) : error ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">⚠️</div>
            <h3>Couldn’t load the list</h3>
            <p>{error}</p>
            <button type="button" className="adp-btn adp-btn--view" onClick={load}>Retry</button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">🗑️</div>
            <h3>No deletion requests</h3>
            <p>{hasFilters ? "Nothing matches these filters." : "No one has requested account deletion yet."}</p>
          </div>
        ) : (
          <div className="adp-table-wrap" aria-busy={loading}>
            <table className="adp-table adr-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Patient ID</th>
                  <th>Requested</th>
                  <th>Requested via</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row._id}>
                    <td data-label="Person">
                      <div className="adr-name">{row.name || "—"}</div>
                      <div className="adr-muted">{row.email || "—"}</div>
                    </td>
                    <td data-label="Patient ID" className="adr-mono">{formatPatientId(row.patientId)}</td>
                    <td data-label="Requested">
                      {row.status === "deleted_by_admin" ? <span className="adr-muted">No request</span> : formatDateTime(row.requestedAt)}
                    </td>
                    <td data-label="Requested via">
                      <span className={row.requestSource?.platform ? "" : "adr-muted"}>{formatRequestedVia(row)}</span>
                    </td>
                    <td data-label="Reason"><ReasonCell text={row.reason} /></td>
                    <td data-label="Status">
                      <span className={`adr-badge adr-badge--${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span>
                      <div className="adr-muted adr-emails" title="Whether the emails to the person were sent">
                        {row.status !== "deleted_by_admin" && (
                          <>
                            ✉ received {row.emails.requested ? "✓" : "✗"}
                            {row.status !== "pending" && row.status !== "cancelled" && <> · decision {row.emails.decision ? "✓" : "✗"}</>}
                          </>
                        )}
                        {row.backfilled && <span className="adr-tag" title="Added from existing data; the decider and source may be unknown">backfilled</span>}
                      </div>
                    </td>
                    <td data-label="Decision">
                      {row.status === "pending" ? (
                        <span className="adr-muted">Awaiting decision</span>
                      ) : (
                        <>
                          <div>{formatDateTime(row.decidedAt)}</div>
                          <div className="adr-muted">{decidedByText(row)}</div>
                        </>
                      )}
                    </td>
                    <td data-label="Actions">
                      <div className="adr-actions">
                        {row.userExists && (
                          <Link className="adp-btn adp-btn--view" to={`/admin-dashboard/manage-users/${row.userId}`}>
                            View
                          </Link>
                        )}
                        {row.status === "pending" && row.userExists && (
                          <>
                            <button
                              type="button"
                              className="adp-btn adp-btn--approve"
                              disabled={Boolean(busyId)}
                              onClick={() => decide(row, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="adp-btn adp-btn--reject"
                              disabled={Boolean(busyId)}
                              onClick={() => decide(row, "reject")}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {!row.userExists && <span className="adr-muted">Account deleted</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <div className="adr-pager">
            <span className="adr-muted">
              {data.total} request{data.total === 1 ? "" : "s"} · page {data.page || page} of {data.pages || 1}
            </span>
            <div className="adr-pager-buttons">
              <button type="button" className="adp-btn adp-btn--view" disabled={page <= 1 || loading} onClick={() => update({ page: page - 1 })}>
                Previous
              </button>
              <button type="button" className="adp-btn adp-btn--view" disabled={page >= (data.pages || 1) || loading} onClick={() => update({ page: page + 1 })}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
