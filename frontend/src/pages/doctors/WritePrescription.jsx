import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import ConsultationNotesPanel from "../../components/ConsultationNotesPanel";
import {
  EMPTY_MEDICINE,
  EMPTY_RX,
  buildFrequencyText,
  formatShortDate,
} from "../../utils/prescriptionForm";
import "./DoctorPatients.css";
import "./WritePrescription.css";

export default function WritePrescription() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [form, setForm] = useState({ ...EMPTY_RX, appointmentId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadPatientData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get(
        `/api/medical/patients/${patientId}/history`,
      );
      const allAppointments = Array.isArray(data?.appointments)
        ? data.appointments
        : [];
      const completed = allAppointments.filter((a) =>
        ["complete", "completed"].includes(a.status),
      );
      setPatient(allAppointments[0]?.patientId || null);
      setAppointments(completed);
      setForm((prev) => ({ ...prev, appointmentId: completed[0]?._id || "" }));
    } catch (err) {
      setLoadError(
        err.response?.data?.msg || "Failed to load patient details.",
      );
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setMed = (i, k, v) =>
    setForm((p) => {
      const meds = [...p.medicines];
      const updated = { ...meds[i], [k]: v };
      if (
        ["timeMorning", "timeAfternoon", "timeNight", "foodTiming"].includes(k)
      ) {
        updated.frequency = buildFrequencyText(updated);
      }
      meds[i] = updated;
      return { ...p, medicines: meds };
    });

  const addMed = () =>
    setForm((p) => ({
      ...p,
      medicines: [...p.medicines, { ...EMPTY_MEDICINE }],
    }));
  const removeMed = (i) =>
    setForm((p) => ({
      ...p,
      medicines: p.medicines.filter((_, idx) => idx !== i),
    }));

  const goBackToPatients = () => navigate("/doctor-dashboard/patients");

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
      await api.post("/api/medical/prescriptions", {
        ...form,
        patientId,
      });
      setSaved(true);
      setTimeout(goBackToPatients, 1500);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save prescription.");
      setSaving(false);
    }
  };

  return (
    <div className="wp-page">
      <div className="wp-topbar">
        <button
          type="button"
          className="wp-back-btn"
          onClick={goBackToPatients}
        >
          ← Back to My Patients
        </button>
      </div>

      {loading ? (
        <div className="dp-loading">
          <div className="dp-spinner" />
          <p>Loading patient details…</p>
        </div>
      ) : loadError ? (
        <div className="dp-modal-error">{loadError}</div>
      ) : !patient || appointments.length === 0 ? (
        <div className="dp-empty-state">
          <div className="dp-empty-icon">💊</div>
          <h3>No completed consultations</h3>
          <p>
            A prescription can only be written after a completed video
            consultation with this patient.
          </p>
        </div>
      ) : (
        <div className="wp-grid">
          <section className="wp-form-col">
            <header className="wp-form-header">
              <span className="dp-eyebrow">Write Prescription</span>
              <h1 className="dp-title">{patient.name}</h1>
              <p className="dp-sub">{patient.email}</p>
            </header>

            {saved && (
              <div className="wp-alert wp-alert--success">
                Prescription saved! Returning to My Patients…
              </div>
            )}
            {error && <div className="dp-modal-error">{error}</div>}

            <form className="wp-form" onSubmit={submit}>
              <label className="dp-label">Appointment</label>
              <select
                className="dp-input"
                value={form.appointmentId}
                onChange={(e) => setField("appointmentId", e.target.value)}
                disabled={saving || saved}
              >
                {appointments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {formatShortDate(a.date)} — {a.time} ({a.status})
                  </option>
                ))}
              </select>

              <label className="dp-label">Diagnosis *</label>
              <input
                className="dp-input"
                value={form.diagnosis}
                onChange={(e) => setField("diagnosis", e.target.value)}
                placeholder="e.g. Acute viral pharyngitis"
                disabled={saving || saved}
              />

              <label className="dp-label">Medicines</label>
              {form.medicines.map((med, i) => (
                <div key={i} className="dp-med-card">
                  <div className="dp-med-row">
                    <input
                      className="dp-input dp-med-name"
                      value={med.name}
                      onChange={(e) => setMed(i, "name", e.target.value)}
                      placeholder="Medicine name"
                      disabled={saving || saved}
                    />
                    <input
                      className="dp-input dp-med-sm"
                      value={med.dosage}
                      onChange={(e) => setMed(i, "dosage", e.target.value)}
                      placeholder="Dosage e.g. 500mg"
                      disabled={saving || saved}
                    />
                    <input
                      className="dp-input dp-med-sm"
                      value={med.duration}
                      onChange={(e) => setMed(i, "duration", e.target.value)}
                      placeholder="Duration e.g. 5 days"
                      disabled={saving || saved}
                    />
                    <button
                      type="button"
                      className="dp-med-remove"
                      onClick={() => removeMed(i)}
                      title="Remove"
                      disabled={saving || saved}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="dp-timing-row">
                    <div className="dp-timing-slot">
                      <span className="dp-timing-label">🌅 Morning</span>
                      <select
                        className="dp-input dp-timing-select"
                        value={med.timeMorning}
                        onChange={(e) =>
                          setMed(i, "timeMorning", e.target.value)
                        }
                        disabled={saving || saved}
                      >
                        <option value="0">—</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                    <div className="dp-timing-slot">
                      <span className="dp-timing-label">🌤 Afternoon</span>
                      <select
                        className="dp-input dp-timing-select"
                        value={med.timeAfternoon}
                        onChange={(e) =>
                          setMed(i, "timeAfternoon", e.target.value)
                        }
                        disabled={saving || saved}
                      >
                        <option value="0">—</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                    <div className="dp-timing-slot">
                      <span className="dp-timing-label">🌙 Night</span>
                      <select
                        className="dp-input dp-timing-select"
                        value={med.timeNight}
                        onChange={(e) =>
                          setMed(i, "timeNight", e.target.value)
                        }
                        disabled={saving || saved}
                      >
                        <option value="0">—</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                    <div className="dp-timing-slot dp-timing-slot--food">
                      <span className="dp-timing-label">🍽 Food</span>
                      <select
                        className="dp-input dp-timing-select"
                        value={med.foodTiming}
                        onChange={(e) =>
                          setMed(i, "foodTiming", e.target.value)
                        }
                        disabled={saving || saved}
                      >
                        <option value="Before Food">Before Food</option>
                        <option value="After Food">After Food</option>
                        <option value="With Food">With Food</option>
                      </select>
                    </div>
                  </div>

                  {med.frequency && (
                    <div className="dp-timing-preview">📋 {med.frequency}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="dp-add-med-btn"
                onClick={addMed}
                disabled={saving || saved}
              >
                + Add Medicine
              </button>

              <label className="dp-label">Instructions</label>
              <textarea
                className="dp-input dp-textarea"
                value={form.instructions}
                onChange={(e) => setField("instructions", e.target.value)}
                placeholder="Special instructions, diet, rest..."
                rows={3}
                disabled={saving || saved}
              />

              <label className="dp-label">Follow-up Date</label>
              <input
                className="dp-input"
                type="date"
                value={form.followUpDate}
                onChange={(e) => setField("followUpDate", e.target.value)}
                disabled={saving || saved}
              />

              <div className="wp-form-footer">
                <button
                  type="button"
                  className="dp-btn dp-btn--ghost"
                  onClick={goBackToPatients}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dp-btn dp-btn--primary"
                  disabled={saving || saved}
                >
                  {saving ? "Saving…" : "Save Prescription"}
                </button>
              </div>
            </form>
          </section>

          <aside className="wp-notes-col">
            <div className="wp-notes-sticky">
              <h2 className="wp-notes-title">📝 Consultation Notes</h2>
              <p className="wp-notes-hint">
                Reference the doctor's saved consultation notes for{" "}
                {patient.name} while preparing this prescription.
              </p>
              <ConsultationNotesPanel patientId={patientId} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
