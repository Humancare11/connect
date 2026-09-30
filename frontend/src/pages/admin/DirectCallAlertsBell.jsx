import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

const POLL_MS = 30_000;

const ALERT_LABELS = {
  room_full: "Meeting full",
  repeated_retries: "Repeated reconnects",
  never_connected: "Never connected",
};

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Admin-panel-only, best-effort UI (Phase 4). Polls a plain REST endpoint
// rather than a socket — this must never depend on / interfere with the
// call-signaling socket connection.
export default function DirectCallAlertsBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    api
      .get("/api/direct-video-room/alerts/unread-count")
      .then((res) => setUnreadCount(res.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const timer = setInterval(refreshUnreadCount, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openPanel = () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      api
        .get("/api/direct-video-room/alerts?limit=20")
        .then((res) => setAlerts(res.data?.alerts || []))
        .catch(() => setAlerts([]))
        .finally(() => setLoading(false));
    }
  };

  const markRead = (alertId) => {
    setAlerts((prev) => prev.map((a) => (a._id === alertId ? { ...a, readAt: new Date().toISOString() } : a)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    api.post(`/api/direct-video-room/alerts/${alertId}/read`).catch(() => {});
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Direct call alerts"
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#ef4444",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              minWidth: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            zIndex: 300,
          }}
        >
          <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9", color: "#0a1f44" }}>
            Direct call alerts
          </div>
          {loading ? (
            <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Loading…</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>No alerts yet.</div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert._id}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #f1f5f9",
                  background: alert.readAt ? "#fff" : "#eff6ff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0a1f44" }}>
                    {ALERT_LABELS[alert.type] || alert.type}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(alert.createdAt)}</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: 12.5, color: "#374151" }}>
                  {alert.message}
                  {alert.doctorName ? ` — Dr. ${alert.doctorName}` : ""}
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Link
                    to={`/admin-dashboard/direct-video-consultation/calls/${alert.roomId}`}
                    onClick={() => setOpen(false)}
                    style={{ fontSize: 12, color: "#4b5db8", fontWeight: 600, textDecoration: "none" }}
                  >
                    View call →
                  </Link>
                  {!alert.readAt && (
                    <button
                      type="button"
                      onClick={() => markRead(alert._id)}
                      style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
