import { useEffect, useState } from "react";
import api from "../../../api";

// Blocked IPs (collapsed by default): a block lasts until someone removes it here.
export default function BlockedIpsPanel({ refreshKey }) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // bumped after an unblock to reload the list

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/admin/livechat/blocked-ips")
      .then(({ data }) => {
        if (!cancelled) setBlocked(data.blocked || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the blocked IPs.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, version]);

  return (
    <div className="lcv-blocked">
      <button type="button" className="lcv-blocked-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⛔ Blocked IPs <span className="lcv-blocked-count">{blocked.length}</span>
      </button>
      {open && (
        <div className="lcv-blocked-body">
          {error && <div className="lcv-start-error">{error}</div>}
          {blocked.length === 0 && <span className="lcv-muted">No IP is blocked.</span>}
          {blocked.map((entry) => (
            <div key={entry.id} className="lcv-blocked-row">
              <span className="lcv-mono">{entry.ip}</span>
              <span className="lcv-muted">{entry.reason || "No reason given"}</span>
              <span className="lcv-muted">{new Date(entry.createdAt).toLocaleDateString()}</span>
              <button
                type="button"
                className="lcv-btn"
                onClick={async () => {
                  try {
                    await api.delete(`/api/admin/livechat/blocked-ips/${entry.id}`);
                    setVersion((v) => v + 1);
                  } catch {
                    setError("Could not unblock that IP.");
                  }
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
