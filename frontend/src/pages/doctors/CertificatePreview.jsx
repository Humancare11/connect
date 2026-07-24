import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./DoctorPatients.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const MedicalCertificateSlip = lazy(() =>
  import("../../components/MedicalCertificateSlip").then((module) => ({
    default: module.MedicalCertificateSlip,
  })),
);

// ── Medical certificate letterhead preview — dedicated page ───────────────────
// Mirrors PrescriptionPreview.jsx: uses navigation state when available (from
// PatientPanel's "View Cert" button) and falls back to the patient-history
// endpoint when opened directly via URL/refresh.

export default function CertificatePreview() {
  const { patientId, certId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { doctor } = useDoctorAuth();
  const slipRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const initial = location.state || {};
  const [cert, setCert] = useState(initial.cert || null);
  const [patient, setPatient] = useState(initial.patient || null);
  const [doctorEnrollment, setDoctorEnrollment] = useState(
    initial.doctorEnrollment || null,
  );
  const [loading, setLoading] = useState(!initial.cert);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initial.cert) return;
    api
      .get(`/api/medical/patients/${patientId}/history`)
      .then((r) => {
        const found = r.data.certificates?.find((c) => c._id === certId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setCert(found);
        setDoctorEnrollment(r.data.doctorEnrollment || null);
        setPatient(
          r.data.appointments?.find((a) => a.patientId)?.patientId || null,
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, certId]);

  const goBack = () => navigate(-1);

  const handleDownload = async () => {
    if (!slipRef.current || busy) return;
    setBusy(true);
    try {
      const { downloadCertificatePDF } = await import(
        "../../components/MedicalCertificateSlip"
      );
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date =
        cert?.issuedDate ||
        (cert?.createdAt
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

  if (loading) {
    return (
      <div className="dp-root-mp">
        <div className="dp-panel-loading">
          <div className="dp-spinner" />
        </div>
      </div>
    );
  }

  if (notFound || !cert) {
    return (
      <div className="dp-root-mp">
        <div className="dp-empty-state">
          <div className="dp-empty-icon">📄</div>
          <h3>Certificate not found</h3>
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
            <button className="dp-slip-close-btn" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>

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
