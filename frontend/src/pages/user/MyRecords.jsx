import { lazy, Suspense, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
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
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setOpen((p) => !p))(e); } }} className="mr-card-top" onClick={() => setOpen((p) => !p)}>
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

// ── Scale-to-fit certificate preview ──────────────────────────────────────────
// The certificate is a fixed 794px (A4) document. On narrower content areas the
// on-screen preview is scaled down to fit; below CERT_MIN_SCALE it stops
// shrinking and the surrounding .mr-slip-wrap scrolls horizontally instead.
// This is display-only: the PDF is captured from a separate, unscaled instance.

const CERT_WIDTH = 794;
const CERT_MIN_SCALE = 0.5;

function ScaledCertificatePreview({ cert, patient }) {
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
      if (avail > 0) {
        setScale(Math.max(CERT_MIN_SCALE, Math.min(1, avail / CERT_WIDTH)));
      }
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
    <div ref={measureRef} className="mr-cert-measure">
      <div
        className="mr-cert-box"
        style={{
          width: CERT_WIDTH * scale,
          height: height ? height * scale : undefined,
        }}
      >
        <div
          ref={innerRef}
          className="mr-cert-inner"
          style={{ width: CERT_WIDTH, transform: `scale(${scale})` }}
        >
          <Suspense fallback={null}>
            <MedicalCertificateSlip cert={cert} patient={patient} />
          </Suspense>
        </div>
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
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setOpen((p) => !p))(e); } }} className="mr-card-top" onClick={() => setOpen((p) => !p)}>
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

      {/* On-screen preview — scaled to fit, only mounted while open */}
      {open && (
        <div className="mr-slip-wrap">
          <ScaledCertificatePreview cert={cert} patient={patient} />
        </div>
      )}

      {/* PDF source — always in DOM, offscreen and never scaled, so the
          capture ref stays valid and is independent of the preview */}
      <div className="mr-slip-offscreen" aria-hidden="true">
        <Suspense fallback={null}>
          <MedicalCertificateSlip cert={cert} patient={patient} slipRef={slipRef} />
        </Suspense>
      </div>
    </div>
  );
}

// ── Admin-issued medical report ────────────────────────────────────────────────
// The report itself is a PDF held in private storage; the download button asks the server
// for a short-lived link (refused for voided reports).

function MedicalReportCard({ report }) {
  const [downloading, setDownloading] = useState(false);
  const [error,       setError]       = useState("");
  const voided = report.status === "voided";

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await api.get(`/api/medical/my-reports/${report._id}/download`);
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.response?.data?.msg || "Could not open the report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`mr-card mr-card--report${voided ? " mr-card--voided" : ""}`}>
      <div className="mr-card-top mr-card-top--static">
        <div className="mr-card-icon">🩺</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">
            {report.title}
            {voided && <span className="mr-voided-badge">Voided</span>}
          </h3>
          <p className="mr-card-sub">
            {report.doctorName || "Humancare"} &nbsp;·&nbsp; {formatDate(report.reportDate)} &nbsp;·&nbsp; {report.reportNumber}
          </p>
          {voided && <p className="mr-card-sub">This report is no longer valid. A corrected report may be issued separately.</p>}
          {error && <p className="mr-card-sub" role="alert">{error}</p>}
        </div>
        {!voided && (
          <button className="mr-download-btn" onClick={handleDownload} disabled={downloading} title="View / download PDF">
            {downloading ? "…" : "⬇ PDF"}
          </button>
        )}
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
  const [reports,        setReports]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [activeTab,      setActiveTab]      = useState("prescriptions");
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "certificates" || tab === "prescriptions" || tab === "reports") setActiveTab(tab);
  }, [location.search]);

  const loadRecords = useCallback(async (withLoader = false) => {
    if (withLoader) setLoading(true);
    setError("");

    const [rxRes, certRes, reportRes] = await Promise.allSettled([
      api.get("/api/medical/my-prescriptions"),
      api.get("/api/medical/my-certificates"),
      api.get("/api/medical/my-reports"),
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

    setReports(reportRes.status === "fulfilled" && Array.isArray(reportRes.value.data) ? reportRes.value.data : []);

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
    { key: "reports",       label: "Medical Reports",      icon: "🩺", count: reports.length       },
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
        <div className="mr-summary-card">
          <span className="mr-summary-icon">🩺</span>
          <div>
            <div className="mr-summary-num">{reports.length}</div>
            <div className="mr-summary-label">Reports</div>
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
      ) : activeTab === "reports" ? (
        reports.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">🩺</div>
            <h3>No medical reports yet</h3>
            <p>Medical reports issued to you will appear here.</p>
          </div>
        ) : (
          <div className="mr-list">
            {reports.map((report) => <MedicalReportCard key={report._id} report={report} />)}
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
