import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api from "../../api";
import socket, { setSocketAuthRole } from "../../socket";
import { useAdmin } from "../../context/AdminContext";
import "./AdminDirectVideoConsultation.css";
import { formatDate, roleLabel } from "./callReport/reportUtils";
import ProblemsCard from "./callReport/ProblemsCard";
import ParticipantsCard from "./callReport/ParticipantsCard";
import LiveCard from "./callReport/LiveCard";
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
  {
    header: "Connection type",
    render: (p) => (p.statsReceived ? p.connectionType : <span style={{ color: "#9ca3af" }}>No stats received</span>),
  },
  { header: "Delay (ms) min / avg / max", render: (p) => triple(p.stats?.rttMs) },
  { header: "Packet loss (%) avg / max", render: (p) => pair(p.stats?.packetLossPct) },
  { header: "Jitter (ms) avg / max", render: (p) => pair(p.stats?.jitterMs) },
  { header: "Incoming kbps min / avg / max", render: (p) => triple(p.stats?.bitrateKbps) },
  { header: "Quality", render: (p) => (p.stats ? QUALITY_LABELS[p.quality] || "-" : "-") },
  { header: "IP (masked)", render: (p) => p.maskedIp || "-" },
];

const QUALITY_LABELS = { good: "Good", weak: "Weak", poor: "Poor", unknown: "Unknown" };
const show = (v) => (v === null || v === undefined ? "-" : v);
const triple = (m) => (m ? `${show(m.min)} / ${show(m.avg)} / ${show(m.max)}` : "-");
const pair = (m) => (m ? `${show(m.avg)} / ${show(m.max)}` : "-");

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

  // Live view: same mechanism as the direct-call report - automatic while the
  // page is open, admin sockets only, nothing stored. Samples are keyed by role.
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveSamples, setLiveSamples] = useState({});
  const liveOpenRef = useRef(false);

  const handleLiveSample = useCallback((sample) => {
    if (!sample?.role) return;
    setLiveSamples((prev) => ({ ...prev, [sample.role]: { ...sample, at: Date.now() } }));
  }, []);

  const stopWatching = useCallback(() => {
    if (!liveOpenRef.current) return;
    liveOpenRef.current = false;
    setLiveOpen(false);
    socket.emit("admin-unwatch-call", { appointmentId: id });
    socket.off("call-live-stats", handleLiveSample);
  }, [id, handleLiveSample]);

  const startWatching = useCallback(async () => {
    // Refresh first so the socket handshake uses a current admin token (an
    // expired one would leave the Live section silently empty).
    await api.post("/api/auth/refresh", null, { authRole: "admin", skipAuthRefresh: true }).catch(() => {});
    setSocketAuthRole("admin");
    if (socket.connected) socket.disconnect();
    socket.connect();
    liveOpenRef.current = true;
    setLiveOpen(true);
    setLiveSamples({});
    socket.on("call-live-stats", handleLiveSample);
    socket.emit("admin-watch-call", { appointmentId: id });
  }, [id, handleLiveSample]);

  useEffect(() => {
    startWatching();
    return () => stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

          <LiveCard
            liveOpen={liveOpen}
            participants={participants}
            liveSamples={liveSamples}
            participantKey={(p) => p.role}
            showMedia={false}
            renderExtra={(sample) => (
              <>
                <span>{sample.iceType ? (sample.iceType === "relay" ? "Relay" : "Direct") : "-"}</span>
                <span>In: {typeof sample.bitrateKbps === "number" ? `${sample.bitrateKbps} kbps` : "-"}</span>
                <span>Out: {typeof sample.outKbps === "number" ? `${sample.outKbps} kbps` : "-"}</span>
                <span>{sample.resolution || "-"}</span>
              </>
            )}
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
