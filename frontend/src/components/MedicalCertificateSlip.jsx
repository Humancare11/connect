/**
 * MedicalCertificateSlip — letterhead-style certificate component.
 * Mirrors PrescriptionSlip exactly: same logo, same header, same footer,
 * same color scheme, same QR code, same 794 px A4 width.
 *
 * Props:
 *   cert             — certificate object
 *   patient          — { name, dob, gender }
 *   doctor           — { name } from auth context (optional; falls back to cert.doctorId.name)
 *   doctorEnrollment — { specialization, qualification, clinicName, clinicAddress,
 *                        medicalRegistrationNumber, medicalCouncilName } (optional)
 *   slipRef          — ref forwarded to root div for PDF capture
 */

import logoFull from "../assets/Logo.png";
import logoIcon from "../assets/single-logo.png";

/* ── Shared design tokens (identical to PrescriptionSlip) ─────────────────── */
const PRIMARY = "#0d47a1";
const ACCENT  = "#1565c0";
const LIGHT   = "#e8f0fe";

const COMPANY = {
  tagline: "Global Health Passport",
  phone:   "+1 (302) 303-9993",
  email:   "support@humancareconnect.co",
  address: "4 Peddlers Row #1091 Newark, DE 19702, United States",
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function calcAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "";
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function fmtDate(d) {
  if (!d) return "—";
  const p = new Date(d);
  if (isNaN(p)) return d;
  return p.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Sub-components (same as PrescriptionSlip) ───────────────────────────── */
function InfoField({ label, value, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, ...style }}>
      <span style={{
        fontSize: 12, fontWeight: 700, color: PRIMARY,
        whiteSpace: "nowrap", letterSpacing: 0.3,
      }}>
        {label} :
      </span>
      <span style={{
        flex: 1, fontSize: 13, color: "#1a1a2e",
        borderBottom: "1.2px solid #b0c4de",
        paddingBottom: 2, minWidth: 80,
      }}>
        {value || " "}
      </span>
    </div>
  );
}

/* Exact copy of QRCode from PrescriptionSlip */
function QRCode() {
  const D = PRIMARY;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ display: "block", flexShrink: 0 }}>
      <rect width="64" height="64" fill="#fff" rx="4"/>
      <rect x="2"  y="2"  width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="8"  y="8"  width="10" height="10" rx="1" fill={D}/>
      <rect x="40" y="2"  width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="46" y="8"  width="10" height="10" rx="1" fill={D}/>
      <rect x="2"  y="40" width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="8"  y="46" width="10" height="10" rx="1" fill={D}/>
      {[
        [28,4],[32,4],[36,4],[28,8],[36,8],[32,12],[28,16],[36,16],[32,20],
        [4,28],[8,28],[12,28],[4,32],[12,32],[8,36],[4,36],[12,36],[8,40],
        [28,28],[32,28],[36,28],[40,28],[44,28],[48,28],[52,28],[56,28],
        [28,32],[36,32],[44,32],[52,32],[28,36],[32,36],[40,36],[48,36],[56,36],
        [28,40],[36,40],[44,40],[52,40],[28,44],[32,44],[40,44],[48,44],[56,44],
        [28,48],[36,48],[44,48],[52,48],[28,52],[32,52],[40,52],[48,52],[56,52],
        [28,56],[36,56],[44,56],[52,56],[28,60],[36,60],[44,60],[52,60],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="3.5" height="3.5" rx="0.5" fill={D}/>
      ))}
    </svg>
  );
}

/* ── Section label used inside the certificate body ─────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: ACCENT,
      textTransform: "uppercase", letterSpacing: 1.2,
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export function MedicalCertificateSlip({ cert, patient, doctor, doctorEnrollment, slipRef }) {
  const age    = calcAge(patient?.dob);
  const ageSex = [age ? `${age} yrs` : "", patient?.gender].filter(Boolean).join(" / ");
  const certId = cert?._id ? `HC-CERT-${String(cert._id).slice(-8).toUpperCase()}` : "—";

  /* Resolve doctor info — prefer passed prop, fall back to embedded cert data */
  const doctorName    = doctor?.name || cert?.doctorId?.name || "—";
  const enrollment    = doctorEnrollment || cert?.doctorEnrollment || {};
  const specialty     = enrollment.specialization || "";
  const qualification = enrollment.qualification  || "";
  const regNumber     = enrollment.medicalRegistrationNumber || "";
  const councilName   = enrollment.medicalCouncilName || "";
  const clinicName    = enrollment.clinicName    || "Humancare Connect";
  const clinicAddress = enrollment.clinicAddress || COMPANY.address;

  const hasRestPeriod = cert?.restFromDate || cert?.restToDate;

  return (
    <div
      ref={slipRef}
      style={{
        width: 794,
        background: "#fff",
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        boxSizing: "border-box",
        color: "#1a1a2e",
      }}
    >
      {/* ── Top accent bar — identical to PrescriptionSlip ─────────── */}
      <div style={{ height: 7, background: `linear-gradient(90deg, ${PRIMARY} 0%, #42a5f5 100%)` }} />

      {/* ── Header — identical to PrescriptionSlip ─────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px 16px",
        borderBottom: `2px solid ${LIGHT}`,
        background: "#fff",
      }}>
        <img
          src={logoFull}
          alt="HumanCare Connect"
          style={{ height: 54, objectFit: "contain", display: "block" }}
          crossOrigin="anonymous"
        />
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: ACCENT,
            letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4,
          }}>
            {COMPANY.tagline}
          </div>
          <div style={{
            width: 48, height: 4, borderRadius: 2,
            background: `linear-gradient(90deg, ${ACCENT}, #42a5f5)`,
            marginLeft: "auto",
          }} />
        </div>
      </div>

      {/* ── Document type banner — mirrors Rx banner style ─────────── */}
      <div style={{
        background: LIGHT, padding: "10px 40px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid #c5d5f0`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Medical Certificate</div>
          {cert?.diagnosis && (
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
              <strong>Reason:</strong> {cert.diagnosis}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: PRIMARY }}>{certId}</div>
          <div>Issued: {fmtDate(cert?.issuedDate || cert?.createdAt)}</div>
        </div>
      </div>

      {/* ── Patient Info — same grid layout as PrescriptionSlip ─────── */}
      <div style={{ padding: "20px 40px 16px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 48px",
        }}>
          <InfoField label="Patient Name" value={patient?.name} />
          <InfoField label="Date of Issue" value={fmtDate(cert?.issuedDate || cert?.createdAt)} />
          <InfoField label="Age / Sex"    value={ageSex} />
          {patient?.dob && (
            <InfoField label="Date of Birth" value={fmtDate(patient.dob)} />
          )}
        </div>
      </div>

      {/* Divider — identical to PrescriptionSlip */}
      <div style={{ margin: "0 40px", height: 1, background: `linear-gradient(90deg, ${ACCENT}, transparent)` }} />

      {/* ── Certificate Body ────────────────────────────────────────── */}
      <div style={{ padding: "18px 40px 0" }}>

        {/* "This is to certify" statement */}
        <div style={{
          background: "#f8faff",
          border: `1.5px solid ${LIGHT}`,
          borderLeft: `4px solid ${ACCENT}`,
          borderRadius: 6,
          padding: "14px 18px",
          marginBottom: 16,
          fontSize: 13,
          color: "#1a1a2e",
          lineHeight: 1.7,
        }}>
          This is to certify that{" "}
          <strong style={{ color: PRIMARY }}>{patient?.name || "the patient"}</strong>
          {ageSex ? `, ${ageSex},` : ","}{" "}
          has been examined and is suffering from{" "}
          <strong>{cert?.diagnosis || "—"}</strong>.
        </div>

        {/* Details table */}
        <table style={{
          width: "100%", borderCollapse: "collapse",
          border: `1.5px solid ${ACCENT}`,
          borderRadius: 8, overflow: "hidden",
          marginBottom: 0,
        }}>
          <thead>
            <tr>
              <th style={{
                border: `1px solid ${ACCENT}`,
                padding: "9px 12px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                background: ACCENT, textAlign: "left",
                textTransform: "uppercase", letterSpacing: 0.5,
                width: "30%",
              }}>Field</th>
              <th style={{
                border: `1px solid ${ACCENT}`,
                padding: "9px 12px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                background: ACCENT, textAlign: "left",
                textTransform: "uppercase", letterSpacing: 0.5,
              }}>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#fff" }}>
              <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: PRIMARY, verticalAlign: "top" }}>
                Diagnosis / Condition
              </td>
              <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 13, color: "#1a1a2e", verticalAlign: "top", background: "#fff" }}>
                {cert?.diagnosis || "—"}
              </td>
            </tr>

            {cert?.recommendation && (
              <tr style={{ background: "#f5f8ff" }}>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: PRIMARY, verticalAlign: "top" }}>
                  Recommendation
                </td>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 13, color: "#1a1a2e", verticalAlign: "top" }}>
                  {cert.recommendation}
                </td>
              </tr>
            )}

            {hasRestPeriod && (
              <tr style={{ background: cert?.recommendation ? "#fff" : "#f5f8ff" }}>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: PRIMARY, verticalAlign: "top" }}>
                  Rest Period
                </td>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 13, color: "#1a1a2e", verticalAlign: "top" }}>
                  {cert.restFromDate && cert.restToDate
                    ? `${fmtDate(cert.restFromDate)} to ${fmtDate(cert.restToDate)}`
                    : cert.restFromDate
                      ? `From ${fmtDate(cert.restFromDate)}`
                      : `Until ${fmtDate(cert.restToDate)}`}
                </td>
              </tr>
            )}

            {cert?.notes && (
              <tr style={{ background: "#fff" }}>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: PRIMARY, verticalAlign: "top" }}>
                  Additional Notes
                </td>
                <td style={{ border: "1px solid #c5d5f0", padding: "10px 12px", fontSize: 13, color: "#1a1a2e", verticalAlign: "top" }}>
                  {cert.notes}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Doctor details + Signature — same card style as instructions block ── */}
      <div style={{
        margin: "16px 40px 0",
        border: `1px solid ${LIGHT}`,
        borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* Doctor header row */}
        <div style={{
          background: LIGHT,
          borderBottom: `1px solid #c5d5f0`,
          padding: "9px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: PRIMARY,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
              {doctorName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
              Dr. {doctorName}
            </div>
            {(specialty || qualification) && (
              <div style={{ fontSize: 11, color: "#475569" }}>
                {[specialty, qualification].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            {regNumber && (
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Reg. No: <strong style={{ color: PRIMARY }}>{regNumber}</strong>
              </div>
            )}
            {councilName && (
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{councilName}</div>
            )}
          </div>
        </div>

        {/* Clinic info + Signature row */}
        <div style={{
          background: "#f8faff",
          padding: "14px 16px",
          display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20,
        }}>
          {/* Clinic details */}
          <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.7 }}>
            {clinicName && (
              <div style={{ fontWeight: 600, color: "#1e3a5f", marginBottom: 2 }}>{clinicName}</div>
            )}
            {clinicAddress && (
              <div style={{ color: "#64748b" }}>{clinicAddress}</div>
            )}
          </div>

          {/* System-generated note */}
          <div style={{
            fontSize: 11, color: "#64748b", fontStyle: "italic",
            textAlign: "center", maxWidth: 220, lineHeight: 1.6,
          }}>
            This is a system-generated certificate and does not require a signature or stamp.
          </div>
        </div>
      </div>

      {/* ── Validity notice ────────────────────────────────────────── */}
      <div style={{
        margin: "10px 40px 0",
        padding: "7px 14px",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 6,
        fontSize: 11,
        color: "#92400e",
        lineHeight: 1.5,
      }}>
        <strong>Note:</strong> This certificate is issued based on the medical examination conducted via Humancare Connect telehealth platform. It is valid as an official medical document for the purpose stated above.
      </div>

      {/* ── Footer — identical to PrescriptionSlip ──────────────────── */}
      <div style={{
        marginTop: 10,
        background: LIGHT,
        borderTop: `2px solid ${ACCENT}`,
        padding: "12px 32px",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <QRCode />

        <div style={{
          flex: 1, display: "flex", flexDirection: "column", gap: 5,
          fontSize: 11, color: "#334155",
        }}>
          {[
            { icon: "📞", text: COMPANY.phone },
            { icon: "✉",  text: COMPANY.email },
            { icon: "📍", text: COMPANY.address },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
              <span style={{ color: "#1e3a5f" }}>{text}</span>
            </div>
          ))}
        </div>

        <img
          src={logoIcon}
          alt=""
          style={{ height: 52, objectFit: "contain", display: "block", flexShrink: 0, opacity: 0.9 }}
          crossOrigin="anonymous"
        />
      </div>
    </div>
  );
}

/* ── PDF download utility — identical pattern to downloadPrescriptionPDF ──── */
export async function downloadCertificatePDF(element, filename = "medical-certificate.pdf") {
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

  const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const pdfH    = (canvas.height * pdfW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.97);

  pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
  pdf.save(filename);
}
