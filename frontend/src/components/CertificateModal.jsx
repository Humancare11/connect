import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api";
import useModalA11y from "../hooks/useModalA11y";
import { formatShortDate as formatDate } from "../utils/prescriptionForm";
// Uses the shared doctor-dashboard modal styles (dp-modal*, dp-input, ...).
import "../pages/doctors/DoctorPatients.css";

const EMPTY_CERT = {
  diagnosis: "",
  recommendation: "",
  restFromDate: "",
  restToDate: "",
  notes: "",
};

// Issues a medical certificate for one of the given appointments. Used from
// My Patients and from the doctor's Appointments page. A certificate never
// changes the appointment's status.
export default function CertificateModal({ patient, appointments, onClose, onSaved }) {
  const certDialogRef = useRef(null);
  useModalA11y(certDialogRef, true, onClose);

  // Lock the page behind the modal; restore whatever was set before on close.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
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

  // Portalled to <body>: inside the dashboard the overlay lives in .dl-main's
  // stacking context (z-index: 1), which is painted beneath the fixed sidebar
  // (z-index: 50), so the sidebar covered the left of the modal.
  return createPortal(
    <div className="dp-modal-overlay dp-modal-overlay--fit" onClick={onClose}>
      <div ref={certDialogRef} role="dialog" aria-modal="true" aria-label="Medical certificate" className="dp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-header">
          <h2>Medical Certificate</h2>
          <span className="dp-modal-patient">for {patient.name}</span>
          <button className="dp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="dp-modal-form" onSubmit={submit}>
          <div className="dp-modal-body">
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

          </div>

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
    </div>,
    document.body,
  );
}
