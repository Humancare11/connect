import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./DoctorNotes.css";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import VisitNoteEditor from "../../components/VisitNoteEditor";

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
  const confirm = useConfirm();
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

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Keep the list card in step with what the editor auto-saved.
  const handleNoteChange = useCallback((saved) => {
    if (!saved?._id) return;
    setNotes((prev) =>
      prev.map((note) =>
        note._id === saved._id
          ? { ...note, updatedAt: saved.updatedAt, reportId: saved.reportId, status: saved.status }
          : note,
      ),
    );
  }, []);

  const deleteSelectedNote = async () => {
    if (!selectedNote || saving) return;
    const confirmed = await confirm({
      title: "Delete note",
      message: "Delete this consultation note permanently?",
      confirmText: "Delete",
      tone: "danger",
    });
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
          <p className="dn-subtitle">Structured notes saved during video consultations. Finalise a note to add it to a Visit Note.</p>
        </div>
      </div>

      <div className="dn-filters">
        <input
          className="dn-input dn-search"
          type="search"
          placeholder="Search by patient name"
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
                <span className={`dn-pill ${note.reportId ? "dn-pill--final" : "dn-pill--draft"}`}>
                  {note.reportId ? "Finalised" : "Draft"}
                </span>
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
                <div>
                  <span>Status</span>
                  <strong>
                    {selectedNote.reportId ? "Finalised · in Visit Note" : "Draft · only you can see"}
                  </strong>
                </div>
              </div>

              <VisitNoteEditor
                key={selectedNote.appointmentId?._id || selectedNote._id}
                appointmentId={selectedNote.appointmentId?._id}
                variant="page"
                showBadge={false}
                onNoteChange={handleNoteChange}
                onDelete={deleteSelectedNote}
              />
            </>
          ) : (
            <div className="dn-empty dn-empty--editor">Select a note to view details.</div>
          )}
        </section>
      </div>
    </div>
  );
}
