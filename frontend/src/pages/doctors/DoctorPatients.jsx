import { useState, useEffect, useCallback } from "react";
import "./DoctorPatients.css";
import api from "../../api";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_MEDICINE = { name: "", dosage: "", frequency: "", duration: "", notes: "" };
const EMPTY_RX = { diagnosis: "", medicines: [{ ...EMPTY_MEDICINE }], instructions: "", followUpDate: "" };
const EMPTY_CERT = { diagnosis: "", recommendation: "", restFromDate: "", restToDate: "", notes: "" };

// ── Small reusable components ─────────────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  const colors = ["#19c9a3", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="dp-avatar" style={{ width: size, height: size, background: `${color}22`, color, fontSize: size * 0.4 }}>
      {name?.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

// ── Prescription Modal ────────────────────────────────────────────────────────

function PrescriptionModal({ patient, appointments, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_RX, appointmentId: appointments[0]?._id || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setMed = (i, k, v) =>
    setForm((p) => {
      const meds = [...p.medicines];
      meds[i] = { ...meds[i], [k]: v };
      return { ...p, medicines: meds };
    });

  const addMed = () => setForm((p) => ({ ...p, medicines: [...p.medicines, { ...EMPTY_MEDICINE }] }));
  const removeMed = (i) =>
    setForm((p) => ({ ...p, medicines: p.medicines.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.diagnosis.trim()) { setError("Diagnosis is required."); return; }
    if (!form.appointmentId) { setError("Select an appointment."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/medical/prescriptions", { ...form, patientId: patient._id });
      onSaved("prescription");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save prescription.");
      setSaving(false);
    }
  };

  return (
    <div className="dp-modal-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-header">
          <h2>New Prescription</h2>
          <span className="dp-modal-patient">for {patient.name}</span>
          <button className="dp-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="dp-modal-body" onSubmit={submit}>
          {error && <div className="dp-modal-error">{error}</div>}

          <label className="dp-label">Appointment</label>
          <select className="dp-input" value={form.appointmentId} onChange={(e) => setField("appointmentId", e.target.value)}>
            {appointments.map((a) => (
              <option key={a._id} value={a._id}>
                {formatDate(a.date)} — {a.time} ({a.status})
              </option>
            ))}
          </select>

          <label className="dp-label">Diagnosis *</label>
          <input className="dp-input" value={form.diagnosis} onChange={(e) => setField("diagnosis", e.target.value)} placeholder="e.g. Acute viral pharyngitis" />

          <label className="dp-label">Medicines</label>
          {form.medicines.map((med, i) => (
            <div key={i} className="dp-med-row">
              <input className="dp-input dp-med-name" value={med.name} onChange={(e) => setMed(i, "name", e.target.value)} placeholder="Medicine name" />
              <input className="dp-input dp-med-sm" value={med.dosage} onChange={(e) => setMed(i, "dosage", e.target.value)} placeholder="Dosage" />
              <input className="dp-input dp-med-sm" value={med.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} placeholder="Frequency" />
              <input className="dp-input dp-med-sm" value={med.duration} onChange={(e) => setMed(i, "duration", e.target.value)} placeholder="Duration" />
              <button type="button" className="dp-med-remove" onClick={() => removeMed(i)} title="Remove">✕</button>
            </div>
          ))}
          <button type="button" className="dp-add-med-btn" onClick={addMed}>+ Add Medicine</button>

          <label className="dp-label">Instructions</label>
          <textarea className="dp-input dp-textarea" value={form.instructions} onChange={(e) => setField("instructions", e.target.value)} placeholder="Special instructions, diet, rest..." rows={3} />

          <label className="dp-label">Follow-up Date</label>
          <input className="dp-input" type="date" value={form.followUpDate} onChange={(e) => setField("followUpDate", e.target.value)} />

          <div className="dp-modal-footer">
            <button type="button" className="dp-btn dp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="dp-btn dp-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Medical Certificate Modal ─────────────────────────────────────────────────

function CertificateModal({ patient, appointments, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_CERT, appointmentId: appointments[0]?._id || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.diagnosis.trim()) { setError("Diagnosis is required."); return; }
    if (!form.appointmentId) { setError("Select an appointment."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/medical/certificates", { ...form, patientId: patient._id });
      onSaved("certificate");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to issue certificate.");
      setSaving(false);
    }
  };

  return (
    <div className="dp-modal-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-header">
          <h2>Medical Certificate</h2>
          <span className="dp-modal-patient">for {patient.name}</span>
          <button className="dp-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="dp-modal-body" onSubmit={submit}>
          {error && <div className="dp-modal-error">{error}</div>}

          <label className="dp-label">Appointment</label>
          <select className="dp-input" value={form.appointmentId} onChange={(e) => setField("appointmentId", e.target.value)}>
            {appointments.map((a) => (
              <option key={a._id} value={a._id}>
                {formatDate(a.date)} — {a.time} ({a.status})
              </option>
            ))}
          </select>

          <label className="dp-label">Diagnosis *</label>
          <input className="dp-input" value={form.diagnosis} onChange={(e) => setField("diagnosis", e.target.value)} placeholder="Diagnosis / condition" />

          <label className="dp-label">Recommendation</label>
          <input className="dp-input" value={form.recommendation} onChange={(e) => setField("recommendation", e.target.value)} placeholder="e.g. Bed rest recommended" />

          <div className="dp-date-row">
            <div>
              <label className="dp-label">Rest From</label>
              <input className="dp-input" type="date" value={form.restFromDate} onChange={(e) => setField("restFromDate", e.target.value)} />
            </div>
            <div>
              <label className="dp-label">Rest To</label>
              <input className="dp-input" type="date" value={form.restToDate} onChange={(e) => setField("restToDate", e.target.value)} />
            </div>
          </div>

          <label className="dp-label">Additional Notes</label>
          <textarea className="dp-input dp-textarea" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Any additional remarks..." rows={3} />

          <div className="dp-modal-footer">
            <button type="button" className="dp-btn dp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="dp-btn dp-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Issue Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Patient Detail Panel ──────────────────────────────────────────────────────

function PatientPanel({ entry, onClose }) {
  const { patient } = entry;
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // "rx" | "cert"
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.get(`/api/medical/patients/${patient._id}/history`)
      .then((r) => setHistory(r.data))
      .catch(() => setHistory({ appointments: [], prescriptions: [], certificates: [] }))
      .finally(() => setLoading(false));
  }, [patient._id]);

  const handleSaved = (type) => {
    setModal(null);
    setToast(type === "rx" ? "Prescription saved!" : "Certificate issued!");
    setTimeout(() => setToast(""), 3000);
    setLoading(true);
    api.get(`/api/medical/patients/${patient._id}/history`)
      .then((r) => setHistory(r.data))
      .finally(() => setLoading(false));
  };

  const completedAppts = history?.appointments?.filter((a) => a.status === "completed") || [];

  return (
    <div className="dp-panel-overlay" onClick={onClose}>
      <div className="dp-panel" onClick={(e) => e.stopPropagation()}>
        {toast && <div className="dp-toast">{toast}</div>}

        <div className="dp-panel-header">
          <Avatar name={patient.name} size={48} />
          <div>
            <h2 className="dp-panel-name">{patient.name}</h2>
            <p className="dp-panel-email">{patient.email}</p>
            {patient.mobile && <p className="dp-panel-meta">📱 {patient.mobile}</p>}
          </div>
          <button className="dp-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dp-panel-actions">
          <button className="dp-btn dp-btn--primary" onClick={() => setModal("rx")} disabled={completedAppts.length === 0}>
            💊 Write Prescription
          </button>
          <button className="dp-btn dp-btn--secondary" onClick={() => setModal("cert")} disabled={completedAppts.length === 0}>
            📄 Issue Certificate
          </button>
          {completedAppts.length === 0 && (
            <span className="dp-panel-note">Complete a consultation first to issue documents.</span>
          )}
        </div>

        {loading ? (
          <div className="dp-panel-loading"><div className="dp-spinner" /></div>
        ) : (
          <div className="dp-panel-tabs">
            {/* Appointments */}
            <section>
              <h3 className="dp-section-title">Appointments ({history.appointments.length})</h3>
              {history.appointments.length === 0 ? (
                <p className="dp-empty">No appointments yet.</p>
              ) : (
                <div className="dp-appt-list">
                  {history.appointments.map((a) => (
                    <div key={a._id} className="dp-appt-item">
                      <span className={`dp-status-dot dp-status-dot--${a.status}`} />
                      <span className="dp-appt-date">{formatDate(a.date)}</span>
                      <span className="dp-appt-time">{a.time}</span>
                      <span className="dp-appt-problem">{a.problem || "—"}</span>
                      <span className={`dp-badge dp-badge--${a.status}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Prescriptions */}
            <section>
              <h3 className="dp-section-title">Prescriptions ({history.prescriptions.length})</h3>
              {history.prescriptions.length === 0 ? (
                <p className="dp-empty">No prescriptions issued.</p>
              ) : (
                history.prescriptions.map((rx) => (
                  <div key={rx._id} className="dp-record-card dp-record-card--rx">
                    <div className="dp-record-header">
                      <span className="dp-record-icon">💊</span>
                      <span className="dp-record-title">{rx.diagnosis}</span>
                      <span className="dp-record-date">{formatDate(rx.createdAt)}</span>
                    </div>
                    {rx.medicines?.length > 0 && (
                      <ul className="dp-med-list">
                        {rx.medicines.map((m, i) => (
                          <li key={i}><strong>{m.name}</strong>{m.dosage ? ` — ${m.dosage}` : ""}{m.frequency ? `, ${m.frequency}` : ""}{m.duration ? ` for ${m.duration}` : ""}</li>
                        ))}
                      </ul>
                    )}
                    {rx.instructions && <p className="dp-record-note">📋 {rx.instructions}</p>}
                    {rx.followUpDate && <p className="dp-record-note">🔁 Follow-up: {formatDate(rx.followUpDate)}</p>}
                  </div>
                ))
              )}
            </section>

            {/* Certificates */}
            <section>
              <h3 className="dp-section-title">Medical Certificates ({history.certificates.length})</h3>
              {history.certificates.length === 0 ? (
                <p className="dp-empty">No certificates issued.</p>
              ) : (
                history.certificates.map((cert) => (
                  <div key={cert._id} className="dp-record-card dp-record-card--cert">
                    <div className="dp-record-header">
                      <span className="dp-record-icon">📄</span>
                      <span className="dp-record-title">{cert.diagnosis}</span>
                      <span className="dp-record-date">Issued: {formatDate(cert.issuedDate)}</span>
                    </div>
                    {cert.recommendation && <p className="dp-record-note">✅ {cert.recommendation}</p>}
                    {cert.restFromDate && cert.restToDate && (
                      <p className="dp-record-note">🗓 Rest: {formatDate(cert.restFromDate)} → {formatDate(cert.restToDate)}</p>
                    )}
                    {cert.notes && <p className="dp-record-note">📋 {cert.notes}</p>}
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>

      {modal === "rx" && (
        <PrescriptionModal
          patient={patient}
          appointments={completedAppts}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved("rx")}
        />
      )}
      {modal === "cert" && (
        <CertificateModal
          patient={patient}
          appointments={completedAppts}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved("cert")}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/api/medical/patients")
      .then((r) => setPatients(r.data))
      .catch((err) => console.error("Failed to load patients", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((e) =>
    e.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.patient?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dp-root">
      <header className="dp-header">
        <div>
          <span className="dp-eyebrow">HumaniCare</span>
          <h1 className="dp-title">My Patients</h1>
          <p className="dp-sub">Patients from completed consultations</p>
        </div>
        <div className="dp-header-right">
          <div className="dp-search-wrap">
            <span className="dp-search-icon">🔍</span>
            <input
              className="dp-search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="dp-stats">
        <div className="dp-stat">
          <div className="dp-stat-num">{patients.length}</div>
          <div className="dp-stat-label">Total Patients</div>
        </div>
        <div className="dp-stat">
          <div className="dp-stat-num">{patients.reduce((s, e) => s + e.totalVisits, 0)}</div>
          <div className="dp-stat-label">Completed Sessions</div>
        </div>
      </div>

      {loading ? (
        <div className="dp-loading"><div className="dp-spinner" /><p>Loading patients…</p></div>
      ) : filtered.length === 0 ? (
        <div className="dp-empty-state">
          <div className="dp-empty-icon">👥</div>
          <h3>No patients yet</h3>
          <p>Patients will appear here after you complete a video consultation.</p>
        </div>
      ) : (
        <div className="dp-grid">
          {filtered.map((entry) => (
            <button
              key={entry.patient._id}
              className="dp-card"
              onClick={() => setSelected(entry)}
            >
              <Avatar name={entry.patient.name} size={52} />
              <div className="dp-card-info">
                <h3 className="dp-card-name">{entry.patient.name}</h3>
                <p className="dp-card-email">{entry.patient.email}</p>
                {entry.patient.mobile && <p className="dp-card-meta">📱 {entry.patient.mobile}</p>}
              </div>
              <div className="dp-card-visits">
                <span className="dp-card-visits-num">{entry.totalVisits}</span>
                <span className="dp-card-visits-label">visit{entry.totalVisits > 1 ? "s" : ""}</span>
              </div>
              <div className="dp-card-last">
                <span>Last visit</span>
                <span>{formatDate(entry.lastAppointment?.date)}</span>
              </div>
              <span className="dp-card-arrow">›</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PatientPanel
          entry={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
