import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./DoctorPatients.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const PrescriptionSlip = lazy(() =>
  import("../../components/RxSlip").then((module) => ({
    default: module.PrescriptionSlip,
  })),
);

// ── Prescription letterhead preview — dedicated page ──────────────────────────
// Reached either from PatientPanel's "View Slip" button (which hands us the
// already-loaded rx/patient/doctorEnrollment via navigation state, so no
// refetch is needed) or directly via URL/refresh, in which case we look the
// record up from the same patient-history endpoint the list view already uses.

export default function PrescriptionPreview() {
  const { patientId, rxId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { doctor } = useDoctorAuth();
  const slipRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const initial = location.state || {};
  const [rx, setRx] = useState(initial.rx || null);
  const [patient, setPatient] = useState(initial.patient || null);
  const [doctorEnrollment, setDoctorEnrollment] = useState(
    initial.doctorEnrollment || null,
  );
  const [loading, setLoading] = useState(!initial.rx);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initial.rx) return;
    api
      .get(`/api/medical/patients/${patientId}/history`)
      .then((r) => {
        const found = r.data.prescriptions?.find((p) => p._id === rxId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setRx(found);
        setDoctorEnrollment(r.data.doctorEnrollment || null);
        setPatient(
          r.data.appointments?.find((a) => a.patientId)?.patientId || null,
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, rxId]);

  const goBack = () => navigate(-1);

  const handleDownload = async () => {
    if (!slipRef.current || busy) return;
    setBusy(true);
    try {
      const { downloadPrescriptionPDF } = await import(
        "../../components/RxSlip"
      );
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date = rx?.createdAt
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

  if (loading) {
    return (
      <div className="dp-root-mp">
        <div className="dp-panel-loading">
          <div className="dp-spinner" />
        </div>
      </div>
    );
  }

  if (notFound || !rx) {
    return (
      <div className="dp-root-mp">
        <div className="dp-empty-state">
          <div className="dp-empty-icon">💊</div>
          <h3>Prescription not found</h3>
          <p>It may have been removed, or the link is no longer valid.</p>
          <button className="dp-btn dp-btn--primary" onClick={goBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-root-mp">
      <div className="dp-modal dp-modal--slip dp-slip-modal-box">
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
            <button className="dp-slip-close-btn" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>

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
