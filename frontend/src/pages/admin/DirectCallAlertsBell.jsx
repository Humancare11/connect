import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { createAdminNotificationFeed, timeAgo, unreadTotal } from "./adminNotificationFeed";

// The admin top-bar bell. Despite the file name (kept so AdminLayout is untouched) it shows
// the combined feed: shared admin notifications (bookings, doctors, partner cases, tickets)
// plus the original direct-call alerts. All fetching, polling, read handling and race
// protection live in adminNotificationFeed.js; this file only renders. Polls plain REST
// endpoints, never the call-signaling socket.
export default function DirectCallAlertsBell() {
  const [feed] = useState(() => createAdminNotificationFeed({ api }));
  const state = useSyncExternalStore(feed.subscribe, feed.getState);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    feed.start();
    return () => feed.stop();
  }, [feed]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    feed.setPanelOpen(open);
  }, [feed, open]);

  const total = unreadTotal(state);
  const { items, status, partial, markError } = state;

  return (
    <div ref={panelRef} className="ad-bell">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={total > 0 ? `Notifications, ${total} unread` : "Notifications"}
        aria-expanded={open}
        className="ad-bell-btn"
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10,
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
        {total > 0 && (
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
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          className="ad-bell-panel"
          style={{
            maxHeight: 420,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            zIndex: 300,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              fontWeight: 700,
              fontSize: 13,
              borderBottom: "1px solid #f1f5f9",
              color: "#0a1f44",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>Notifications</span>
            {state.generalUnread > 0 && (
              <button
                type="button"
                onClick={feed.markAllRead}
                title="Marks the notifications read for you. Direct call alerts are marked one by one."
                style={{ fontSize: 12, color: "#4b5db8", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {markError && (
            <div role="alert" style={{ padding: "8px 14px", fontSize: 12, color: "#b91c1c", background: "#fef2f2" }}>
              {markError}
            </div>
          )}
          {partial && status === "ready" && (
            <div role="alert" style={{ padding: "8px 14px", fontSize: 12, color: "#92400e", background: "#fffbeb" }}>
              Some notifications couldn't be loaded.{" "}
              <button type="button" onClick={() => feed.loadItems()} style={retryStyle}>
                Retry
              </button>
            </div>
          )}

          {status === "loading" || status === "idle" ? (
            <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Loading…</div>
          ) : status === "error" ? (
            <div role="alert" style={{ padding: 16, fontSize: 13, color: "#b91c1c" }}>
              Unable to load notifications. Please try again.{" "}
              <button type="button" onClick={() => feed.loadItems()} style={{ ...retryStyle, fontSize: 13 }}>
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>No notifications yet.</div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #f1f5f9",
                  background: item.read ? "#fff" : "#eff6ff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0a1f44" }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{timeAgo(item.createdAt)}</span>
                </div>
                {item.message && <p style={{ margin: "4px 0", fontSize: 12.5, color: "#374151" }}>{item.message}</p>}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {item.link && (
                    <Link
                      to={item.link}
                      onClick={() => {
                        setOpen(false);
                        // Direct-call alerts keep their explicit "Mark as read" (one global state).
                        if (item.source === "general") feed.markRead(item.key);
                      }}
                      style={{ fontSize: 12, color: "#4b5db8", fontWeight: 600, textDecoration: "none" }}
                    >
                      {item.linkLabel}
                    </Link>
                  )}
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => feed.markRead(item.key)}
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

const retryStyle = { fontSize: 12, color: "#4b5db8", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 };
