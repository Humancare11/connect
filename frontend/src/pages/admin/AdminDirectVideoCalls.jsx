import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./AdminDirectVideoConsultation.css";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS = {
  waiting: "Waiting",
  "one joined": "One joined",
  "in call": "In call",
  reconnecting: "Reconnecting",
  problem: "Problem",
  ended: "Ended",
  expired: "Expired",
};

function expiryCountdown(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function AdminDirectVideoCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [error, setError] = useState("");

  const fetchCalls = () => {
    setLoading(true);
    setError("");
    api
      .get("/api/direct-video-room/calls", { params: problemsOnly ? { problems: "true" } : {} })
      .then((res) => setCalls(res.data?.calls || []))
      .catch(() => setError("Failed to load calls."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemsOnly]);

  return (
    <div className="dvc-page">
      <div className="dvc-header">
        <div>
          <p className="dvc-eyebrow">Admin Dashboard</p>
          <h1>Direct Video Calls</h1>
          <p>Live and past direct-link video consultations, with status and any problems.</p>
        </div>
        <Link to="/admin-dashboard/direct-video-consultation" className="dvc-secondary">
          ← Generate Link
        </Link>
      </div>

      <div className="dvc-card dvc-history">
        <div className="dvc-history__head">
          <div>
            <span className="dvc-result__label">Calls</span>
            <h2>{calls.length} shown</h2>
          </div>
          <div className="dvc-history__actions">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#334155" }}>
              <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
              Problems only
            </label>
            <button className="dvc-secondary" type="button" onClick={fetchCalls}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="dvc-error">{error}</div>}

        {loading ? (
          <div className="dvc-empty">Loading calls…</div>
        ) : calls.length === 0 ? (
          <div className="dvc-empty">
            {problemsOnly ? "No calls with problems." : "No video consultation rooms yet."}
          </div>
        ) : (
          <div className="dvc-table-wrap">
            <table className="dvc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Doctor</th>
                  <th>Created</th>
                  <th>Link expiry</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.roomId}>
                    <td>
                      <span className={`dvc-call-status dvc-call-status--${call.callStatus.replace(/\s+/g, "-")}`}>
                        {STATUS_LABELS[call.callStatus] || call.callStatus}
                      </span>
                    </td>
                    <td>{call.doctorName || "-"}</td>
                    <td>{formatDate(call.createdAt)}</td>
                    <td>{call.status === "active" ? expiryCountdown(call.expiresAt) : "-"}</td>
                    <td>
                      <Link className="dvc-link-btn" to={`/admin-dashboard/direct-video-consultation/calls/${call.roomId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
