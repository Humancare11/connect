import { useCallback, useEffect, useState } from "react";
import api from "../api";
import "./ConsultationNotesPanel.css";

function formatNoteDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Read-only list of a patient's saved consultation notes. Shared between the
 * "My Patients" notes modal and the dedicated "Write Prescription" page so
 * doctors can reference past consultations while writing documents.
 */
export default function ConsultationNotesPanel({ patientId, className = "" }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const loadNotes = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/notes", { params: { patientId } });
      const list = Array.isArray(data?.notes) ? data.notes : [];
      setNotes(list);
      setExpandedId(list[0]?._id || "");
    } catch (err) {
      setError(
        err.response?.data?.msg || "Failed to load consultation notes.",
      );
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  return (
    <div className={`cnp-root ${className}`.trim()}>
      {loading ? (
        <div className="cnp-loading">
          <div className="cnp-spinner" />
        </div>
      ) : error ? (
        <div className="cnp-error">{error}</div>
      ) : notes.length === 0 ? (
        <p className="cnp-empty">
          No consultation notes saved for this patient yet.
        </p>
      ) : (
        <div className="cnp-list">
          {notes.map((note) => {
            const isOpen = expandedId === note._id;
            return (
              <div key={note._id} className="cnp-item">
                <button
                  type="button"
                  className="cnp-item-head"
                  onClick={() => setExpandedId(isOpen ? "" : note._id)}
                  aria-expanded={isOpen}
                >
                  <span className="cnp-item-caret">{isOpen ? "▾" : "▸"}</span>
                  <span className="cnp-item-date">
                    {formatNoteDate(note.appointmentId?.date)}
                    {note.appointmentId?.time
                      ? ` · ${note.appointmentId.time}`
                      : ""}
                  </span>
                  <span className="cnp-item-updated">
                    Updated {formatNoteDate(note.updatedAt)}
                  </span>
                </button>
                {isOpen && (
                  <p className="cnp-item-content">
                    {note.content?.trim()
                      ? note.content
                      : "No content recorded."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
