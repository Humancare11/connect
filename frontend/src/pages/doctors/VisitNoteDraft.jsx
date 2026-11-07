import { useNavigate, useParams } from "react-router-dom";
import VisitNoteEditor from "../../components/VisitNoteEditor";
import "./DoctorNotes.css";

// Opened from the Appointments page: the structured note for one appointment (works even if no note exists yet).
export default function VisitNoteDraft() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="dn-page">
      <div className="dn-header">
        <div>
          <span className="dn-eyebrow">Visit Note</span>
          <h2 className="dn-title">Consultation note</h2>
          <p className="dn-subtitle">Auto-saves as you type. Review &amp; Finalise when you are ready to sign.</p>
        </div>
        <button type="button" className="dn-btn dn-btn--ghost" onClick={() => navigate("/doctor-dashboard/appointments")}>
          ← Appointments
        </button>
      </div>
      <section className="dn-editor">
        <VisitNoteEditor key={appointmentId} appointmentId={appointmentId} variant="page" />
      </section>
    </div>
  );
}
