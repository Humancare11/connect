import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import VisitNoteDownload from "../../components/VisitNoteDownload";
import { fmtDate } from "../../utils/visitNote";
import "../doctors/DoctorPatients.css";
import "../doctors/VisitNote.css";

// Patient: finalised Visit Notes (newest first), with completed consultations that have no signed note yet shown
// inline as "Report pending". Drafts are never sent to the patient.
export default function MyVisitNotes() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/consultation-reports/mine", { authRole: "user" })
      .then((res) => {
        setReports(res.data?.reports || []);
        setPending(res.data?.pending || []);
      })
      .catch((err) => setError(err.response?.data?.msg || "Could not load your Visit Notes."))
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    const dateKey = (d) => String(d || "").slice(0, 10);
    return [
      ...reports.map((r) => ({ kind: "report", key: r._id, date: dateKey(r.consultation?.date || r.signedAt), r })),
      ...pending.map((p) => ({ kind: "pending", key: p.appointmentId, date: dateKey(p.date), p })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [reports, pending]);

  return (
    <div className="vn-page">
      <span className="vn-eyebrow">Patient account</span>
      <h2>My Visit Notes</h2>
      <p className="vn-sub">
        All your consultation notes, newest first. Drafts are never shown here. Looking for other reports?{" "}
        <Link to="/user/my-records">Go to My Records</Link>
      </p>

      {loading ? (
        <div className="vn-empty">Loading…</div>
      ) : error ? (
        <div className="vn-error" role="alert">{error}</div>
      ) : items.length === 0 ? (
        <div className="vn-empty">No consultations yet. Your doctor&apos;s signed notes will appear here.</div>
      ) : (
        <div className="vn-panel-list">
          {items.map((it) =>
            it.kind === "report" ? (
              <div key={it.key} className="vn-card">
                <div>
                  <span className="vn-item-title">{fmtDate(it.r.consultation?.date || it.r.signedAt)}</span>
                  <span className="vn-tag vn-tag--ok">Signed</span>
                  {it.r.amendments?.length > 0 && <span className="vn-tag vn-tag--warn">Amended</span>}
                  <small>
                    {it.r.physician?.name || "Doctor"} · Video consultation · {it.r.reportNumber}
                  </small>
                </div>
                <div className="vn-card-actions">
                  <button type="button" className="vn-btn" onClick={() => navigate(`/user/my-visit-notes/${it.r._id}`)}>
                    View
                  </button>
                  <VisitNoteDownload report={it.r} role="user" className="vn-btn vn-btn--primary" />
                </div>
              </div>
            ) : (
              <div key={it.key} className="vn-card vn-card--pending">
                <div>
                  <span className="vn-item-title">{fmtDate(it.p.date)}</span>
                  <span className="vn-tag">Report pending</span>
                  <small>
                    {it.p.doctorName ? `${it.p.doctorName} is preparing this note` : "Your doctor is preparing this note"}
                    {it.p.time ? ` · ${it.p.time}` : ""}
                  </small>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
