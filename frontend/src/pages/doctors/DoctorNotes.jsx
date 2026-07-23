import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./DoctorNotes.css";

const fmtDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtAppointmentDate = (date, time) => {
  if (!date && !time) return "No appointment date";
  const dateText = date
    ? new Date(date).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  return [dateText, time].filter(Boolean).join(" at ");
};

const getPatientName = (note) => note?.patientId?.name || "Unknown Patient";

export default function DoctorNotes() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [draft, setDraft] = useState({
    content: "",
    version: 0,
  });

  const selectedNote = useMemo(
    () => notes.find((note) => note._id === selectedId) || null,
    [notes, selectedId],
  );

  const buildParams = useCallback(() => {
    const params = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    return params;
  }, [filters]);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/notes", { params: buildParams() });
      const nextNotes = Array.isArray(data.notes) ? data.notes : [];
      setNotes(nextNotes);
      setSelectedId((current) => {
        if (current && nextNotes.some((note) => note._id === current)) return current;
        return nextNotes[0]?._id || "";
      });
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load consultation notes.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!selectedNote) {
      setDraft({ content: "", version: 0 });
      return;
    }

    setDraft({
      content: selectedNote.content || "",
      version: Number.isInteger(selectedNote.__v) ? selectedNote.__v : 0,
    });
  }, [selectedNote]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const saveSelectedNote = async () => {
    if (!selectedNote || saving) return;

    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const { data } = await api.patch(`/api/notes/${selectedNote._id}`, {
        content: draft.content,
        version: draft.version,
      });
      const saved = data.note;
      setNotes((prev) => prev.map((note) => (note._id === saved._id ? saved : note)));
      setSelectedId(saved._id);
      setSavedMessage("Note saved.");
      setTimeout(() => setSavedMessage(""), 2500);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save consultation note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedNote = async () => {
    if (!selectedNote || saving) return;
    const confirmed = window.confirm("Delete this consultation note permanently?");
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await api.delete(`/api/notes/${selectedNote._id}`);
      setNotes((prev) => {
        const nextNotes = prev.filter((note) => note._id !== selectedNote._id);
        setSelectedId(nextNotes[0]?._id || "");
        return nextNotes;
      });
      setSavedMessage("Note deleted.");
      setTimeout(() => setSavedMessage(""), 2500);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete consultation note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dn-page">
      <div className="dn-header">
        <div>
          <span className="dn-eyebrow">Consultation notes</span>
          <h2 className="dn-title">Notes</h2>
          <p className="dn-subtitle">Review and manage notes saved during video consultations.</p>
        </div>
      </div>

      <div className="dn-filters">
        <input
          className="dn-input dn-search"
          type="search"
          placeholder="Search notes or patients"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
        <input
          className="dn-input"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
        />
        <input
          className="dn-input"
          type="date"
          value={filters.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
        />
        <button className="dn-btn dn-btn--ghost" type="button" onClick={loadNotes} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="dn-alert dn-alert--error">{error}</div>}
      {savedMessage && <div className="dn-alert dn-alert--success">{savedMessage}</div>}

      <div className="dn-workspace">
        <aside className="dn-list" aria-label="Consultation notes list">
          {loading ? (
            <div className="dn-empty">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="dn-empty">No consultation notes found.</div>
          ) : (
            notes.map((note) => (
              <button
                key={note._id}
                type="button"
                className={`dn-note-card${selectedId === note._id ? " dn-note-card--active" : ""}`}
                onClick={() => setSelectedId(note._id)}
              >
                <strong>{getPatientName(note)}</strong>
                <span>{fmtAppointmentDate(note.appointmentId?.date, note.appointmentId?.time)}</span>
                <small>Updated {fmtDateTime(note.updatedAt)}</small>
              </button>
            ))
          )}
        </aside>

        <section className="dn-editor">
          {selectedNote ? (
            <>
              <div className="dn-editor-head">
                <div>
                  <span className="dn-eyebrow">Patient</span>
                  <h3>{getPatientName(selectedNote)}</h3>
                  <p>{selectedNote.patientId?.email || "No patient email"}</p>
                </div>
              </div>

              <div className="dn-meta-grid">
                <div>
                  <span>Appointment</span>
                  <strong>
                    {fmtAppointmentDate(selectedNote.appointmentId?.date, selectedNote.appointmentId?.time)}
                  </strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>{fmtDateTime(selectedNote.updatedAt)}</strong>
                </div>
              </div>

              <textarea
                className="dn-textarea"
                value={draft.content}
                onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                maxLength={20000}
                disabled={saving}
                placeholder="Consultation observations, assessment, plan, and follow-up notes..."
              />

              <div className="dn-editor-foot">
                <span>{draft.content.length}/20000</span>
                <div className="dn-actions">
                  <button
                    type="button"
                    className="dn-btn dn-btn--danger"
                    onClick={deleteSelectedNote}
                    disabled={saving}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="dn-btn dn-btn--primary"
                    onClick={saveSelectedNote}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="dn-empty dn-empty--editor">Select a note to view details.</div>
          )}
        </section>
      </div>
    </div>
  );
}
