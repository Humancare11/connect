import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./DoctorPatients.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";
import ConsultationNotesPanel from "../../components/ConsultationNotesPanel";
import { formatShortDate as formatDate } from "../../utils/prescriptionForm";

const PrescriptionSlip = lazy(() =>
  import("../../components/RxSlip").then((module) => ({
    default: module.PrescriptionSlip,
  })),
);

const MedicalCertificateSlip = lazy(() =>
  import("../../components/MedicalCertificateSlip").then((module) => ({
    default: module.MedicalCertificateSlip,
  })),
);

const EMPTY_CERT = {
  diagnosis: "",
  recommendation: "",
  restFromDate: "",
  restToDate: "",
  notes: "",
};

// ── Small reusable components ─────────────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  const colors = ["#19c9a3", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div
      className="dp-avatar"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        fontSize: size * 0.4,
      }}
    >
      {name?.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

// ── Consultation Notes viewer (read-only) ─────────────────────────────────────
// Lets a doctor look up previously saved consultation notes for a patient —
// surfaced next to "Write Prescription" so notes can be referenced while
// preparing an accurate prescription, without leaving the current flow.

function ConsultationNotesModal({ patient, onClose }) {
  return (
    <div
      className="dp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Consultation notes for ${patient.name}`}
    >
      <div className="dp-modal dp-notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-header">
          <h2>Consultation Notes</h2>
          <span className="dp-modal-patient">for {patient.name}</span>
          <button className="dp-modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="dp-modal-body">
          <ConsultationNotesPanel patientId={patient._id} />
        </div>
      </div>
    </div>
  );
}

// ── Medical Certificate Modal ─────────────────────────────────────────────────

function CertificateModal({ patient, appointments, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...EMPTY_CERT,
    appointmentId: appointments[0]?._id || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.diagnosis.trim()) {
      setError("Diagnosis is required.");
      return;
    }
    if (!form.appointmentId) {
      setError("Select an appointment.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/medical/certificates", {
        ...form,
        patientId: patient._id,
      });
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
          <button className="dp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="dp-modal-body" onSubmit={submit}>
          {error && <div className="dp-modal-error">{error}</div>}

          <label className="dp-label">Appointment</label>
          <select
            className="dp-input"
            value={form.appointmentId}
            onChange={(e) => setField("appointmentId", e.target.value)}
          >
            {appointments.map((a) => (
              <option key={a._id} value={a._id}>
                {formatDate(a.date)} — {a.time} ({a.status})
              </option>
            ))}
          </select>

          <label className="dp-label">Diagnosis *</label>
          <input
            className="dp-input"
            value={form.diagnosis}
            onChange={(e) => setField("diagnosis", e.target.value)}
            placeholder="Diagnosis / condition"
          />

          <label className="dp-label">Recommendation</label>
          <input
            className="dp-input"
            value={form.recommendation}
            onChange={(e) => setField("recommendation", e.target.value)}
            placeholder="e.g. Bed rest recommended"
          />

          <div className="dp-date-row">
            <div>
              <label className="dp-label">Rest From</label>
              <input
                className="dp-input"
                type="date"
                value={form.restFromDate}
                onChange={(e) => setField("restFromDate", e.target.value)}
              />
            </div>
            <div>
              <label className="dp-label">Rest To</label>
              <input
                className="dp-input"
                type="date"
                value={form.restToDate}
                onChange={(e) => setField("restToDate", e.target.value)}
              />
            </div>
          </div>

          <label className="dp-label">Additional Notes</label>
          <textarea
            className="dp-input dp-textarea"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Any additional remarks..."
            rows={3}
          />

          <div className="dp-modal-footer">
            <button
              type="button"
              className="dp-btn dp-btn--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dp-btn dp-btn--primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Issue Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Prescription letterhead preview modal ─────────────────────────────────────

function RxSlipModal({ rx, patient, doctor, doctorEnrollment, onClose }) {
  const slipRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!slipRef.current) return;
    setBusy(true);
    try {
      const { downloadPrescriptionPDF } =
        await import("../../components/RxSlip");
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date = rx.createdAt
        ? new Date(rx.createdAt).toISOString().split("T")[0]
        : "rx";
      await downloadPrescriptionPDF(
        slipRef.current,
        `prescription_${name}_${date}.pdf`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dp-modal-overlay" onClick={onClose}>
      <div
        className="dp-modal dp-modal--slip dp-slip-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal toolbar */}
        <div className="dp-slip-toolbar">
          <span className="dp-slip-toolbar-title">Prescription Preview</span>
          <div className="dp-slip-toolbar-actions">
            <button
              className="dp-slip-download-btn"
              onClick={handleDownload}
              disabled={busy}
            >
              {busy ? "Generating…" : "⬇ Download PDF"}
            </button>
            <button className="dp-slip-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Slip — no overflow/maxHeight here: the modal box (and, if needed,
            the outer overlay) grow with content instead of trapping their
            own inner scrollbar. */}
        <div className="dp-slip-body">
          <div className="dp-slip-body-inner">
            <Suspense fallback={null}>
              <PrescriptionSlip
                rx={rx}
                patient={patient}
                doctor={doctor}
                doctorEnrollment={doctorEnrollment}
                slipRef={slipRef}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Certificate letterhead preview modal ──────────────────────────────────────

function CertSlipModal({ cert, patient, doctor, doctorEnrollment, onClose }) {
  const slipRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!slipRef.current) return;
    setBusy(true);
    try {
      const { downloadCertificatePDF } =
        await import("../../components/MedicalCertificateSlip");
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date =
        cert.issuedDate ||
        (cert.createdAt
          ? new Date(cert.createdAt).toISOString().split("T")[0]
          : "cert");
      await downloadCertificatePDF(
        slipRef.current,
        `certificate_${name}_${date}.pdf`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dp-modal-overlay" onClick={onClose}>
      <div
        className="dp-modal dp-modal--slip dp-slip-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dp-slip-toolbar">
          <span className="dp-slip-toolbar-title">
            Medical Certificate Preview
          </span>
          <div className="dp-slip-toolbar-actions">
            <button
              className="dp-slip-download-btn"
              onClick={handleDownload}
              disabled={busy}
            >
              {busy ? "Generating…" : "⬇ Download PDF"}
            </button>
            <button className="dp-slip-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Slip — same fix as RxSlipModal: no overflow/maxHeight trap here. */}
        <div className="dp-slip-body">
          <div className="dp-slip-body-inner">
            <Suspense fallback={null}>
              <MedicalCertificateSlip
                cert={cert}
                patient={patient}
                doctor={doctor}
                doctorEnrollment={doctorEnrollment}
                slipRef={slipRef}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Patient Detail Panel ──────────────────────────────────────────────────────

function PatientPanel({ entry, onClose }) {
  const { patient } = entry;
  const { doctor } = useDoctorAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [previewRx, setPreviewRx] = useState(null); // rx object to preview
  const [previewCert, setPreviewCert] = useState(null); // cert object to preview
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api
      .get(`/api/medical/patients/${patient._id}/history`)
      .then((r) => {
        setHistory(r.data);
      })
      .catch(() =>
        setHistory({ appointments: [], prescriptions: [], certificates: [] }),
      )
      .finally(() => setLoading(false));
  }, [patient._id]);

  const handleCertSaved = () => {
    setCertModalOpen(false);
    setToast("Certificate issued!");
    setTimeout(() => setToast(""), 3000);
    setLoading(true);
    api
      .get(`/api/medical/patients/${patient._id}/history`)
      .then((r) => setHistory(r.data))
      .finally(() => setLoading(false));
  };

  const completedAppts =
    history?.appointments?.filter((a) =>
      ["complete", "completed"].includes(a.status),
    ) || [];

  return (
    <div className="dp-panel-overlay" onClick={onClose}>
      <div className="dp-panel" onClick={(e) => e.stopPropagation()}>
        {toast && <div className="dp-toast">{toast}</div>}

        <div className="dp-panel-header">
          <Avatar name={patient.name} size={48} />
          <div>
            <h2 className="dp-panel-name">{patient.name}</h2>
            <p className="dp-panel-email">{patient.email}</p>
            {patient.mobile && (
              <p className="dp-panel-meta">📱 {patient.mobile}</p>
            )}
          </div>
          <button className="dp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dp-panel-actions">
          <button
            className="dp-btn dp-btn--primary"
            onClick={() =>
              navigate(`/doctor-dashboard/patients/${patient._id}/prescription`)
            }
            disabled={completedAppts.length === 0}
          >
            💊 Write Prescription
          </button>
          <button
            className="dp-btn dp-btn--secondary"
            onClick={() => setCertModalOpen(true)}
            disabled={completedAppts.length === 0}
          >
            📄 Issue Certificate
          </button>
          <button
            className="dp-btn dp-btn--ghost"
            onClick={() => setNotesOpen(true)}
            type="button"
            title="View consultation notes for this patient"
          >
            📝 View Notes
          </button>
          {completedAppts.length === 0 && (
            <span className="dp-panel-note">
              Complete a consultation first to issue documents.
            </span>
          )}
        </div>

        {loading ? (
          <div className="dp-panel-loading">
            <div className="dp-spinner" />
          </div>
        ) : (
          <div className="dp-panel-tabs">
            {/* Appointments */}
            <section>
              <h3 className="dp-section-title">
                Appointments ({history.appointments.length})
              </h3>
              {history.appointments.length === 0 ? (
                <p className="dp-empty">No appointments yet.</p>
              ) : (
                <div className="dp-appt-list">
                  {history.appointments.map((a) => (
                    <div key={a._id} className="dp-appt-item">
                      <span
                        className={`dp-status-dot dp-status-dot--${a.status}`}
                      />
                      <span className="dp-appt-date">{formatDate(a.date)}</span>
                      <span className="dp-appt-time">{a.time}</span>
                      <span className="dp-appt-problem">
                        {a.problem || "—"}
                      </span>
                      <span className={`dp-badge dp-badge--${a.status}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Prescriptions */}
            <section>
              <h3 className="dp-section-title">
                Prescriptions ({history.prescriptions.length})
              </h3>
              {history.prescriptions.length === 0 ? (
                <p className="dp-empty">No prescriptions issued.</p>
              ) : (
                history.prescriptions.map((rx) => (
                  <div
                    key={rx._id}
                    className="dp-record-card dp-record-card--rx"
                  >
                    <div className="dp-record-header">
                      <span className="dp-record-icon">💊</span>
                      <span className="dp-record-title">{rx.diagnosis}</span>
                      <span className="dp-record-date">
                        {formatDate(rx.createdAt)}
                      </span>
                      <button
                        className="dp-slip-btn"
                        onClick={() => setPreviewRx(rx)}
                        title="View & Download Prescription"
                      >
                        ⬇ View Slip
                      </button>
                    </div>
                    {rx.medicines?.length > 0 && (
                      <ul className="dp-med-list">
                        {rx.medicines.map((m, i) => (
                          <li key={i}>
                            <strong>{m.name}</strong>
                            {m.dosage ? ` — ${m.dosage}` : ""}
                            {m.frequency ? `, ${m.frequency}` : ""}
                            {m.duration ? ` for ${m.duration}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {rx.instructions && (
                      <p className="dp-record-note">📋 {rx.instructions}</p>
                    )}
                    {rx.followUpDate && (
                      <p className="dp-record-note">
                        🔁 Follow-up: {formatDate(rx.followUpDate)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Certificates */}
            <section>
              <h3 className="dp-section-title">
                Medical Certificates ({history.certificates.length})
              </h3>
              {history.certificates.length === 0 ? (
                <p className="dp-empty">No certificates issued.</p>
              ) : (
                history.certificates.map((cert) => (
                  <div
                    key={cert._id}
                    className="dp-record-card dp-record-card--cert"
                  >
                    <div className="dp-record-header">
                      <span className="dp-record-icon">📄</span>
                      <span className="dp-record-title">{cert.diagnosis}</span>
                      <span className="dp-record-date">
                        Issued: {formatDate(cert.issuedDate)}
                      </span>
                      <button
                        className="dp-slip-btn"
                        onClick={() => setPreviewCert(cert)}
                        title="View & Download Certificate"
                      >
                        ⬇ View Cert
                      </button>
                    </div>
                    {cert.recommendation && (
                      <p className="dp-record-note">✅ {cert.recommendation}</p>
                    )}
                    {cert.restFromDate && cert.restToDate && (
                      <p className="dp-record-note">
                        🗓 Rest: {formatDate(cert.restFromDate)} →{" "}
                        {formatDate(cert.restToDate)}
                      </p>
                    )}
                    {cert.notes && (
                      <p className="dp-record-note">📋 {cert.notes}</p>
                    )}
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>

      {certModalOpen && (
        <CertificateModal
          patient={patient}
          appointments={completedAppts}
          onClose={() => setCertModalOpen(false)}
          onSaved={handleCertSaved}
        />
      )}
      {previewRx && (
        <RxSlipModal
          rx={previewRx}
          patient={patient}
          doctor={doctor}
          doctorEnrollment={history?.doctorEnrollment}
          onClose={() => setPreviewRx(null)}
        />
      )}
      {previewCert && (
        <CertSlipModal
          cert={previewCert}
          patient={patient}
          doctor={doctor}
          doctorEnrollment={history?.doctorEnrollment}
          onClose={() => setPreviewCert(null)}
        />
      )}
      {notesOpen && (
        <ConsultationNotesModal
          patient={patient}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api
      .get("/api/medical/patients")
      .then((r) => setPatients(r.data))
      .catch((err) => console.error("Failed to load patients", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(
    (e) =>
      e.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.patient?.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="dp-root-mp">
      <header className="dp-header">
        <div>
          <span className="dp-eyebrow">Humancare</span>
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
          <div className="dp-stat-num">
            {patients.reduce((s, e) => s + e.totalVisits, 0)}
          </div>
          <div className="dp-stat-label">Completed Sessions</div>
        </div>
      </div>

      {loading ? (
        <div className="dp-loading">
          <div className="dp-spinner" />
          <p>Loading patients…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dp-empty-state">
          <div className="dp-empty-icon">👥</div>
          <h3>No patients yet</h3>
          <p>
            Patients will appear here after you complete a video consultation.
          </p>
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
                {entry.patient.mobile && (
                  <p className="dp-card-meta">📱 {entry.patient.mobile}</p>
                )}
              </div>
              <div className="dp-card-visits">
                <span className="dp-card-visits-num">{entry.totalVisits}</span>
                <span className="dp-card-visits-label">
                  visit{entry.totalVisits > 1 ? "s" : ""}
                </span>
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
        <PatientPanel entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
