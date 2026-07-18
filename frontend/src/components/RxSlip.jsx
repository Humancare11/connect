import React from "react";

/**
 * RxSlip — coded (HTML/CSS) recreation of the Canva "E - prescription" template.
 *
 * WHY THIS VERSION INSTEAD OF AN IMAGE OVERLAY:
 * The image-overlay approach pins each field to a fixed pixel position on a flat
 * PNG. That works only while the medicine list is short — add a 10th or 15th
 * medicine and it runs off the bottom of the image with nowhere to go.
 *
 * This version uses a real HTML <table> for the medicine list, exactly like a
 * Word document table. It has no fixed height — every extra medicine just adds
 * another <tr>, and the whole slip (and PDF) grows to fit. Nothing is ever cut
 * off, and there's no fine-tuning of pixel coordinates.
 *
 * HOW TO USE:
 *   <RxSlip
 *     clinicLogoUrl={yourLogoUrl}      // swap your real logo in
 *     footerLogoUrl={yourFooterLogoUrl} // optional — defaults to clinicLogoUrl
 *     qrCodeUrl={yourRealQrUrl}         // your real QR image — never regenerated
 *     rx={rxDataFromYourBackend}
 *     doctor={doctorDataFromYourBackend}
 *   />
 *
 * Pass however many medicines you want in rx.medicines — 1 or 50, it just works.
 */

const NAVY = "#12296b";
const ACCENT = "#4a9fe0";
const BORDER = "#1a1a1a";

const styles = `
.rx-slip-wrapper {
  margin: 0;
  padding: 24px;
  background: #eef0ec;
  font-family: "Inter", sans-serif;
}
.rx-slip {
  width: 800px;
  max-width: 100%;
  background: #ffffff;
  color: #111;
  margin: 0 auto;
}

/* Header */
.rx-header {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 20px 40px 10px;
}
.rx-logo { display: block; max-height: 64px; width: auto; }

.rx-divider-row { display: flex; align-items: center; }
.rx-divider-thick { height: 4px; background: ${NAVY}; width: 62%; }
.rx-divider-thin { height: 2px; background: ${ACCENT}; flex: 1; }

/* Title row */
.rx-title-row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  position: relative;
  padding: 18px 40px 14px;
}
.rx-title { font-size: 20px; font-weight: 700; color: #111; }
.rx-date-inline { position: absolute; right: 40px; top: 18px; font-size: 13px; }

/* Patient table */
.rx-patient-table {
  width: calc(100% - 80px);
  margin: 0 40px 20px;
  border-collapse: collapse;
  font-size: 13px;
}
.rx-patient-table td { border: 1.5px solid ${BORDER}; padding: 9px 12px; }
.rx-label { font-weight: 500; white-space: nowrap; }

/* Medications */
.rx-med-heading { margin: 0 40px 2px; font-size: 16px; font-weight: 700; }
.rx-symbol { margin: 0 40px 6px; font-size: 18px; font-style: italic; }

table.rx-med-table {
  width: calc(100% - 80px);
  margin: 0 40px 20px;
  border-collapse: collapse;
  font-size: 12.5px;
}
table.rx-med-table th,
table.rx-med-table td {
  border: 1.5px solid ${BORDER};
  padding: 9px;
  text-align: center;
  vertical-align: top;
}
table.rx-med-table th { font-weight: 700; }
table.rx-med-table td.rx-med-name-cell { text-align: left; }
/* Rows have a comfortable minimum height but GROW if content wraps —
   this is the key difference vs. the image-overlay version. */
table.rx-med-table tbody tr { min-height: 46px; }

/* Advice / Allergy */
.rx-field-row { margin: 0 40px 14px; font-size: 14px; font-weight: 700; }
.rx-field-row .value { font-weight: 400; margin-left: 8px; }

/* Physician ribbon */
.rx-ribbon-wrap { margin: 18px 40px 0; }
.rx-ribbon {
  display: inline-block;
  border: 1.5px solid ${BORDER};
  padding: 7px 36px 7px 20px;
  font-weight: 700;
  font-size: 14px;
  clip-path: polygon(0 0, 100% 0, 90% 100%, 0 100%);
}
.rx-ribbon-underline { height: 2px; background: ${NAVY}; margin: -1.5px 40px 0; }

.rx-physician-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
  margin: 20px 40px 0;
  font-size: 13px;
}
.rx-physician-grid .rx-label { font-weight: 700; }

/* Footer */
.rx-footer-dividers { margin-top: 24px; }
.rx-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 40px 24px;
  gap: 16px;
}
.rx-qr { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
.rx-contact-lines { font-size: 11.5px; line-height: 1.8; }
.rx-contact-lines div { display: flex; align-items: center; gap: 6px; }
.rx-footer-logo { max-height: 36px; width: auto; flex-shrink: 0; }
`;

export default function RxSlip({
  slipRef,
  rx,
  doctor,

  // ── swap these three in your app, no code changes needed ──
  clinicLogoUrl,          // required: your real clinic logo
  footerLogoUrl = null,   // optional: defaults to clinicLogoUrl
  qrCodeUrl,               // required: your real, functional QR image

  // fallback props (used only if rx/doctor aren't passed)
  date = "18 Jul 2026",
  patient = { name: "", gender: "", dob: "", age: "" },
  medicines = [],
  advice = "",
  allergy = "",
  physician = { name: "", regNo: "", specialization: "", country: "United States" },
  clinicPhone = "+1 (302) 303-9993",
  clinicEmail = "support@humancareconnect.co",
  clinicAddress = "4 Peddlers Row #1091 Newark, DE 19702, United States",
}) {
  // Resolve patient details — prefers real backend data (rx), falls back to props
  const pName = rx?.patientId?.name || patient?.name || "";
  const pGender = rx?.patientId?.gender || patient?.gender || "";
  const pDob = rx?.patientId?.dob || patient?.dob || "";
  const pAge = rx?.patientId?.age || patient?.age || "";

  // Resolve medicines — THIS ARRAY CAN BE ANY LENGTH, table grows automatically
  const medicinesList = rx?.medicines
    ? rx.medicines.map((m) => ({
      name: m.name || "",
      dose: `${m.dosage || ""} ${m.frequency || ""}`.trim(),
      days: m.duration || "",
    }))
    : medicines;

  const formattedDate = rx?.createdAt
    ? new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : date;
  const adviceText = rx?.instructions || advice || "";
  const allergyText = rx?.allergy || allergy || "";

  const phyName = doctor?.name || rx?.doctorId?.name || physician?.name || "";
  const phyRegNo = doctor?.regNo || rx?.doctorId?.regNo || physician?.regNo || "";
  const phySpecialization = doctor?.specialization || rx?.doctorId?.specialization || physician?.specialization || "";
  const phyCountry = doctor?.country || rx?.doctorId?.country || physician?.country || "United States";

  return (
    <div className="rx-slip-wrapper">
      <style>{styles}</style>
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

        {/* Patient table */}
        <table className="rx-patient-table">
          <tbody>
            <tr>
              <td className="rx-label" style={{ width: "30%" }}>Patient Name :</td>
              <td>{pName}</td>
            </tr>
            <tr>
              <td className="rx-label">Gender : {pGender}</td>
              <td className="rx-label">DOB : {pDob}</td>
              <td className="rx-label">Age: {pAge}</td>
            </tr>
          </tbody>
        </table>

        {/* Medications — table grows with as many rows as needed */}
        <div className="rx-med-heading">Medications</div>
        <div className="rx-symbol">Rx</div>
        <table className="rx-med-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Sr. No</th>
              <th>Medicine</th>
              <th style={{ width: 90 }}>Dose</th>
              <th style={{ width: 100 }}>No. of Days</th>
            </tr>
          </thead>
          <tbody>
            {medicinesList.length > 0 ? (
              medicinesList.map((med, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td className="rx-med-name-cell">{med.name}</td>
                  <td>{med.dose}</td>
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
              </tr>
            )}
          </tbody>
        </table>

        {/* Advice / Allergy */}
        <div className="rx-field-row">Advice : <span className="value">{adviceText}</span></div>
        <div className="rx-field-row">Allergy : <span className="value">{allergyText}</span></div>

        {/* Physician ribbon */}
        <div className="rx-ribbon-wrap">
          <div className="rx-ribbon">PHYSICIAN DETAILS</div>
        </div>
        <div className="rx-ribbon-underline" />

        <div className="rx-physician-grid">
          <div><span className="rx-label">Doctor's Name:</span> {phyName}</div>
          <div><span className="rx-label">Medical Reg No :</span> {phyRegNo}</div>
          <div><span className="rx-label">Speciality:</span> {phySpecialization}</div>
          <div><span className="rx-label">Date :</span> {formattedDate}</div>
          <div><span className="rx-label">Country :</span> {phyCountry}</div>
        </div>

        {/* Footer */}
        <div className="rx-footer-dividers">
          <div className="rx-divider-row">
            <div className="rx-divider-thin" />
            <div className="rx-divider-thick" />
          </div>
        </div>
        <div className="rx-footer">
          <img className="rx-qr" src={qrCodeUrl} alt="Prescription verification QR" />
          <div className="rx-contact-lines">
            <div>📞 {clinicPhone}</div>
            <div>✉️ {clinicEmail}</div>
            <div>📍 {clinicAddress}</div>
          </div>
          <img className="rx-footer-logo" src={footerLogoUrl || clinicLogoUrl} alt="Clinic logo" />
        </div>
      </div>
    </div>
  );
}

export const PrescriptionSlip = RxSlip;

// ── PDF download utility — unchanged from your original ──
export async function downloadPrescriptionPDF(element, filename = "prescription.pdf") {
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