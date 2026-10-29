import React from "react";
import { Country } from "country-state-city";
import "./RxSlip.css";
import useModalA11y from "../hooks/useModalA11y";

import defaultClinicLogoUrl from "../assets/prescription-logo.png";
import defaultClinicFooterLogoUrl from "../assets/prescription-footer-logo.png";
import newFooterQrUrl from "../assets/New-Footer-QR.jpeg";

import certLogoFull from "../assets/Logo.png";

/* ── Certificate-style layout tokens (same as MedicalCertificateSlip) ──────── */
const C_PRIMARY = "#12296B";
const C_ACCENT = "#1E63D6";
const C_LIGHT = "#EEF1F8";
const C_SOFT = "#F6F8FC";
const C_BORDER = "#D9DDE6";
const C_MUTED = "#7A8194";
const C_BODY = "#1F2433";
const C_TAGLINE = "Global Health Passport";
const C_SLIP_WIDTH = 794; // A4 at 96dpi
const C_SLIP_HEIGHT = 1123; // one A4 page

const C_CELL = {
  border: `1px solid ${C_BORDER}`,
  padding: "10px 16px",
  verticalAlign: "top",
  fontSize: 13,
  color: C_BODY,
};

const C_TH = {
  border: `1px solid ${C_PRIMARY}`,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
  background: C_PRIMARY,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

function CertInfoField({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C_PRIMARY,
          whiteSpace: "nowrap",
          letterSpacing: 0.3,
        }}
      >
        {label} :
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: C_BODY,
          borderBottom: `1.2px solid ${C_BORDER}`,
          paddingBottom: 2,
          minWidth: 80,
        }}
      >
        {value || " "}
      </span>
    </div>
  );
}

function getCountryName(countryCode) {
  if (!countryCode) return "";
  return Country.getCountryByCode(countryCode)?.name || countryCode;
}

function calcAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (isNaN(birth)) return "";
  const diff = new Date() - birth;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function RxSlip({
  slipRef,
  rx,
  doctor,
  doctorEnrollment,

  // ── swap these three in your app, no code changes needed ──
  clinicLogoUrl = defaultClinicLogoUrl, // your real clinic logo, falls back to the bundled default
  footerLogoUrl = defaultClinicFooterLogoUrl, // optional: defaults to clinicLogoUrl
  qrCodeUrl = newFooterQrUrl, // footer QR image

  // fallback props (used only if rx/doctor aren't passed)
  date = "18 Jul 2026",
  patient = { name: "", gender: "", dob: "", age: "" },
  medicines = [],
  advice = "",
  allergy = "",
  physician = {
    name: "",
    regNo: "",
    specialization: "",
    country: "United States",
  },
  clinicPhone = "+1 (302) 303-9993",
  clinicEmail = "support@humancareconnect.co",
  clinicAddress = "4 Peddlers Row #1091 Newark, DE 19702, United States",

  // opt-in: render with the Medical Certificate's look (footer unchanged)
  certStyle = false,
}) {
  // Resolve patient details — prefers real backend data (rx), falls back to props
  const pName = rx?.patientId?.name || patient?.name || "";
  const pGender = rx?.patientId?.gender || patient?.gender || "";
  const pDob = rx?.patientId?.dob || patient?.dob || "";
  const pAge = rx?.patientId?.age || patient?.age || calcAge(pDob) || "";

  // Resolve medicines — THIS ARRAY CAN BE ANY LENGTH, table grows automatically
  const medicinesList = rx?.medicines
    ? rx.medicines.map((m) => ({
      name: m.name || "",
      dose: m.dosage || "",
      timing: m.frequency || "",
      days: m.duration || "",
    }))
    : medicines;

  const formattedDate = rx?.createdAt
    ? new Date(rx.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : date;
  const diagnosisText = rx?.diagnosis || "";
  const adviceText = rx?.instructions || advice || "";
  const allergyText = rx?.allergy || allergy || "";
  const followUpText = rx?.followUpDate
    ? new Date(rx.followUpDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "";

  const phyName = doctor?.name || rx?.doctorId?.name || physician?.name || "";
  const phyRegNo =
    doctorEnrollment?.medicalRegistrationNumber ||
    doctor?.regNo ||
    rx?.doctorId?.regNo ||
    physician?.regNo ||
    "";
  const phySpecialization =
    doctorEnrollment?.specialization ||
    doctor?.specialization ||
    rx?.doctorId?.specialization ||
    physician?.specialization ||
    "";
  const phyCountry = getCountryName(
    doctorEnrollment?.country ||
    doctor?.country ||
    rx?.doctorId?.country ||
    physician?.country ||
    "US",
  );

  if (certStyle) {
    const footer = (
      <>
        {/* Divider line taken from the Medical Certificate footer */}
        <div
          className="rx-footer"
          style={{ marginTop: 10, borderTop: `3px solid ${C_ACCENT}` }}
        >
          {qrCodeUrl ? (
            <img
              className="rx-qr"
              src={qrCodeUrl}
              alt="Prescription verification QR"
            />
          ) : (
            <div className="rx-qr rx-qr-placeholder" aria-hidden="true" />
          )}
          <div className="rx-contact-lines">
            <span>📞 {clinicPhone}</span>
            <span>✉️ {clinicEmail}</span>
            <span>📍 {clinicAddress}</span>
          </div>
          <img
            className="rx-footer-logo"
            src={clinicLogoUrl}
            alt="Clinic logo"
          />
        </div>
      </>
    );

    const fieldRows = [
      { label: "Advice :", value: adviceText },
      { label: "Allergy :", value: allergyText },
      { label: "Follow-up Date :", value: followUpText },
    ];
    const physicianFields = [
      { label: "Doctor's Name", value: phyName },
      { label: "Medical Reg No", value: phyRegNo },
      { label: "Speciality", value: phySpecialization },
      { label: "Date", value: formattedDate },
      { label: "Country", value: phyCountry },
    ];

    return (
      <div className="rx-slip-wrapper rx-slip-wrapper--cert">
        <div
          className="rx-slip rx-slip--cert"
          ref={slipRef}
          style={{
            width: C_SLIP_WIDTH,
            minHeight: C_SLIP_HEIGHT,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            boxSizing: "border-box",
            color: C_BODY,
          }}
        >
          <div style={{ flex: 1 }}>
            {/* Top accent bar */}
            <div
              style={{
                height: 6,
                background: `linear-gradient(90deg, #0C1D4F, ${C_PRIMARY} 60%, ${C_ACCENT})`,
              }}
            />

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 40px 16px",
                borderBottom: `2px solid ${C_LIGHT}`,
                background: "#fff",
              }}
            >
              <img
                src={certLogoFull}
                alt="Humancare Connect"
                style={{ height: 54, objectFit: "contain", display: "block" }}
                crossOrigin="anonymous"
              />
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C_PRIMARY,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {C_TAGLINE}
                </div>
                <div
                  style={{
                    width: 48,
                    height: 4,
                    borderRadius: 2,
                    background: C_PRIMARY,
                    marginLeft: "auto",
                  }}
                />
              </div>
            </div>

            {/* Document type banner */}
            <div
              style={{
                background: C_LIGHT,
                padding: "10px 40px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderBottom: `1px solid ${C_BORDER}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C_PRIMARY }}>
                  Prescription
                </div>
              </div>
              <div style={{ fontSize: 11, color: C_MUTED, textAlign: "right" }}>
                <div>Date : {formattedDate}</div>
              </div>
            </div>

            {/* Patient info */}
            <div style={{ padding: "20px 40px 16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 48px",
                }}
              >
                <CertInfoField label="Patient Name" value={pName} />
                <CertInfoField label="Gender" value={pGender || "—"} />
                <CertInfoField label="DOB" value={pDob || "—"} />
                <CertInfoField label="Age" value={pAge || "—"} />
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                margin: "0 40px",
                height: 1,
                background: `linear-gradient(90deg, ${C_PRIMARY}, transparent)`,
              }}
            />

            <div style={{ padding: "18px 40px 0" }}>
              {/* Diagnosis */}
              <div
                style={{
                  background: C_SOFT,
                  border: `1px solid ${C_BORDER}`,
                  borderLeft: `4px solid ${C_PRIMARY}`,
                  borderRadius: 6,
                  padding: "14px 16px 14px 12px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: C_BODY,
                  lineHeight: 1.7,
                }}
              >
                <strong style={{ color: C_PRIMARY }}>Diagnosis :</strong>{" "}
                {diagnosisText}
              </div>

              {/* Medications */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C_PRIMARY }}>
                  Medications
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: C_ACCENT,
                  }}
                >
                  Rx
                </div>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: `1px solid ${C_BORDER}`,
                  marginBottom: 16,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ ...C_TH, width: 40 }}>Sr. No</th>
                    <th style={{ ...C_TH, width: 140 }}>Medicine</th>
                    <th style={{ ...C_TH, width: 70 }}>Dose</th>
                    <th style={{ ...C_TH, width: 170 }}>Timing</th>
                    <th style={{ ...C_TH, width: 80 }}>No. of Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(medicinesList.length > 0
                    ? medicinesList
                    : [{ name: "", dose: "", timing: "", days: "" }]
                  ).map((med, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 1 ? C_SOFT : "#fff" }}>
                      <td style={C_CELL}>{idx + 1}</td>
                      <td style={{ ...C_CELL, fontWeight: 500 }}>{med.name}</td>
                      <td style={C_CELL}>{med.dose}</td>
                      <td style={{ ...C_CELL, wordBreak: "break-word" }}>
                        {med.timing}
                      </td>
                      <td style={C_CELL}>{med.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Advice / Allergy / Follow-up */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: `1px solid ${C_BORDER}`,
                }}
              >
                <tbody>
                  {fieldRows.map((row, i) => (
                    <tr key={row.label} style={{ background: i % 2 === 1 ? C_SOFT : "#fff" }}>
                      <td
                        style={{
                          ...C_CELL,
                          width: "30%",
                          fontSize: 12,
                          fontWeight: 700,
                          color: C_PRIMARY,
                        }}
                      >
                        {row.label}
                      </td>
                      <td style={C_CELL}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Physician details */}
            <div
              style={{
                margin: "16px 40px 0",
                border: `1px solid ${C_BORDER}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: C_LIGHT,
                  borderBottom: `1px solid ${C_BORDER}`,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: C_PRIMARY,
                  letterSpacing: 0.4,
                }}
              >
                PHYSICIAN DETAILS
              </div>
              <div
                style={{
                  background: C_SOFT,
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 24px",
                }}
              >
                {physicianFields.map((f) => (
                  <div
                    key={f.label}
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C_PRIMARY,
                      }}
                    >
                      {f.label}
                    </span>
                    <span style={{ fontSize: 13, color: C_BODY }}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer — unchanged from the prescription */}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="rx-slip-wrapper">
      <div className="rx-slip" ref={slipRef}>
        {/* Header */}
        <div className="rx-header">
          <img className="rx-logo" src={clinicLogoUrl} alt="Clinic logo" />
        </div>
        <div className="rx-divider-row">
          <div className="rx-divider-thick" />
          <div className="rx-divider-thin" />
        </div>

        {/* Title */}
        <div className="rx-title-row">
          <div className="rx-title">prescription</div>
          <div className="rx-date-inline">Date : {formattedDate}</div>
        </div>

        {/* Patient panel — grid-based so columns always line up cleanly */}
        <div className="rx-patient-panel rx-pdf-block">
          <div className="rx-patient-row rx-patient-row-full">
            <div className="rx-patient-cell">
              <span className="rx-label">Patient Name</span>
              <span className="rx-value">{pName}</span>
            </div>
          </div>
          <div className="rx-patient-row rx-patient-row-triple">
            <div className="rx-patient-cell">
              <span className="rx-label">Gender</span>
              <span className="rx-value">{pGender || "—"}</span>
            </div>
            <div className="rx-patient-cell">
              <span className="rx-label">DOB</span>
              <span className="rx-value">{pDob || "—"}</span>
            </div>
            <div className="rx-patient-cell">
              <span className="rx-label">Age</span>
              <span className="rx-value">{pAge || "—"}</span>
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="rx-field-row">
          Diagnosis : <span className="value">{diagnosisText}</span>
        </div>

        {/* Medications — table grows with as many rows as needed */}
        <div className="rx-med-heading">Medications</div>
        <div className="rx-symbol">Rx</div>
        <table className="rx-med-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>Sr. No</th>
              <th style={{ width: 140 }}>Medicine</th>
              <th style={{ width: 70 }}>Dose</th>
              <th style={{ width: 170 }}>Timing</th>
              <th style={{ width: 80 }}>No. of Days</th>
            </tr>
          </thead>
          <tbody>
            {medicinesList.length > 0 ? (
              medicinesList.map((med, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td className="rx-med-name-cell">{med.name}</td>
                  <td>{med.dose}</td>
                  <td className="rx-med-timing-cell">{med.timing}</td>
                  <td>{med.days}</td>
                </tr>
              ))
            ) : (
              // empty placeholder row when there's no data yet
              <tr>
                <td>1</td>
                <td className="rx-med-name-cell"></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Advice / Allergy */}
        <div className="rx-field-row">
          Advice : <span className="value">{adviceText}</span>
        </div>
        <div className="rx-field-row">
          Allergy : <span className="value">{allergyText}</span>
        </div>
        <div className="rx-field-row">
          Follow-up Date : <span className="value">{followUpText}</span>
        </div>

        {/* Physician ribbon */}
        <div className="rx-ribbon-wrap">
          <div className="rx-ribbon">PHYSICIAN DETAILS</div>
        </div>
        <div className="rx-ribbon-underline" />

        <div className="rx-physician-grid">
          <div className="rx-physician-field">
            <span className="rx-label">Doctor's Name</span>
            <span className="rx-value">{phyName}</span>
          </div>
          <div className="rx-physician-field">
            <span className="rx-label">Medical Reg No</span>
            <span className="rx-value">{phyRegNo}</span>
          </div>
          <div className="rx-physician-field">
            <span className="rx-label">Speciality</span>
            <span className="rx-value">{phySpecialization}</span>
          </div>
          <div className="rx-physician-field">
            <span className="rx-label">Date</span>
            <span className="rx-value">{formattedDate}</span>
          </div>
          <div className="rx-physician-field">
            <span className="rx-label">Country</span>
            <span className="rx-value">{phyCountry}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="rx-footer-dividers">
          <div className="rx-divider-row">
            <div className="rx-divider-thin" />
            <div className="rx-divider-thick" />
          </div>
        </div>
        <div className="rx-footer">
          {qrCodeUrl ? (
            <img
              className="rx-qr"
              src={qrCodeUrl}
              alt="Prescription verification QR"
            />
          ) : (
            <div className="rx-qr rx-qr-placeholder" aria-hidden="true" />
          )}
          <div className="rx-contact-lines">
            <span>📞 {clinicPhone}</span>
            <span>✉️ {clinicEmail}</span>
            <span>📍 {clinicAddress}</span>
          </div>
          <img
            className="rx-footer-logo"
            src={clinicLogoUrl}
            alt="Clinic logo"
          />
        </div>
      </div>
    </div>
  );
}

export const PrescriptionSlip = RxSlip;

// ── Modal wrapper — scoped ONLY to this doctor prescription.
//    Uses its own rx-modal-* classes (see RxSlip.css) so it can
//    never clash with any other prescription/report modal in the app. ──
export function RxSlipModal({ open, onClose, ...rxSlipProps }) {
  const slipRef = React.useRef(null);
  const [downloading, setDownloading] = React.useState(false);
  const modalRef = React.useRef(null);
  useModalA11y(modalRef, open, onClose);

  if (!open) return null;

  const handleDownload = async () => {
    if (!slipRef.current || downloading) return;
    try {
      setDownloading(true);
      await downloadPrescriptionPDF(slipRef.current, "prescription.pdf");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="rx-modal-overlay"
      onMouseDown={(e) => {
        // close only when clicking the backdrop itself, not the card
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="rx-modal-box" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="rx-modal-title">
        <div className="rx-modal-header">
          <div className="rx-modal-title" id="rx-modal-title">Prescription Preview</div>
          <div className="rx-modal-actions">
            <button
              type="button"
              className="rx-modal-btn rx-modal-btn-primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Preparing…" : "⬇ Download PDF"}
            </button>
            <button
              type="button"
              className="rx-modal-btn rx-modal-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="rx-modal-body">
          <RxSlip slipRef={slipRef} {...rxSlipProps} />
        </div>
      </div>
    </div>
  );
}

// ── PDF download utility — captures at a fixed layout width and paginates
//    between blocks (see utils/slipPdf.js). ──
export async function downloadPrescriptionPDF(
  element,
  filename = "prescription.pdf",
) {
  const { renderSlipToPdf } = await import("../utils/slipPdf");
  // The certificate-style slip is a 794px A4 page; the classic slip is 800px.
  const slipWidth = element.classList.contains("rx-slip--cert") ? 794 : 800;
  await renderSlipToPdf(element, filename, slipWidth);
}
