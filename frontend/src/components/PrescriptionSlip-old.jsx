/**
 * PrescriptionSlip — letterhead-style prescription component.
 * Used in MyRecords.jsx (patient view) and DoctorPatients.jsx (doctor view).
 *
 * Props:
 *   rx      — prescription object
 *   patient — { name, mobile, dob, gender }
 *   doctor  — { name } (optional; falls back to rx.doctorId.name)
 *   slipRef — ref forwarded to root div for PDF capture
 */

import logoFull   from "../assets/Logo.png";
import logoIcon   from "../assets/single-logo.png";

const PRIMARY = "#0d47a1";
const ACCENT  = "#1565c0";
const LIGHT   = "#e8f0fe";

const COMPANY = {
  tagline: "Global Health Passport",
  phone:   "+1 (302) 303-9993",
  email:   "support@humancareconnect.co",
  address: "4 Peddlers Row #1091 Newark, DE 19702, United States",
};

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

// ── Sub-components ────────────────────────────────────────────────────────────

function PatientField({ label, value, style = {} }) {
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
        {value || " "}
      </span>
    </div>
  );
}

const ThCell = ({ children, w }) => (
  <th style={{
    border: `1px solid ${ACCENT}`,
    padding: "9px 12px",
    fontSize: 12, fontWeight: 700,
    color: "#fff",
    background: ACCENT,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: w,
  }}>
    {children}
  </th>
);

const TdCell = ({ children, center = false }) => (
  <td style={{
    border: "1px solid #c5d5f0",
    padding: "10px 12px",
    fontSize: 13,
    color: "#1a1a2e",
    verticalAlign: "top",
    textAlign: center ? "center" : "left",
    background: "#fff",
  }}>
    {children ?? <span style={{ color: "#ccc" }}>—</span>}
  </td>
);

// Static QR-like SVG
function QRCode() {
  const D = PRIMARY;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ display: "block", flexShrink: 0 }}>
      <rect width="64" height="64" fill="#fff" rx="4"/>
      {/* top-left finder */}
      <rect x="2"  y="2"  width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="8"  y="8"  width="10" height="10" rx="1" fill={D}/>
      {/* top-right finder */}
      <rect x="40" y="2"  width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="46" y="8"  width="10" height="10" rx="1" fill={D}/>
      {/* bottom-left finder */}
      <rect x="2"  y="40" width="22" height="22" rx="2" fill="none" stroke={D} strokeWidth="2.5"/>
      <rect x="8"  y="46" width="10" height="10" rx="1" fill={D}/>
      {/* data dots */}
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

// ── Main Component ────────────────────────────────────────────────────────────

export function PrescriptionSlip({ rx, patient, doctor, slipRef }) {
  const age    = calcAge(patient?.dob);
  const ageSex = [age ? `${age} yrs` : "", patient?.gender].filter(Boolean).join(" / ");
  const shortId = rx?._id ? `HC-${String(rx._id).slice(-8).toUpperCase()}` : "—";
  const meds = rx?.medicines || [];

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
      {/* ── Top accent bar ─────────────────────────────────────────── */}
      <div style={{ height: 7, background: `linear-gradient(90deg, ${PRIMARY} 0%, #42a5f5 100%)` }} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px 16px",
        borderBottom: `2px solid ${LIGHT}`,
        background: "#fff",
      }}>
        {/* Logo */}
        <img
          src={logoFull}
          alt="HumanCare Connect"
          style={{ height: 54, objectFit: "contain", display: "block" }}
          crossOrigin="anonymous"
        />

        {/* Right side info */}
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

      {/* ── Rx banner ──────────────────────────────────────────────── */}
      <div style={{
        background: LIGHT, padding: "10px 40px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid #c5d5f0`,
      }}>
        {/* <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: PRIMARY,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, fontStyle: "italic", lineHeight: 1 }}>Rx</span>
        </div> */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Medical Prescription</div>
          {rx?.diagnosis && (
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
              <strong>Diagnosis:</strong> {rx.diagnosis}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: PRIMARY }}>{shortId}</div>
          <div>{fmtDate(rx?.createdAt)}</div>
        </div>
      </div>

      {/* ── Patient Info ────────────────────────────────────────────── */}
      <div style={{ padding: "20px 40px 16px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 48px",
        }}>
          <PatientField label="Name"      value={patient?.name} />
          <PatientField label="Date"      value={fmtDate(rx?.createdAt)} />
          <PatientField label="Age / Sex" value={ageSex} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: "0 40px", height: 1, background: `linear-gradient(90deg, ${ACCENT}, transparent)` }} />

      {/* ── Medicines Table ─────────────────────────────────────────── */}
      <div style={{ padding: "18px 40px 0" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          border: `1.5px solid ${ACCENT}`,
          borderRadius: 8, overflow: "hidden",
        }}>
          <thead>
            <tr>
              <ThCell w="52">Sr.No</ThCell>
              <ThCell>Medicine Name</ThCell>
              <ThCell w="130">Frequency</ThCell>
              <ThCell w="110">Duration</ThCell>
              <ThCell w="140">Notes</ThCell>
            </tr>
          </thead>
          <tbody>
            {meds.map((m, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f8ff" }}>
                <TdCell center>{i + 1}</TdCell>
                <TdCell>
                  <strong>{m.name}</strong>
                  {m.dosage && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.dosage}</div>
                  )}
                </TdCell>
                <TdCell>{m.frequency}</TdCell>
                <TdCell>{m.duration}</TdCell>
                <TdCell>{m.notes}</TdCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Extra Info ─────────────────────────────────────────────── */}
      {(rx?.instructions || rx?.followUpDate) && (
        <div style={{
          margin: "16px 40px 0",
          background: "#f8faff",
          border: `1px solid ${LIGHT}`,
          borderRadius: 8,
          padding: "12px 16px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {rx.instructions && (
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: PRIMARY }}>Instructions: </strong>{rx.instructions}
            </div>
          )}
          {rx.followUpDate && (
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: PRIMARY }}>Follow-up Date: </strong>{fmtDate(rx.followUpDate)}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 32,
        background: LIGHT,
        borderTop: `2px solid ${ACCENT}`,
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <QRCode />

        {/* Contact */}
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

        {/* Icon logo (right side) */}
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

// ── PDF download utility ──────────────────────────────────────────────────────

export async function downloadPrescriptionPDF(element, filename = "prescription.pdf") {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas  = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW   = pdf.internal.pageSize.getWidth();
  const pdfH   = (canvas.height * pdfW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.97);

  pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
  pdf.save(filename);
}
