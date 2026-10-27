import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import socket, { setSocketAuthRole } from "../../socket";
import { useAdmin } from "../../context/AdminContext";
import "./AdminDirectVideoConsultation.css";
import { formatDate, roleLabel } from "./callReport/reportUtils";
import ProblemsCard from "./callReport/ProblemsCard";
import ParticipantsCard from "./callReport/ParticipantsCard";
import LiveCard from "./callReport/LiveCard";
import TimelineCard from "./callReport/TimelineCard";

const DIRECT_PARTICIPANT_COLUMNS = [
  { header: "Role", render: (p) => roleLabel(p.role) },
  { header: "Device", render: (p) => [p.device, p.browser, p.os].filter(Boolean).join(", ") || "-" },
  { header: "Joined", render: (p) => formatDate(p.joinedAt) },
  { header: "Last seen", render: (p) => formatDate(p.lastSeenAt) },
  { header: "Connection", render: (p) => p.connectionState },
  { header: "Mic", render: (p) => (p.isMicOff === null ? "-" : p.isMicOff ? "Off" : "On") },
  { header: "Camera", render: (p) => (p.isCamOff === null ? "-" : p.isCamOff ? "Off" : "On") },
  { header: "IP (masked)", render: (p) => p.maskedIp || "-" },
];

export default function AdminDirectVideoCallDetail() {
  const { roomId } = useParams();
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "superadmin";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmForceEnd, setConfirmForceEnd] = useState(false);

  // Live view — automatic for as long as this report page is open, no
  // button. Samples are keyed by guestId; never persisted anywhere, just
  // held in this component's state for as long as the page is open.
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveSamples, setLiveSamples] = useState({});
  const liveOpenRef = useRef(false);

  const handleLiveSample = useCallback((sample) => {
    if (!sample?.guestId) return;
    setLiveSamples((prev) => ({ ...prev, [sample.guestId]: { ...sample, at: Date.now() } }));
  }, []);

  const stopWatching = useCallback(() => {
    if (!liveOpenRef.current) return;
    liveOpenRef.current = false;
    setLiveOpen(false);
    socket.emit("admin-unwatch-direct-room", { roomId });
    socket.off("direct-call-stats", handleLiveSample);
  }, [roomId, handleLiveSample]);

  const startWatching = useCallback(async (isCancelled = () => false) => {
    // This admin socket has typically never connected before this report
    // page mounted — no other admin page uses it. If the admin's access
    // token has since expired (e.g. they had this report open, idle, past
    // token expiry), refresh first so the handshake below authenticates
    // with a current token rather than one io.use() will reject, which
    // would otherwise leave the Live section silently empty
    // (isAdminSocket() fails closed on the server for an unauthenticated
    // socket).
    await api.post("/api/auth/refresh", null, { authRole: "admin", skipAuthRefresh: true }).catch(() => {});
    // The refresh is async: if the page unmounted (or the room changed, or
    // StrictMode re-ran this effect) while it was in flight, stopWatching()
    // already ran as a no-op because nothing was watching yet. Continuing
    // would join the watcher room after the admin left, with nothing left
    // to ever leave it.
    if (isCancelled()) return;
    setSocketAuthRole("admin");
    if (socket.connected) {
      // Already connected under a possibly-stale identity (e.g. connected
      // once, then sat idle past token expiry) — force a fresh handshake
      // with the just-refreshed token instead of reusing the old one.
      socket.disconnect();
    }
    socket.connect();
    liveOpenRef.current = true;
    setLiveOpen(true);
    setLiveSamples({});
    socket.on("direct-call-stats", handleLiveSample);
    socket.emit("admin-watch-direct-room", { roomId });
  }, [roomId, handleLiveSample]);

  // Auto-join the watcher room on mount, leave on unmount (navigating away)
  // or if the room changes — the server only speeds up participants'
  // telemetry cadence and only the current page's lifetime controls that,
  // never leaving it thinking a closed page is still watching.
  useEffect(() => {
    let cancelled = false;
    startWatching(() => cancelled);
    return () => {
      cancelled = true;
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchReport = () => {
    setLoading(true);
    setError("");
    api
      .get(`/api/direct-video-room/${roomId}/events`)
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 404) setError("This call could not be found. It may have been removed.");
        else if (status === 401 || status === 403) setError("You don't have access to this call's report.");
        else setError("Failed to load this call's report.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const runAction = async (action, endpoint, body) => {
    setActionBusy(action);
    setActionNotice("");
    try {
      const res = await api.post(`/api/direct-video-room/${roomId}/${endpoint}`, body || {});
      setActionNotice(res.data?.msg || "Done.");
      fetchReport();
    } catch (err) {
      setActionNotice(err.response?.data?.msg || "Action failed.");
    } finally {
      setActionBusy("");
      setConfirmForceEnd(false);
    }
  };

  const deleteTimeline = async () => {
    setActionBusy("deleteTimeline");
    setActionNotice("");
    try {
      const res = await api.delete(`/api/direct-video-room/${roomId}/events`);
      setActionNotice(res.data?.msg || "Timeline deleted.");
      fetchReport();
    } catch (err) {
      setActionNotice(err.response?.data?.msg || "Failed to delete the timeline.");
    } finally {
      setActionBusy("");
    }
  };

  if (loading) return <div className="dvc-page dvc-empty">Loading call report…</div>;
  if (error || !data || !data.room) {
    return (
      <div className="dvc-page">
        <div className="dvc-error">{error || "Not found."}</div>
        <Link to="/admin-dashboard/direct-video-consultation" className="dvc-secondary">
          ← Back to Direct Video Consultation
        </Link>
      </div>
    );
  }

  const { room } = data;
  const participants = data.participants || [];
  const timeline = data.timeline || [];
  const problems = data.problems || [];

  return (
    <div className="dvc-page">
      <div className="dvc-header">
        <div>
          <p className="dvc-eyebrow">Admin Dashboard</p>
          <h1>Call Report</h1>
          <p>
            {room.doctorName ? `Dr. ${room.doctorName}` : "No doctor assigned"} · Created{" "}
            {formatDate(room.createdAt)} · Expires {formatDate(room.expiresAt)}
          </p>
        </div>
        <Link to="/admin-dashboard/direct-video-consultation" className="dvc-secondary">
          ← Back to Direct Video Consultation
        </Link>
      </div>

      <ProblemsCard problems={problems} />

      <div className="dvc-card">
        <div className="dvc-form__title">
          <h2>Admin Actions</h2>
        </div>
        {actionNotice && <div className="dvc-notice" style={{ marginBottom: 10 }}>{actionNotice}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="dvc-secondary"
            type="button"
            disabled={!!actionBusy}
            onClick={() => runAction("extend", "extend", { extraHours: 24 })}
          >
            {actionBusy === "extend" ? "Extending…" : "Extend Link (+24h)"}
          </button>
          <button
            className="dvc-secondary"
            type="button"
            disabled={!!actionBusy}
            onClick={() => runAction("clear", "clear-stuck-seats")}
          >
            {actionBusy === "clear" ? "Clearing…" : "Clear Stuck Seats"}
          </button>
          {!confirmForceEnd ? (
            <button
              className="dvc-link-btn"
              type="button"
              disabled={!!actionBusy}
              onClick={() => setConfirmForceEnd(true)}
              style={{ borderColor: "#fecaca", background: "#fee2e2", color: "#991b1b" }}
            >
              Force End Call
            </button>
          ) : (
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                This disconnects an active call. Are you sure?
              </span>
              <button
                className="dvc-link-btn"
                type="button"
                disabled={!!actionBusy}
                onClick={() => runAction("forceEnd", "force-end")}
                style={{ borderColor: "#fecaca", background: "#fee2e2", color: "#991b1b" }}
              >
                {actionBusy === "forceEnd" ? "Ending…" : "Yes, end it"}
              </button>
              <button className="dvc-link-btn" type="button" onClick={() => setConfirmForceEnd(false)}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      <ParticipantsCard
        participants={participants}
        rowKey={(p) => p.guestId}
        emptyText="Nobody has joined this room yet."
        columns={DIRECT_PARTICIPANT_COLUMNS}
      />

      <LiveCard
        liveOpen={liveOpen}
        participants={participants}
        liveSamples={liveSamples}
        participantKey={(p) => p.guestId}
      />

      <TimelineCard
        timeline={timeline}
        isSuperAdmin={isSuperAdmin}
        actionBusy={actionBusy}
        onDelete={deleteTimeline}
      />
    </div>
  );
}
