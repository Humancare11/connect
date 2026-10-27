import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { Country } from "country-state-city";
import api from "../../api";
import {
  approveUserDeletion,
  deleteUserAccount,
  mergeUpdatedUser,
  rejectUserDeletion,
} from "./userAdminActions";
import DeletionRequestsPanel from "./DeletionRequestsPanel";
import "./ManageUsers.css";
import { useConfirm } from "../../components/ui/ConfirmDialog";

// Remembers where the list was scrolled when a profile is opened, so coming
// back (the page's Back button or the browser's) puts the admin in the same place.
const SCROLL_KEY = "manage-users:list-scroll";
const PAGE_SIZE = 10;

function getCountryName(isoCode) {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
}

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

export default function ManageUsers() {
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // A result message handed over by the profile page (e.g. after deleting a user).
  const [toast, setToast] = useState(() =>
    location.state?.toast ? { msg: location.state.toast, ok: true } : null
  );

  // Search and filter are kept in the URL (?q=…&filter=…) so they survive
  // opening a profile and coming back, and the browser's Back button works.
  const search = searchParams.get("q") || "";
  const filter = searchParams.get("filter") === "deletion_requests" ? "deletion_requests" : "all";
  // Changing the search or the tab starts again from page 1.
  const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const updateParams = ({ q = search, filter: nextFilter = filter, page: nextPage = 1 }) => {
    const next = {};
    if (q) next.q = q;
    if (nextFilter !== "all") next.filter = nextFilter;
    if (nextPage > 1) next.page = String(nextPage);
    setSearchParams(next, { replace: true });
  };
  const setSearch = (q) => updateParams({ q });
  const setFilter = (nextFilter) => updateParams({ filter: nextFilter });
  const setPage = (nextPage) => updateParams({ page: nextPage });

  // Also called after a decision made in the Deletion Requests tab, so the
  // pending count and the Users list stay in step with the history.
  const loadUsers = useCallback(
    () => api.get("/api/admin/users").then((r) => setUsers(r.data)).catch(console.error),
    [],
  );

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, [loadUsers]);

  useEffect(() => {
    if (!location.state?.toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    // keep restoreScroll, drop the toast so a refresh doesn't show it again
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: { restoreScroll: location.state.restoreScroll } }
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the scroll position when returning from a profile (Back button on
  // the profile page, or the browser's back). A normal visit starts at the top.
  useEffect(() => {
    if (loading) return;
    if (navigationType !== "POP" && !location.state?.restoreScroll) return;
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* sessionStorage unavailable — start at the top */
    }
    if (saved && saved.search === location.search) {
      // instant: the site uses smooth scrolling, but a restore should just be there
      requestAnimationFrame(() => window.scrollTo({ top: saved.top, behavior: "instant" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const rememberScroll = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ search: location.search, top: window.scrollY }));
    } catch {
      /* sessionStorage unavailable — Back just starts at the top */
    }
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (userId, userName) => {
    const result = await deleteUserAccount(userId, userName, confirm);
    if (!result.done) return;
    if (result.ok) setUsers((prev) => prev.filter((u) => u._id !== userId));
    showToast(result.message, result.ok);
  };

  const handleApproveDelete = async (userId, userName) => {
    const result = await approveUserDeletion(userId, userName, confirm);
    if (!result.done) return;
    if (result.ok) setUsers((prev) => prev.filter((u) => u._id !== userId));
    showToast(result.message, result.ok);
  };

  const handleRejectDelete = async (userId, userName) => {
    const result = await rejectUserDeletion(userId, userName, confirm);
    if (!result.done) return;
    if (result.ok) {
      setUsers((prev) => prev.map((u) => (u._id === userId ? mergeUpdatedUser(u, result.user) : u)));
    }
    showToast(result.message, result.ok);
  };

  const deletionRequestCount = users.filter((u) => u.deletionRequestStatus === "pending").length;

  const filtered = users
    .filter(
      (u) =>
        String(u.patientId || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()),
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleUsers = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const firstPageShown = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => firstPageShown + i);

  return (
    <div className="mu-list-page">
      {toast && (
        <div
          className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}
        >
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Manage Users</h1>
        <p className="adp-sub">
          View and manage all registered patient accounts.
        </p>
        <Link className="mu-history-link" to="/admin-dashboard/deletion-requests">
          Deletion request history →
        </Link>
      </div>

      <div className="adp-card mu-users-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {[
              { key: "all", label: "All Users", count: users.length },
              { key: "deletion_requests", label: "Deletion Requests", count: deletionRequestCount },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`adp-tab ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="adp-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="adp-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search by patient ID, name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filter === "deletion_requests" ? (
          // Full history (all statuses), same list as the Deletion Requests page.
          // The tab badge and the stat card above stay PENDING-only.
          <DeletionRequestsPanel search={search} onDecided={loadUsers} onToast={showToast} />
        ) : loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">👥</div>
            <h3>No users found</h3>
            <p>
              {search
                ? "Try a different search."
                : "No users have registered yet."}
            </p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table mu-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Patient ID</th>
                  <th>Mobile</th>
                  <th className="mu-col-gender">Gender</th>
                  <th>Country</th>
                  <th className="mu-col-status">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div
                        className="mu-users-user"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          className="adp-avatar"
                          style={{ background: "#ede9fe", color: "#7c3aed" }}
                        >
                          {u.name
                            ? u.name
                                .split(" ")
                                .map((w) => w[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            : "U"}
                        </div>
                        <div className="mu-users-who">
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className="mu-col-id"
                      data-label="Patient ID"
                      style={{
                        fontFamily: "var(--font-secondary)",
                        fontVariantNumeric: "tabular-nums",
                        color: "#475569",
                      }}
                    >
                      {formatPatientId(u.patientId)}
                    </td>
                    <td className="mu-col-mobile" data-label="Mobile">{u.mobile || "—"}</td>
                    <td className="mu-col-gender" data-label="Gender" style={{ textTransform: "capitalize" }}>
                      {u.gender || "—"}
                    </td>
                    <td className="mu-col-country" data-label="Country">{getCountryName(u.country) || "—"}</td>
                    <td className="mu-col-status" data-label="Status">
                      {u.deletionRequestStatus === "pending" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#fee2e2",
                            color: "#991b1b",
                            borderRadius: 20,
                            padding: "3px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          🗑️ Deletion Requested
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mu-col-actions">
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link
                          className="adp-btn adp-btn--view"
                          to={`/admin-dashboard/manage-users/${u._id}`}
                          state={{ from: location.search }}
                          onClick={rememberScroll}
                        >
                          View
                        </Link>
                        {u.deletionRequestStatus === "pending" ? (
                          <>
                            <button
                              className="adp-btn adp-btn--approve"
                              onClick={() => handleApproveDelete(u._id, u.name)}
                            >
                              Approve
                            </button>
                            <button
                              className="adp-btn adp-btn--reject"
                              onClick={() => handleRejectDelete(u._id, u.name)}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            className="adp-btn adp-btn--reject"
                            onClick={() => handleDelete(u._id, u.name)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filter !== "deletion_requests" && !loading && filtered.length > 0 && (
          <div className="mu-users-foot">
            <span>
              Showing {pageStart + 1} - {pageStart + visibleUsers.length} of {filtered.length} users
            </span>
            {totalPages > 1 && (
              <nav className="mu-pager" aria-label="User pages">
                <button
                  type="button"
                  className="mu-pager-btn"
                  aria-label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ‹
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`mu-pager-btn${n === currentPage ? " mu-pager-btn--active" : ""}`}
                    aria-current={n === currentPage ? "page" : undefined}
                    onClick={() => n !== currentPage && setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                {firstPageShown + 4 < totalPages && (
                  <span className="mu-pager-gap" aria-hidden="true">
                    …
                  </span>
                )}
                <button
                  type="button"
                  className="mu-pager-btn"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  ›
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
