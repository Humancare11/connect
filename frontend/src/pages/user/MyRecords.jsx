import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import "./MyRecords.css";
import api from "../../api";
import socket from "../../socket";
import { useAuth } from "../../context/AuthContext";

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

function formatDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed)) return d;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Prescription Card with letterhead view ─────────────────────────────────────

function PrescriptionCard({ rx, patient }) {
  const [open,        setOpen]        = useState(false);
  const [downloading, setDownloading] = useState(false);
  const slipRef = useRef(null);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!slipRef.current) return;
    setDownloading(true);
    try {
      const { downloadPrescriptionPDF } = await import("../../components/RxSlip");
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date = rx.createdAt ? new Date(rx.createdAt).toISOString().split("T")[0] : "rx";
      await downloadPrescriptionPDF(slipRef.current, `prescription_${name}_${date}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mr-card mr-card--rx">
      {/* ── Collapsed header ── */}
      <div className="mr-card-top" onClick={() => setOpen((p) => !p)}>
        <div className="mr-card-icon">💊</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">{rx.diagnosis}</h3>
          <p className="mr-card-sub">
            Dr. {rx.doctorId?.name || "—"} &nbsp;·&nbsp; {formatDate(rx.createdAt)}
            {rx.appointmentId?.date && ` · Appt: ${formatDate(rx.appointmentId.date)}`}
          </p>
        </div>
        <button
          className="mr-download-btn"
          onClick={handleDownload}
          disabled={downloading}
          title="Download PDF"
        >
          {downloading ? "…" : "⬇ PDF"}
        </button>
        <span className={`mr-chevron ${open ? "mr-chevron--open" : ""}`}>›</span>
      </div>

      {/* Slip — always in DOM so ref is valid for PDF download */}
      <div className={open ? "mr-slip-wrap" : "mr-slip-offscreen"}>
        <Suspense fallback={null}>
          <PrescriptionSlip rx={rx} patient={patient} doctorEnrollment={rx.doctorEnrollment} slipRef={slipRef} />
        </Suspense>
      </div>
    </div>
  );
}

// ── Certificate Card with letterhead view ─────────────────────────────────────

function CertificateCard({ cert, patient }) {
  const [open,        setOpen]        = useState(false);
  const [downloading, setDownloading] = useState(false);
  const slipRef = useRef(null);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!slipRef.current) return;
    setDownloading(true);
    try {
      const { downloadCertificatePDF } = await import("../../components/MedicalCertificateSlip");
      const name = patient?.name?.replace(/\s+/g, "_") || "patient";
      const date = cert.issuedDate || (cert.createdAt ? new Date(cert.createdAt).toISOString().split("T")[0] : "cert");
      await downloadCertificatePDF(slipRef.current, `certificate_${name}_${date}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mr-card mr-card--cert">
      {/* ── Collapsed header ── */}
      <div className="mr-card-top" onClick={() => setOpen((p) => !p)}>
        <div className="mr-card-icon">📄</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">{cert.diagnosis}</h3>
          <p className="mr-card-sub">
            Dr. {cert.doctorId?.name || "—"} &nbsp;·&nbsp; Issued: {formatDate(cert.issuedDate)}
          </p>
        </div>
        <button
          className="mr-download-btn"
          onClick={handleDownload}
          disabled={downloading}
          title="Download PDF"
        >
          {downloading ? "…" : "⬇ PDF"}
        </button>
        <span className={`mr-chevron ${open ? "mr-chevron--open" : ""}`}>›</span>
      </div>

      {/* Slip — always in DOM so ref is valid for PDF download */}
      <div className={open ? "mr-slip-wrap" : "mr-slip-offscreen"}>
        <Suspense fallback={null}>
          <MedicalCertificateSlip cert={cert} patient={patient} slipRef={slipRef} />
        </Suspense>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyRecords() {
  const location = useLocation();
  const { user } = useAuth();

  const [prescriptions,  setPrescriptions]  = useState([]);
  const [certificates,   setCertificates]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [activeTab,      setActiveTab]      = useState("prescriptions");
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "certificates" || tab === "prescriptions") setActiveTab(tab);
  }, [location.search]);

  const loadRecords = useCallback(async (withLoader = false) => {
    if (withLoader) setLoading(true);
    setError("");

    const [rxRes, certRes] = await Promise.allSettled([
      api.get("/api/medical/my-prescriptions"),
      api.get("/api/medical/my-certificates"),
    ]);

    if (rxRes.status === "fulfilled") {
      setPrescriptions(Array.isArray(rxRes.value.data) ? rxRes.value.data : []);
    } else {
      console.error("Prescriptions load error:", rxRes.reason);
      if (rxRes.reason?.response?.status === 401) setError("Session expired. Please log in again.");
      setPrescriptions([]);
    }

    if (certRes.status === "fulfilled") {
      setCertificates(Array.isArray(certRes.value.data) ? certRes.value.data : []);
    } else {
      setCertificates([]);
    }

    if (withLoader) setLoading(false);
  }, []);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadRecords(false);
    }, 250);
  }, [loadRecords]);

  useEffect(() => { loadRecords(true); }, [loadRecords]);

  useEffect(() => {
    const onFocus   = () => queueRefresh();
    const onVisible = () => { if (document.visibilityState === "visible") queueRefresh(); };

    socket.on("new-prescription", queueRefresh);
    socket.on("new-certificate",  queueRefresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      socket.off("new-prescription", queueRefresh);
      socket.off("new-certificate",  queueRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [queueRefresh]);

  const tabs = [
    { key: "prescriptions", label: "Prescriptions",       icon: "💊", count: prescriptions.length },
    { key: "certificates",  label: "Medical Certificates", icon: "📄", count: certificates.length  },
  ];

  return (
    <div className="mr-root">
      <header className="mr-header">
        <span className="mr-eyebrow">Humancare Connect</span>
        <h1 className="mr-title">My Medical Records</h1>
        <p className="mr-sub">  </p>
      </header>

      <div className="mr-summary">
        <div className="mr-summary-card">
          <span className="mr-summary-icon">💊</span>
          <div>
            <div className="mr-summary-num">{prescriptions.length}</div>
            <div className="mr-summary-label">Prescriptions</div>
          </div>
        </div>
        <div className="mr-summary-card">
          <span className="mr-summary-icon">📄</span>
          <div>
            <div className="mr-summary-num">{certificates.length}</div>
            <div className="mr-summary-label">Certificates</div>
          </div>
        </div>
      </div>

      {error && <div className="mr-error-banner">⚠️ {error}</div>}

      <div className="mr-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`mr-tab ${activeTab === t.key ? "mr-tab--active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
            <span className="mr-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mr-loading"><div className="mr-spinner" /><p>Loading records…</p></div>
      ) : activeTab === "prescriptions" ? (
        prescriptions.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">💊</div>
            <h3>No prescriptions yet</h3>
            <p>Prescriptions from your doctors will appear here after a completed consultation.</p>
          </div>
        ) : (
          <div className="mr-list">
            {prescriptions.map((rx) => (
              <PrescriptionCard key={rx._id} rx={rx} patient={user} />
            ))}
          </div>
        )
      ) : (
        certificates.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">📄</div>
            <h3>No certificates yet</h3>
            <p>Medical certificates issued by your doctors will appear here.</p>
          </div>
        ) : (
          <div className="mr-list">
            {certificates.map((cert) => <CertificateCard key={cert._id} cert={cert} patient={user} />)}
          </div>
        )
      )}
    </div>
  );
}
