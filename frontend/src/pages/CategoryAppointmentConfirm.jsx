import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import api from "../api";
import HealthcareIcon from "../components/HealthcareIcon";
import { PaymentStage } from "./AppointmentBookingForm";
import { useAuth } from "../context/AuthContext";
import { uploadFileDirectToS3 } from "../utils/directUpload";
import {
  readPendingBooking,
  savePendingBooking,
  clearPendingBooking,
  BOOKING_RESUME_KEY,
  getClientTimezone,
  toAppointmentUtc,
  formatDisplayDate,
  formatPrice,
} from "../utils/booking";
import "./Appointment.css";

const FILE_ICONS = { pdf: "📄", image: "🖼️", doc: "📝", default: "📎" };
function fileIcon(type = "") {
  if (type.includes("pdf")) return FILE_ICONS.pdf;
  if (type.startsWith("image/")) return FILE_ICONS.image;
  if (type.includes("word") || type.includes("doc")) return FILE_ICONS.doc;
  return FILE_ICONS.default;
}
function formatBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function CategoryAppointmentConfirm() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pending = readPendingBooking();

  const [selection, setSelection] = useState(pending?.selection || null);
  const [livePrice, setLivePrice] = useState(pending?.selection?.cost ?? null);
  const [notes] = useState(pending?.formData?.notes || pending?.formData?.concern || "");
  const [time] = useState(pending?.formData?.time || pending?.formData?.slot || "");
  const [date, setDate] = useState(pending?.formData?.date || "");
  const [stage, setStage] = useState("form"); // form | payment | confirming | success
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [confirmErr, setConfirmErr] = useState("");
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consents, setConsents] = useState({
    telehealth: false,
    terms: false,
    hipaa: false,
    age: false,
  });
  const allConsentsChecked = Object.values(consents).every(Boolean);
  const toggleConsent = (key) =>
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));

  // Resume flow if user had to log in mid-way
  useEffect(() => {
    if (authLoading || !user) return;
    if (sessionStorage.getItem(BOOKING_RESUME_KEY) !== "1") return;
    sessionStorage.removeItem(BOOKING_RESUME_KEY);
    const p = readPendingBooking();
    if (p?.selection) setSelection(p.selection);
    if (p?.formData?.date) setDate(p.formData.date);
    setStage("payment");
  }, [authLoading, user]);

  // Always confirm the price against the DB before charging the patient
  useEffect(() => {
    if (!selection?.catLabel) return;
    const fetchLivePrice = async () => {
      try {
        const response = await api.get("/api/appointment-tree");
        const category = response.data.find(
          (item) => item.name === selection.catLabel,
        );
        if (category && category.price !== undefined) {
          setLivePrice(category.price);
        }
      } catch (error) {
        console.error("Failed to refresh pricing:", error);
      }
    };
    fetchLivePrice();
  }, [selection?.catLabel]);

  if (authLoading) {
    return (
      <div className="ap-page">
        <div className="ap-card">
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selection) return <Navigate to="/category-consultant" replace />;
  if (!user && stage !== "form") {
    return (
      <Navigate
        to="/login"
        state={{ from: "/appointment-booking/category-confirm" }}
        replace
      />
    );
  }

  const handleProceedClick = () => {
    setConsents({ telehealth: false, terms: false, hipaa: false, age: false });
    setShowConsentModal(true);
  };

  const uploadFiles = async (fileList) => {
    setUploading(true);
    const results = [];
    for (const file of Array.from(fileList)) {
      try {
        const uploaded = await uploadFileDirectToS3(file);
        results.push({
          url: uploaded.url,
          name: uploaded.name,
          type: uploaded.type,
          size: uploaded.size,
        });
      } catch {
        setConfirmErr(`Failed to upload "${file.name}". Max 10 MB.`);
      }
    }
    setReports((prev) => [...prev, ...results]);
    setUploading(false);
  };
  const handleFileChange = (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };
  const removeReport = (idx) =>
    setReports((prev) => prev.filter((_, i) => i !== idx));

  const handleConsentConfirm = () => {
    setShowConsentModal(false);
    if (!user) {
      savePendingBooking({ selection, formData: { notes, date, time } });
      sessionStorage.setItem(BOOKING_RESUME_KEY, "1");
      navigate("/login", {
        state: {
          from: "/appointment-booking/category-confirm",
          resumeBooking: true,
        },
        replace: true,
      });
      return;
    }
    setStage("payment");
  };

  const createAppointment = async (paymentRef, gateway) => {
    setStage("confirming");
    setConfirmErr("");
    try {
      if (selection?.isCategoryBooking) {
        const body = {
          concern: pending.formData.concern,
          duration: pending.formData.duration,
          severity: pending.formData.severity,
          supportType: pending.formData.supportType,
          urgency: pending.formData.urgency,
          timeWindow: pending.formData.timeWindow,
          slot: pending.formData.slot,
          date: pending.formData.date,
          medicalReports: reports,
          consultationPrice: Number(livePrice),
        };
        await api.post("/api/category-consultation", body);
      } else {
        const body = {
          category: selection.catLabel,
          specialty: selection.specName,
          condition: selection.condName,
          consultationPrice: Number(livePrice),
          date,
          time,
          appointmentDateTimeUtc: toAppointmentUtc(date, time),
          patientTimezone: getClientTimezone(),
          problem: notes,
          medicalReports: reports,
        };
        if (gateway === "paypal") body.paypalOrderId = paymentRef;
        else body.paymentIntentId = paymentRef;
        await api.post("/api/appointments", body);
      }
      clearPendingBooking();
      setStage("success");
    } catch (err) {
      setConfirmErr(
        err?.response?.data?.msg ||
        "Appointment creation failed after payment. Please contact support.",
      );
      setStage("payment");
    }
  };

  const stageIndex = stage === "form" ? 0 : stage === "payment" ? 1 : 2;

  return (
    <div className="ap-page">
      {stage === "form" && (
        <div className="ap-page-title">
          <h1>Confirm Your Appointment</h1>
          <p>Just pick a date — we've saved the rest from your intake.</p>
        </div>
      )}

      <div className="ap-card">
        <div className="ap-hero">
          <div className="ap-hero-avatar">
            <HealthcareIcon name={selection.specIco} size={30} />
          </div>
          <div className="ap-hero-body">
            <span className="ap-hero-eyebrow">{selection.catLabel}</span>
            <h2 className="ap-hero-name">{selection.specName}</h2>
            <span className="ap-hero-spec">
              <HealthcareIcon name={selection.condIco} size={16} />{" "}
              {selection.condName}
            </span>
          </div>
          {stage === "form" && (
            <div className="ap-hero-fee">
              <span className="ap-hero-fee-label">Fee</span>
              <span className="ap-hero-fee-amount">
                {formatPrice(livePrice)}
              </span>
            </div>
          )}
        </div>

        {stage !== "success" && (
          <div className="ap-progress">
            {["Details", "Payment", "Confirmed"].map((label, i) => (
              <div
                key={label}
                className={`ap-progress-step ${i < stageIndex ? "ap-progress-step--done" : ""} ${i === stageIndex ? "ap-progress-step--active" : ""}`}
              >
                <div className="ap-progress-dot">
                  {i < stageIndex ? "✓" : i + 1}
                </div>
                <span>{label}</span>
                {i < 2 && (
                  <div
                    className={`ap-progress-line ${i < stageIndex ? "ap-progress-line--done" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {stage === "form" && (
          <div className="ap-form">
            {/* Read-only summary of what the intake already captured */}
            <div className="ap-step">
              <div className="ap-step-title" style={{ marginBottom: 8 }}>
                What you told us
              </div>
              <div className="ap-pay-summary" style={{ padding: 16 }}>
                <div className="ap-pay-summary-row">
                  <span>Concern</span>
                  <strong>{notes.split("\n")[0]}</strong>
                </div>
                <div className="ap-pay-summary-row">
                  <span>Date</span>
                  <strong>{date ? formatDisplayDate(date) : "—"}</strong>
                </div>
                <div className="ap-pay-summary-row">
                  <span>Preferred time</span>
                  <strong>{time || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">1</span>
                <div>
                  <div className="ap-step-title">Medical Reports</div>
                  <div className="ap-step-meta">
                    Optional — PDF, Images, Word, Excel · max 10 MB each
                  </div>
                </div>
              </div>
              <div
                className={`ap-upload-zone ${dragOver ? "ap-upload-zone--over" : ""} ${uploading ? "ap-upload-zone--busy" : ""}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {uploading ? (
                  <div className="ap-upload-busy">
                    <span className="ap-spinner" /> Uploading…
                  </div>
                ) : (
                  <>
                    <span className="ap-upload-icon">📂</span>
                    <p className="ap-upload-text">
                      Drag & drop or{" "}
                      <span className="ap-upload-link">browse files</span>
                    </p>
                    <p className="ap-upload-sub">Max 10 MB per file</p>
                  </>
                )}
              </div>
              {reports.length > 0 && (
                <div className="ap-report-list">
                  {reports.map((r, i) => (
                    <div key={i} className="ap-report-item">
                      <span className="ap-report-icon">{fileIcon(r.type)}</span>
                      <div className="ap-report-meta">
                        <span className="ap-report-name">{r.name}</span>
                        <span className="ap-report-size">
                          {formatBytes(r.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ap-report-remove"
                        onClick={() => removeReport(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="ap-submit"
              type="button"
              onClick={handleProceedClick}
            >
              Proceed to Payment - {formatPrice(livePrice)} →
            </button>
          </div>
        )}

        {stage === "confirming" && (
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Creating your appointment…</p>
          </div>
        )}

        {stage === "payment" && (
          <PaymentStage
            amount={livePrice}
            selection={selection}
            formData={{ notes, date, time }}
            uploadedReports={reports}
            onBack={() => {
              setStage("form");
              setConfirmErr("");
            }}
            onComplete={(paymentRef, gateway) =>
              createAppointment(paymentRef, gateway)
            }
          />
        )}

        {confirmErr && stage !== "form" && (
          <p className="ap-error" style={{ margin: "0 28px 20px" }}>
            {confirmErr}
          </p>
        )}

        {stage === "success" && (
          <div className="ap-success">
            <div className="ap-success-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="ap-success-title">Appointment Requested!</h3>
            <p className="ap-success-sub">
              Payment confirmed. Our team will review and assign a doctor
              shortly.
            </p>
            <Link
              to="/user/appointments"
              className="ap-submit"
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              View My Appointments
            </Link>
          </div>
        )}
        {showConsentModal && (
          <div
            className="ap-modal-overlay"
            onClick={() => setShowConsentModal(false)}
          >
            <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ap-modal-header">
                <div className="ap-modal-title">Patient Informed Consent</div>
                <button
                  type="button"
                  className="ap-modal-close"
                  onClick={() => setShowConsentModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="ap-modal-body">
                <div className="ap-consent-scroll">
                  <p className="ap-consent-text">
                    <strong>Patient Informed Consent:</strong> By booking this
                    appointment, you consent to receive telehealth services from
                    licensed physicians through Humancare Connect. You
                    understand that (1) telehealth is not a substitute for
                    in-person care in all situations; (2) physicians on this
                    platform are independent contractors; (3) in a medical
                    emergency, call 911 immediately. You have read and agree to
                    our Telehealth Informed Consent policy.
                  </p>
                </div>
                <div className="ap-consent-checks" style={{ marginTop: 12 }}>
                  {[
                    {
                      key: "telehealth",
                      label: "I have read and agree to the ",
                      linkText: "Telehealth Informed Consent",
                      href: "/tele-health-informed-consent",
                    },
                    {
                      key: "terms",
                      label: "I agree to the ",
                      linkText: "Terms of Service",
                      href: "/terms-of-service",
                      extra: " and ",
                      linkText2: "Privacy Policy",
                      href2: "/privacy-policy",
                    },
                    {
                      key: "hipaa",
                      label: "I have read the ",
                      linkText: "HIPAA Notice of Privacy Practices",
                      href: "/notice-of-privacy-practices",
                    },
                    { key: "age", label: "I am 18 years of age or older" },
                  ].map(
                    ({
                      key,
                      label,
                      linkText,
                      href,
                      extra,
                      linkText2,
                      href2,
                    }) => (
                      <label key={key} className="ap-consent-row">
                        <input
                          type="checkbox"
                          className="ap-consent-checkbox"
                          checked={consents[key]}
                          onChange={() => toggleConsent(key)}
                        />
                        <span className="ap-consent-label">
                          {label}
                          {linkText && href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ap-consent-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkText}
                            </a>
                          )}
                          {extra}
                          {linkText2 && href2 && (
                            <a
                              href={href2}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ap-consent-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkText2}
                            </a>
                          )}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="ap-modal-footer">
                <button
                  type="button"
                  className="ap-btn-outline"
                  onClick={() => setShowConsentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ap-submit"
                  style={{ marginTop: 0, flex: 1 }}
                  disabled={!allConsentsChecked}
                  onClick={handleConsentConfirm}
                >
                  Confirm & Continue →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}