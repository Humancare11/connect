import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "./AdminDirectVideoConsultation.css";
import { formatDate, roleLabel } from "./callReport/reportUtils";
import ProblemsCard from "./callReport/ProblemsCard";
import ParticipantsCard from "./callReport/ParticipantsCard";
import TimelineCard from "./callReport/TimelineCard";

// Admin-only call report for an appointment / category-consultation video call.
// Same sections, layout and wording as the direct-call report
// (AdminDirectVideoCallDetail.jsx) - the section components are shared.

const END_REASON_LABELS = {
  completed: "Appointment marked complete",
  cancelled: "Appointment cancelled",
  participants_left: "Everyone left",
};

const PLATFORM_BADGES = { web: "Web", android: "App · Android", ios: "App · iOS", app: "App" };

const PARTICIPANT_COLUMNS = [
  { header: "Role", render: (p) => roleLabel(p.role) },
  {
    header: "Joined from",
    render: (p) => (
      <span title={p.platformSource ? `How we know: ${p.platformSource}` : undefined}>
        <strong>{PLATFORM_BADGES[p.platform] || "Unknown"}</strong>
        <br />
        <span style={{ fontSize: 12, color: "#6b7280" }}>{p.joinedFrom}</span>
      </span>
    ),
  },
  { header: "First join", render: (p) => formatDate(p.firstJoinedAt) },
  { header: "Last seen", render: (p) => formatDate(p.lastSeenAt) },
  { header: "Left", render: (p) => formatDate(p.leftAt) },
  { header: "Joins", render: (p) => p.joins },
  { header: "Reconnects", render: (p) => p.reconnects },
  { header: "Disconnects", render: (p) => p.disconnects },
  { header: "Connection", render: (p) => p.connectionState },
  { header: "IP (masked)", render: (p) => p.maskedIp || "-" },
];

function connectedLabel(summary) {
  if (!summary.connected) return "No";
  return summary.connectedSource === "client" ? "Yes" : "Yes (inferred: both stayed together)";
}

export default function AdminAppointmentCallReport() {
  const { id } = useParams();
  const location = useLocation();
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "superadmin";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get(`/api/call-reports/${id}`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.status === 404 ? "This appointment was not found." : "Failed to load this call's report."),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const deleteReport = async () => {
    setActionBusy("deleteTimeline");
    setActionNotice("");
    try {
      const res = await api.delete(`/api/call-reports/${id}`);
      setActionNotice(res.data?.msg || "Call report deleted.");
      fetchReport();
    } catch (err) {
      setActionNotice(err.response?.data?.msg || "Failed to delete the call report.");
    } finally {
      setActionBusy("");
    }
  };

  if (loading) return <div className="dvc-page dvc-empty">Loading call report…</div>;
  if (error || !data) return <div className="dvc-page dvc-error">{error || "Not found."}</div>;

  const { appointment, participants, timeline, summary } = data;
  const problems = data.problems || [];
  const isConsultation = appointment.kind === "category_consultation" || location.pathname.includes("/category-consultations/");
  const detailsPath = isConsultation ? `/admin-dashboard/category-consultations/${id}` : `/admin-dashboard/appointments/${id}`;

  return (
    <div className="dvc-page">
      <div className="dvc-header">
        <div>
          <p className="dvc-eyebrow">Admin Dashboard</p>
          <h1>Call Report</h1>
          <p>
            {appointment.patientName || "Patient"}
            {appointment.doctorName ? ` with Dr. ${appointment.doctorName}` : ""} ·{" "}
            {isConsultation ? "Category consultation" : "Appointment"}
            {appointment.date ? ` · ${appointment.date}${appointment.time ? ` ${appointment.time}` : ""}` : ""}
            {appointment.status ? ` · ${appointment.status}` : ""}
          </p>
        </div>
        <Link to={detailsPath} className="dvc-secondary">
          ← Back to {isConsultation ? "Consultation" : "Appointment"}
        </Link>
      </div>

      {data.empty ? (
        <div className="dvc-card">
          <div className="dvc-empty">
            No video call has been recorded for this {isConsultation ? "consultation" : "appointment"} yet. A report appears
            as soon as the doctor or the patient joins the call.
          </div>
        </div>
      ) : (
        <>
          <div className="dvc-card">
            <div className="dvc-form__title">
              <h2>Summary</h2>
            </div>
            <div className="dvc-table-wrap">
              <table className="dvc-table">
                <tbody>
                  <tr>
                    <th>Call duration</th>
                    <td>
                      {summary.durationLabel || "0s"}
                      {summary.inProgress ? " (in progress)" : ""}
                    </td>
                    <th>Connected</th>
                    <td>{connectedLabel(summary)}</td>
                  </tr>
                  <tr>
                    <th>Both in the call from</th>
                    <td>{formatDate(summary.bothPresentAt)}</td>
                    <th>Call ended</th>
                    <td>{summary.inProgress ? "-" : formatDate(summary.callEndedAt)}</td>
                  </tr>
                  <tr>
                    <th>How it ended</th>
                    <td>{END_REASON_LABELS[summary.endReason] || (summary.inProgress ? "Still going" : "-")}</td>
                    <th>First activity</th>
                    <td>{formatDate(summary.firstActivityAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ProblemsCard problems={problems} />

          <div className="dvc-card">
            <div className="dvc-form__title">
              <h2>Admin Actions</h2>
            </div>
            {actionNotice && <div className="dvc-notice" style={{ marginBottom: 10 }}>{actionNotice}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to={detailsPath} className="dvc-secondary">
                View {isConsultation ? "consultation" : "appointment"} details
              </Link>
            </div>
          </div>

          <ParticipantsCard
            participants={participants}
            rowKey={(p) => p.key}
            emptyText="Nobody has joined this call yet."
            columns={PARTICIPANT_COLUMNS}
          />

          <TimelineCard
            timeline={timeline}
            isSuperAdmin={isSuperAdmin}
            actionBusy={actionBusy}
            onDelete={deleteReport}
            deleteLabel="Delete call report"
            deleteWarning={(count) => `Permanently deletes this whole call report (participants and ${count} event(s)). Are you sure?`}
          />
        </>
      )}
    </div>
  );
}
