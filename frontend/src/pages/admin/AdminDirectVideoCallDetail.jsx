import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import socket, { setSocketAuthRole } from "../../socket";
import "./AdminDirectVideoConsultation.css";

const CONNECTION_STATE_COLORS = {
  connected: "#16a34a",
  connecting: "#d97706",
  new: "#6b7280",
  disconnected: "#dc2626",
  failed: "#dc2626",
  closed: "#6b7280",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function roleLabel(role) {
  if (role === "initiator") return "Host";
  if (role === "guest") return "Guest";
  return "Participant";
}

export default function AdminDirectVideoCallDetail() {
  const { roomId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmForceEnd, setConfirmForceEnd] = useState(false);

  // Phase 5.1: Live view — off by default, only watching while liveOpen is
  // true. Samples are keyed by guestId; never persisted anywhere, just held
  // in this component's state for as long as the panel is open.
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
    socket.off("direct-live-monitor-sample", handleLiveSample);
  }, [roomId, handleLiveSample]);

  const startWatching = useCallback(() => {
    setSocketAuthRole("admin");
    if (!socket.connected) socket.connect();
    liveOpenRef.current = true;
    setLiveOpen(true);
    setLiveSamples({});
    socket.on("direct-live-monitor-sample", handleLiveSample);
    socket.emit("admin-watch-direct-room", { roomId });
  }, [roomId, handleLiveSample]);

  // Stop watching on unmount (navigating away) or if the room changes —
  // never leaves the server thinking this admin is still watching a room
  // whose page isn't open anymore.
  useEffect(() => () => stopWatching(), [stopWatching]);

  const fetchReport = () => {
    setLoading(true);
    setError("");
    api
      .get(`/api/direct-video-room/${roomId}/events`)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load this call's report."))
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

  if (loading) return <div className="dvc-page dvc-empty">Loading call report…</div>;
  if (error || !data) return <div className="dvc-page dvc-error">{error || "Not found."}</div>;

  const { room, participants, timeline } = data;

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
        <Link to="/admin-dashboard/direct-video-consultation/calls" className="dvc-secondary">
          ← Back to Calls
        </Link>
      </div>

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

      <div className="dvc-card">
        <div className="dvc-form__title">
          <h2>Participants</h2>
        </div>
        {participants.length === 0 ? (
          <div className="dvc-empty">Nobody has joined this room yet.</div>
        ) : (
          <div className="dvc-table-wrap">
            <table className="dvc-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Device</th>
                  <th>Joined</th>
                  <th>Last seen</th>
                  <th>Connection</th>
                  <th>Mic</th>
                  <th>Camera</th>
                  <th>IP (masked)</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.guestId}>
                    <td>{roleLabel(p.role)}</td>
                    <td>{[p.device, p.browser, p.os].filter(Boolean).join(", ") || "-"}</td>
                    <td>{formatDate(p.joinedAt)}</td>
                    <td>{formatDate(p.lastSeenAt)}</td>
                    <td>{p.connectionState}</td>
                    <td>{p.isMicOff === null ? "-" : p.isMicOff ? "Off" : "On"}</td>
                    <td>{p.isCamOff === null ? "-" : p.isCamOff ? "Off" : "On"}</td>
                    <td>{p.maskedIp || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dvc-card">
        <div className="dvc-form__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Live</h2>
          <button
            className="dvc-secondary"
            type="button"
            onClick={liveOpen ? stopWatching : startWatching}
          >
            {liveOpen ? "Stop Live Monitoring" : "Start Live Monitoring"}
          </button>
        </div>
        {!liveOpen ? (
          <div className="dvc-empty">
            Start Live Monitoring to see both participants' mic level, mute/camera state, connection
            state and network quality update every 1-2 seconds while this call is in progress. Both
            participants see a small notice while you're watching.
          </div>
        ) : participants.filter((p) => p.connectionState !== "left").length === 0 ? (
          <div className="dvc-empty">Waiting for a participant to be in the call…</div>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {participants
              .filter((p) => p.connectionState !== "left")
              .map((p) => {
                const sample = liveSamples[p.guestId];
                const stale = sample && Date.now() - sample.at > 6000;
                const level = sample ? Math.round(sample.micLevel * 100) : 0;
                return (
                  <div
                    key={p.guestId}
                    style={{
                      minWidth: 220,
                      flex: "1 1 240px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 14,
                      opacity: stale ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1f44", marginBottom: 8 }}>
                      {roleLabel(p.role)}
                    </div>
                    {!sample ? (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>No samples yet…</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Mic level</div>
                        <div style={{ background: "#f1f5f9", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 10 }}>
                          <div
                            style={{
                              width: `${level}%`,
                              height: "100%",
                              background: sample.micOn ? "#16a34a" : "#d1d5db",
                              transition: "width 150ms linear",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#374151", flexWrap: "wrap" }}>
                          <span>Mic: {sample.micOn ? "On" : "Off"}</span>
                          <span>Camera: {sample.camOn ? "On" : "Off"}</span>
                          <span style={{ color: CONNECTION_STATE_COLORS[sample.connectionState] || "#374151" }}>
                            {sample.connectionState || "unknown"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                          <span>RTT: {typeof sample.rtt === "number" ? `${sample.rtt}ms` : "-"}</span>
                          <span>
                            Loss: {typeof sample.packetLoss === "number" ? `${(sample.packetLoss * 100).toFixed(1)}%` : "-"}
                          </span>
                        </div>
                        {stale && <div style={{ fontSize: 11, color: "#d97706", marginTop: 6 }}>No recent samples</div>}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="dvc-card">
        <div className="dvc-form__title">
          <h2>Timeline</h2>
        </div>
        {timeline.length === 0 ? (
          <div className="dvc-empty">No events recorded yet.</div>
        ) : (
          <ul className="dvc-timeline">
            {timeline.map((event, i) => (
              <li key={i}>
                <span className="dvc-timeline__time">{formatDate(event.at)}</span>
                <span className="dvc-timeline__summary">{event.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
