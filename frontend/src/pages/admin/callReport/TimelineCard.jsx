import { useState } from "react";
import { formatDate } from "./reportUtils";

// "Timeline" section of an admin call report, including the superadmin-only
// "Delete timeline data" control. Extracted from AdminDirectVideoCallDetail.jsx;
// the two-step confirm state now lives here. `onDelete` must return a promise
// (the confirm closes when it settles, as before).
export default function TimelineCard({
  timeline,
  isSuperAdmin,
  actionBusy,
  onDelete,
  deleteLabel = "Delete timeline data",
  deleteWarning = (count) => `Permanently deletes all ${count} event(s). Are you sure?`,
}) {
  const [confirmDeleteTimeline, setConfirmDeleteTimeline] = useState(false);

  const handleDelete = async () => {
    try {
      await onDelete();
    } finally {
      setConfirmDeleteTimeline(false);
    }
  };

  return (
    <div className="dvc-card">
      <div className="dvc-form__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Timeline</h2>
        {isSuperAdmin && timeline.length > 0 && (
          !confirmDeleteTimeline ? (
            <button
              type="button"
              className="dvc-link-btn"
              disabled={!!actionBusy}
              onClick={() => setConfirmDeleteTimeline(true)}
              style={{ borderColor: "#fecaca", background: "#fee2e2", color: "#991b1b" }}
            >
              {deleteLabel}
            </button>
          ) : (
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                {deleteWarning(timeline.length)}
              </span>
              <button
                type="button"
                className="dvc-link-btn"
                disabled={!!actionBusy}
                onClick={handleDelete}
                style={{ borderColor: "#fecaca", background: "#fee2e2", color: "#991b1b" }}
              >
                {actionBusy === "deleteTimeline" ? "Deleting…" : "Yes, delete it"}
              </button>
              <button type="button" className="dvc-link-btn" onClick={() => setConfirmDeleteTimeline(false)}>
                Cancel
              </button>
            </span>
          )
        )}
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
  );
}
