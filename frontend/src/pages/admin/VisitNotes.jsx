import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import VisitNoteDownload from "../../components/VisitNoteDownload";
import { fmtDate, fmtDateTime } from "../../utils/visitNote";
import "../doctors/DoctorPatients.css";
import "../doctors/VisitNote.css";

const PAGE_SIZE = 25;

// Admin / super admin: every finalised Visit Note, searchable by patient name or report ID. View and download only.
export default function VisitNotes() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // One result per (query, page); "loading" is simply "the stored result is for a different request".
  const requestKey = `${query}|${page}`;
  const [result, setResult] = useState({ key: "", reports: [], total: 0, error: "" });
  const loading = result.key !== requestKey;
  const data = result;
  const error = result.error;

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/consultation-reports/admin", { authRole: "admin", params: { q: query || undefined, page, limit: PAGE_SIZE } })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, reports: res.data?.reports || [], total: res.data?.total || 0, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: requestKey, reports: [], total: 0, error: err.response?.data?.msg || "Could not load Visit Notes." });
      });
    return () => {
      cancelled = true;
    };
  }, [query, page, requestKey]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="vn-page">
      <span className="vn-eyebrow">Admin</span>
      <h2>Visit Notes</h2>
      <p className="vn-sub">Every signed consultation note on the platform. Admin can view and download, not edit.</p>

      <div className="vn-toolbar">
        <input
          className="vn-search"
          type="search"
          placeholder="Search by patient or report ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search Visit Notes"
        />
      </div>

      {error && <div className="vn-error" role="alert">{error}</div>}
      {loading ? (
        <div className="vn-empty">Loading…</div>
      ) : data.reports.length === 0 ? (
        <div className="vn-empty">No Visit Notes match.</div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Consultation</th>
                <th>Signed on</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r._id}>
                  <td><span className="vn-id">{r.reportNumber}</span></td>
                  <td>
                    <div className="vn-pt">
                      <span className="vn-av">{(r.patient?.name || "P")[0]}</span>
                      {r.patient?.name || "Patient"}
                    </div>
                  </td>
                  <td>{r.physician?.name || "—"}</td>
                  <td>{fmtDate(r.consultation?.date || r.signedAt)}</td>
                  <td>{fmtDateTime(r.signedAt)}</td>
                  <td>
                    {r.amendments?.length ? (
                      <span className="vn-tag vn-tag--warn" style={{ marginLeft: 0 }}>Amended ×{r.amendments.length}</span>
                    ) : (
                      <span className="vn-tag vn-tag--ok" style={{ marginLeft: 0 }}>Signed</span>
                    )}
                  </td>
                  <td>
                    <div className="vn-acts">
                      <button type="button" className="vn-btn" onClick={() => navigate(`/admin-dashboard/visit-notes/${r._id}`)}>
                        View
                      </button>
                      <VisitNoteDownload report={r} role="admin" className="vn-btn vn-btn--primary" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.total > PAGE_SIZE && (
        <div className="vn-pager">
          <button type="button" className="vn-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="vn-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
