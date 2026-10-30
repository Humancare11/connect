import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

// Profile country changes (old -> new, who, when). A change by someone who already has a paid booking is flagged here until an
// admin marks it reviewed. It is a record only: prices follow the visitor's IP location, not the profile country.
//
// Used as a tab of Manage Users:
//   <CountryChangesPanel search={…} onChanged={loadUsers} onToast={showToast} />

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function CountryChangesPanel({ search = "", onChanged, onToast }) {
  const [onlyReview, setOnlyReview] = useState(true);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [debounced, setDebounced] = useState(search.trim().toLowerCase());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/admin/country-changes", {
        params: { needsReview: onlyReview ? "true" : undefined, page, limit: PAGE_SIZE },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load country changes.");
    } finally {
      setLoading(false);
    }
  }, [onlyReview, page]);

  useEffect(() => {
    load();
  }, [load]);

  const markReviewed = async (row) => {
    setBusyId(row._id);
    try {
      await api.patch(`/api/admin/country-changes/${row._id}/review`);
      onToast?.("Marked as reviewed.", true);
      await load();
      onChanged?.();
    } catch (err) {
      onToast?.(err.response?.data?.msg || "Could not mark as reviewed.", false);
    } finally {
      setBusyId("");
    }
  };

  // The search box above filters the rows of the page that is showing.
  const rows = debounced
    ? data.rows.filter((r) =>
        [r.user?.name, r.user?.email, r.user?.patientId, r.oldCountry, r.newCountry]
          .some((v) => String(v ?? "").toLowerCase().includes(debounced)),
      )
    : data.rows;

  return (
    <div className="ccp-panel">
      <div className="ccp-toolbar">
        <button
          type="button"
          className={`adp-tab ${onlyReview ? "active" : ""}`}
          onClick={() => { setOnlyReview(true); setPage(1); }}
        >
          Needs review
        </button>
        <button
          type="button"
          className={`adp-tab ${!onlyReview ? "active" : ""}`}
          onClick={() => { setOnlyReview(false); setPage(1); }}
        >
          All changes
        </button>
        <span className="ccp-note">
          A country change after a paid booking is flagged for review. (Prices follow the visitor's location, not the profile country.)
        </span>
      </div>

      {error ? (
        <div className="adp-empty"><p>{error}</p></div>
      ) : loading ? (
        <div className="adp-loading"><div className="adp-spinner" /><p>Loading country changes…</p></div>
      ) : rows.length === 0 ? (
        <div className="adp-empty">
          <h3>{onlyReview ? "Nothing to review" : "No country changes yet"}</h3>
          <p>{debounced ? "Try a different search." : onlyReview ? "No flagged country changes are waiting." : "Nobody has changed their country."}</p>
        </div>
      ) : (
        <div className="adp-table-wrap">
          <table className="adp-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Country change</th>
                <th>When</th>
                <th>Paid booking</th>
                <th>Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.user?.name || "(deleted user)"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{r.user?.email || ""}</div>
                  </td>
                  <td data-label="Country change">{r.oldCountry || "—"} → {r.newCountry || "—"}</td>
                  <td data-label="When">{formatDateTime(r.changedAt)}</td>
                  <td data-label="Paid booking">
                    {r.hadPaidBooking ? <span className="ccp-flag">Yes</span> : "No"}
                  </td>
                  <td data-label="Review">
                    {r.needsReview
                      ? <span className="ccp-flag">Needs review</span>
                      : r.reviewedAt
                        ? `Reviewed ${formatDateTime(r.reviewedAt)}${r.reviewedBy?.name ? ` by ${r.reviewedBy.name}` : ""}`
                        : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {r.user?._id && (
                        <Link className="adp-btn adp-btn--view" to={`/admin-dashboard/manage-users/${r.user._id}`}>
                          View
                        </Link>
                      )}
                      {r.needsReview && (
                        <button
                          type="button"
                          className="adp-btn adp-btn--approve"
                          disabled={busyId === r._id}
                          onClick={() => markReviewed(r)}
                        >
                          {busyId === r._id ? "Saving…" : "Mark reviewed"}
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

      {!loading && !error && data.totalPages > 1 && (
        <div className="mu-users-foot">
          <span>Page {data.page} of {data.totalPages} · {data.total} change{data.total === 1 ? "" : "s"}</span>
          <nav className="mu-pager" aria-label="Country change pages">
            <button type="button" className="mu-pager-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <button type="button" className="mu-pager-btn" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>›</button>
          </nav>
        </div>
      )}
    </div>
  );
}
