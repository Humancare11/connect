import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./DoctorPatients.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const MedicalCertificateSlip = lazy(() =>
  import("../../components/MedicalCertificateSlip").then((module) => ({
    default: module.MedicalCertificateSlip,
  })),
);

// ── Scale-to-fit certificate preview ──────────────────────────────────────────
// The certificate is a fixed 794px (A4) document. On narrower screens the
// on-screen preview is scaled down proportionally to fit the container.
// Display-only: the PDF is captured from a separate, unscaled instance.

const CERT_WIDTH = 794;

function ScaledCertificatePreview({
  cert,
  patient,
  doctor,
  doctorEnrollment,
}) {
  const measureRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    const innerEl = innerRef.current;
    if (!measureEl || !innerEl) return undefined;

    const update = () => {
      const avail = measureEl.clientWidth;
      if (avail > 0) setScale(Math.min(1, avail / CERT_WIDTH));
      setHeight(innerEl.offsetHeight); // layout height, unaffected by transform
    };
    update();

    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(measureEl);
    ro.observe(innerEl);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={measureRef} className="dp-cert-measure">
      <div
        className="dp-cert-box"
        style={{
          width: CERT_WIDTH * scale,
          height: height ? height * scale : undefined,
        }}
      >
        <div
          ref={innerRef}
          className="dp-cert-inner"
          style={{ width: CERT_WIDTH, transform: `scale(${scale})` }}
        >
          <Suspense fallback={null}>
            <MedicalCertificateSlip
              cert={cert}
              patient={patient}
              doctor={doctor}
              doctorEnrollment={doctorEnrollment}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

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
  const [toast, setToast] = useState("");

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

  const showError = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

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
    } catch (err) {
      console.error("Certificate PDF download failed", err);
      showError("Could not generate the PDF. Please try again.");
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
      {toast && (
        <div className="dp-toast" role="alert" style={{ background: "#dc2626" }}>
          {toast}
        </div>
      )}
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
            <ScaledCertificatePreview
              cert={cert}
              patient={patient}
              doctor={doctor}
              doctorEnrollment={doctorEnrollment}
            />
          </div>
        </div>

        {/* PDF source — always in DOM, offscreen and never scaled, so the
            capture ref stays valid and independent of the preview */}
        <div className="dp-cert-offscreen" aria-hidden="true">
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
  );
}
