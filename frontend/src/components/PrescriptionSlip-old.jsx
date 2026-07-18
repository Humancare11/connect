import React from "react";
import logoFull from "../assets/Logo.png";
import logoIcon from "../assets/single-logo.png";

const PRIMARY = "#0d47a1";
const ACCENT = "#1565c0";
const LIGHT = "#e8f0fe";

const styles = `
.rx-slip-wrapper {
  margin: 0;
  padding: 24px;
  background: ${LIGHT};
  font-family: "Inter", sans-serif;
}
.rx-slip {
  width: 800px;
  background: #ffffff;
  color: ${PRIMARY};
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(13, 71, 161, 0.12);
  position: relative;
  overflow: hidden;
}
.rx-header {
  position: relative;
  padding: 36px 44px 24px;
  overflow: hidden;
}
.rx-watermark {
  position: absolute;
  right: -10px;
  top: -40px;
  font-family: "Lora", serif;
  font-size: 220px;
  font-weight: 600;
  color: ${PRIMARY};
  opacity: 0.035;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
.rx-brand-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
}
.rx-clinic-name {
  font-family: "Lora", serif;
  font-size: 26px;
  font-weight: 600;
  color: ${PRIMARY};
  margin: 0;
}
.rx-clinic-tag {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${ACCENT};
  margin-top: 4px;
  font-weight: 500;
}
.rx-logo {
  display: block;
  max-height: 48px;
  width: auto;
}
.rx-contact {
  text-align: right;
  font-size: 11.5px;
  color: #5a6472;
  line-height: 1.6;
}

.rx-divider {
  height: 1px;
  background: ${LIGHT};
  margin: 0 44px;
  position: relative;
}
.rx-divider::after {
  content: "";
  position: absolute;
  left: 0;
  top: 3px;
  height: 1px;
  width: 64px;
  background: ${ACCENT};
}

.rx-ref-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 44px 0;
}
.rx-title {
  font-family: "Lora", serif;
  font-size: 15px;
  font-weight: 600;
  color: ${PRIMARY};
}
.rx-diagnosis {
  font-size: 12.5px;
  color: #5a6472;
  margin-top: 2px;
}
.rx-ref-box {
  border: 1px solid ${LIGHT};
  border-radius: 2px;
  padding: 8px 14px;
  text-align: right;
}
.rx-ref-code {
  font-family: "IBM Plex Mono", monospace;
  font-size: 12.5px;
  font-weight: 500;
  color: ${PRIMARY};
}
.rx-ref-date {
  font-size: 11px;
  color: #8a8f98;
  margin-top: 2px;
}

.rx-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 24px 44px 0;
  border-top: 1px solid ${LIGHT};
  border-bottom: 1px solid ${LIGHT};
}
.rx-info-block {
  padding: 16px 20px;
}
.rx-info-block + .rx-info-block {
  border-left: 1px solid ${LIGHT};
}
.rx-info-kicker {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${ACCENT};
  font-weight: 600;
  margin-bottom: 10px;
}
.rx-info-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 5px 0;
}
.rx-info-line-label {
  color: #5a6472;
}
.rx-info-line-value {
  color: ${PRIMARY};
  font-weight: 500;
  text-align: right;
}
.rx-doctor-name {
  font-size: 14.5px;
  font-weight: 600;
  color: ${PRIMARY};
  margin-bottom: 2px;
}
.rx-doctor-spec {
  font-size: 12px;
  color: ${ACCENT};
  margin-bottom: 10px;
}

.rx-med-section {
  padding: 24px 44px 0;
}
.rx-symbol {
  font-family: "Lora", serif;
  font-size: 30px;
  color: ${ACCENT};
  margin-bottom: 6px;
  line-height: 1;
}
table.rx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
table.rx-table thead th {
  text-align: left;
  padding: 8px 10px;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8f98;
  font-weight: 600;
  border-bottom: 1.5px solid ${PRIMARY};
}
table.rx-table tbody td {
  padding: 12px 10px;
  border-bottom: 1px solid #eaeae5;
  color: #2e3440;
  vertical-align: top;
}
.rx-med-name {
  font-weight: 600;
  color: ${PRIMARY};
}
.rx-med-sub {
  font-size: 11.5px;
  color: #8a8f98;
  margin-top: 2px;
}

.rx-notes {
  margin: 22px 44px 0;
  padding: 16px 20px;
  border-left: 2px solid ${ACCENT};
  background: ${LIGHT};
  font-size: 12.5px;
  color: #4a4f58;
}
.rx-notes b {
  color: ${PRIMARY};
  font-weight: 600;
}
.rx-notes div + div {
  margin-top: 6px;
}

.rx-sign-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin: 34px 44px 0;
}
.rx-sign-block {
  text-align: center;
}
.rx-sign-line {
  width: 170px;
  border-bottom: 1px solid ${PRIMARY};
  margin-bottom: 6px;
  height: 34px;
}
.rx-sign-label {
  font-size: 11px;
  color: #8a8f98;
  letter-spacing: 0.04em;
}
.rx-seal {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1.5px solid ${ACCENT};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: ${ACCENT};
  position: relative;
}
.rx-seal::before {
  content: "";
  position: absolute;
  inset: 5px;
  border: 1px solid ${ACCENT};
  border-radius: 50%;
  opacity: 0.5;
}
.rx-seal-text {
  font-size: 7px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 600;
}
.rx-seal-cross {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.rx-footer {
  margin-top: 26px;
  padding: 14px 44px;
  background: ${PRIMARY};
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rx-footer-item {
  font-size: 10.5px;
  color: #b7c0d1;
  letter-spacing: 0.02em;
}
.rx-footer-brand {
  font-family: "Lora", serif;
  font-size: 11px;
  color: #fff;
  letter-spacing: 0.03em;
}
.rx-footer-logo {
  display: block;
  max-height: 20px;
  width: auto;
}
.rx-footer-logo--mono {
  filter: brightness(0) invert(1);
}
`;

/**
 * RxSlip — a prescription-slip layout component.
 *
 * All content is driven by props so the same layout can be reused
 * across different clinics / patients / medicines.
 */
export default function RxSlip({
  clinic = {
    logoUrl: logoFull,
    logoAlt: "Humancare Connect",
    address: "4 Peddlers Row #1091, Newark, DE 19702",
    phone: "+1 (302) 303-9993",
    email: "support@humancareconnect.co",
  },
  // Footer sits on a dark background. By default the same logo is
  // rendered as a white silhouette (filter: invert). Pass footerLogoUrl
  // to use a dedicated light/white version of the logo instead, and set
  // footerLogoMono to false if that version already has its own colors.
  footerLogoUrl = null,
  footerLogoMono = true,
  reference = {
    code: "HC-2C1552C9",
    issuedDate: "03 Jul 2026",
  },
  diagnosis = "TEST-Diagnosis",
  patient = {
    name: "Satish",
    age: 25,
    sex: "Male",
  },
  physician = {
    name: "Dr. Shizuka Mestry",
    specialization: "General Physician",
    regNo: "MH-2024-11983",
  },
  medicines = [
    {
      name: "TEST-Medicines",
      dosage: "500mg",
      frequency: "Twice daily",
      duration: "2 days",
      notes: "After food",
    },
  ],
  instructions = "TEST-Instructions",
  followUpDate = "10 Jul 2026",
  footerNote = "This document is generated electronically and is valid without a physical signature.",
}) {
  return (
    <div className="rx-slip-wrapper">
      <style>{styles}</style>

      <div className="rx-slip">
        <div className="rx-header">
          <div className="rx-watermark">℞</div>
          <div className="rx-brand-row">
            <div>
              <img
                className="rx-logo"
                src={clinic.logoUrl}
                alt={clinic.logoAlt}
              />
            </div>
            <div className="rx-contact">
              {clinic.address}
              <br />
              {clinic.phone} &nbsp;·&nbsp; {clinic.email}
            </div>
          </div>
        </div>

        <div className="rx-divider"></div>

        <div className="rx-ref-row">
          <div>
            <div className="rx-title">Medical Prescription</div>
            <div className="rx-diagnosis">Diagnosis — {diagnosis}</div>
          </div>
          <div className="rx-ref-box">
            <div className="rx-ref-code">{reference.code}</div>
            <div className="rx-ref-date">Issued {reference.issuedDate}</div>
          </div>
        </div>

        <div className="rx-info-grid">
          <div className="rx-info-block">
            <div className="rx-info-kicker">Patient</div>
            <div className="rx-info-line">
              <span className="rx-info-line-label">Name</span>
              <span className="rx-info-line-value">{patient.name}</span>
            </div>
            <div className="rx-info-line">
              <span className="rx-info-line-label">Age / Sex</span>
              <span className="rx-info-line-value">
                {patient.age} yrs / {patient.sex}
              </span>
            </div>
          </div>
          <div className="rx-info-block">
            <div className="rx-info-kicker">Physician</div>
            <div className="rx-doctor-name">{physician.name}</div>
            <div className="rx-doctor-spec">{physician.specialization}</div>
            <div className="rx-info-line">
              <span className="rx-info-line-label">Reg. No.</span>
              <span className="rx-info-line-value">{physician.regNo}</span>
            </div>
          </div>
        </div>

        <div className="rx-med-section">
          <div className="rx-symbol">℞</div>
          <table className="rx-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>No.</th>
                <th>Medicine</th>
                <th>Frequency</th>
                <th>Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <div className="rx-med-name">{med.name}</div>
                    <div className="rx-med-sub">{med.dosage}</div>
                  </td>
                  <td>{med.frequency}</td>
                  <td>{med.duration}</td>
                  <td>{med.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rx-notes">
          <div>
            <b>Instructions:</b> {instructions}
          </div>
          <div>
            <b>Follow-up date:</b> {followUpDate}
          </div>
        </div>

        <div className="rx-sign-row">
          <div className="rx-seal">
            <div className="rx-seal-cross">℞</div>
            <div className="rx-seal-text">Verified</div>
          </div>
          <div className="rx-sign-block">
            <div className="rx-sign-line"></div>
            <div className="rx-sign-label">Physician's signature</div>
          </div>
        </div>

        <div className="rx-footer">
          <img
            className={`rx-footer-logo${footerLogoMono ? " rx-footer-logo--mono" : ""}`}
            src={footerLogoUrl || clinic.logoUrl}
            alt={clinic.logoAlt}
          />
          <div className="rx-footer-item">{footerNote}</div>
        </div>
      </div>
    </div>
  );
}

// Named export for backward compatibility
export const PrescriptionSlip = RxSlip;

// ── PDF download utility ──────────────────────────────────────────────────────

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

  pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
  pdf.save(filename);
}
