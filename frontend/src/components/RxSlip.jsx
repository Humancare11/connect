import React from "react";
import "./RxSlip.css";

import defaultClinicLogoUrl from "../assets/prescription-logo.png";
import defaultClinicFooterLogoUrl from "../assets/prescription-footer-logo.png";

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
  qrCodeUrl = defaultClinicFooterLogoUrl, // required: your real, functional QR image

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
  const phyCountry =
    doctor?.country ||
    rx?.doctorId?.country ||
    physician?.country ||
    "United States";

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
          <div className="rx-title">E - prescription</div>
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
              <span className="rx-value">{pGender}</span>
            </div>
            <div className="rx-patient-cell">
              <span className="rx-label">DOB</span>
              <span className="rx-value">{pDob}</span>
            </div>
            <div className="rx-patient-cell">
              <span className="rx-label">Age</span>
              <span className="rx-value">{pAge}</span>
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
      <div className="rx-modal-box">
        <div className="rx-modal-header">
          <div className="rx-modal-title">Prescription Preview</div>
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

// ── PDF download utility — unchanged from your original ──
export async function downloadPrescriptionPDF(
  element,
  filename = "prescription.pdf",
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = (canvas.height * pdfW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.97);

  // if content is taller than one A4 page, split across multiple pages
  let heightLeft = pdfH;
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, "JPEG", 0, position, pdfW, pdfH);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - pdfH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, pdfW, pdfH);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
